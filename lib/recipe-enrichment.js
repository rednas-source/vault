'use strict';
const path=require('node:path'),fs=require('node:fs');
const collection=require('./recipe-reel-collection');
const samples=require('./recipe-samples').map(r=>({...r,code:r.cover.replace('.jpg',''),ingredients:r.ingredients.map(require('../public/recipe-model').parseIngredient)}));
// Ingredient indices checked against each curated method. Empty steps only heat,
// rest or handle an already assembled mixture; no ingredient is added there.
const maps={
 pasta:[[0],[2,3],[1,6,7],[],[4,5]],oats:[[4],[0,1,2,6,7],[],[3,5]],pancakes:[[0,1,2,3],[4,5,6],[7],[],[8,9]],
 DHja6NsJigP:[[0,1,2],[],[3,4,5,6,7,8],[9,10,11],[12],[]],
 DIrV94jJeGk:[[0,1,2,3,4,5,6,7],[],[8],[12],[9,10,11],[]],
 DMnsBcEpZXO:[[],[0,1,2,3,4,5,6],[7,8,9],[],[10,11,12,13,14,5],[],[]],
 DMGVunyJSpv:[[0,1,2],[3,4,5,6,7],[],[9,10,11,12],[13,14],[15]],
 DGJPGUYSnVB:[[0,1,2,3,4],[7,8,9,10,11,2,3],[5,6],[12,13,15],[14],[16,17]],
 DOB_QOcAR9r:[[0,1,2],[3,4,5,6,7,8,9,10],[],[11,12,13,14],[15],[16]],
 DRH_aJfEeTI:[[0,1,2],[3,4,5,6,7,8],[9,10,11],[],[12,13,14,15,16,17],[18]],
};
function enrichDetails(store,user){
 const data=store.read(user);let changed=false;
 for(const r of data.recipes){
  const source=collection.find(c=>r.sourceUrl?.includes('/'+c.code+'/'))||samples.find(c=>r.image?.file==='sample-'+c.cover&&r.title===c.title);
  if(!source)continue;
  if(!r.aiImage){const file=source.code+'.png',from=path.join(__dirname,'recipe-ai',file);if(fs.existsSync(from)){const dir=path.join(store.directory(user),'media');fs.mkdirSync(dir,{recursive:true});fs.copyFileSync(from,path.join(dir,'ai-'+file));r.aiImage={file:'ai-'+file,mime:'image/png',name:'AI food photo'};changed=true;}}
  if(!r.stepIngredients&&JSON.stringify(r.instructions)===JSON.stringify(source.instructions)&&r.ingredients.length===source.ingredients.length&&r.ingredients.every((i,n)=>i.name===source.ingredients[n].name)){
   r.stepIngredients=maps[source.code.replace('-','_')].map(indices=>indices.map(n=>({id:r.ingredients[n].id,fraction:1})));changed=true;
  }
 }
 if(changed)store.write(user,data);
 return data;
}
module.exports={enrichDetails,maps};
