'use strict';
const {Parser}=require('htmlparser2');
const {fetchPublic,parseText}=require('./recipe-import');
const cache=new Map();
function shortcode(address){
  try{const u=new URL(address);if(u.protocol!=='https:'||u.username||u.password||u.port||!['instagram.com','www.instagram.com'].includes(u.hostname))return null;return u.pathname.match(/^\/(?:reel|reels|p)\/([\w-]{5,28})\/?$/)?.[1]||null;}catch{return null;}
}
function parseMedia(html,code){
  let collecting=false,json='',media=null;
  function walk(value,depth=0){if(!value||typeof value!=='object'||depth>60)return;if(value.code===code&&value.video_versions?.length){media=value;return;}for(const child of Object.values(value))walk(child,depth+1);}
  new Parser({onopentag(name,attrs){if(name==='script'&&attrs.type==='application/json'){collecting=true;json='';}},ontext(value){if(collecting)json+=value;},onclosetag(name){if(name==='script'&&collecting){try{walk(JSON.parse(json));}catch{}collecting=false;}}}).end(html);
  if(!media)throw Error('Instagram did not share this reel publicly. Paste its caption and upload the video instead.');
  const videoUrl=media.video_versions.find(v=>v.url)?.url;
  const imageUrl=media.image_versions2?.candidates?.find(i=>i.url)?.url||'';
  return {caption:media.caption?.text||'',videoUrl,imageUrl,creator:media.user?.username||''};
}
async function instagram(address){
  const code=shortcode(address);if(!code)throw Error('Use a public Instagram reel or post link.');
  const cached=cache.get(code);if(cached&&Date.now()-cached.at<10*60000)return cached.value;
  const page=await fetchPublic('https://www.instagram.com/p/'+code+'/');
  const media=parseMedia(page.html,code),sourceUrl='https://www.instagram.com/reel/'+code+'/';
  const curated=require('./recipe-reel-collection').find(r=>r.code===code);
  const draft=curated?structuredClone(curated):parseText(media.caption);
  delete draft.code;
  Object.assign(draft,{sourceUrl,imageUrl:media.imageUrl,importVideo:true});
  const value={draft,...media,message:draft.instructions.length?'Reel imported. Review servings, ingredient matches and cooking steps before saving. The video and cover will be saved with the recipe.':'Caption imported. This caption does not include a cooking method; review the video and add its steps before saving. The video and cover will be saved with the recipe.'};
  if(cache.size>=50)cache.delete(cache.keys().next().value);cache.set(code,{at:Date.now(),value});return value;
}
module.exports={shortcode,parseMedia,instagram};
