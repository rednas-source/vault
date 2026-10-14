'use strict';
const express=require('express'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createStore,createExperiment,instrument,key,number,fail,atomic,valuation,mark,execute}=require('./economy-store');
const {createMarket}=require('./economy-market');
const {roles,discuss,consensus}=require('./economy-agents');
function economyRoutes({root,auth,config={},fetcher=fetch,clock=Date.now}){
 const router=express.Router(),directory=path.join(root,'.economy'),store=createStore(directory),settingsFile=path.join(directory,'settings.json'),busy=new Map(),limits=new Map();store.recover();
 let saved={};try{saved=JSON.parse(fs.readFileSync(settingsFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 function settings(){return {twelveDataApiKey:process.env.TWELVE_DATA_API_KEY||saved.twelveDataApiKey||config.twelveDataApiKey||'',openaiApiKey:process.env.OPENAI_API_KEY||saved.openaiApiKey||config.openaiApiKey||'',models:Object.fromEntries(roles.map(r=>[r.id,saved.models?.[r.id]||config.economyModels?.[r.id]||config.economyModel||'gpt-4.1-mini'])),dailyRounds:Math.min(50,Math.max(1,Number(config.economyDailyRounds)||10))};}
 const market=createMarket(settings,fetcher,clock);
 function status(){const s=settings();return {stocks:!!s.twelveDataApiKey,agents:!!s.openaiApiKey,models:s.models,dailyRounds:s.dailyRounds,stockKeyFromEnvironment:!!process.env.TWELVE_DATA_API_KEY,agentKeyFromEnvironment:!!process.env.OPENAI_API_KEY,paperOnly:true};}
 function experiment(data,id){const e=data.experiments.find(e=>e.id===id);if(!e)throw Object.assign(new Error('Experiment not found.'),{status:404});return e;}
 const route=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){res.status(e.status||502).json({error:e.status?e.message:'The operation could not complete. Check provider setup and try again.'});}};
 const providerError=e=>Object.assign(new Error(e.message),{status:e.status||502});
 router.use(auth,(req,res,next)=>{res.set('Cache-Control','no-store');const now=clock(),l=(limits.get(req.user.name)||[]).filter(t=>now-t<60000);if(l.length>=150)return res.status(429).json({error:'Too many requests. Wait a minute.'});l.push(now);limits.set(req.user.name,l);next();});
 router.get('/',route((req,res)=>{const d=store.read(req.user.name);res.json({settings:status(),watchlist:d.watchlist,experiments:d.experiments.map(e=>({...e,summary:valuation(e)})),usage:d.usage,roles,seeds:market.seeds,demo:market.demo});}));
 router.put('/settings',route((req,res)=>{
  if(req.user.role!=='admin')return res.status(403).json({error:'Only an administrator can configure providers.'});
  const next={...saved};for(const field of ['twelveDataApiKey','openaiApiKey'])if(req.body[field]){if(typeof req.body[field]!=='string'||req.body[field].length>512||/\s/.test(req.body[field]))fail('Enter a valid provider key.');next[field]=req.body[field];}
  if(req.body.models){next.models={};for(const role of roles){const m=req.body.models[role.id];if(typeof m!=='string'||!/^[-a-zA-Z0-9_.:]{1,100}$/.test(m))fail('Choose valid model IDs for all four roles.');next.models[role.id]=m;}}
  atomic(settingsFile,next);saved=next;market.clear();res.json(status());
 }));
 router.post('/connection-test',route(async(req,res)=>{if(req.user.role!=='admin')return res.status(403).json({error:'Admins only.'});try{if(req.body.provider==='stocks'){await market.quote(market.seeds[0]);res.json({ok:true,message:'Stock quote received. Other exchanges depend on your plan.'});}else if(req.body.provider==='agents'){const s=settings();if(!s.openaiApiKey)fail('Add an OpenAI key first.');const response=await fetcher('https://api.openai.com/v1/models',{headers:{Authorization:'Bearer '+s.openaiApiKey},signal:AbortSignal.timeout(15000)});if(!response.ok)fail('OpenAI could not authenticate this key.');const data=await response.json(),ids=new Set((data.data||[]).map(v=>v.id)),missing=[...new Set(Object.values(s.models))].filter(m=>!ids.has(m));res.json({ok:!missing.length,message:missing.length?'Key works; model IDs not listed: '+missing.join(', '):'Key and model IDs are available. No generation was billed by this test.'});}else fail('Choose a provider.');}catch(e){throw providerError(e);}}));
 router.get('/search',route(async(req,res)=>{try{res.json(await market.search(req.query.q));}catch(e){throw providerError(e);}}));
 router.post('/market',route(async(req,res)=>{const i=instrument(req.body.instrument);try{const quote=await market.quote(i);let history=[],historyError='';if(req.body.history)try{history=await market.history(i);}catch(e){historyError=e.message;}res.json({quote,history,historyError});}catch(e){throw providerError(e);}}));
 router.put('/watchlist',route((req,res)=>{if(!Array.isArray(req.body.instruments)||req.body.instruments.length>30)fail('Keep up to 30 watchlist instruments.');const d=store.read(req.user.name);d.watchlist=[...new Map(req.body.instruments.map(i=>{const v=instrument(i);return [key(v),v];})).values()];store.write(req.user.name,d);res.json(d.watchlist);}));
 router.post('/experiments',route((req,res)=>{const d=store.read(req.user.name);if(d.experiments.length>=20)fail('Keep up to 20 experiments.');const e=createExperiment(req.body);if(req.body.benchmark){const b=instrument(req.body.benchmark);if(b.currency!==e.currency||(b.provider==='demo')!==(e.mode==='demo'))fail('Benchmark must match experiment currency and data mode.');e.benchmark={instrument:b,start:null,last:null};}d.experiments.push(e);store.write(req.user.name,d);res.status(201).json(e);}));
 router.patch('/experiments/:id',route((req,res)=>{const d=store.read(req.user.name),e=experiment(d,req.params.id);if(typeof req.body.paused!=='boolean')fail('Choose pause or resume.');e.paused=req.body.paused;store.write(req.user.name,d);res.json(e);}));
 async function fresh(e,extra){const all=[...e.positions.map(p=>p.instrument),...(e.benchmark?[e.benchmark.instrument]:[]),...(extra?[extra]:[])],unique=[...new Map(all.map(i=>[key(i),i])).values()],quotes=[];for(const i of unique)quotes.push(await market.quote(i));return quotes;}
 router.post('/experiments/:id/refresh',route(async(req,res)=>{const user=req.user.name;if(busy.has(user))fail('Wait for the current decision to finish.');busy.set(user,true);try{const e=experiment(store.read(user),req.params.id);const quotes=await fresh(e);const d=store.read(user),current=experiment(d,e.id);mark(current,quotes,clock());store.write(user,d);res.json({...current,summary:valuation(current)});}catch(e){throw providerError(e);}finally{busy.delete(user);}}));
 router.post('/experiments/:id/orders',route(async(req,res)=>{const user=req.user.name;if(busy.has(user))fail('Wait for the current decision to finish.');busy.set(user,true);try{const d=store.read(user),e=experiment(d,req.params.id);const old=e.orders.find(o=>o.clientId===req.body.clientId);if(old)return res.json(old);const i=instrument(req.body.instrument),quotes=await fresh(e,i);mark(e,quotes,clock());const latest=store.read(user),current=experiment(latest,e.id);if(current.paused)fail('Experiment is paused.');const order=execute(e,{side:req.body.side,quantity:req.body.quantity,clientId:req.body.clientId},quotes.find(q=>key(q.instrument)===key(i)),clock());mark(e,quotes,clock());latest.experiments[latest.experiments.findIndex(v=>v.id===e.id)]=e;store.write(user,latest);res.status(201).json(order);}catch(e){throw providerError(e);}finally{busy.delete(user);}}));
 function updateRound(user,id,roundId,change){const d=store.read(user),e=experiment(d,id),r=e.rounds.find(r=>r.id===roundId);change(r,e,d);store.write(user,d);}
 async function run(user,id,roundId,i){
  try{
   let d=store.read(user),e=experiment(d,id);const quotes=await fresh(e,i),history=await market.history(i),quote=quotes.find(q=>key(q.instrument)===key(i));mark(e,quotes,clock());
   updateRound(user,id,roundId,(r,current)=>{current.positions=e.positions;current.snapshots=e.snapshots;current.benchmark=e.benchmark;r.quote=quote;r.history=history;});
   const context={instrument:i,quote,history,portfolio:valuation(e),positions:e.positions,rules:e.rules,horizon:e.horizon,mode:e.mode},messages=[];
   for(const role of roles){if(experiment(store.read(user),id).paused)throw Error('Experiment was paused. No decision was executed.');const result=await discuss(role,context,messages,settings(),fetcher);messages.push(result);updateRound(user,id,roundId,r=>r.messages.push(result));}
   const decision=consensus(messages);d=store.read(user);e=experiment(d,id);const r=e.rounds.find(r=>r.id===roundId);r.decision=decision;
   if(e.paused)throw Error('Experiment was paused. No decision was executed.');
   if(decision.side==='hold'){r.status='held';r.result='No trade: the panel held or did not reach approval.';}
   else{
    const currentQuotes=await fresh(e,i);d=store.read(user);e=experiment(d,id);const finalRound=e.rounds.find(v=>v.id===roundId);finalRound.decision=decision;mark(e,currentQuotes,clock());
    try{const order=execute(e,{...decision,clientId:roundId,actor:'agents',roundId},currentQuotes.find(q=>key(q.instrument)===key(i)),clock());finalRound.status='executed';finalRound.orderId=order.id;finalRound.result='Paper order filled after all four reviews and server risk checks.';mark(e,currentQuotes,clock());}catch(err){finalRound.status='blocked';finalRound.result=err.message;}
   }
   e.rounds.find(v=>v.id===roundId).finished=clock();store.write(user,d);
  }catch(err){updateRound(user,id,roundId,r=>{r.status='failed';r.error=String(err.message).slice(0,500);r.finished=clock();});}finally{busy.delete(user);}
 }
 router.post('/experiments/:id/rounds',route((req,res)=>{
  const user=req.user.name;if(busy.has(user))fail('A decision is already running for your account.');const s=settings();if(!s.openaiApiKey)fail('Connect OpenAI in Setup before running agents.');
  const d=store.read(user),e=experiment(d,req.params.id),i=instrument(req.body.instrument);if(e.paused)fail('Resume this experiment first.');if(i.currency!==e.currency||(i.provider==='demo')!==(e.mode==='demo'))fail('Choose an instrument matching this experiment.');
  const day=new Date(clock()).toISOString().slice(0,10);if(d.usage.day!==day)d.usage={day,count:0};if(d.usage.count>=s.dailyRounds)fail('Daily agent-round limit reached. Try tomorrow.');if(e.rounds.length>=500)fail('Start a new experiment after 500 rounds.');
  const r={id:crypto.randomUUID(),at:clock(),status:'running',instrument:i,messages:[],decision:null};d.usage.count++;e.rounds.push(r);store.write(user,d);busy.set(user,true);res.status(202).json(r);void run(user,e.id,r.id,i);
 }));
 router.get('/experiments/:id/export',route((req,res)=>{const e=experiment(store.read(req.user.name),req.params.id);res.set('Content-Disposition','attachment; filename="economy-experiment.json"');res.json({version:1,paperOnly:true,...e,summary:valuation(e)});}));
 return router;
}
module.exports={economyRoutes};
