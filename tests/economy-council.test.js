'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),express=require('express');
const {council,councilRoles,consensus,reserveCost}=require('../lib/economy-council');
const {createMarket,demo}=require('../lib/economy-market');
const {key,createExperiment,createStore}=require('../lib/economy-store');
const {analytics}=require('../lib/economy-analytics');
const {economyRoutes}=require('../lib/economy-routes');
const rates=Object.fromEntries(councilRoles.map(r=>[r.id,{input:0.1,output:0.2}])),models=Object.fromEntries(councilRoles.map(r=>[r.id,'gpt-4.1-mini']));
const vote={instrumentKey:key(demo),action:'buy',quantity:1,approve:true,confidence:0.6,reason:'Fixture only',risks:[],exitPlan:'Reassess next cycle'};
function response(v=vote){return Response.json({status:'completed',usage:{input_tokens:100,output_tokens:50},output:[{content:[{type:'output_text',text:JSON.stringify(v)}]}]});}
test('four initial reviews start together; debate sees all four and settles a matching instrument',async()=>{
 let entered=0,release;const gate=new Promise(r=>release=r),seen=[];
 const result=await council({candidates:[{instrument:demo}]},{openaiApiKey:'fixture',models,rates},async(url,options)=>{const input=JSON.parse(JSON.parse(options.body).input);seen.push(input);if(input.phase==='initial'){entered++;if(entered===4)release();await gate;}return response();});
 assert.equal(entered,4);assert.equal(seen.length,8);assert.ok(seen.slice(0,4).every(v=>v.discussion.length===0));assert.ok(seen.slice(4).every(v=>v.discussion.length===4));assert.equal(result.instrumentKey,key(demo));assert.equal(result.side,'buy');
});
test('council requires three matching votes and both critic and realist; size cannot exceed any supporter',()=>{
 const v=councilRoles.map(r=>({...vote,role:r.id}));v[1].quantity=9;assert.equal(consensus(v).quantity,1);
 assert.equal(consensus(v.map(x=>x.role==='critic'?{...x,action:'hold'}:x)).side,'hold');
 assert.equal(consensus(v.map(x=>x.role==='realist'?{...x,instrumentKey:'other'}:x)).side,'hold');
 assert.equal(consensus(v.map((x,n)=>n>1?{...x,action:'sell'}:x)).side,'hold');
});
test('catalogue browses beyond seeds, filters by country/exchange and caches the full provider list',async()=>{
 let calls=0;const market=createMarket(()=>({twelveDataApiKey:'fixture'}),async()=>{calls++;return Response.json({data:Array.from({length:70},(_,n)=>({symbol:'TEST'+n,name:'Test '+n,exchange:n<50?'NASDAQ':'OSL',currency:n<50?'USD':'NOK',country:n<50?'United States':'Norway'}))});});
 assert.equal((await market.catalogue()).total,70);assert.equal((await market.catalogue({country:'Norway'})).total,20);assert.equal((await market.catalogue({q:'TEST69'})).items[0].symbol,'TEST69');assert.equal(calls,1);
});
async function fixture(t,fetcher){const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-council-'));const app=express();app.use(express.json());const router=economyRoutes({root,fetcher:async(url,options)=>url==='https://developers.openai.com/api/docs/pricing.md'?new Response('### Standard pricing data\n| Model | Input | Cached input | Output |\n| --- | --- | --- | --- |\n| gpt-4.1-mini | $0.10 | $0.01 | $0.20 |'):url==='https://api.openai.com/v1/models'?Response.json({data:[{id:'gpt-4.1-mini'}]}):fetcher(url,options),config:{openaiApiKey:'fixture',economyScheduler:false},auth:(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={name:req.headers.authorization,role:'admin'};next();}});app.use('/api/economy',router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{router.research.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});});
 const call=async(url='',body,method,user='alice')=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/economy'+url,{method:method||(body?'POST':'GET'),headers:{Authorization:user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
 await call('/settings',{models,rates},'PUT');const e=(await call('/experiments',{name:'Council test',mode:'demo'})).data;
 await call('/experiments/'+e.id+'/research',{enabled:false,source:'watchlist',batchSize:2,intervalMinutes:15,durationHours:4,budgetUSD:5},'PUT');
 const result=async()=>{let e;for(let n=0;n<100;n++){e=(await call()).data.experiments[0];if(!e.rounds.some(r=>r.status==='running'))return e;await new Promise(r=>setTimeout(r,10));}throw Error('Round did not finish');};return {root,call,e,result,research:router.research};
}
test('end-to-end council records costs, selects and fills one trade; schedules survive storage reload',async t=>{
 let calls=0;const f=await fixture(t,async()=>{calls++;return response();});const start=await f.call('/experiments/'+f.e.id+'/council',{});assert.equal(start.status,202);const e=await f.result();assert.equal(e.rounds[0].status,'executed',e.rounds[0].error);assert.equal(calls,8);assert.equal(e.orders.length,1);assert.ok(e.analytics.aiUSD>0);assert.equal(e.analytics.unknownCostCalls,0);assert.ok(e.analytics.netPnl<e.summary.pnl);assert.equal(e.research.spentUSD,e.analytics.aiUSD);
 const store=createStore(path.join(f.root,'.economy'));assert.deepEqual(store.accounts(),['alice']);const d=store.read('alice');d.experiments[0].research.enabled=true;d.experiments[0].research.nextAt=0;store.write('alice',d);await f.research.tick();const next=await f.result();assert.equal(next.rounds.length,2);assert.equal(calls,16,JSON.stringify(next.rounds.at(-1)));assert.ok(next.research.nextAt>Date.now());
 assert.equal((await f.call('/experiments/'+f.e.id+'/council',{},undefined,'bob')).status,404);
});
test('insufficient budget and missing rates prevent all model calls',async t=>{
 let calls=0;const f=await fixture(t,async()=>{calls++;return response();});const store=createStore(path.join(f.root,'.economy')),d=store.read('alice');d.experiments[0].research.budgetUSD=0.01;store.write('alice',d);await f.call('/experiments/'+f.e.id+'/council',{});const e=await f.result();assert.equal(calls,0);assert.equal(e.rounds[0].status,'failed');assert.match(e.rounds[0].error,/budget/i);assert.equal(reserveCost({},{rates:{}}),null);
});
test('stop during concurrent opinions prevents debate and order; failed calls retain budget reserve',async t=>{
 let entered=0,signal,release;const started=new Promise(r=>signal=r),gate=new Promise(r=>release=r);const f=await fixture(t,async()=>{entered++;if(entered===4)signal();await gate;return response();});await f.call('/experiments/'+f.e.id+'/council',{});await started;
 await f.call('/experiments/'+f.e.id+'/research',{enabled:false},'PUT');release();const e=await f.result();assert.equal(entered,4);assert.equal(e.orders.length,0);assert.equal(e.paused,true);assert.equal(e.rounds[0].costUncertain,true);assert.ok(e.research.spentUSD>0);assert.equal(e.analytics.netPnl,null);
});
test('analytics never treats unknown AI costs or missing FX as a net profit',()=>{
 const e=createExperiment({name:'NOK',currency:'NOK'});e.rounds=[{messages:[{usage:{input:100,output:10}}]}];assert.equal(analytics(e).netPnl,null);e.rounds=[];assert.equal(analytics(e).aiPortfolio,null);e.research={usdRate:10};assert.equal(analytics(e).netPnl,0);
});
test('intraday history uses five-minute candles and keeps UTC intraday timestamps',async()=>{
 const market=createMarket(()=>({twelveDataApiKey:'fixture'}),async url=>{const u=new URL(url);assert.equal(u.searchParams.get('interval'),'5min');assert.equal(u.searchParams.get('outputsize'),'96');return Response.json({values:[{datetime:'2026-10-15 14:35:00',close:'123.45'}]});});
 const h=await market.history({provider:'twelve',symbol:'AAPL',exchange:'NASDAQ',currency:'USD'},'day');assert.equal(h[0].at,Date.parse('2026-10-15T14:35:00Z'));
});
test('expired sessions do not launch, and recovery keeps an unfinished cost reservation unknown',async t=>{
 let calls=0;const f=await fixture(t,async()=>{calls++;return response();}),store=createStore(path.join(f.root,'.economy')),d=store.read('alice');
 d.experiments[0].research.enabled=true;d.experiments[0].research.endsAt=Date.now()-1;d.experiments[0].research.nextAt=0;
 d.experiments[0].rounds.push({id:'crash',status:'running',reservedUSD:1,messages:[]});store.write('alice',d);store.recover();await f.research.tick();
 const e=(await f.call()).data.experiments[0];assert.equal(e.research.enabled,false);assert.equal(e.rounds[0].status,'interrupted');assert.equal(e.rounds[0].costUncertain,true);assert.equal(e.analytics.netPnl,null);assert.equal(calls,0);
 assert.equal((await f.call('/experiments/'+e.id+'/rounds',{})).status,400);
});
