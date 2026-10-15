'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),express=require('express');
const {createExperiment,createStore,execute,mark,valuation}=require('../lib/economy-store');
const {createMarket,demo}=require('../lib/economy-market');
const {economyRoutes}=require('../lib/economy-routes');
const now=Date.now(),quote={instrument:demo,price:100,asOf:now,marketOpen:true,source:'Synthetic demo'};
function account(overrides={}){return createExperiment({name:'Test experiment',mode:'demo',initial:10000,maxPositionPct:50,...overrides});}
test('paper fills account for fees, spread and slippage, preserve cash and deduplicate retries',()=>{
 const e=account();mark(e,[quote],now);const o=execute(e,{clientId:'order0001',side:'buy',quantity:10},quote,now);
 assert.equal(o.price,100.1);assert.equal(o.fee,1.001);assert.equal(e.cash,8997.999);assert.equal(e.positions[0].avgCost,100.2001);
 assert.equal(execute(e,{clientId:'order0001',side:'buy',quantity:100},quote,now).id,o.id);assert.equal(e.orders.length,1);
 const sale=execute(e,{clientId:'order0002',side:'sell',quantity:10},{...quote,price:110},now);
 assert.equal(e.positions.length,0);assert.ok(sale.realized>90&&sale.realized<100);assert.equal(valuation(e).pnl,sale.realized);
});
test('paper engine rejects stale, closed, mixed currency, mixed data, short, excess exposure and paused orders',()=>{
 const e=account(),buy={clientId:'safe0001',side:'buy',quantity:1};
 for(const q of [{...quote,asOf:now-864e5},{...quote,marketOpen:false},{...quote,instrument:{...demo,currency:'NOK'}},{...quote,instrument:{...demo,provider:'twelve'}}])assert.throws(()=>execute(e,buy,q,now));
 assert.throws(()=>execute(e,{...buy,quantity:51},quote,now),/position limit/);assert.throws(()=>execute(e,{...buy,quantity:200},quote,now),/cash/);
 assert.throws(()=>execute(e,{...buy,side:'sell'},quote,now),/Short selling/);assert.throws(()=>execute(e,{...buy,quantity:NaN},quote,now));
 e.paused=true;assert.throws(()=>execute(e,buy,quote,now),/paused/);assert.equal(e.orders.length,0);
});
test('loss and order limits apply; marks and benchmarks use observed data without inventing FX',()=>{
 const e=account({maxTradesPerDay:2});e.benchmark={instrument:demo,start:null,last:null};mark(e,[quote],now);execute(e,{clientId:'daily001',side:'buy',quantity:40},quote,now);
 mark(e,[{...quote,price:80}],now+1000);assert.equal(valuation(e).benchmark,8000);assert.ok(valuation(e).pnl< -800);
 assert.throws(()=>execute(e,{clientId:'daily002',side:'buy',quantity:1},{...quote,price:80},now+1000),/loss limit/);
 execute(e,{clientId:'daily003',side:'sell',quantity:1},{...quote,price:80},now+1000);
 assert.throws(()=>execute(e,{clientId:'daily004',side:'sell',quantity:1},quote,now+1000),/order limit/);
});
test('provider adapters retain timestamps, cache quotes and fail closed without a stock key',async()=>{
 let requests=0;const i={provider:'twelve',symbol:'AAPL',name:'Apple',exchange:'NASDAQ',currency:'USD'};
 const market=createMarket(()=>({twelveDataApiKey:'fixture'}),async url=>{requests++;assert.equal(new URL(url).hostname,'api.twelvedata.com');return new Response(JSON.stringify({symbol:'AAPL',currency:'USD',close:'190.5',timestamp:Math.floor(now/1000),is_market_open:false,percent_change:'-1.1'}));},()=>now);
 const q=await market.quote(i);assert.equal(q.marketOpen,false);assert.equal(q.price,190.5);assert.equal(q.asOf,Math.floor(now/1000)*1000);await market.quote(i);assert.equal(requests,1);
 const offline=createMarket(()=>({}),()=>assert.fail('No request should be made'));await assert.rejects(offline.quote(i),/Connect Twelve Data/);
});
async function fixture(t,fetcher){const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-economy-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const app=express();app.use(express.json());app.use('/api/economy',economyRoutes({root,config:{openaiApiKey:'fixture-key'},auth:(req,res,next)=>{const user=req.get('Authorization');if(!user)return res.sendStatus(401);req.user={name:user,role:user==='owner'?'admin':'member'};next();},fetcher}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port+'/api/economy';return {root,call:async(url='',body,user='owner',method)=>{const r=await fetch(base+url,{method:method||(body?'POST':'GET'),headers:{...(user?{Authorization:user}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>null)};}};}
test('authenticated API isolates experiments, ignores submitted prices and exposes no provider secrets',async t=>{
 const f=await fixture(t,()=>assert.fail('Demo needs no external data'));
 assert.equal((await f.call('',null,null)).status,401);const setup=await f.call();assert.equal(setup.data.settings.agents,true);assert.ok(!JSON.stringify(setup.data).includes('fixture-key'));
 assert.equal((await f.call('/settings',{twelveDataApiKey:'test'},'guest','PUT')).status,403);
 const created=await f.call('/experiments',{name:'Private experiment',mode:'demo',initial:10000}),id=created.data.id;
 assert.equal((await f.call('/experiments/'+id+'/export',null,'guest')).status,404);
 const input={instrument:demo,clientId:'manual0001',side:'buy',quantity:1,price:0.01};const trade=await f.call('/experiments/'+id+'/orders',input);assert.equal(trade.status,201);assert.ok(trade.data.price>90);
 assert.equal((await f.call('/experiments/'+id+'/orders',input)).data.id,trade.data.id);assert.equal((await f.call()).data.experiments[0].orders.length,1);
 await f.call('/experiments/'+id,{paused:true},'owner','PATCH');assert.equal((await f.call('/experiments/'+id+'/orders',{...input,clientId:'manual0002'})).status,400);
 const store=createStore(path.join(f.root,'.economy'));assert.equal(store.read('owner').experiments[0].orders.length,1);assert.equal(store.read('guest').experiments.length,0);
});
test('client renders USDT quotes and exposes provider setup only to an administrator',async()=>{
 const vm=require('node:vm'),syncFs=require('node:fs'),controls=new Map(),root={innerHTML:'',scrollTop:0,querySelectorAll(selector){const attr=selector.slice(1,-1),re=new RegExp(attr+'="([^"]+)"','g');return [...this.innerHTML.matchAll(re)].map(m=>{const camel=attr.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),b={dataset:{[camel]:m[1]}};controls.set(attr+':'+m[1],b);return b;});}};
 const btc={provider:'binance',symbol:'BTCUSDT',exchange:'Binance',currency:'USDT',name:'Bitcoin'},state={mode:'economy',user:'alice',role:'admin',q:''};
 const data={settings:{stocks:false,agents:false,dailyRounds:10,models:{}},watchlist:[],experiments:[],seeds:[btc],roles:[],demo};
 let catalogueCalls=0;const context=vm.createContext({state,URLSearchParams,innerWidth:1280,document:{body:{classList:{toggle(){}}}},$:s=>s==='#scroll'?root:root.innerHTML.includes('id="'+s.slice(1)+'"')?(controls.get(s)||controls.set(s,{}).get(s)):null,esc:v=>String(v??'').replaceAll('<','&lt;'),icon:()=>'',Intl,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,fetch:async url=>({ok:!url.includes('/catalogue?')||++catalogueCalls>1,json:async()=>url.includes('/catalogue?')?catalogueCalls===1?{error:'Fixture catalogue unavailable'}:{items:[],total:0,globalTotal:0,page:0,pageSize:25,exchanges:[],countries:[],currencies:[]}:url.endsWith('/market')?{quote:{instrument:btc,price:83000,changePct:1,asOf:now,marketOpen:true,source:'Fixture',delay:'Fixture'},history:[]}:data})});
 vm.runInContext(syncFs.readFileSync(path.join(__dirname,'../public/economy.js'),'utf8')+'\nglobalThis.client=Economy;',context);context.client.sync();context.client.render();await new Promise(r=>setImmediate(r));
 assert.match(root.innerHTML,/Catalogue unavailable/);assert.doesNotMatch(root.innerHTML,/data-instrument=/);await controls.get('#ecoRetryCatalogue').onclick();assert.equal(catalogueCalls,2);assert.doesNotMatch(root.innerHTML,/Catalogue unavailable/);controls.get('#ecoCrypto').onclick();await controls.get('data-instrument:0').onclick();assert.match(root.innerHTML,/83,000 USDT/);
 controls.get('data-eco-tab:setup').onclick();assert.match(root.innerHTML,/Provider settings/);
 state.role='member';context.client.render();assert.doesNotMatch(root.innerHTML,/id="ecoSettings"/);assert.match(root.innerHTML,/Ask a Vault administrator/);
});
