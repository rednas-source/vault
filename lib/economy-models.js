'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {atomic,fail}=require('./economy-store');
const PRICE_SOURCE='https://developers.openai.com/api/docs/pricing.md';
const DAY=86400000;
// The council uses text Responses with structured outputs, not media/embedding/chat-only models.
const councilModel=id=>/^(?:gpt-(?:[5-9]|[1-9]\d)(?:\.\d+)?(?:-(?:astra|sol|luna|terra|mini|nano|pro))?|gpt-4\.1(?:-(?:mini|nano))?|gpt-4o(?:-mini)?|o[134](?:-(?:mini|pro))?)$/.test(id);
function parsePrices(markdown){
 const section=markdown.split(/^### Standard pricing data\s*$/m)[1]?.split(/^### /m)[0];
 if(!section)throw Error('Official standard pricing table was not found.');
 const rows=section.split(/\r?\n/).filter(l=>l.trim().startsWith('|')).map(l=>l.trim().slice(1,-1).split('|').map(c=>c.trim()));
 const headers=rows[0]||[],index=n=>headers.indexOf(n),short=index('Short context input')>=0;
 const input=index(short?'Short context input':'Input'),output=index(short?'Short context output':'Output');
 if(headers[0]!=='Model'||input<0||output<0)throw Error('Official pricing columns have changed.');
 const amount=(row,n)=>{if(n<0||row[n]==='-')return null;const s=row[n]||'';if(!/^\$\d+(?:\.\d+)?$/.test(s))throw Error('Unrecognized official token price.');const v=Number(s.slice(1));if(v>10000)throw Error('Token price exceeds supported range.');return v;};
 const prices={};
 for(const row of rows.slice(2)){
  const id=row[0]?.replace(/\s+\([^)]*\)$/,'');if(!councilModel(id))continue;
  if(prices[id])throw Error('Ambiguous standard model pricing.');
  const rate={input:amount(row,input),output:amount(row,output),cachedInput:amount(row,index(short?'Short context cached input':'Cached input')),cacheWrite:amount(row,index('Short context cache writes'))};
  if(rate.input===null||rate.output===null)continue;
  if(short&&amount(row,index('Long context input'))!==null){
   if(!/Short context: (?:≤|<=)272K input tokens/.test(markdown))throw Error('Long-context pricing threshold could not be verified.');
   rate.long={input:amount(row,index('Long context input')),output:amount(row,index('Long context output')),cachedInput:amount(row,index('Long context cached input')),cacheWrite:amount(row,index('Long context cache writes'))};
   if(rate.long.output===null)throw Error('Incomplete long-context pricing.');rate.threshold=272000;
  }
  prices[id]=rate;
 }
 if(!Object.keys(prices).length)throw Error('No supported text-model prices found.');return prices;
}
function createModelCatalogue({file,fetcher=fetch,clock=Date.now}){
 let pricing=null,available=null,pending=null,lastAttempt=-Infinity,lastError='';
 try{const p=JSON.parse(fs.readFileSync(file,'utf8'));if(p.version===1&&p.source===PRICE_SOURCE&&p.markdown){pricing={at:p.at,prices:parsePrices(p.markdown)};}}catch{}
 const fresh=(record,ttl)=>!!record&&clock()>=record.at&&clock()-record.at<ttl;
 const fingerprint=key=>crypto.createHash('sha256').update(key||'').digest('hex');
 async function text(url,headers){let r;try{r=await fetcher(url,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw Error('Could not reach OpenAI model or pricing information. Try Refresh models & prices.');}if(!r.ok)throw Error('OpenAI model/pricing lookup failed ('+r.status+'). Check the API key and retry.');const body=await r.text();if(body.length>2000000)throw Error('OpenAI catalogue response was too large.');return body;}
 async function refresh(apiKey,force=false){
  if(!apiKey)fail('Save an OpenAI API key before loading available models.');
  const keyId=fingerprint(apiKey);if(available?.keyId!==keyId){available=null;lastAttempt=-Infinity;}
  if(!force&&fresh(pricing,DAY)&&fresh(available,3600000))return;
  if(pending){await pending;return refresh(apiKey,false);}
  if(clock()-lastAttempt<60000){if(lastError)throw Error(lastError);return;}
  lastAttempt=clock();
  pending=(async()=>{
   const results=await Promise.allSettled([
    force||!fresh(pricing,DAY)?text(PRICE_SOURCE,{Accept:'text/markdown'}).then(markdown=>{const prices=parsePrices(markdown),at=clock();atomic(file,{version:1,source:PRICE_SOURCE,at,markdown});pricing={at,prices};}):Promise.resolve(),
    force||!fresh(available,3600000)?text('https://api.openai.com/v1/models',{Authorization:'Bearer '+apiKey,Accept:'application/json'}).then(body=>{const d=JSON.parse(body);if(!Array.isArray(d.data))throw Error('OpenAI returned an invalid model list.');available={keyId,at:clock(),ids:[...new Set(d.data.filter(m=>!m.shutdown_date||Date.parse(m.shutdown_date)>clock()).map(m=>m.id).filter(councilModel))].sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))};}):Promise.resolve()
   ]);
   const rejected=results.find(r=>r.status==='rejected');lastError=rejected?rejected.reason.message:'';if(lastError)throw Error(lastError);
  })();try{await pending;}finally{pending=null;}
 }
 function rates(models){return Object.fromEntries(Object.entries(models).filter(([,id])=>pricing?.prices[id]).map(([role,id])=>[role,{...pricing.prices[id],model:id,source:PRICE_SOURCE,checkedAt:pricing.at}]));}
 async function list(apiKey,force=false){let error='';try{await refresh(apiKey,force);}catch(e){error=e.message;}const validKey=available?.keyId===fingerprint(apiKey);return {items:validKey?available.ids.map(id=>({id,rate:rates({model:id}).model||null})):[],checkedAt:validKey?available.at:null,pricesCheckedAt:pricing?.at||null,source:PRICE_SOURCE,stale:!fresh(pricing,DAY)||!validKey||!fresh(available,3600000),error};}
 async function resolve(models,apiKey){await refresh(apiKey);if(!fresh(pricing,DAY)||!fresh(available,3600000))fail('Current model prices or availability could not be verified. Refresh models & prices in Setup.');
  for(const id of Object.values(models)){if(!available.ids.includes(id))fail(id+' is not an available council model. Choose a model in Setup.');if(!pricing.prices[id])fail('No verified standard price for '+id+'. Choose another model or refresh pricing.');}
  return rates(models);
 }
 return {list,resolve,rates};
}
module.exports={createModelCatalogue,parsePrices,PRICE_SOURCE,councilModel};
