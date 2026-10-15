'use strict';
const crypto=require('node:crypto');
const {key,instrument,number,fail,mark,execute,valuation}=require('./economy-store');
const {council,reserveCost}=require('./economy-council');
const {globalMarkets}=require('./economy-fx');
function usReviewWindow(now){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));const minute=+parts.hour*60+(+parts.minute);return !['Sat','Sun'].includes(parts.weekday)&&minute>=575&&minute<950;}
function mountResearch(router,{store,market,settings,busy,route,clock,fetcher,modelCatalogue,autoSchedule=true}){
 const settingsRevisions=new Map();
 const find=(d,id)=>{const e=d.experiments.find(v=>v.id===id);if(!e)throw Object.assign(Error('Experiment not found.'),{status:404});return e;};
 function change(user,id,fn){const d=store.read(user),e=find(d,id);fn(e,d);store.write(user,d);return e;}
 const stopped=(user,id)=>{const e=find(store.read(user),id);return e.paused||(e.research?.endsAt&&clock()>=e.research.endsAt);};
 async function candidates(e,d){
  const s=e.research||{},scope=e.mode!=='demo'&&s.source==='catalogue'?await market.catalogue({exchange:s.exchange,country:s.country,currency:globalMarkets(e)?'':e.currency}):{items:(s.source==='preset'?e.universe||[]:d.watchlist).filter(i=>(globalMarkets(e)||i.currency===e.currency)&&(i.provider==='demo')===(e.mode==='demo'))};
  if(e.mode==='demo')scope.items=[market.demo];
  scope.items=[...new Map(scope.items.map(i=>[key(i),i])).values()];
  if(globalMarkets(e)&&s.source==='catalogue'){
   // Interleave countries so early batches are not confined to one alphabetical market.
   const groups=new Map();for(const i of scope.items){const country=i.country||i.exchange; if(!groups.has(country))groups.set(country,[]);groups.get(country).push(i);}
   const countries=[...groups.keys()].sort(),ordered=[];for(let index=0;ordered.length<scope.items.length;index++)for(const country of countries){const i=groups.get(country)[index];if(i)ordered.push(i);}scope.items=ordered;
  }
  if(!scope.items.length)throw Object.assign(Error(s.source==='catalogue'?`No ${globalMarkets(e)?'global':e.currency} listings match ${[s.exchange,s.country].filter(Boolean).join(' / ')||'this catalogue'}. Clear the exchange and country filters in Sandbox, then check the stock selection. Enable Global markets to include other currencies.`:`Your ${s.source==='preset'?'saved universe':'watchlist'} has no ${globalMarkets(e)?'eligible':e.currency} stocks. In Sandbox choose Full provider catalogue, or add stocks to your watchlist. No agent calls were made.`),{status:400,code:'EMPTY_UNIVERSE'});
  const cursor=(s.cursor||0)%scope.items.length,batch=Array.from({length:Math.min(s.batchSize||2,scope.items.length)},(_,n)=>scope.items[(cursor+n)%scope.items.length]);
  return {items:[...new Map([...e.positions.map(p=>p.instrument),...batch].map(i=>[key(i),i])).values()],keys:new Set(scope.items.map(key)),batch:batch.map(key),cursor,size:scope.items.length};
 }
 async function run(user,id,roundId){let reservation=0;
  const update=fn=>change(user,id,(e,d)=>fn(e.rounds.find(r=>r.id===roundId),e,d));
  try{
   let d=store.read(user),e=find(d,id);const pool=await candidates(e,d),evidence=[],errors=[];
   const completed=new Set();
   function coverage(entries,flag){update((r,current)=>{const s=current.research,c=s.coverage||(s.coverage={listings:{},startedAt:clock()});for(const k of entries)if(pool.keys.has(k))c.listings[k]=(c.listings[k]||0)|flag;for(const k of Object.keys(c.listings))if(!pool.keys.has(k))delete c.listings[k];const values=Object.values(c.listings);c.attempted=values.filter(v=>v&1).length;c.withData=values.filter(v=>v&2).length;c.reviewed=values.filter(v=>v&4).length;c.remaining=pool.size-c.reviewed;});}
   update((r,current)=>{r.phase='Fetching market evidence';r.universeSize=pool.size;current.research.universeSize=pool.size;});coverage([],0);
   for(const i of pool.items){if(stopped(user,id))throw Error('Experiment stopped.');let limited=false;try{if(i.provider==='twelve')await market.pace();if(stopped(user,id))throw Error('Experiment stopped.');coverage([key(i)],1);const history=await market.history(i,e.horizon==='day'?'day':'1y');if(!history.length)throw Error('Price history unavailable for this listing.');if(i.provider==='twelve')await market.pace();if(stopped(user,id))throw Error('Experiment stopped.');const quote=await market.forExperiment(e,i);evidence.push({instrument:{...quote.instrument,country:i.country,mic:i.mic},instrumentKey:key(i),quote,history,historyCurrency:quote.instrument.currency});coverage([key(i)],2);}catch(err){errors.push({symbol:i.symbol,error:err.message});limited=err.status===429;}
    if(stopped(user,id))throw Error('Experiment stopped.');
    if(!limited)completed.add(key(i));
    let advance=0;while(advance<pool.batch.length&&completed.has(pool.batch[advance]))advance++;
    update((r,current)=>{current.research.cursor=(pool.cursor+advance)%pool.size;r.candidates=evidence;r.dataErrors=errors;});
    if(limited)break;
   }
   if(!evidence.length)throw Error('No usable market evidence. '+(errors[0]?.error||'Check your exchange coverage in Setup.'));
   if(e.benchmark&&!evidence.some(v=>key(v.instrument)===key(e.benchmark.instrument))){try{if(e.benchmark.instrument.provider==='twelve')await market.pace();const q=await market.forExperiment(e,e.benchmark.instrument);evidence.push({instrument:e.benchmark.instrument,instrumentKey:key(e.benchmark.instrument),quote:q,history:[],benchmarkOnly:true});}catch(err){errors.push({symbol:e.benchmark.instrument.symbol,error:err.message});}}
   if(e.benchmark&&!evidence.some(v=>key(v.instrument)===key(e.benchmark.instrument)))throw Error('Buy-and-hold benchmark quote unavailable. No agent calls made; check benchmark coverage.');
   e=change(user,id,(current)=>mark(current,evidence.map(c=>c.quote),clock()));
   // Research batches can take several minutes at provider quotas. Execution still requires a fresh quote.
   const tradable=evidence.filter(v=>!v.benchmarkOnly&&v.quote.marketOpen&&v.quote.asOf<=clock()+60000&&clock()-v.quote.asOf<1200000);
   update(r=>{r.candidates=evidence;r.dataErrors=errors;});
   if(!tradable.length){update(r=>{r.marketClosed=true;r.status='held';r.result='Markets are closed or quotes are stale. No model calls were made.';});return;}
   if(stopped(user,id))throw Error('Experiment stopped.');
   const context={universe:{source:e.research.source,currency:e.currency,marketScope:e.marketScope||'domestic',priceUnits:'Portfolio, position costs and quote.basePrice use the reporting currency. quote.price and history remain in each instrument currency. FX risk affects returns. Closed-market position marks can use a recently retrieved last closing price; these are not current tradable prices.',eligibleListings:pool.size,batchListings:tradable.length,note:'This is a rolling research batch, not a review of the entire market. Quotes may be up to 20 minutes old; execution requires a fresh quote.'},candidates:tradable,portfolio:valuation(e),positions:e.positions,rules:e.rules,horizon:e.horizon,previousDecisions:e.rounds.filter(r=>r.status!=='running').slice(-4).map(r=>({decision:r.decision,result:r.result,exitPlans:(r.messages||[]).filter(m=>m.phase==='debate').map(m=>m.exitPlan)}))};
   const costFx=globalMarkets(e)?await market.fx('USD',e.currency):null;if(costFx)update((r,current)=>{r.costFx=costFx;current.costFx=costFx;});
   const config={...settings(),models:e.research.models||settings().models};config.rates=await modelCatalogue.resolve(config.models,config.openaiApiKey);if(stopped(user,id))throw Error('Experiment stopped.');reservation=reserveCost(context,config);if(reservation===null)throw Error('Refresh models & prices in Setup before running.');
   if((e.research.spentUSD||0)+reservation>e.research.budgetUSD)throw Error('Remaining AI budget cannot cover the maximum reserved cost of this round. Increase the cap or use lower-cost models.');
   update((r,current)=>{r.phase='Four independent reviews';r.reservedUSD=reservation;r.rates=config.rates;current.research.rates=config.rates;current.research.spentUSD=(current.research.spentUSD||0)+reservation;});
   const decision=await council(context,config,fetcher,m=>update(r=>{r.messages.push(m);r.phase=m.phase==='initial'?'Independent reviews / debate':'Final votes';}),()=>stopped(user,id));
   coverage(tradable.map(v=>v.instrumentKey),4);
   if(stopped(user,id))throw Error('Experiment stopped. No decision executed.');
   update(r=>{r.decision=decision;r.phase='Execution checks';});
   if(decision.side==='hold'){update(r=>{r.status='held';r.result='No trade: at least three matching votes including Critic and Realist are required.';});return;}
   const chosen=tradable.find(c=>c.instrumentKey===decision.instrumentKey);if(!chosen)throw Error('Council selected an instrument outside the supplied evidence.');
   e=find(store.read(user),id);const all=[...new Map([...e.positions.map(p=>p.instrument),chosen.instrument].map(i=>[key(i),i])).values()],quotes=[];
   for(const i of all){if(i.provider==='twelve')await market.pace();if(stopped(user,id))throw Error('Experiment stopped.');quotes.push(await market.forExperiment(e,i));}
   update((r,current)=>{try{if(stopped(user,id))throw Error('Experiment stopped.');mark(current,quotes,clock());const order=execute(current,{...decision,clientId:roundId,actor:'council',roundId},quotes.find(q=>key(q.instrument)===decision.instrumentKey),clock());r.status='executed';r.orderId=order.id;r.instrument=chosen.instrument;r.result='Paper order filled after council agreement and server risk checks.';mark(current,quotes,clock());}catch(err){r.status='blocked';r.result=err.message;}});
  }catch(err){update((r,e)=>{r.status='failed';r.error=String(err.message||'Council failed').slice(0,500);e.research.lastError=r.error;e.research.failureCount=(e.research.failureCount||0)+1;if(err.code==='EMPTY_UNIVERSE'||e.research.failureCount>=3){e.research.enabled=false;e.research.lastError+=' Automatic reviews stopped. Check the stock selection and provider access before restarting.';}});}
  finally{
   update((r,e)=>{r.finished=clock();r.phase=r.status==='failed'?'Needs attention':'Complete';if(r.status!=='failed')e.research.failureCount=0;const complete=r.messages.length===8&&r.messages.every(m=>Number.isFinite(m.estimatedUSD));if(reservation){r.costUncertain=!complete;const cost=complete?r.messages.reduce((s,m)=>s+m.estimatedUSD,0):reservation;e.research.spentUSD=Math.max(0,(e.research.spentUSD||0)-reservation+cost);r.accountedUSD=cost;}e.research.lastAt=clock();e.research.nextAt=Math.max(clock()+60000,r.at+(r.marketClosed&&e.horizon==='long'?15:e.research.intervalMinutes)*60000);if(e.research.endsAt<=clock())e.research.enabled=false;});busy.delete(user);
  }
 }
 async function launch(user,id){
  if(busy.has(user))fail('A decision or valuation is already running.');const d=store.read(user),e=find(d,id),s=settings();
  if(e.paused)fail('Resume the experiment first.');if(!e.research)fail('Save experiment run settings first.');if(!s.openaiApiKey)fail('Configure OpenAI in Setup.');if(!e.research.endsAt||e.research.endsAt<=clock())fail('This session has ended. Start a new duration in run settings.');
  if(e.rounds.length>=10000||e.orders.length>=10000)fail('Experiment record limit reached. Export results and create a new experiment.');
  const day=new Date(clock()).toISOString().slice(0,10);if(d.usage.day!==day)d.usage={day,count:0};if(d.usage.count>=s.dailyRounds)fail('Daily model-round cap reached.');
  busy.set(user,true);
  try{
   await candidates(e,d);
   // Reload after the catalogue request: Stop must win while preflight is in flight.
   const latest=store.read(user),current=find(latest,id);if(stopped(user,id))fail('Experiment stopped.');
   const r={id:crypto.randomUUID(),at:clock(),status:'running',kind:'council',phase:'Preparing universe',messages:[],decision:null};current.research.lastError='';current.rounds.push(r);latest.usage={day,count:d.usage.count+1};store.write(user,latest);void run(user,id,r.id);return r;
  }catch(err){busy.delete(user);throw err;}
 }
 router.get('/catalogue',route(async(req,res)=>{const result=await market.catalogue(req.query),page=Math.max(0,Math.floor(Number(req.query.page)||0)),size=25;res.json({...result,items:result.items.slice(page*size,(page+1)*size),page,pageSize:size});}));
 router.post('/experiments/:id/preflight',route(async(req,res)=>{
  const d=store.read(req.user.name),e=find(d,req.params.id),source=req.body.source||e.research?.source||'catalogue';
  if(!['watchlist','catalogue','preset'].includes(source))fail('Choose watchlist or catalogue.');
  const marketScope=req.body.marketScope??e.marketScope;const pool=await candidates({...e,marketScope,research:{...e.research,source,exchange:req.body.exchange??e.research?.exchange,country:req.body.country??e.research?.country}},d);
  res.json({eligible:pool.size,currency:e.currency,sample:pool.items.slice(0,5),message:`${pool.size.toLocaleString('en-GB')} eligible ${marketScope==='global'?'listings across currencies, reported in '+e.currency:e.currency+' listings'}. Price and FX access depend on your provider plan. No agent calls were made.`});
 }));
 router.put('/experiments/:id/research',route(async(req,res)=>{
  const e=find(store.read(req.user.name),req.params.id);if(busy.has(req.user.name)&&!(req.body.enabled===false&&Object.keys(req.body).length===1))fail('Stop the current discussion before changing run settings.');
  const revisionKey=req.user.name+':'+e.id,revision=(settingsRevisions.get(revisionKey)||0)+1;settingsRevisions.set(revisionKey,revision);
  if(req.body.enabled===false&&Object.keys(req.body).length===1){change(req.user.name,e.id,current=>{if(current.research)current.research.enabled=false;current.paused=true;});return res.json({ok:true});}
  const b=req.body;if(!['watchlist','catalogue',...(e.universe?['preset']:[])].includes(b.source))fail('Choose watchlist or catalogue.');if(typeof b.enabled!=='boolean')fail('Choose start or save.');
  const marketScope=b.marketScope??e.marketScope??'domestic';if(!['global','domestic'].includes(marketScope)||e.mode==='demo'&&marketScope==='global')fail('Choose a supported market scope.');
  if(marketScope==='domestic'&&[...e.positions.map(p=>p.instrument),...(e.benchmark?[e.benchmark.instrument]:[])].some(i=>i.currency!==e.currency))fail('Keep Global markets enabled while foreign holdings or a foreign benchmark exist.');
  if(b.enabled){await candidates({...e,marketScope,research:{...e.research,...b}},store.read(req.user.name));const s=settings();if(!s.openaiApiKey)fail('Connect OpenAI in Setup first.');await modelCatalogue.resolve(e.preset?e.research.models:s.models,s.openaiApiKey);if(e.mode!=='demo'&&['catalogue','preset'].includes(b.source)&&!s.twelveDataApiKey)fail('Connect Twelve Data in Setup first.');}
  if(b.enabled&&e.preset&&marketScope!=='global'&&e.horizon==='day'){const q=await market.quote(e.benchmark.instrument);if(!usReviewWindow(clock())||!q.marketOpen||clock()-q.asOf>120000||q.asOf>clock()+60000)fail('Start the short test during US market hours with quotes under two minutes old. No test was started.');}
  if(b.enabled&&b.source==='watchlist'&&e.mode!=='demo'&&!store.read(req.user.name).watchlist.some(i=>(marketScope==='global'||i.currency===e.currency)&&i.provider!=='demo'))fail('Add matching-currency instruments to your watchlist, or choose Provider catalogue.');
  const cfg={models:e.preset?e.research.models:settings().models,rates:e.preset?modelCatalogue.rates(e.research.models):settings().rates,source:b.source,exchange:String(b.exchange||'').trim().slice(0,80),country:String(b.country||'').trim().slice(0,60),batchSize:Math.floor(number(b.batchSize,1,20,'New candidates per review')),intervalMinutes:number(b.intervalMinutes,5,10080,'Review interval'),durationHours:number(b.durationHours,1,8760,'Run duration'),budgetUSD:number(b.budgetUSD,0.01,10000,'AI budget'),dataCostUSD:number(b.dataCostUSD||0,0,10000,'Allocated market-data cost'),usdRate:b.usdRate===undefined?e.research?.usdRate||null:b.usdRate?number(b.usdRate,0.0001,10000,'USD conversion rate'):null,enabled:b.enabled};
  if(settingsRevisions.get(revisionKey)!==revision)fail('Run settings changed while checking the catalogue. Refresh before starting again.');
  if(busy.has(req.user.name))fail('A review started while checking settings. Stop it before changing the run.');
  const result=change(req.user.name,e.id,current=>{const old=current.research||{},sameScope=(current.marketScope||'domestic')===marketScope&&old.source===cfg.source&&old.exchange===cfg.exchange&&old.country===cfg.country;if((current.marketScope||'domestic')!==marketScope){current.marketScopeChanges=current.marketScopeChanges||[];current.marketScopeChanges.push({at:clock(),from:current.marketScope||'domestic',to:marketScope});}current.marketScope=marketScope;current.research={...old,...cfg,cursor:sameScope?old.cursor||0:0,coverage:sameScope?old.coverage:null,universeSize:sameScope?old.universeSize:0,spentUSD:old.spentUSD||0,endsAt:clock()+cfg.durationHours*3600000,nextAt:clock(),lastError:'',failureCount:0};if(cfg.enabled)current.paused=false;});res.json(result.research);
 }));
 router.post(['/experiments/:id/council','/experiments/:id/rounds'],route(async(req,res)=>res.status(202).json(await launch(req.user.name,req.params.id))));
 let ticking=false;
 async function tick(){if(ticking)return;ticking=true;try{for(const user of store.accounts()){
  if(busy.has(user))continue;const d=store.read(user);for(const e of d.experiments){const s=e.research;if(!s?.enabled||e.paused)continue;if(s.endsAt<=clock()){change(user,e.id,v=>{v.research.enabled=false;});continue;}if(s.nextAt>clock())continue;if(e.preset&&!globalMarkets(e)&&!usReviewWindow(clock()))continue;
   try{await launch(user,e.id);}catch(err){change(user,e.id,v=>{v.research.lastError=err.message;v.research.failureCount=(v.research.failureCount||0)+1;if(err.status===400||v.research.failureCount>=3){v.research.enabled=false;v.research.lastError+=' Automatic reviews stopped. Fix the settings in Sandbox before restarting.';}v.research.nextAt=clock()+Math.max(15,v.research.intervalMinutes)*60000;});}break;
  }
 }}finally{ticking=false;}}
 const timer=autoSchedule?setInterval(()=>void tick().catch(()=>{}),30000):null;timer?.unref();
 return {tick,close:()=>clearInterval(timer)};
}
module.exports={mountResearch,usReviewWindow};
