'use strict';
const {valuation}=require('./economy-store');
function analytics(e){
 const v=valuation(e),sales=e.orders.filter(o=>o.side==='sell'),won=sales.filter(o=>o.realized>0),lost=sales.filter(o=>o.realized<0);
 const rounds=e.rounds||[],messages=rounds.flatMap(r=>r.messages||[]),known=messages.filter(m=>Number.isFinite(m.estimatedUSD));
 const aiUSD=known.reduce((s,m)=>s+m.estimatedUSD,0),unknown=messages.length-known.length+rounds.filter(r=>r.costUncertain).length;
 const fx=e.currency==='USD'?1:e.research?.usdRate,aiPortfolio=Number.isFinite(fx)&&fx>0?(aiUSD+(e.research?.dataCostUSD||0))*fx:null;
 let peak=e.initial,maxDrawdown=0;for(const p of e.snapshots){peak=Math.max(peak,p.equity);maxDrawdown=Math.min(maxDrawdown,(p.equity-peak)/peak*100);}
 return {aiUSD,dataCostUSD:e.research?.dataCostUSD||0,unknownCostCalls:unknown,aiPortfolio,netPnl:unknown===0&&aiPortfolio!==null?v.pnl-aiPortfolio:null,netReturnPct:unknown===0&&aiPortfolio!==null?(v.pnl-aiPortfolio)/e.initial*100:null,realized:v.realized,unrealized:v.pnl-v.realized,closedSales:sales.length,winRate:sales.length?won.length/sales.length*100:null,profitFactor:lost.length?won.reduce((s,o)=>s+o.realized,0)/-lost.reduce((s,o)=>s+o.realized,0):null,maxDrawdown:Math.min(maxDrawdown,e.maxDrawdownPct||0),turnover:e.orders.reduce((s,o)=>s+o.gross,0),benchmarkReturnPct:v.benchmark===null?null:(v.benchmark/e.initial-1)*100,netExcessReturnPct:unknown||aiPortfolio===null||v.benchmark===null?null:(v.equity-aiPortfolio-v.benchmark)/e.initial*100,excessReturnPct:v.benchmark===null?null:(v.equity-v.benchmark)/e.initial*100,rounds:rounds.length,executed:rounds.filter(r=>r.status==='executed').length,held:rounds.filter(r=>r.status==='held').length,failed:rounds.filter(r=>['failed','blocked','interrupted'].includes(r.status)).length,tokens:messages.reduce((s,m)=>s+(m.usage?.input||0)+(m.usage?.output||0),0),exposure:e.positions.map(p=>({symbol:p.instrument.symbol,value:p.quantity*(p.mark?.price||p.avgCost),pct:p.quantity*(p.mark?.price||p.avgCost)/v.equity*100,unrealized:p.quantity*((p.mark?.price||p.avgCost)-p.avgCost)}))};
}
module.exports={analytics};
