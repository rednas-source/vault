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

test('shopping combines compatible units while preserving variants, unknown quantities and recipe provenance',()=>{
  const item=(id,name,quantity,unit,done=false)=>({id,name,quantity,unit,done,recipeTitle:id});
  const list=[item('a','milk',2,'dl'),item('b','Milk',400,'ml'),item('c','skimmed milk',1,'dl'),item('d','milk',100,'g'),item('e','milk',1,'dl',true),item('f','salt to taste',null,''),item('g','salt to taste',null,'')];
  const groups=Model.shoppingGroups(list);assert.equal(groups.length,5);assert.equal(groups[4].quantity,null);assert.deepEqual(groups[4].ids,['f','g']);
  assert.equal(groups[0].quantity,6);assert.deepEqual(groups[0].ids,['a','b']);assert.deepEqual(groups[0].recipes,['a','b']);
  assert.equal(Model.parseIngredient('375g (3 cups) all-purpose flour').name,'all-purpose flour');
});

test('creator totals remain available when ingredient estimates are partial',()=>{
  const r={servings:2,sourceNutrition:{protein:40},ingredients:[{name:'chicken',quantity:100,unit:'g',food:{nutrients:{protein:20}}},{name:'tortilla',quantity:2,unit:'piece'}]};
  assert.equal(Model.nutrition(r,1,2).values.protein,40);
  assert.equal(Model.nutrition(r,1,2,'ingredients').values.protein,10);
  assert.equal(Model.nutrition(r,2,4,'publisher').values.protein,40);
});

test('caption macro extraction stops before unrelated food comparisons and handles Unicode line breaks',()=>{
  const draft=parseText('Mini Steak Burritos\u2028Per burrito (Makes 16)\u2028230 cals\u202825g Protein\u20285g Carbs\u202812g Fat\u2028Protein bar comparison\u2028200 cals\u202820g Protein\u2028Ingredients:\u2028900g (32oz) steak\u2028Instructions:\u20281. Sear the steak.');
  assert.equal(draft.title,'Mini Steak Burritos');assert.equal(draft.servings,16);assert.equal(draft.sourceNutrition.protein,25);assert.equal(draft.sourceNutrition.calories,230);assert.equal(draft.ingredients.length,1);assert.deepEqual(draft.instructions,['Sear the steak.']);
});

test('Instagram parser selects the requested public media and canonicalizes duplicate links',()=>{
  const {shortcode,parseMedia}=require('../lib/recipe-instagram');
  assert.equal(shortcode('https://www.instagram.com/reel/DMGVunyJSpv/?srtk=abc'),'DMGVunyJSpv');
  for(const url of ['https://instagram.com.evil.test/reel/DMGVunyJSpv/','http://instagram.com/reel/DMGVunyJSpv/','https://user@instagram.com/reel/DMGVunyJSpv/'])assert.equal(shortcode(url),null);
  const media={code:'DMGVunyJSpv',video_versions:[{url:'https://cdn.example/video.mp4'}],caption:{text:'Chicken'},image_versions2:{candidates:[{url:'https://cdn.example/cover.jpg'}]}};
  const result=parseMedia('<script type="application/json">'+JSON.stringify({data:{if_not_gated_logged_out:media}})+'</script>','DMGVunyJSpv');
  assert.equal(result.caption,'Chicken');assert.throws(()=>parseMedia('<html>Login</html>','DMGVunyJSpv'),/publicly/);
  const collection=require('../lib/recipe-reel-collection');assert.equal(collection.length,7);assert.equal(new Set(collection.map(r=>r.code)).size,7);assert(collection.every(r=>r.ingredients.length>8&&r.instructions.length>=6));
});

test('Norwegian nutrition mapping preserves missing values and avoids cooked/raw and brand substitutions',()=>{
  const N=require('../lib/recipe-nutrition');const food=N.fromNorway({foodId:'x',foodName:'Example',calories:{quantity:50},constituents:[{nutrientId:'Protein',quantity:0},{nutrientId:'Vit C'},{nutrientId:'Folat',quantity:20}]});
  assert.equal(food.nutrients.protein,0);assert.equal(food.nutrients.vitaminC,undefined);assert.equal(food.nutrients.folate,undefined);
  const foods=require('../lib/recipe-foods.json').foods;assert.equal(N.findAutomatic({name:'chicken breast'},foods).id,'03.205');assert.equal(N.findAutomatic({name:'fried chicken breast'},foods),null);assert.equal(N.findAutomatic({name:'fat-free cheddar'},foods),null);
  const combined=[...foods,...require('../lib/recipe-foods-usda.json').foods];assert.equal(N.findAutomatic({name:'fat-free cheddar'},combined).id,'171295');assert.equal(N.findAutomatic({name:'fat-free Greek yogurt'},combined).id,'330137');assert.equal(N.findAutomatic({name:'2% cottage cheese'},combined).id,'328841');assert.equal(N.findAutomatic({name:'Brand X nonfat yogurt'},combined),null);
});

test('group check and clear-all undo are atomic, account-isolated and persist across restart',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-shopping-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const store=createRecipeStore(root);
  const r=store.save('alice',recipe());const items=store.addShopping('alice',r.id,1);store.addShopping('alice',r.id,1);const group=Model.shoppingGroups(store.read('alice').shopping)[0];
  assert.throws(()=>store.checkShoppingGroup('alice',[group.ids[0],'missing'],true),/changed/);assert(store.read('alice').shopping.every(i=>!i.done));
  store.checkShoppingGroup('alice',group.ids,true);assert.equal(store.read('alice').shopping.filter(i=>i.done).length,2);
  store.clearShopping('alice',true);assert.equal(store.read('alice').shopping.length,0);assert.equal(store.restoreShopping('bob').length,0);
  const restarted=createRecipeStore(root);assert.equal(restarted.restoreShopping('alice').length,4);assert.equal(restarted.restoreShopping('alice').length,4);
  restarted.clearShopping('alice');assert.equal(restarted.read('alice').shopping.length,2);assert.equal(restarted.restoreShopping('alice').length,4);
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

test('sample cookbooks initialize once, preserve existing data, and stay deleted after restart',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-recipe-samples-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const store=createRecipeStore(root),first=store.initializeSamples('alice');
  assert.equal(first.recipes.length,3);
  assert.deepEqual(store.initializeSamples('alice'),first);
  for(const recipe of first.recipes){
    assert(recipe.ingredients.length>=8);assert(recipe.instructions.length>=4);
    assert.equal(recipe.sourceNutrition,null);
    const photo=await fs.readFile(path.join(store.directory('alice'),'media',recipe.image.file));
    assert.equal(photo.readUInt16BE(0),0xffd8);
  }
  const saved=store.save('bob',recipe());
  const shopping=store.addShopping('bob',saved.id,2);
  const existing=store.initializeSamples('bob');
  assert.deepEqual(existing.recipes,[saved]);assert.deepEqual(existing.shopping,shopping);
  store.save('alice',{...first.recipes[0],title:'My edited recipe'},first.recipes[0].id);
  assert.equal(store.initializeSamples('alice').recipes[0].title,'My edited recipe');
  for(const r of first.recipes)store.remove('alice',r.id);
  store.remove('bob',saved.id);
  const restarted=createRecipeStore(root);
  assert.deepEqual(restarted.initializeSamples('alice').recipes,[]);
  assert.deepEqual(restarted.initializeSamples('bob').recipes,[]);
  assert.deepEqual(restarted.read('bob').shopping,shopping);
  assert.equal(restarted.initializeSamples('carol').recipes.length,3);
});

test('sample photos use authenticated recipe media and are independent between accounts',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-samples-api-'));
  const app=express();app.use(express.json());
  app.use('/api/recipes',routes({root,config:{},auth(req,res,next){
    if(!req.get('X-Test-User'))return res.sendStatus(401);
    req.user={name:req.get('X-Test-User')};next();
  }}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}/api/recipes`;
  assert.equal((await fetch(base)).status,401);
  const call=(p='',user='alice',method='GET')=>fetch(base+p,{method,headers:{'X-Test-User':user}});
  const first=await(await call()).json(),r=first.recipes[0];
  assert.equal(first.recipes.length,3);
  const image=await call('/'+r.id+'/media/image');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');
  const ai=await call('/'+r.id+'/media/aiImage');assert.equal(ai.status,200);assert.equal(ai.headers.get('content-type'),'image/png');
  assert.equal((await fetch(base+'/'+r.id+'/media/aiImage')).status,401);assert.equal((await call('/'+r.id+'/media/aiImage','bob')).status,404);
  assert.equal((await call('/'+r.id+'/ai-photo','bob','POST')).status,404);
  assert.equal((await call('/'+r.id+'/media/image','bob')).status,404);
  const bob=await(await call('','bob')).json();assert.notEqual(bob.recipes[0].id,r.id);
  assert.equal((await call('/'+r.id,'alice','DELETE')).status,200);
  assert.equal((await call('/'+r.id+'/media/image')).status,404);
  assert.equal((await call('/'+r.id+'/media/aiImage')).status,404);
  assert.equal((await call('/'+bob.recipes[0].id+'/media/image','bob')).status,200);
  assert.equal((await(await call()).json()).recipes.length,2);
});
test('authenticated routes support CRUD, caption import, shopping, chunk retry and byte-range media with ownership checks',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-recipe-api-'));const app=express();app.use(express.json({limit:'256kb'}));
  app.use('/api/recipes',routes({root,config:{recipeAutoImages:false},auth(req,res,next){if(!req.get('X-Test-User'))return res.status(401).json({error:'Not signed in'});req.user={name:req.get('X-Test-User')};next();}}));
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
