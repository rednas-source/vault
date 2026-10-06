'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Model=require('../public/recipe-model');
const id=()=>crypto.randomUUID();
const validId=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const fail=message=>{const e=Error(message);e.status=400;throw e;};
const text=(value,max=4000)=>String(value||'').trim().slice(0,max);
function finite(value,max=1e7){if(value==null||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=max?n:null;}
function link(value){if(!value)return '';try{const u=new URL(value);if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password)return u.href.slice(0,2048);}catch{}return '';}
function nutrientValues(input){const result={};for(const [key]of Model.nutrients){const n=finite(input?.[key]);if(n!==null)result[key]=n;}return result;}
function normalize(input,old){
  if(!input||typeof input!=='object')fail('Enter a recipe.');
  const title=text(input.title,160);if(!title)fail('Give your recipe a name.');
  if(!Array.isArray(input.ingredients)||input.ingredients.length>150||!Array.isArray(input.instructions)||input.instructions.length>150)fail('Recipes support up to 150 ingredients and 150 steps.');
  const seen=new Set();
  const ingredients=input.ingredients.map(item=>{
    if(typeof item==='string')item=Model.parseIngredient(item);
    const key=validId(item.id)&&!seen.has(item.id)?item.id:id();seen.add(key);
    const ingredient={id:key,name:text(item.name,500),quantity:finite(item.quantity),unit:text(item.unit,24),original:text(item.original,600),grams:finite(item.grams),density:finite(item.density,100)};
    if(item.food&&text(item.food.name,300))ingredient.food={id:text(item.food.id,40),name:text(item.food.name,300),source:text(item.food.source,80),nutrients:nutrientValues(item.food.nutrients)};
    return ingredient;
  }).filter(i=>i.name);
  const servings=finite(input.servings,1000);if(!(servings>0))fail('Servings must be between 1 and 1,000.');
  return {id:old?.id||id(),title,description:text(input.description,2000),time:text(input.time,80),servings,ingredients,instructions:input.instructions.map(s=>text(s,5000)).filter(Boolean),sourceUrl:link(input.sourceUrl),imageUrl:link(input.imageUrl),sourceNutrition:input.sourceNutrition?nutrientValues(input.sourceNutrition):null,favorite:!!input.favorite,created:old?.created||Date.now(),updated:Date.now(),image:old?.image||null,video:old?.video||null};
}
function createRecipeStore(root){
  function directory(user){return path.join(root,crypto.createHash('sha256').update(user).digest('hex'));}
  function read(user){try{return JSON.parse(fs.readFileSync(path.join(directory(user),'recipes.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return {recipes:[],shopping:[]};}}
  function write(user,data){const dir=directory(user);fs.mkdirSync(dir,{recursive:true});const tmp=path.join(dir,`write-${id()}.tmp`);fs.writeFileSync(tmp,JSON.stringify(data),{mode:0o600});fs.renameSync(tmp,path.join(dir,'recipes.json'));}
  function get(user,key){if(!validId(key))return null;return read(user).recipes.find(r=>r.id===key)||null;}
  return {directory,read,get,write,
    save(user,input,key){const data=read(user),old=key?data.recipes.find(r=>r.id===key):null;if(key&&!old)fail('Recipe not found.');if(!key&&data.recipes.length>=1000)fail('Your cookbook supports up to 1,000 recipes.');const recipe=normalize(input,old);data.recipes=old?data.recipes.map(r=>r.id===key?recipe:r):[recipe,...data.recipes];write(user,data);return recipe;},
    media(user,key,kind,asset){const data=read(user),recipe=data.recipes.find(r=>r.id===key);if(!recipe)fail('Recipe not found.');const old=recipe[kind];recipe[kind]=asset;recipe.updated=Date.now();write(user,data);return old;},
    remove(user,key){const data=read(user);const recipe=data.recipes.find(r=>r.id===key);if(!recipe)fail('Recipe not found.');data.recipes=data.recipes.filter(r=>r.id!==key);write(user,data);return recipe;},
    addShopping(user,key,scale){const data=read(user),recipe=data.recipes.find(r=>r.id===key);if(!recipe)fail('Recipe not found.');if(!(scale>0&&scale<=100))fail('Choose a batch multiplier from 0.1 to 100.');if(data.shopping.length+recipe.ingredients.length>2000)fail('Clear completed items before adding more.');const batch=id();data.shopping.push(...recipe.ingredients.map(i=>({id:id(),batch,recipeId:key,recipeTitle:recipe.title,name:i.name,quantity:i.quantity==null?null:i.quantity*scale,unit:i.unit,density:i.density,done:false})));write(user,data);return data.shopping;},
    checkShopping(user,key,done){const data=read(user),item=data.shopping.find(i=>i.id===key);if(!item)fail('Shopping item not found.');item.done=!!done;write(user,data);return data.shopping;},
    clearShopping(user){const data=read(user);data.shopping=data.shopping.filter(i=>!i.done);write(user,data);return data.shopping;},
  };
}
module.exports={createRecipeStore,normalize,validId,finite};
