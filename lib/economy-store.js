'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const round=n=>Math.round(n*1e8)/1e8;
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
const number=(value,min,max,label)=>{const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)fail(`${label} must be between ${min} and ${max}.`);return n;};
const key=i=>`${i.provider}:${i.symbol}:${i.exchange||''}`;
function instrument(i){
 if(!i||!['twelve','binance','demo'].includes(i.provider)||!/^[-A-Z0-9./]{1,30}$/.test(i.symbol)||!/^[-A-Za-z0-9 ]{0,40}$/.test(i.exchange||'')||! /^[A-Z]{3,6}$/.test(i.currency))fail('Choose a valid market instrument.');
 return {provider:i.provider,symbol:i.symbol,exchange:i.exchange||'',currency:i.currency,name:String(i.name||i.symbol).slice(0,100)};
}
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(data),{mode:0o600});for(let attempt=0;;attempt++){try{fs.renameSync(tmp,file);break;}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=5)throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10*(2**attempt));}}}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
function createStore(dir){
 const file=user=>path.join(dir,crypto.createHash('sha256').update(user).digest('hex')+'.json');
 const read=user=>{try{return JSON.parse(fs.readFileSync(file(user),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return {version:1,watchlist:[],experiments:[],usage:{day:'',count:0}};}};
 return {read,write:(user,data)=>atomic(file(user),{...data,owner:user}),accounts(){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')).owner).filter(Boolean);},recover(){if(!fs.existsSync(dir))return;for(const name of fs.readdirSync(dir).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){const p=path.join(dir,name),d=JSON.parse(fs.readFileSync(p,'utf8'));let changed=false;for(const e of d.experiments)for(const r of e.rounds)if(r.status==='running'){r.status='interrupted';if(r.reservedUSD)r.costUncertain=true;r.error='Server restarted. No unfinished decision was executed.';changed=true;}if(changed)atomic(p,d);}}};
}
function createExperiment(input){
 const currency=String(input.currency||'USD');if(!['USD','NOK','EUR','USDT'].includes(currency))fail('Choose USD, NOK, EUR or USDT.');
 const name=String(input.name||'').trim();if(!name||name.length>80)fail('Give the experiment a name (up to 80 characters).');
 const mode=input.mode==='demo'?'demo':'paper',initial=number(input.initial??100000,100,1e8,'Starting cash');
 if(input.mode&&!['demo','paper'].includes(input.mode))fail('Choose demo or paper trading.');
 const horizon=input.horizon==='day'?'day':'long';
 return {id:crypto.randomUUID(),name,currency,mode,horizon,created:Date.now(),initial,cash:initial,paused:false,positions:[],orders:[],rounds:[],snapshots:[],benchmark:null,
 rules:{feeBps:number(input.feeBps??10,0,100,'Commission'),spreadBps:number(input.spreadBps??10,0,500,'Spread'),slippageBps:number(input.slippageBps??5,0,500,'Slippage'),maxPositionPct:number(input.maxPositionPct??20,1,100,'Position limit'),maxDailyLossPct:number(input.maxDailyLossPct??3,0.1,25,'Daily loss limit'),maxTradesPerDay:number(input.maxTradesPerDay??10,1,100,'Daily order limit')}};
}
function quoteValid(e,q,now=Date.now(),forTrade=true){
 if(!q||!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(q.asOf)||q.asOf<=0)fail('A valid quote is required. Refresh market data.');
 if(q.instrument.currency!==e.currency)fail('This instrument uses a different currency. Create a matching-currency experiment.');
 if((q.instrument.provider==='demo')!==(e.mode==='demo'))fail('Demo prices and real-market experiments cannot be mixed.');
 if(forTrade&&(now-q.asOf>(e.horizon==='day'?120000:1200000)||q.asOf>now+60000||q.marketOpen!==true))fail('Market is closed or the quote is too old. Refresh during market hours; day trading needs quotes under two minutes old.');
}
function valuation(e,now=Date.now()){
 const marketValue=e.positions.reduce((sum,p)=>sum+p.quantity*(p.mark?.price??p.avgCost),0),equity=round(e.cash+marketValue),pnl=round(equity-e.initial);
 const stale=e.positions.some(p=>!p.mark||now-p.mark.asOf>1200000);
 const peak=Math.max(e.initial,e.peakEquity||0,equity,...e.snapshots.map(s=>s.equity));
 return {equity,cash:e.cash,marketValue:round(marketValue),pnl,returnPct:pnl/e.initial*100,fees:round(e.orders.reduce((s,o)=>s+o.fee,0)),realized:round(e.orders.reduce((s,o)=>s+(o.realized||0),0)),drawdownPct:(equity-peak)/peak*100,stale,benchmark:e.benchmark?.last?round(e.initial*e.benchmark.last/e.benchmark.start):null};
}
function mark(e,quotes,now=Date.now()){
 for(const p of e.positions){const q=quotes.find(q=>key(q.instrument)===key(p.instrument));if(q){quoteValid(e,q,now,false);p.mark={price:q.price,asOf:q.asOf};}}
 if(e.benchmark){const q=quotes.find(q=>key(q.instrument)===key(e.benchmark.instrument));if(q){quoteValid(e,q,now,false);if(!e.benchmark.start){e.benchmark.start=q.price;e.benchmark.started=now;}e.benchmark.last=q.price;e.benchmark.asOf=q.asOf;}}
 const v=valuation(e,now);if(!v.stale){e.peakEquity=Math.max(e.peakEquity||e.initial,v.equity);e.maxDrawdownPct=Math.min(e.maxDrawdownPct||0,(v.equity-e.peakEquity)/e.peakEquity*100);e.daily=e.daily||[];const day=new Date(now).toISOString().slice(0,10),record={day,at:now,equity:v.equity,benchmark:v.benchmark};if(e.daily.at(-1)?.day===day)e.daily[e.daily.length-1]=record;else e.daily.push(record);e.snapshots.push({at:now,equity:v.equity,benchmark:v.benchmark});e.snapshots=e.snapshots.slice(-3000);}return v;
}
function execute(e,input,q,now=Date.now()){
 const id=String(input.clientId||'');if(!/^[a-zA-Z0-9_-]{8,100}$/.test(id))fail('An idempotency clientId is required.');
 const old=e.orders.find(o=>o.clientId===id);if(old)return old;
 if(e.paused)fail('Experiment is paused. Resume it before trading.');
 if(e.orders.length>=10000)fail('This experiment reached its order limit. Start a new experiment.');
 quoteValid(e,q,now);const side=input.side;if(!['buy','sell'].includes(side))fail('Choose buy or sell.');
 const qty=number(input.quantity,0.000001,1e9,'Quantity'),day=new Date(now).toISOString().slice(0,10),daily=e.orders.filter(o=>new Date(o.at).toISOString().slice(0,10)===day);
 if(daily.length>=e.rules.maxTradesPerDay)fail('Daily order limit reached (UTC).');
 const v=valuation(e,now);if(v.stale)fail('Refresh all held positions before trading.');
 const opening=e.snapshots.find(s=>new Date(s.at).toISOString().slice(0,10)===day)?.equity||e.initial;
 if(side==='buy'&&v.equity<opening*(1-e.rules.maxDailyLossPct/100))fail('Daily loss limit reached. New buys are blocked.');
 const slip=e.rules.spreadBps/2+e.rules.slippageBps,price=round(q.price*(1+(side==='buy'?1:-1)*slip/10000)),gross=round(qty*price),fee=round(gross*e.rules.feeBps/10000);
 let p=e.positions.find(p=>key(p.instrument)===key(q.instrument)),realized=0;
 if(side==='buy'){
  if(gross+fee>e.cash+1e-7)fail('Not enough simulated cash, including fees.');
  if(((p?.quantity||0)+qty)*q.price>v.equity*e.rules.maxPositionPct/100+1e-7)fail('This order exceeds the position limit.');
  if(!p){p={instrument:q.instrument,quantity:0,avgCost:0};e.positions.push(p);}
  p.avgCost=round((p.avgCost*p.quantity+gross+fee)/(p.quantity+qty));p.quantity=round(p.quantity+qty);e.cash=round(e.cash-gross-fee);
 }else{
  if(!p||qty>p.quantity+1e-8)fail('Not enough shares. Short selling and leverage are disabled.');
  realized=round(gross-fee-qty*p.avgCost);p.quantity=round(p.quantity-qty);e.cash=round(e.cash+gross-fee);
 }
 p.mark={price:q.price,asOf:q.asOf};e.positions=e.positions.filter(p=>p.quantity>1e-8);
 const order={id:crypto.randomUUID(),clientId:id,at:now,side,quantity:qty,instrument:q.instrument,price,quotePrice:q.price,quoteAt:q.asOf,source:q.source,fee,gross,realized,actor:input.actor||'manual',roundId:input.roundId||null};e.orders.push(order);return order;
}
module.exports={createStore,createExperiment,instrument,key,number,fail,atomic,valuation,mark,execute,quoteValid};
