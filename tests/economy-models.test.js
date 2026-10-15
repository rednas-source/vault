'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),express=require('express');
const {createModelCatalogue,parsePrices,PRICE_SOURCE}=require('../lib/economy-models');
const {estimateCost,reserveCost,councilRoles}=require('../lib/economy-council');
const {economyRoutes}=require('../lib/economy-routes');
const pricing=(input='0.10')=>`# Fixture pricing
### Standard pricing data
| Model | Short context input | Short context cached input | Short context cache writes | Short context output | Long context input | Long context cached input | Long context cache writes | Long context output |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-4.1-mini | $${input} | $0.01 | - | $0.20 | - | - | - | - |
| gpt-6.1-sol | $2.00 | $0.10 | $2.50 | $10.00 | $4.00 | $0.20 | $5.00 | $15.00 |
| gpt-4o-2024-05-13 | $5.00 | - | - | $15.00 | - | - | - | - |
### Batch pricing data
| Model | Input | Output |
| --- | --- | --- |
| gpt-4.1-mini | $0.001 | $0.002 |
Short context: ≤272K input tokens. Long context: >272K input tokens.
`;
async function setup(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'vault-models-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return path.join(dir,'pricing.json');}
test('pricing parser selects standard text rates, long-context tier and fails on changed columns',()=>{
 const p=parsePrices(pricing());assert.equal(p['gpt-4.1-mini'].input,.1);assert.equal(p['gpt-6.1-sol'].long.output,15);assert.equal(p['gpt-4o-2024-05-13'],undefined);
 assert.throws(()=>parsePrices(pricing().replace('Short context output','Unknown output')),/columns/);
 assert.throws(()=>parsePrices(pricing().replace('≤272K','≤100K')),/threshold/);
 assert.throws(()=>parsePrices(pricing().replace('$0.10','free')),/price/);
});
test('catalogue joins API availability with exact prices, refreshes automatically and never forwards keys to docs',async t=>{
 const file=await setup(t);let now=100000000,input='0.10',calls=[];
 const fetcher=async(url,options)=>{calls.push(url);if(url===PRICE_SOURCE){assert.equal(options.headers.Authorization,undefined);return new Response(pricing(input));}assert.equal(url,'https://api.openai.com/v1/models');return Response.json({data:[{id:options.headers.Authorization==='Bearer second'?'gpt-6.1-sol':'gpt-4.1-mini'},{id:'gpt-7-sol'},{id:'gpt-image-1'},{id:'gpt-4.1-mini-2025-04-14'}]});};
 const c=createModelCatalogue({file,fetcher,clock:()=>now}),first=await c.list('first');assert.equal(first.stale,false);assert.deepEqual(first.items.map(v=>v.id),['gpt-7-sol','gpt-4.1-mini']);assert.equal(first.items[0].rate,null);
 const pinned=await c.resolve({critic:'gpt-4.1-mini'},'first');assert.equal(calls.length,2);await assert.rejects(c.resolve({critic:'gpt-7-sol'},'first'),/verified standard price/);
 now+=86400001;input='0.30';assert.equal((await c.resolve({critic:'gpt-4.1-mini'},'first')).critic.input,.3);assert.equal(pinned.critic.input,.1);
 assert.equal((await c.list('second')).items.some(m=>m.id==='gpt-4.1-mini'),false);await assert.rejects(c.resolve({critic:'gpt-4.1-mini'},'second'),/available council/);
 const disk=await fs.readFile(file,'utf8');assert.ok(!disk.includes('Bearer'));
});
test('stale pricing failure preserves history but blocks new paid reviews and is retry-throttled',async t=>{
 const file=await setup(t);let now=100000000,offline=false,calls=0;const c=createModelCatalogue({file,clock:()=>now,fetcher:async url=>{calls++;if(offline)throw Error('network');return url===PRICE_SOURCE?new Response(pricing()):Response.json({data:[{id:'gpt-4.1-mini'}]});}});
 await c.resolve({critic:'gpt-4.1-mini'},'key');now+=86400001;offline=true;const list=await c.list('key');assert.equal(list.stale,true);assert.match(list.error,/Could not reach/);const n=calls;await assert.rejects(c.resolve({critic:'gpt-4.1-mini'},'key'));assert.equal(calls,n);
 assert.equal(c.rates({critic:'gpt-4.1-mini'}).critic.input,.1);
});
test('costs include cache reads, cache writes and long context; reservation covers the expensive input rate',()=>{
 const rate=parsePrices(pricing())['gpt-6.1-sol'];assert.equal(estimateCost(1000,100,rate,{cached:500,written:200}),.00215);
 assert.equal(estimateCost(300000,100,rate),1.2015);assert.equal(estimateCost(1000,100,rate,{conservative:true}),.0035);
 assert.equal(estimateCost(100,10,rate,{cached:101}),null);assert.equal(estimateCost(100,10,rate,{cached:NaN}),null);
 const rates=Object.fromEntries(councilRoles.map(r=>[r.id,rate]));assert.ok(reserveCost({}, {rates})>8*(64000*2+1800*10)/1e6);
});
test('settings derive prices server-side and model catalogue remains admin-only',async t=>{
 const file=await setup(t),root=path.dirname(file),app=express();app.use(express.json());
 const router=economyRoutes({root,config:{openaiApiKey:'fixture',economyScheduler:false},fetcher:async url=>url===PRICE_SOURCE?new Response(pricing()):Response.json({data:[{id:'gpt-4.1-mini'},{id:'gpt-6.1-sol'}]}),auth:(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={name:'owner',role:req.headers.authorization};next();}});app.use('/api/economy',router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port+'/api/economy';
 assert.equal((await fetch(base+'/models',{headers:{Authorization:'member'}})).status,403);
 const models=Object.fromEntries(councilRoles.map(r=>[r.id,'gpt-6.1-sol']));const res=await fetch(base+'/settings',{method:'PUT',headers:{Authorization:'admin','Content-Type':'application/json'},body:JSON.stringify({models,rates:Object.fromEntries(councilRoles.map(r=>[r.id,{input:0,output:0}]))})});assert.equal(res.status,200);const data=await res.json();assert.equal(data.rates.critic.input,2);assert.equal(data.rates.critic.model,'gpt-6.1-sol');assert.ok(!JSON.stringify(data).includes('fixture'));
});
module.exports={pricing};
