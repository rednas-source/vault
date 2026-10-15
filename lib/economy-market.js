'use strict';
const {instrument,key,fail}=require('./economy-store');
const seeds=[['AAPL','Apple','NASDAQ','USD'],['MSFT','Microsoft','NASDAQ','USD'],['NVDA','NVIDIA','NASDAQ','USD'],['AMZN','Amazon','NASDAQ','USD'],['GOOGL','Alphabet','NASDAQ','USD'],['SPY','SPDR S&P 500 ETF','NYSE','USD'],['EQNR','Equinor','OSL','NOK'],['DNB','DNB Bank','OSL','NOK'],['NHY','Norsk Hydro','OSL','NOK'],['TEL','Telenor','OSL','NOK']].map(([symbol,name,exchange,currency])=>({provider:'twelve',symbol,name,exchange,currency}));
const cryptoSeeds=[['BTCUSDT','Bitcoin'],['ETHUSDT','Ethereum'],['SOLUSDT','Solana']].map(([symbol,name])=>({provider:'binance',symbol,name,exchange:'Binance',currency:'USDT'}));
const demo={provider:'demo',symbol:'DEMO',name:'Demo company · synthetic',exchange:'Simulation',currency:'USD'};
function createMarket(settings,fetcher=fetch,clock=Date.now){
 const cache=new Map(),pending=new Map();let minute=[],day='',daily=0;
 async function json(url,provider){
  if(provider==='twelve'){
   const now=clock(),today=new Date(now).toISOString().slice(0,10);if(day!==today){day=today;daily=0;}minute=minute.filter(t=>now-t<60000);
   const limits=settings();if(minute.length>=(limits.requestsPerMinute||8)||daily>=(limits.requestsPerDay||700))throw Object.assign(new Error('Stock data request allowance reached. Check the usage and plan limits in Setup.'),{status:429});minute.push(now);daily++;
  }
  let res;try{res=await fetcher(url,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{Accept:'application/json'}});}catch{throw Error('Market data connection failed. Try again.');}
  if(!res.ok)throw Object.assign(Error(`Market data provider returned ${res.status}. Check your key, plan and provider availability.`),{status:res.status});
  const text=await res.text();if(text.length>30e6)throw Error('Market data response was too large.');let data;try{data=JSON.parse(text);}catch{throw Error('Market data provider returned an invalid response.');}
  if(data.status==='error'||data.code<0)throw Object.assign(Error('The provider could not return this instrument. Check symbol, exchange, key and plan coverage.'),{status:Number(data.code)===429?429:502});return data;
 }
 async function td(endpoint,params){const k=settings().twelveDataApiKey;if(!k)throw Object.assign(new Error('Connect Twelve Data in Setup to load stock prices.'),{status:409});const url=new URL('https://api.twelvedata.com/'+endpoint);for(const [n,v]of Object.entries({...params,apikey:k}))if(v!==undefined&&v!=='')url.searchParams.set(n,v);return json(url,'twelve');}
 async function cached(id,ttl,fn){const hit=cache.get(id);if(hit&&clock()-hit.at<ttl)return hit.value;if(pending.has(id))return pending.get(id);const p=fn().then(value=>{if(cache.size>300)cache.delete(cache.keys().next().value);cache.set(id,{at:clock(),value});return value;}).finally(()=>pending.delete(id));pending.set(id,p);return p;}
 async function search(query){const q=String(query||'').trim().slice(0,60);if(q.length<2)return [...seeds,...cryptoSeeds];if(!settings().twelveDataApiKey)return [...seeds,...cryptoSeeds].filter(i=>(i.name+' '+i.symbol).toLowerCase().includes(q.toLowerCase()));
  return cached('search:'+q,3600000,async()=>{const d=await td('symbol_search',{symbol:q,outputsize:20});return [...(d.data||[]).filter(i=>i.currency&&/Stock|ETF|Depositary/.test(i.instrument_type||'')).map(i=>{try{return instrument({provider:'twelve',symbol:i.symbol,name:i.instrument_name,exchange:i.exchange,currency:i.currency});}catch{return null;}}).filter(Boolean),...cryptoSeeds.filter(i=>(i.name+i.symbol).toLowerCase().includes(q.toLowerCase()))].slice(0,25);});
 }
 async function quote(raw){const i=instrument(raw);return cached('quote:'+key(i),45000,async()=>{
  if(i.provider==='demo')return {instrument:i,price:100+Math.sin(clock()/3600000)*3,changePct:0,asOf:clock(),marketOpen:true,source:'Synthetic demo',delay:'Synthetic; not market data'};
  if(i.provider==='binance'){
   if(!cryptoSeeds.some(s=>s.symbol===i.symbol))fail('Choose a supported Binance pair.');
   const d=await json('https://data-api.binance.vision/api/v3/ticker/24hr?symbol='+encodeURIComponent(i.symbol),'binance');return clean({instrument:{...i,currency:'USDT'},price:+d.lastPrice,changePct:+d.priceChangePercent,asOf:+d.closeTime,marketOpen:true,source:'Binance public market data',delay:'Provider timestamp'});
  }
  const d=await td('quote',{symbol:i.symbol,exchange:i.exchange});if(d.symbol!==i.symbol||!d.currency)throw Error('Provider returned an unexpected instrument.');
  return clean({instrument:{...i,currency:d.currency,name:d.name||i.name},price:+d.close,changePct:Number.isFinite(+d.percent_change)?+d.percent_change:null,asOf:+d.timestamp*1000,marketOpen:d.is_market_open===true,source:'Twelve Data',delay:'Real-time or delayed according to your plan'});
 });}
 function clean(q){if(!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(q.asOf)||q.asOf<=0)throw Error('Provider quote is missing price or timestamp.');return q;}
 async function history(raw,range='3m'){const intraday=range==='day',count=intraday?96:({'1m':30,'3m':90,'1y':365,'5y':1825})[range]||90;const i=instrument(raw);return cached('history:'+key(i)+':'+count,300000,async()=>{
  if(i.provider==='demo')return Array.from({length:60},(_,n)=>({at:clock()-(59-n)*864e5,close:95+n*.1+Math.sin(n*.4)*3}));
  if(i.provider==='binance'){if(!cryptoSeeds.some(s=>s.symbol===i.symbol))fail('Choose a supported pair.');const d=await json('https://data-api.binance.vision/api/v3/klines?symbol='+encodeURIComponent(i.symbol)+'&interval='+(intraday?'5m':'1d')+'&limit='+Math.min(count,1000),'binance');return d.map(v=>({at:+v[0],close:+v[4]}));}
  const d=await td('time_series',{symbol:i.symbol,exchange:i.exchange,interval:intraday?'5min':'1day',outputsize:count,timezone:'UTC'});return (d.values||[]).map(v=>({at:Date.parse(v.datetime.includes(' ')?v.datetime.replace(' ','T')+'Z':v.datetime+'T00:00:00Z'),close:+v.close})).filter(v=>Number.isFinite(v.at)&&Number.isFinite(v.close)).reverse();
 });}
 async function catalogue(filters={}){
  const all=await cached('catalogue',86400000,async()=>{const d=await td('stocks',{});return (d.data||[]).map(v=>{try{return {...instrument({provider:'twelve',symbol:v.symbol,name:v.name,exchange:v.exchange,currency:v.currency}),country:String(v.country||'')};}catch{return null;}}).filter(Boolean).sort((a,b)=>key(a).localeCompare(key(b)));});
  const q=String(filters.q||'').toLowerCase().slice(0,60);
  const items=all.filter(i=>(!filters.exchange||i.exchange===filters.exchange)&&(!filters.country||i.country===filters.country)&&(!filters.currency||i.currency===filters.currency)&&(!q||(i.symbol+' '+i.name).toLowerCase().includes(q)));
  return {items,total:items.length,exchanges:[...new Set(all.map(i=>i.exchange))].sort(),countries:[...new Set(all.map(i=>i.country).filter(Boolean))].sort(),asOf:cache.get('catalogue')?.at};
 }
 async function pace(){const now=clock();minute=minute.filter(t=>now-t<60000);if(minute.length>=(settings().requestsPerMinute||8))await new Promise(r=>setTimeout(r,Math.max(0,60010-(now-minute[0]))));}
 function usage(){return {minute:minute.filter(t=>clock()-t<60000).length,day:day===new Date(clock()).toISOString().slice(0,10)?daily:0};}
 return {search,catalogue,pace,usage,quote,history,seeds:[...seeds,...cryptoSeeds],demo,clear:()=>cache.clear()};
}
module.exports={createMarket,seeds,cryptoSeeds,demo};
