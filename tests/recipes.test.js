'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const express=require('express');
const Model=require('../public/recipe-model');
const {normalize,createRecipeStore}=require('../lib/recipes');
const {publicAddress,parseText,parseHTML}=require('../lib/recipe-import');
const routes=require('../lib/recipe-routes');
const recipe=()=>({title:'Seven lunches',servings:7,ingredients:['700 g chicken breast','2 tbsp olive oil'],instructions:['Heat the oven to 200°C.','Bake until cooked through.']});

test('converts US mass and volume separately, retaining fractions and unsupported quantities',()=>{
  assert.equal(Model.convert(1,'lb','g'),453.59237);
  assert.equal(Model.convert(1,'oz','g'),28.349523125);
  assert.equal(Model.convert(1,'fl oz','dl'),.295735295625);
  assert.equal(Model.convert(1,'oz','dl'),null);
  assert.equal(Model.convert(100,'ml','g',.9),90);
  assert.equal(Model.parseIngredient('1½ cups milk').quantity,1.5);
  assert.equal(Model.parseIngredient('3/4 lb chicken').unit,'lb');
  assert.equal(Model.parseIngredient('250g flour').quantity,250);
  assert.equal(Model.parseIngredient('250g flour').unit,'g');
  assert.equal(Model.parseIngredient('1-2 lemons').quantity,null);
  assert.equal(Model.parseIngredient('2 x 400 g tomatoes').quantity,null);
  assert.equal(Model.parseIngredient('salt to taste').quantity,null);
  assert.equal(Model.amount({quantity:100,unit:'g'},2,'metric'),'200 g');
});
test('nutrition scales the batch and meal denominator independently without inventing missing nutrients',()=>{
  const r={servings:7,ingredients:[{name:'Chicken',quantity:700,unit:'g',food:{nutrients:{calories:100,protein:20,fat:0}}},{name:'Oil',quantity:2,unit:'tbsp'}]};
  const total=Model.nutrition(r,1,1),meal=Model.nutrition(r,1,7),double=Model.nutrition(r,2,7);
  assert.equal(total.values.calories,700);assert.equal(meal.values.calories,100);assert.equal(double.values.calories,200);
  assert.equal(meal.values.fat,0);assert.equal(meal.values.vitaminC,null);assert.equal(total.matched,1);assert.equal(total.total,2);
  assert.equal(Model.grams(r.ingredients[1]),null);
  const publisher=Model.nutrition({servings:7,sourceNutrition:{calories:250},ingredients:[]},2,14);
  assert.equal(publisher.values.calories,250);assert.equal(publisher.values.protein,null);
});
test('USDA mapping uses nutrient IDs, energy fallback, and leaves unreported vitamins blank',()=>{
  const f=Model.fromUSDA({fdcId:1,description:'Example',foodNutrients:[{nutrientId:2048,value:120},{nutrientId:1003,value:12},{nutrientId:1106,value:30}]});
  assert.equal(f.nutrients.calories,120);assert.equal(f.nutrients.protein,12);assert.equal(f.nutrients.vitaminA,30);assert.equal(f.nutrients.vitaminD,undefined);
});
test('imports nested Recipe JSON-LD and numbered captions without executing page content',()=>{
  const html=`<script type="application/ld+json">${JSON.stringify({'@graph':[{'@type':'Recipe',name:'Fish & rice',recipeYield:'7 servings',image:[{url:'/cover.jpg'}],recipeIngredient:['700 g fish','2 cups rice'],recipeInstructions:[{'@type':'HowToSection',name:'Prep',itemListElement:[{'@type':'HowToStep',text:'<b>Rinse</b> rice.'}]},{text:'Bake fish.'}],nutrition:{calories:'300 calories',proteinContent:'20 g'}}]})}</script>`;
  const result=parseHTML(html,'https://example.org/recipe');assert.equal(result.draft.servings,7);assert.deepEqual(result.draft.instructions,['Rinse rice.','Bake fish.']);assert.equal(result.draft.imageUrl,'https://example.org/cover.jpg');assert.equal(result.draft.sourceNutrition.calories,300);
  const caption=parseText('Lemon chicken\nIngredients:\n500 g chicken\n2 tbsp oil\nInstructions:\n1. Heat the pan.\n2. Cook the chicken.');
  assert.equal(caption.title,'Lemon chicken');assert.equal(caption.ingredients.length,2);assert.equal(caption.instructions[0],'Heat the pan.');
  assert.equal(parseHTML('<title>Instagram</title>','https://instagram.com/reel/example').needsText,true);
});
test('recipe importer rejects local, private, mapped and link-local network addresses',()=>{
  for(const a of ['127.0.0.1','10.0.0.1','172.16.1.2','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2002:7f00:1::1'])assert.equal(publicAddress(a),false,a);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
});
test('private persistence preserves recipe IDs, isolates users and retains completed shopping items for undo',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-recipes-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const store=createRecipeStore(root);
  const saved=store.save('alice',recipe());assert.equal(store.read('bob').recipes.length,0);assert.equal(createRecipeStore(root).get('alice',saved.id).title,'Seven lunches');
  const list=store.addShopping('alice',saved.id,2);assert.equal(list[0].quantity,1400);store.checkShopping('alice',list[0].id,true);assert.equal(store.read('alice').shopping.filter(i=>!i.done).length,1);
  store.checkShopping('alice',list[0].id,false);assert.equal(store.read('alice').shopping.filter(i=>!i.done).length,2);
  assert.throws(()=>store.save('bob',recipe(),saved.id),/not found/);assert.throws(()=>normalize({...recipe(),servings:0}),/Servings/);
  assert.equal(normalize({...recipe(),sourceUrl:'javascript:alert(1)',imageUrl:'data:text/html,test'}).imageUrl,'');
});
test('authenticated routes support CRUD, caption import, shopping, chunk retry and byte-range media with ownership checks',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-recipe-api-'));const app=express();app.use(express.json({limit:'256kb'}));
  app.use('/api/recipes',routes({root,config:{},auth(req,res,next){if(!req.get('X-Test-User'))return res.status(401).json({error:'Not signed in'});req.user={name:req.get('X-Test-User')};next();}}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}/api/recipes`;
  const call=(p='',options={},user='alice')=>fetch(base+p,{...options,headers:{'Content-Type':'application/json','X-Test-User':user,...options.headers}});
  assert.equal((await fetch(base)).status,401);
  assert.equal((await call('',{method:'POST',headers:{'Sec-Fetch-Site':'cross-site'},body:JSON.stringify(recipe())})).status,403);
  const r=await (await call('',{method:'POST',body:JSON.stringify(recipe())})).json();assert(r.id);
  const imported=await (await call('/import',{method:'POST',body:JSON.stringify({text:'Porridge\nIngredients:\n100 g oats\nInstructions:\nCook in water.'})})).json();assert.equal(imported.draft.ingredients.length,1);
  const blocked=await call('/import',{method:'POST',body:JSON.stringify({url:'http://127.0.0.1/secret'})});assert.equal(blocked.status,400);
  assert.equal((await call('/'+r.id,{method:'PUT',body:JSON.stringify(recipe())},'bob')).status,400);
  const items=await (await call('/shopping/add',{method:'POST',body:JSON.stringify({recipeId:r.id,scale:1})})).json();assert.equal(items.shopping.length,2);
  assert.equal((await call('/shopping/'+items.shopping[0].id,{method:'PATCH',body:'{"done":true}'},'bob')).status,400);
  const bytes=Buffer.from('000000206674797069736f6d00000000','hex');
  const u=await (await call('/'+r.id+'/upload',{method:'POST',body:JSON.stringify({kind:'video',name:'clip.mp4',size:bytes.length})})).json();
  const chunk=offset=>call('/uploads/'+u.id+'/chunk?offset='+offset,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:bytes});
  assert.equal((await call('/uploads/'+u.id+'/finish',{method:'POST',body:'{}'},'bob')).status,404);
  assert.equal((await chunk(0)).status,200);const retry=await chunk(0);assert.equal(retry.status,409);assert.equal((await retry.json()).offset,bytes.length);
  const saved=await (await call('/uploads/'+u.id+'/finish',{method:'POST',body:'{}'})).json();assert.equal(saved.video.mime,'video/mp4');
  const partial=await call('/'+r.id+'/media/video',{headers:{Range:'bytes=0-3'}});assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,4);
  assert.equal((await call('/'+r.id+'/media/video',{},'bob')).status,404);
  const bad=await (await call('/'+r.id+'/upload',{method:'POST',body:JSON.stringify({kind:'image',name:'photo.jpg',size:5})})).json();await call('/uploads/'+bad.id+'/chunk?offset=0',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:'<html'});
  assert.equal((await call('/uploads/'+bad.id+'/finish',{method:'POST',body:'{}'})).status,400);
  assert.equal((await call('/'+r.id,{method:'DELETE'})).status,200);assert.equal((await call('/'+r.id+'/media/video')).status,404);
});
