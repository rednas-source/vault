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

const foreign={provider:'twelve',symbol:'AAPL',exchange:'NASDAQ',currency:'USD',name:'Apple'};
const nokAccount=()=>account({mode:'paper',currency:'NOK',marketScope:'global',feeBps:10,spreadBps:0,slippageBps:0});
const convertedQuote=(rate=10,overrides={})=>({instrument:foreign,price:100,asOf:now,marketOpen:true,source:'Fixture',fx:{from:'USD',to:'NOK',rate,asOf:now,source:'Fixture'},...overrides});
test('foreign fills, risk limits, profits and buy-and-hold use NOK, including currency movements',()=>{
 const e=nokAccount(),q=convertedQuote();e.benchmark={instrument:foreign,start:null,last:null};mark(e,[q],now);
 const order=execute(e,{clientId:'fx-buy-001',side:'buy',quantity:2},q,now);
 assert.equal(order.price,1000);assert.equal(order.fee,2);assert.equal(order.gross,2000);assert.equal(order.nativeQuotePrice,100);assert.equal(e.cash,7998);assert.equal(e.positions[0].avgCost,1001);
 assert.throws(()=>execute(e,{clientId:'fx-risk-01',side:'buy',quantity:4},q,now),/position limit/);
 const later=convertedQuote(11);mark(e,[later],now);assert.equal(valuation(e,now).equity,10198);assert.equal(valuation(e,now).benchmark,11000);
 const sold=execute(e,{clientId:'fx-sell-01',side:'sell',quantity:2},later,now);assert.equal(sold.realized,195.8);assert.equal(e.cash,10195.8);assert.equal(e.orders[0].fx.rate,10);assert.equal(e.benchmark.startFx.rate,10);
});
test('foreign orders reject missing, stale, reversed and future FX; legacy scope stays single currency',()=>{
 const e=nokAccount(),buy={clientId:'fx-safe-01',side:'buy',quantity:1},q=convertedQuote();e.horizon='day';
 for(const fx of [null,{...q.fx,rate:0},{...q.fx,rate:NaN},{...q.fx,from:'NOK',to:'USD'},{...q.fx,asOf:now-120001},{...q.fx,asOf:now+60001}])assert.throws(()=>execute(e,buy,{...q,fx},now),/exchange rate/);
 e.marketScope='domestic';assert.throws(()=>execute(e,buy,q,now),/Enable Global/);assert.equal(e.orders.length,0);assert.equal(e.cash,10000);
});
test('closed foreign holdings allow another open market to trade only with recently retrieved close and current FX',()=>{
 const e=nokAccount(),q=convertedQuote();execute(e,{clientId:'closed-initial',side:'buy',quantity:1},q,now);
 const closed={...q,asOf:now-3*3600000,marketOpen:false,observedAt:now};mark(e,[closed],now);assert.equal(valuation(e,now).stale,false);assert.equal(valuation(e,now).closedMarketMarks,1);
 const other={...q,instrument:{...foreign,symbol:'MSFT'}};execute(e,{clientId:'open-other-01',side:'buy',quantity:1},other,now);assert.equal(e.orders.length,2);
 assert.throws(()=>execute(e,{clientId:'closed-sell-1',side:'sell',quantity:1},closed,now),/Market is closed/);
 mark(e,[{...closed,observedAt:now-1200001}],now);assert.equal(valuation(e,now).stale,true);
 mark(e,[{...closed,marketOpen:null}],now);assert.equal(valuation(e,now).stale,true);
 assert.throws(()=>mark(e,[{...closed,asOf:now+120000}],now),/valid quote/);
 mark(e,[{...closed,asOf:now-8*86400000}],now);assert.equal(valuation(e,now).stale,true);
});
test('FX adapter caches per major pair, normalizes minor units and never assumes a stablecoin peg',async()=>{
 const pairs=[],market=createMarket(()=>({twelveDataApiKey:'fixture',requestsPerMinute:100}),async url=>{const pair=new URL(url).searchParams.get('symbol');pairs.push(pair);return Response.json({symbol:pair,rate:pair==='GBP/NOK'?13:pair==='USDT/NOK'?9.9:10,timestamp:Math.floor(now/1000)});},()=>now);
 assert.equal((await market.fx('GBp','NOK')).rate,.13);assert.equal((await market.fx('GBX','NOK')).rate,.13);assert.equal((await market.fx('GBP','NOK')).rate,13);assert.equal(pairs.length,1);
 assert.equal((await market.fx('ZAc','NOK')).rate,.1);assert.equal((await market.fx('ILA','NOK')).rate,.1);assert.equal((await market.fx('GBp','GBP')).rate,.01);assert.equal((await market.fx('USDT','NOK')).rate,9.9);assert.ok(pairs.includes('USDT/NOK'));
 const bad=createMarket(()=>({twelveDataApiKey:'fixture'}),async()=>Response.json({symbol:'NOK/USD',rate:10,timestamp:Math.floor(now/1000)}),()=>now);await assert.rejects(bad.fx('USD','NOK'),/unexpected/);
 const old=createMarket(()=>({twelveDataApiKey:'fixture'}),async()=>Response.json({symbol:'USD/NOK',rate:10,timestamp:Math.floor(now/1000)-1201}),()=>now);await assert.rejects(old.fx('USD','NOK'),/fresh/);
});
test('API converts server quotes and ignores client FX, retaining account isolation and foreign benchmark rules',async t=>{
 const f=await fixture(t,async url=>{const u=new URL(url);return u.pathname==='/exchange_rate'?Response.json({symbol:u.searchParams.get('symbol'),rate:10,timestamp:Math.floor(Date.now()/1000)}):Response.json({symbol:'AAPL',currency:'USD',close:100,timestamp:Math.floor(Date.now()/1000),is_market_open:true});});
 await f.call('/settings',{twelveDataApiKey:'fixture',requestsPerMinute:100},'owner','PUT');
 const created=await f.call('/experiments',{name:'Worldwide NOK',currency:'NOK',marketScope:'global',initial:10000,benchmark:foreign,spreadBps:0,slippageBps:0,feeBps:0});assert.equal(created.status,201);
 const trade=await f.call('/experiments/'+created.data.id+'/orders',{instrument:foreign,clientId:'fx-api-001',side:'buy',quantity:1,price:1,basePrice:1,fx:{rate:.001,from:'USD',to:'NOK',asOf:Date.now()}});assert.equal(trade.status,201);assert.equal(trade.data.price,1000);assert.equal(trade.data.fx.rate,10);
 const e=(await f.call()).data.experiments[0];assert.equal(e.summary.benchmark,10000);assert.equal(e.cash,9000);
 assert.equal((await f.call('/experiments',{name:'Legacy NOK',currency:'NOK',benchmark:foreign})).status,400);
 const downgrade=await f.call('/experiments/'+e.id+'/research',{enabled:false,source:'catalogue',marketScope:'domestic'},'owner','PUT');assert.equal(downgrade.status,400);assert.match(downgrade.data.error,/Keep Global/);
});
