'use strict';
const crypto=require('node:crypto');
const {key,instrument,number,fail,mark,execute,valuation}=require('./economy-store');
const {council,reserveCost}=require('./economy-council');
function mountResearch(router,{store,market,settings,busy,route,clock,fetcher,modelCatalogue,autoSchedule=true}){
 const find=(d,id)=>{const e=d.experiments.find(v=>v.id===id);if(!e)throw Object.assign(Error('Experiment not found.'),{status:404});return e;};
 function change(user,id,fn){const d=store.read(user),e=find(d,id);fn(e,d);store.write(user,d);return e;}
 const stopped=(user,id)=>{const e=find(store.read(user),id);return e.paused||(e.research?.endsAt&&clock()>=e.research.endsAt);};
 async function candidates(e,d){
  const s=e.research||{},scope=s.source==='catalogue'?await market.catalogue({exchange:s.exchange,country:s.country,currency:e.currency}):{items:d.watchlist.filter(i=>i.currency===e.currency&&(i.provider==='demo')===(e.mode==='demo'))};
  if(e.mode==='demo')scope.items=[market.demo];
  if(!scope.items.length)fail('No instruments in this universe. Add stocks to the watchlist or choose a covered exchange and currency.');
  const cursor=(s.cursor||0)%scope.items.length,batch=Array.from({length:Math.min(s.batchSize||2,scope.items.length)},(_,n)=>scope.items[(cursor+n)%scope.items.length]);
  return {items:[...new Map([...e.positions.map(p=>p.instrument),...batch].map(i=>[key(i),i])).values()],size:scope.items.length,next:(cursor+batch.length)%scope.items.length,scanned:batch.length};
 }
 async function run(user,id,roundId){let reservation=0;
  const update=fn=>change(user,id,(e,d)=>fn(e.rounds.find(r=>r.id===roundId),e,d));
  try{
   let d=store.read(user),e=find(d,id);const pool=await candidates(e,d),evidence=[],errors=[];
   update((r,current)=>{r.phase='Fetching market evidence';r.universeSize=pool.size;current.research.cursor=pool.next;current.research.scanned=(current.research.scanned||0)+pool.scanned;current.research.universeSize=pool.size;});
   for(const i of pool.items){if(stopped(user,id))throw Error('Experiment stopped.');try{if(i.provider==='twelve')await market.pace();if(stopped(user,id))throw Error('Experiment stopped.');const quote=await market.quote(i);if(i.provider==='twelve')await market.pace();const history=await market.history(i,e.horizon==='day'?'day':'1y');evidence.push({instrument:i,instrumentKey:key(i),quote,history});}catch(err){errors.push({symbol:i.symbol,error:err.message});}}
   if(!evidence.length)throw Error(errors[0]?.error||'No usable market evidence.');
   if(e.benchmark&&!evidence.some(v=>key(v.instrument)===key(e.benchmark.instrument))){try{if(e.benchmark.instrument.provider==='twelve')await market.pace();const q=await market.quote(e.benchmark.instrument);evidence.push({instrument:e.benchmark.instrument,instrumentKey:key(e.benchmark.instrument),quote:q,history:[],benchmarkOnly:true});}catch(err){errors.push({symbol:e.benchmark.instrument.symbol,error:err.message});}}
   e=change(user,id,(current)=>mark(current,evidence.map(c=>c.quote),clock()));
   const tradable=evidence.filter(v=>!v.benchmarkOnly&&v.quote.marketOpen&&clock()-v.quote.asOf<(e.horizon==='day'?120000:1200000));
   update(r=>{r.candidates=evidence;r.dataErrors=errors;});
   if(!tradable.length){update(r=>{r.status='held';r.result='Markets are closed or quotes are stale. No model calls were made.';});return;}
   if(stopped(user,id))throw Error('Experiment stopped.');
   const context={candidates:tradable,portfolio:valuation(e),positions:e.positions,rules:e.rules,horizon:e.horizon,previousDecisions:e.rounds.filter(r=>r.status!=='running').slice(-4).map(r=>({decision:r.decision,result:r.result,exitPlans:(r.messages||[]).filter(m=>m.phase==='debate').map(m=>m.exitPlan)}))};
   const config={...settings(),models:e.research.models||settings().models};config.rates=await modelCatalogue.resolve(config.models,config.openaiApiKey);if(stopped(user,id))throw Error('Experiment stopped.');reservation=reserveCost(context,config);if(reservation===null)throw Error('Refresh models & prices in Setup before running.');
   if((e.research.spentUSD||0)+reservation>e.research.budgetUSD)throw Error('Remaining AI budget cannot cover the maximum reserved cost of this round. Increase the cap or use lower-cost models.');
   update((r,current)=>{r.phase='Four independent reviews';r.reservedUSD=reservation;r.rates=config.rates;current.research.rates=config.rates;current.research.spentUSD=(current.research.spentUSD||0)+reservation;});
   const decision=await council(context,config,fetcher,m=>update(r=>{r.messages.push(m);r.phase=m.phase==='initial'?'Independent reviews / debate':'Final votes';}),()=>stopped(user,id));
   if(stopped(user,id))throw Error('Experiment stopped. No decision executed.');
   update(r=>{r.decision=decision;r.phase='Execution checks';});
   if(decision.side==='hold'){update(r=>{r.status='held';r.result='No trade: at least three matching votes including Critic and Realist are required.';});return;}
   const chosen=tradable.find(c=>c.instrumentKey===decision.instrumentKey);if(!chosen)throw Error('Council selected an instrument outside the supplied evidence.');
   e=find(store.read(user),id);const all=[...new Map([...e.positions.map(p=>p.instrument),chosen.instrument].map(i=>[key(i),i])).values()],quotes=[];
   for(const i of all){if(i.provider==='twelve')await market.pace();if(stopped(user,id))throw Error('Experiment stopped.');quotes.push(await market.quote(i));}
   update((r,current)=>{try{if(stopped(user,id))throw Error('Experiment stopped.');mark(current,quotes,clock());const order=execute(current,{...decision,clientId:roundId,actor:'council',roundId},quotes.find(q=>key(q.instrument)===decision.instrumentKey),clock());r.status='executed';r.orderId=order.id;r.instrument=chosen.instrument;r.result='Paper order filled after council agreement and server risk checks.';mark(current,quotes,clock());}catch(err){r.status='blocked';r.result=err.message;}});
  }catch(err){update((r,e)=>{r.status='failed';r.error=String(err.message||'Council failed').slice(0,500);e.research.lastError=r.error;});}
  finally{
   update((r,e)=>{r.finished=clock();r.phase='Complete';const complete=r.messages.length===8&&r.messages.every(m=>Number.isFinite(m.estimatedUSD));if(reservation){r.costUncertain=!complete;const cost=complete?r.messages.reduce((s,m)=>s+m.estimatedUSD,0):reservation;e.research.spentUSD=Math.max(0,(e.research.spentUSD||0)-reservation+cost);r.accountedUSD=cost;}e.research.lastAt=clock();e.research.nextAt=clock()+e.research.intervalMinutes*60000;if(e.research.endsAt<=clock())e.research.enabled=false;});busy.delete(user);
  }
 }
 function launch(user,id){
  if(busy.has(user))fail('A decision or valuation is already running.');const d=store.read(user),e=find(d,id),s=settings();
  if(e.paused)fail('Resume the experiment first.');if(!e.research)fail('Save experiment run settings first.');if(!s.openaiApiKey)fail('Configure OpenAI in Setup.');if(e.research.endsAt<=clock())fail('This session has ended. Start a new duration in run settings.');
  if(e.rounds.length>=10000||e.orders.length>=10000)fail('Experiment record limit reached. Export results and create a new experiment.');
  const day=new Date(clock()).toISOString().slice(0,10);if(d.usage.day!==day)d.usage={day,count:0};if(d.usage.count>=s.dailyRounds)fail('Daily model-round cap reached.');
  const r={id:crypto.randomUUID(),at:clock(),status:'running',kind:'council',phase:'Preparing universe',messages:[],decision:null};e.research.lastError='';e.rounds.push(r);d.usage.count++;store.write(user,d);busy.set(user,true);void run(user,id,r.id);return r;
 }
 router.get('/catalogue',route(async(req,res)=>{const result=await market.catalogue(req.query),page=Math.max(0,Math.floor(Number(req.query.page)||0)),size=25;res.json({...result,items:result.items.slice(page*size,(page+1)*size),page,pageSize:size});}));
 router.put('/experiments/:id/research',route(async(req,res)=>{
  const e=find(store.read(req.user.name),req.params.id);if(busy.has(req.user.name)&&!(req.body.enabled===false&&Object.keys(req.body).length===1))fail('Stop the current discussion before changing run settings.');
  if(req.body.enabled===false&&Object.keys(req.body).length===1){change(req.user.name,e.id,current=>{if(current.research)current.research.enabled=false;current.paused=true;});return res.json({ok:true});}
  const b=req.body;if(!['watchlist','catalogue'].includes(b.source))fail('Choose watchlist or catalogue.');if(typeof b.enabled!=='boolean')fail('Choose start or save.');
  if(b.enabled){const s=settings();if(!s.openaiApiKey)fail('Connect OpenAI in Setup first.');await modelCatalogue.resolve(s.models,s.openaiApiKey);if(e.mode!=='demo'&&b.source==='catalogue'&&!s.twelveDataApiKey)fail('Connect Twelve Data in Setup first.');}
  const cfg={models:settings().models,rates:settings().rates,source:b.source,exchange:String(b.exchange||'').slice(0,40),country:String(b.country||'').slice(0,60),batchSize:Math.floor(number(b.batchSize,1,20,'New candidates per review')),intervalMinutes:number(b.intervalMinutes,5,10080,'Review interval'),durationHours:number(b.durationHours,1,8760,'Run duration'),budgetUSD:number(b.budgetUSD,0.01,10000,'AI budget'),dataCostUSD:number(b.dataCostUSD||0,0,10000,'Allocated market-data cost'),usdRate:b.usdRate?number(b.usdRate,0.0001,10000,'USD conversion rate'):null,enabled:b.enabled};
  const result=change(req.user.name,e.id,current=>{const old=current.research||{};current.research={...old,...cfg,cursor:old.source===cfg.source&&old.exchange===cfg.exchange&&old.country===cfg.country?old.cursor||0:0,spentUSD:old.spentUSD||0,endsAt:clock()+cfg.durationHours*3600000,nextAt:clock(),lastError:''};if(cfg.enabled)current.paused=false;});res.json(result.research);
 }));
 router.post(['/experiments/:id/council','/experiments/:id/rounds'],route((req,res)=>res.status(202).json(launch(req.user.name,req.params.id))));
 let ticking=false;
 async function tick(){if(ticking)return;ticking=true;try{for(const user of store.accounts()){
  if(busy.has(user))continue;const d=store.read(user);for(const e of d.experiments){const s=e.research;if(!s?.enabled||e.paused)continue;if(s.endsAt<=clock()){change(user,e.id,v=>{v.research.enabled=false;});continue;}if(s.nextAt>clock())continue;
   try{launch(user,e.id);}catch(err){change(user,e.id,v=>{v.research.lastError=err.message;v.research.nextAt=clock()+Math.max(15,v.research.intervalMinutes)*60000;});}break;
  }
 }}finally{ticking=false;}}
 const timer=autoSchedule?setInterval(()=>void tick().catch(()=>{}),30000):null;timer?.unref();
 return {tick,close:()=>clearInterval(timer)};
}
module.exports={mountResearch};
