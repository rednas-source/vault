'use strict';
const {createExperiment,fail}=require('./economy-store');
const {councilRoles}=require('./economy-council');
const {seeds}=require('./economy-market');
function prepareSolTests(data,shortHours=4,now=Date.now()){
 if(![1,4].includes(shortHours))fail('Choose a one-hour or four-hour short test.');
 const specs=[{id:`sol-${shortHours}h-v1`,name:`Sol · ${shortHours}-hour trading test`,horizon:'day',hours:shortHours,interval:15,budget:20},{id:'sol-30d-v1',name:'Sol · 30-day investing test',horizon:'long',hours:720,interval:1440,budget:10}];
 if(data.experiments.length+specs.filter(s=>!data.experiments.some(e=>e.preset===s.id)).length>20)fail('Keep up to 20 experiments.');
 return specs.map(s=>{
  const existing=data.experiments.find(e=>e.preset===s.id);if(existing)return existing;
  const e=createExperiment({name:s.name,horizon:s.horizon,mode:'paper',currency:'USD',initial:100000});
  e.created=now;e.preset=s.id;e.universe=seeds.filter(i=>['AAPL','MSFT','NVDA','AMZN','GOOGL'].includes(i.symbol));
  // Resolve the unique US ETF by symbol; do not guess the provider's exchange alias.
  e.benchmark={instrument:{provider:'twelve',symbol:'SPY',name:'SPDR S&P 500 ETF',exchange:'',currency:'USD'},start:null,last:null};
  e.research={models:Object.fromEntries(councilRoles.map(r=>[r.id,'gpt-6.1-sol'])),source:'preset',batchSize:2,intervalMinutes:s.interval,durationHours:s.hours,budgetUSD:s.budget,dataCostUSD:0,spentUSD:0,enabled:false,endsAt:null,nextAt:null,cursor:0};
  data.experiments.push(e);return e;
 });
}
module.exports={prepareSolTests};
