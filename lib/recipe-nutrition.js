'use strict';
const Model=require('../public/recipe-model');
const mapping={protein:'Protein',carbs:'Karbo',fat:'Fett',fiber:'Fiber',sugar:'Mono+Di',saturatedFat:'Mettet',monoFat:'Enumet',polyFat:'Flerum',cholesterol:'Kolest',sodium:'Na',potassium:'K',calcium:'Ca',iron:'Fe',magnesium:'Mg',phosphorus:'P',zinc:'Zn',copper:'Cu',selenium:'Se',vitaminA:'Vit A',vitaminC:'Vit C',vitaminD:'Vit D',vitaminE:'Vit E',thiamin:'Vit B1',riboflavin:'Vit B2',niacin:'Niacin',vitaminB6:'Vit B6',vitaminB12:'Vit B12'};
function fromNorway(food){
  const nutrients={};if(Number.isFinite(food.calories?.quantity))nutrients.calories=food.calories.quantity;
  for(const [key,id]of Object.entries(mapping)){const n=food.constituents?.find(n=>n.nutrientId===id);if(Number.isFinite(n?.quantity))nutrients[key]=n.quantity;}
  return {id:food.foodId,name:food.foodName,source:'Matvaretabellen',nutrients,portions:(food.portions||[]).filter(p=>p.unit==='g').map(p=>({unit:p.portionUnit,grams:p.quantity}))};
}
let foods,pending,refreshed=0;
async function catalog(){
  foods||=[...require('./recipe-foods.json').foods,...require('./recipe-foods-usda.json').foods];
  if(Date.now()-refreshed<7*86400000)return foods;
  if(!pending){refreshed=Date.now();pending=(async()=>{
    try{const response=await fetch('https://www.matvaretabellen.no/api/en/foods.json',{signal:AbortSignal.timeout(12000)});if(!response.ok)return;const json=await response.json();if(Array.isArray(json.foods)&&json.foods.length>100)foods=[...json.foods.map(fromNorway),...require('./recipe-foods-usda.json').foods];}catch{/* Bundled API snapshot keeps nutrition available offline. */}
  })().finally(()=>{pending=null;});}
  await pending;return foods;
}
const clean=s=>String(s).toLowerCase().replace(/[.,%()]/g,' ').replace(/\s+/g,' ').trim();
// Conservative equivalences only. Brands, fat percentages and raw/cooked state
// must never disappear in an automatic fuzzy match.
const aliases=[
  [/^(?:raw )?chicken breast(?:s)?(?: \(.*\))?$/i,'03.205'],
  [/^boneless skinless chicken thighs(?:, diced)?$/i,'03.333'],
  [/^(?:all.purpose|plain) flour$/i,'05.010'],
  [/^garlic powder$/i,'06.154'],[/^corn\s?starch$/i,'05.015'],
  [/^honey$/i,'09.003'],[/^(?:reduced fat|low.fat) mozzarella$/i,'01.138'],
  [/^(?:sharp )?cheddar$/i,'01.027'],[/^olive oil$/i,'08.019'],
  [/^sweet potato(?:es)?(?:, diced)?$/i,'06.136'],[/^tomato paste$/i,'06.080'],
  [/^(?:coarse )?salt$/i,'12.022'],[/^reduced-fat mozzarella$/i,'01.138'],
  [/^(?:plain )?(?:fat.free|nonfat|0%) Greek yogh?urt$/i,'330137'],
  [/^2% cottage cheese$/i,'328841'],[/^fat.free cheddar$/i,'171295'],
  [/^reduced.fat (?:sharp )?cheddar$/i,'171292'],[/^93% lean ground beef$/i,'173110'],
  [/^skirt steak, exterior fat trimmed$/i,'173374'],[/^flank steak$/i,'2646175'],
  [/^onion powder$/i,'171327'],[/^chili powder$/i,'171319'],
  [/^onions?(?:, diced)?$/i,'06.042'],[/^cumin$/i,'06.266'],[/^salsa$/i,'06.202']
];
function findAutomatic(i,list){
  if(/\bor\b|optional|to taste|&|\band\b|cooked|roasted|fried/i.test(i.name))return null;
  const exact=list.filter(f=>clean(f.name)===clean(i.name));if(exact.length===1)return exact[0];
  const alias=aliases.find(([pattern])=>pattern.test(i.name));return alias?(list.find(f=>f.id===alias[1])||null):null;
}
async function enrich(recipe){
  const list=await catalog();
  recipe.ingredients=recipe.ingredients.map(i=>{
    if(typeof i==='string')i=Model.parseIngredient(i);
    if(i.food)return i;const food=findAutomatic(i,list);if(!food)return i;
    const next={...i,food:{...food,automatic:true}};
    // Use an official volume weight only; piece sizes are too variable to assume.
    const portion=(food.portions||[]).find(p=>p.unit==='dl'&&p.grams>0);
    if(Model.units[i.unit]?.[0]==='volume'&&portion)next.density=portion.grams/100;
    return next;
  });return recipe;
}
async function search(query){
  const list=await catalog(),words=clean(query).split(' ').filter(Boolean);
  return list.map(f=>({f,score:words.reduce((n,w)=>n+(clean(f.name).includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.f.name.length-b.f.name.length).slice(0,16).map(x=>x.f);
}
module.exports={fromNorway,enrich,search,findAutomatic};
