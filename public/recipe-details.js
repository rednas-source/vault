(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RecipeDetails=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const clean=s=>String(s||'').toLowerCase().replace(/[^a-zæøå0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  const words=s=>clean(s).split(' ').map(w=>w.replace(/s$/,''));
  function yieldLabel(r){const t=clean(r.title);return /burrito/.test(t)?'burritos':/roll/.test(t)?'rolls':/pizza/.test(t)?'pizza portions':'servings';}
  function scaleFor(r,count){const n=Number(count);return Number.isFinite(n)&&n>0&&n<=1000&&r.servings>0?n/r.servings:null;}
  function stepItems(r,index){
    const explicit=r.stepIngredients?.[index];
    if(Array.isArray(explicit))return explicit.map(ref=>{const ingredient=r.ingredients.find(i=>i.id===ref.id);return ingredient?{ingredient,fraction:ref.fraction??1,uncertain:false}:null;}).filter(Boolean);
    // Conservative fallback for new captions. Repeated mentions are recipe totals,
    // not invented allocations. Curated imports have verified explicit links.
    const text=words(r.instructions[index]).join(' '),ignore=new Set(['fresh','diced','chopped','ground','reduced','fat','free','plain','optional','to','taste','for','garnish','boneless','skinless']);
    return r.ingredients.flatMap(i=>{
      const tokens=words(i.name).filter(w=>!ignore.has(w)&&w.length>2&&!/^\d+$/.test(w));
      const distinctive=tokens.filter(w=>r.ingredients.filter(x=>words(x.name).includes(w)).length===1);
      const matches=s=>distinctive.some(w=>(' '+words(s).join(' ')+' ').includes(' '+w+' '));
      if(!matches(text))return [];
      const mentions=r.instructions.filter(matches).length,divided=/\b(half|remaining|rest|divided|some|little|reserve)\b/i.test(r.instructions[index]);
      return [{ingredient:i,fraction:1,uncertain:mentions>1||divided}];
    });
  }
  return {yieldLabel,scaleFor,stepItems};
});
