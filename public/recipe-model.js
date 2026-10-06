/* Shared recipe arithmetic. No ingredient density is assumed. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RecipeModel=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const units={g:['mass',1],kg:['mass',1000],oz:['mass',28.349523125],lb:['mass',453.59237],ml:['volume',1],dl:['volume',100],l:['volume',1000],'fl oz':['volume',29.5735295625],cup:['volume',236.5882365],tbsp:['volume',14.78676478125],tsp:['volume',4.92892159375]};
  const aliases={grams:'g',gram:'g',kilograms:'kg',kilogram:'kg',ounces:'oz',ounce:'oz',pounds:'lb',pound:'lb',lbs:'lb',milliliters:'ml',millilitres:'ml',deciliters:'dl',liters:'l',litres:'l',cups:'cup',tablespoons:'tbsp',tablespoon:'tbsp',tbs:'tbsp',teaspoons:'tsp',teaspoon:'tsp',ss:'tbsp',ts:'tsp',stk:'piece',pieces:'piece'};
  const nutrients=[['calories','Energy','kcal',1008],['protein','Protein','g',1003],['carbs','Carbohydrate','g',1005],['fat','Fat','g',1004],['fiber','Fiber','g',1079],['sugar','Total sugars','g',2000],['saturatedFat','Saturated fat','g',1258],['monoFat','Monounsaturated fat','g',1292],['polyFat','Polyunsaturated fat','g',1293],['cholesterol','Cholesterol','mg',1253],['sodium','Sodium','mg',1093],['potassium','Potassium','mg',1092],['calcium','Calcium','mg',1087],['iron','Iron','mg',1089],['magnesium','Magnesium','mg',1090],['phosphorus','Phosphorus','mg',1091],['zinc','Zinc','mg',1095],['copper','Copper','mg',1098],['manganese','Manganese','mg',1101],['selenium','Selenium','µg',1103],['vitaminA','Vitamin A (RAE)','µg',1106],['vitaminC','Vitamin C','mg',1162],['vitaminD','Vitamin D','µg',1114],['vitaminE','Vitamin E','mg',1109],['vitaminK','Vitamin K','µg',1185],['thiamin','Vitamin B1 / thiamin','mg',1165],['riboflavin','Vitamin B2 / riboflavin','mg',1166],['niacin','Vitamin B3 / niacin','mg',1167],['pantothenicAcid','Vitamin B5','mg',1170],['vitaminB6','Vitamin B6','mg',1175],['folate','Folate (DFE)','µg',1190],['vitaminB12','Vitamin B12','µg',1178],['choline','Choline','mg',1180]];
  const fractions={'½':'1/2','¼':'1/4','¾':'3/4','⅓':'1/3','⅔':'2/3','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'};
  function number(text){return String(text).trim().split(/\s+/).reduce((sum,part)=>{const bits=part.split('/').map(Number);return sum+(bits.length===2?bits[0]/bits[1]:bits[0]);},0);}
  function parseIngredient(raw){
    let text=String(raw||'').trim().replace(/^[•*\-]\s*/,'');
    text=text.replace(/(\d)([½¼¾⅓⅔⅛⅜⅝⅞])/g,'$1 $2').replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g,m=>fractions[m]);
    const match=text.match(/^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+|\/\d+)?)\s*/);
    if(!match)return {name:text,quantity:null,unit:'',original:String(raw||'')};
    const quantity=number(match[1].replace(',','.'));let rest=text.slice(match[0].length);
    // Ranges and package expressions require a human choice, never silently drop half.
    if(/^(?:[-–]|to\b|x\s*\d|×|\()/i.test(rest))return {name:text,quantity:null,unit:'',original:String(raw||'')};
    const found=rest.match(/^(fl\.?\s*oz\.?|[a-zA-Z]+)(?=\s|$|\.)\.?\s*/);
    const candidate=found?found[1].toLowerCase().replace(/\./g,'').replace(/\s+/g,' '):'';
    const unit=aliases[candidate]||candidate;
    if(found&&(units[unit]||unit==='piece'))rest=rest.slice(found[0].length);else return {name:rest,quantity,unit:'piece',original:String(raw||'')};
    return {name:rest.replace(/^of\s+/i,''),quantity,unit,original:String(raw||'')};
  }
  function convert(value,from,to,density){
    if(from===to)return value;if(!units[from]||!units[to]||!Number.isFinite(value))return null;
    let base=value*units[from][1];
    if(units[from][0]!==units[to][0]){if(!(density>0))return null;base=units[from][0]==='volume'?base*density:base/density;}
    return base/units[to][1];
  }
  function format(value){return Number.isFinite(value)?new Intl.NumberFormat('en',{maximumFractionDigits:value<1?2:1}).format(value):'';}
  function amount(ingredient,scale=1,system='metric',target){
    let q=ingredient.quantity,u=ingredient.unit||'';if(q==null)return '';
    if(!target&&system!=='original'&&units[u]){
      const base=q*scale*units[u][1];
      target=units[u][0]==='mass'?(system==='metric'?(base>=1000?'kg':'g'):(base>=453.59237?'lb':'oz')):(system==='metric'?(base>=1000?'l':base>=100?'dl':'ml'):'fl oz');
    }
    const changed=target?convert(q,u,target,ingredient.density):q;
    if(changed!==null){q=changed;u=target||u;}
    return `${format(q*scale)}${u&&u!=='piece'?' '+u:''}`;
  }
  function grams(i){if(i.grams!=null&&Number.isFinite(i.grams)&&i.grams>=0)return i.grams;if(i.quantity==null)return null;return convert(i.quantity,i.unit,'g',i.density);}
  function nutrition(recipe,scale=1,portions=1){
    const ingredients=recipe.ingredients||[],matched=ingredients.filter(i=>i.food&&grams(i)!==null);
    const values={},coverage={};
    for(const [key] of nutrients){
      const known=matched.filter(i=>Number.isFinite(i.food.nutrients?.[key]));coverage[key]=known.length;
      values[key]=known.length?known.reduce((n,i)=>n+i.food.nutrients[key]*grams(i)/100,0)*scale/portions:null;
    }
    let source='ingredients';
    if(!matched.length&&recipe.sourceNutrition){source='publisher';for(const [key] of nutrients){const n=recipe.sourceNutrition[key];values[key]=Number.isFinite(n)?n*(recipe.servings||1)*scale/portions:null;}}
    return {values,coverage,matched:matched.length,total:ingredients.length,source};
  }
  function fromUSDA(food){
    const values={};for(const [key,,unit,id] of nutrients){const n=(food.foodNutrients||[]).find(n=>(n.nutrient?.id||n.nutrientId)===id);const amount=n?.amount??n?.value;if(Number.isFinite(amount))values[key]=amount;}
    if(values.calories==null){for(const id of [2048,2047]){const n=(food.foodNutrients||[]).find(n=>(n.nutrient?.id||n.nutrientId)===id);if(Number.isFinite(n?.amount??n?.value)){values.calories=n.amount??n.value;break;}}}
    return {id:String(food.fdcId),name:food.description,source:'USDA FoodData Central',nutrients:values};
  }
  return {units,nutrients,parseIngredient,convert,format,amount,grams,nutrition,fromUSDA};
});
