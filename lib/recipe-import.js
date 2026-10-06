'use strict';
const https=require('node:https');
const http=require('node:http');
const dns=require('node:dns/promises');
const net=require('node:net');
const {Parser}=require('htmlparser2');
const Model=require('../public/recipe-model');

function publicAddress(address){
  if(net.isIPv4(address)){
    const [a,b]=address.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19)));
  }
  // Only global-unicast IPv6; reject mapped IPv4, local, link-local and multicast.
  return net.isIPv6(address)&&/^[23][0-9a-f]{3}:/i.test(address)&&!/^2001:(?:db8|0):/i.test(address)&&!/^2002:/i.test(address);
}
async function fetchPublic(address,redirects=0,kind='page'){
  const url=new URL(address);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||(url.port&&!['80','443'].includes(url.port)))throw Error('Use a public HTTP or HTTPS recipe link.');
  const host=url.hostname.replace(/^\[|\]$/g,'');
  const answers=net.isIP(host)?[{address:host,family:net.isIP(host)}]:await dns.lookup(host,{all:true});
  if(!answers.length||answers.some(a=>!publicAddress(a.address)))throw Error('Only public recipe websites can be imported.');
  const chosen=answers[0];
  return new Promise((resolve,reject)=>{
    const request=(url.protocol==='https:'?https:http).get(url,{
      headers:{'User-Agent':'VaultRecipeImporter/1.0','Accept':kind==='image'?'image/jpeg,image/png,image/webp,image/gif':'text/html,application/xhtml+xml','Accept-Encoding':'identity'},
      lookup:(_host,options,cb)=>options?.all?cb(null,[chosen]):cb(null,chosen.address,chosen.family),
    },response=>{
      if([301,302,303,307,308].includes(response.statusCode)){
        response.resume();if(redirects>=4){reject(Error('Too many redirects. Paste the recipe text instead.'));return;}
        try{resolve(fetchPublic(new URL(response.headers.location,url).href,redirects+1,kind));}catch(e){reject(e);}return;
      }
      if(response.statusCode!==200){response.resume();reject(Error('This website did not share its recipe. Paste the caption below instead.'));return;}
      const type=String(response.headers['content-type']||'').split(';')[0].trim().toLowerCase();
      if(!(kind==='image'?['image/jpeg','image/png','image/webp','image/gif'].includes(type):['text/html','application/xhtml+xml'].includes(type))){response.resume();reject(Error(kind==='image'?'The recipe photo could not be imported.':'That link is not a recipe page.'));return;}
      let size=0;const chunks=[];
      response.on('data',chunk=>{size+=chunk.length;if(size>(kind==='image'?15:3)*1024*1024)request.destroy(Error('Import too large. Upload a smaller image or paste the recipe text.'));else chunks.push(chunk);});
      response.on('end',()=>resolve(kind==='image'?{body:Buffer.concat(chunks),type}:{html:Buffer.concat(chunks).toString('utf8'),url:url.href}));response.on('error',reject);
    });
    const timer=setTimeout(()=>request.destroy(Error('The website took too long. Paste the caption instead.')),12000);
    request.on('close',()=>clearTimeout(timer));request.on('error',reject);
  });
}
function plain(value){let text='';const p=new Parser({ontext:t=>{text+=t;},onclosetag:t=>{if(['p','div','li','br'].includes(t))text+='\n';}},{decodeEntities:true});p.write(String(value||''));p.end();return text.trim();}
function steps(value){
  if(typeof value==='string')return plain(value).split(/\n+/).map(s=>s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
  if(Array.isArray(value))return value.flatMap(steps);
  if(value&&typeof value==='object')return value.itemListElement?steps(value.itemListElement):steps(value.text||value.name||'');
  return [];
}
function findRecipe(node,depth=0){
  if(!node||depth>12||typeof node!=='object')return null;
  if([node['@type']].flat().some(t=>t==='Recipe'||/\/Recipe$/.test(t||'')))return node;
  for(const val of Object.values(node)){if(val&&typeof val==='object'){const found=findRecipe(val,depth+1);if(found)return found;}}return null;
}
function imageUrl(value,base){const raw=typeof value==='string'?value:Array.isArray(value)?imageUrl(value[0],base):value?.url||value?.contentUrl;try{const url=new URL(raw,base);return ['http:','https:'].includes(url.protocol)&&raw?url.href:'';}catch{return '';}}
function parseText(text){
  const lines=String(text||'').slice(0,60000).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  let title='',section='',ingredients=[],instructions=[];
  for(const line of lines){
    if(/^(?:ingredients|ingredienser|you(?:'|’)ll need)\s*:?$/i.test(line)){section='ingredients';continue;}
    if(/^(?:instructions|directions|method|steps|how to make|fremgangsmåte|slik gjør du)\s*:?$/i.test(line)){section='steps';continue;}
    if(/^(?:notes|nutrition|macros|nutrition facts|tips)\s*:/i.test(line)){section='notes';continue;}
    if(section==='notes')continue;
    if(section==='ingredients'){ingredients.push(Model.parseIngredient(line));continue;}
    if(section==='steps'||/^\d+[.)]\s/.test(line)){instructions.push(line.replace(/^\d+[.)]\s*/,''));section='steps';continue;}
    const ingredient=Model.parseIngredient(line);
    if(ingredient.quantity!==null){ingredients.push(ingredient);continue;}
    if(!title)title=line;else if(!/^#|^@|https?:\/\//.test(line))instructions.push(line);
  }
  return {title:title||'New recipe',ingredients,instructions,servings:1,sourceNutrition:null,description:''};
}
function parseHTML(html,url){
  let json='',inJson=false,title='',inTitle=false;const documents=[],meta={};
  const parser=new Parser({
    onopentag(name,attrs){if(name==='script'&&/application\/ld\+json/i.test(attrs.type||'')){inJson=true;json='';}if(name==='title')inTitle=true;if(name==='meta')meta[attrs.property||attrs.name]=attrs.content;},
    ontext(text){if(inJson)json+=text;if(inTitle)title+=text;},
    onclosetag(name){if(name==='script'&&inJson){try{documents.push(JSON.parse(json));}catch{}inJson=false;}if(name==='title')inTitle=false;},
  },{decodeEntities:true});parser.write(html);parser.end();
  const recipe=documents.map(d=>findRecipe(d)).find(Boolean);
  if(!recipe){
    const caption=meta['og:description']||meta.description||'';
    const draft=parseText(caption);draft.title=plain(meta['og:title']||title||draft.title).slice(0,160);
    return {draft:{...draft,sourceUrl:url,imageUrl:imageUrl(meta['og:image'],url)},needsText:true,message:'No structured recipe was available. Paste the full caption to fill in the ingredients and steps, then review.'};
  }
  const n=recipe.nutrition||{},sourceNutrition={};
  const fields={calories:'calories',protein:'proteinContent',carbs:'carbohydrateContent',fat:'fatContent',fiber:'fiberContent',sugar:'sugarContent',saturatedFat:'saturatedFatContent',cholesterol:'cholesterolContent',sodium:'sodiumContent'};
  for(const [key,field] of Object.entries(fields)){const raw=n[field];if(raw==null)continue;const value=Number(String(raw).match(/[\d.]+/)?.[0]);if(Number.isFinite(value))sourceNutrition[key]=value;}
  const servings=Number(String(recipe.recipeYield||'').match(/\d+(?:\.\d+)?/)?.[0])||1;
  const duration=String(recipe.totalTime||recipe.cookTime||'').replace(/^PT/,'').toLowerCase();
  return {draft:{title:plain(recipe.name),description:plain(recipe.description),servings,time:duration,sourceUrl:url,imageUrl:imageUrl(recipe.image,url),ingredients:(recipe.recipeIngredient||[]).map(i=>Model.parseIngredient(typeof i==='string'?plain(i):`${i.value||''} ${i.unitText||i.unitCode||''} ${i.name||''}`.trim())),instructions:steps(recipe.recipeInstructions),sourceNutrition:Object.keys(sourceNutrition).length?sourceNutrition:null},needsText:false,message:'Imported. Check the quantities and serving count before saving.'};
}
module.exports={publicAddress,fetchPublic,parseText,parseHTML,plain};
