'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {normalize,createRecipeStore}=require('../lib/recipes'),{enrichDetails}=require('../lib/recipe-enrichment'),D=require('../public/recipe-details'),M=require('../public/recipe-model'),{createImageQueue}=require('../lib/recipe-images');
const collection=require('../lib/recipe-reel-collection');
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-recipe-details-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return createRecipeStore(root);}
const input={title:'Chicken burritos',servings:12,ingredients:['1200 g chicken','12 tortillas'],instructions:['Cook the chicken.','Fill the tortillas.']};
async function finished(queue,user,id){for(let n=0;n<100&&queue.active(user,id);n++)await new Promise(r=>setTimeout(r,10));assert.equal(queue.active(user,id),false);}
test('curated step amounts scale for three burritos, shopping agrees, and migration is idempotent',async t=>{
 const store=await fixture(t),source=collection.find(r=>r.code==='DMGVunyJSpv');const r=store.save('alice',{...source,sourceUrl:'https://www.instagram.com/reel/'+source.code+'/'});
 enrichDetails(store,'alice');const saved=store.get('alice',r.id),scale=D.scaleFor(saved,3);assert.equal(scale,.25);assert.equal(D.yieldLabel(saved),'burritos');
 const step=D.stepItems(saved,1);assert.deepEqual(step.map(x=>x.ingredient.quantity*scale),[340,10,7.5,.75,5]);assert(step.every(x=>!x.uncertain));
 assert.equal(store.addShopping('alice',r.id,scale)[3].quantity,340);assert.equal(M.nutrition(saved,scale,3,'publisher').values.protein,42);
 assert.equal(saved.aiImage.mime,'image/png');assert.equal(saved.cover,'original');assert.equal(store.read('bob').recipes.length,0);
 enrichDetails(store,'alice');assert.deepEqual(store.get('alice',r.id),saved);assert.equal(D.scaleFor(saved,0),null);assert.equal(D.scaleFor(saved,Infinity),null);
});
test('curated and sample step links reference valid ingredients and text changes invalidate links',async t=>{
 const store=await fixture(t);store.initializeSamples('alice');for(const r of collection)store.save('alice',{...r,sourceUrl:'https://www.instagram.com/reel/'+r.code+'/'});enrichDetails(store,'alice');
 for(const r of store.read('alice').recipes){assert(r.aiImage);assert.equal(r.stepIngredients.length,r.instructions.length);assert(r.stepIngredients.flat().every(ref=>r.ingredients.some(i=>i.id===ref.id)));}
 const r=store.read('alice').recipes[0];assert.equal(normalize({...r,instructions:['Changed instructions']},r).stepIngredients,null);
 const selected=store.save('alice',{...r,cover:'ai'},r.id);assert.equal(selected.cover,'ai');assert.deepEqual(selected.aiImage,r.aiImage);
});
test('inferred repeated ingredients identify recipe totals without fabricating split amounts',()=>{
 const r=normalize({...input,instructions:['Use half the chicken.','Cook the remaining chicken.','Fill tortillas.']});
 assert.equal(D.stepItems(r,0)[0].uncertain,true);assert.equal(D.stepItems(r,1)[0].uncertain,true);assert.equal(D.stepItems(r,2)[0].uncertain,false);
});
test('image generation queues once, keeps original cover and enforces persisted daily allowance',async t=>{
 const store=await fixture(t),r=store.save('alice',input);let calls=0;
 const image=await fs.readFile(path.join(__dirname,'../lib/recipe-ai/pasta.png'));
 const queue=createImageQueue(store,{openaiApiKey:'test-only',recipeImageDailyLimit:1},async(url,opts)=>{calls++;assert.equal(url,'https://api.openai.com/v1/images/generations');assert.equal(JSON.parse(opts.body).model,'gpt-image-2');await new Promise(r=>setTimeout(r,10));return {ok:true,json:async()=>({data:[{b64_json:image.toString('base64')}]})};});
 queue.enqueue('alice',r.id);queue.enqueue('alice',r.id);await finished(queue,'alice',r.id);assert.equal(calls,1);assert.equal(store.get('alice',r.id).aiStatus,'ready');assert.equal(store.get('alice',r.id).cover,'original');
 const second=store.save('alice',input);queue.enqueue('alice',second.id);assert.match(store.get('alice',second.id).aiStatus,/Daily/);assert.equal(store.get('alice',second.id).aiImage,null);
 assert.equal(store.read('alice').imageUsage.count,1);
});
test('failed provider responses do not expose response secrets or attach invalid photos',async t=>{
 const store=await fixture(t),r=store.save('alice',input);const queue=createImageQueue(store,{openaiApiKey:'test-only'},async()=>({ok:true,json:async()=>({data:[{b64_json:Buffer.from('provider secret').toString('base64')}]})}));
 queue.enqueue('alice',r.id);await finished(queue,'alice',r.id);assert.equal(store.get('alice',r.id).aiImage,null);assert.match(store.get('alice',r.id).aiStatus,/Could not generate/);assert(!JSON.stringify(store.read('alice')).includes('provider secret'));
});
test('a recipe changed during generation does not receive an outdated image',async t=>{
 const store=await fixture(t),r=store.save('alice',input),bytes=await fs.readFile(path.join(__dirname,'../lib/recipe-ai/pasta.png'));
 const queue=createImageQueue(store,{openaiApiKey:'test-only'},async()=>{store.save('alice',{...r,title:'Vegetarian soup'},r.id);return {ok:true,json:async()=>({data:[{b64_json:bytes.toString('base64')}]})};});
 queue.enqueue('alice',r.id);await finished(queue,'alice',r.id);assert.equal(store.get('alice',r.id).aiImage,null);assert.match(store.get('alice',r.id).aiStatus,/Recipe changed/);
});
test('Norwegian presentation covers included recipes, persists separately and restores English',async()=>{
 let preference='nb';const context=vm.createContext({localStorage:{getItem:key=>{assert.equal(key,'vault-recipe-language');return preference;},setItem:(key,value)=>{assert.equal(key,'vault-recipe-language');preference=value;}},RecipeModel:M,RecipeDetails:D});
 for(const file of ['recipe-norwegian','recipe-language','recipe-extras'])vm.runInContext(await fs.readFile(path.join(__dirname,'../public/'+file+'.js'),'utf8'),context);
 for(const r of [...collection,...require('../lib/recipe-samples')])for(const text of [r.title,r.description,...r.instructions]){context.phrase=text;assert.notEqual(vm.runInContext('RecipeLanguage.text(phrase)',context),text);}
 assert.equal(vm.runInContext("RecipeLanguage.text('Recipes')",context),'Oppskrifter');assert.equal(vm.runInContext("RecipeLanguage.text('My own untouched recipe')",context),'My own untouched recipe');
 context.recipe=normalize(collection.find(r=>r.code==='DMGVunyJSpv'));assert.match(vm.runInContext('RecipeExtras.stepText(recipe,5,.25)',context),/3 like porsjoner/);
 vm.runInContext("RecipeLanguage.set('en')",context);assert.equal(preference,'en');assert.equal(vm.runInContext("RecipeLanguage.text('Recipes')",context),'Recipes');
});
