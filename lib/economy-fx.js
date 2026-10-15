'use strict';
// Rates always mean reporting-currency units per ONE quoted instrument unit.
const units={GBp:['GBP',0.01],GBX:['GBP',0.01],ZAc:['ZAR',0.01],ILA:['ILS',0.01]};
function currencyUnit(currency){return units[currency]||[currency,1];}
const globalMarkets=e=>e.mode==='paper'&&e.marketScope==='global';
function fxValid(fx,from,to,now,maxAge=1200000){
 if(!fx||fx.from!==from||fx.to!==to||!Number.isFinite(fx.rate)||fx.rate<=0||!Number.isFinite(fx.asOf)||fx.asOf<=0||fx.asOf>now+60000||now-fx.asOf>maxAge)throw Object.assign(Error(`A fresh ${from} → ${to} exchange rate is required. Check currency coverage and refresh market data.`),{status:400});
 return fx.rate;
}
function basePrice(e,q,now,forTrade=false){
 if(q.instrument.currency===e.currency)return q.price;
 if(!globalMarkets(e))throw Object.assign(Error('This instrument uses a different currency. Enable Global markets in run settings.'),{status:400});
 return q.price*fxValid(q.fx,q.instrument.currency,e.currency,now,forTrade&&e.horizon==='day'?120000:1200000);
}
module.exports={currencyUnit,globalMarkets,fxValid,basePrice};
