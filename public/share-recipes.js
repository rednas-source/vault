/* A read-only reader: every request is scoped to the share capability. */
(()=>{
  const M=RecipeModel,root=document.getElementById('sharedRecipes');
  const id=location.pathname.split('/').pop(),base='/api/share/'+encodeURIComponent(id)+'/recipes';
  const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=name=>`<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const button=(action,label,style='',extra='')=>`<button type="button" class="rc-button ${style}" data-action="${action}" ${extra}>${label}</button>`;
  const media=(r,kind)=>base+'/'+encodeURIComponent(r.id)+'/media/'+kind+'?v='+encodeURIComponent(r.updated);
  const art=r=>r.image?`<img src="${h(media(r,'image'))}" alt="${h(r.title)}" loading="lazy">`:`<div class="rc-art-empty" aria-label="No recipe photo">${icon('bowl-food')}</div>`;
  let data,active=null,scale=1,meals=1,units='metric',section='recipe',source='ingredients',query='',step=null;
  const checked=new Set();
  function header(){return `<header class="rc-top"><div class="rc-wordmark">${icon('fork-knife')}<span>Recipes<small>SHARED FROM VAULT</small></span></div><div class="rc-top-actions">${button('theme',`${icon('sun')}<span>${document.documentElement.dataset.theme==='light'?'Dark':'Light'} mode</span>`)}</div></header>`;}
  function home(){
    const recipes=data.recipes.filter(r=>(r.title+' '+r.description+' '+r.ingredients.map(i=>i.name).join(' ')).toLowerCase().includes(query.toLowerCase()));
    return `<section class="rc-home-head"><span class="rc-eyebrow">A SHARED COOKBOOK</span><h1>Something good<br><em>to make together.</em></h1><p>Explore the recipes, adjust your portions, and follow along in the kitchen.</p></section><form class="rc-cookbook-search"><label for="recipeSearch">${icon('magnifying-glass')}<span class="rc-sr-only">Search recipes or ingredients</span></label><input id="recipeSearch" value="${h(query)}" placeholder="Search recipes or ingredients"><button class="rc-button quiet">Search</button></form><div class="rc-section-heading"><h2>${query?'Search results':'The cookbook'}</h2><span>${recipes.length} ${recipes.length===1?'recipe':'recipes'}</span></div>${recipes.length?`<div class="rc-grid">${recipes.map(r=>`<article class="rc-card"><button class="rc-card-open" data-action="open" data-id="${h(r.id)}"><div class="rc-card-art">${art(r)}${r.video?`<span class="rc-video-badge">${icon('play')} Video</span>`:''}</div><div class="rc-card-body"><span class="rc-card-meta">${h(r.time)} · ${r.servings} servings</span><h3>${h(r.title)}</h3><p>${h(r.description)}</p></div></button></article>`).join('')}</div>`:`<div class="rc-search-empty"><h2>${query?'No recipes found':'No recipes here yet'}</h2><p>${query?'Try another dish or ingredient.':'Recipes will appear here when the owner adds them.'}</p></div>`}`;
  }
  function nutrition(r){return M.nutrition(r,scale,meals,source);}
  function detail(r){
    const n=nutrition(r),label=n.source==='publisher'?'CREATOR’S VALUES':n.matched<n.total?'PARTIAL INGREDIENT ESTIMATE':'INGREDIENT ESTIMATE';
    return `<div class="rc-detail-nav">${data.kind==='cookbook'?button('home',`${icon('arrow-left')} Cookbook`,'quiet'):'<span class="rc-muted">Shared recipe · Read-only</span>'}</div><section class="rc-hero"><div class="rc-hero-art">${art(r)}</div><div class="rc-hero-copy"><span class="rc-eyebrow">FROM A SHARED COOKBOOK</span><h1 tabindex="-1">${h(r.title)}</h1>${r.description?`<p>${h(r.description)}</p>`:''}<div class="rc-macro-summary"><small>PER PORTION · ${label}</small><div>${['protein','carbs','fat'].map(key=>`<span><b>${n.values[key]==null?'—':M.format(n.values[key])+' g'}</b>${{protein:'Protein',carbs:'Carbs',fat:'Fat'}[key]}</span>`).join('')}</div></div><div class="rc-recipe-meta">${r.time?`<span>${icon('clock')} ${h(r.time)}</span>`:''}<span>${icon('users')} ${r.servings} original servings</span></div>${r.instructions.length?button('cook',`${icon('play')} Start cooking`,'primary'):''}${r.sourceUrl?`<a class="rc-source" href="${h(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">View original recipe ${icon('arrow-up-right')}</a>`:''}</div></section><div class="rc-controls"><label>Batch size <select id="shareScale">${[.5,1,1.5,2,3,4].map(n=>`<option value="${n}" ${scale===n?'selected':''}>${n}× recipe</option>`).join('')}</select></label><label>Divide into <input id="shareMeals" type="number" min="1" max="1000" value="${meals}"> meals</label><label>Units <select id="shareUnits">${[['metric','Metric · g / dl'],['us','US · lb / fl oz'],['original','As written']].map(([key,label])=>`<option value="${key}" ${units===key?'selected':''}>${label}</option>`).join('')}</select></label></div><nav class="rc-tabs" aria-label="Recipe sections">${['recipe','nutrition',...(r.video?['video']:[])].map(key=>button('section',key[0].toUpperCase()+key.slice(1),section===key?'selected':'',`data-section="${key}" aria-pressed="${section===key}"`)).join('')}</nav>${r.reviewNote?`<p class="rc-nutrition-note">${h(r.reviewNote)}</p>`:''}<div class="rc-detail-content">${section==='recipe'?method(r):section==='nutrition'?nutrients(r):`<section class="rc-video"><video controls playsinline preload="metadata" src="${h(media(r,'video'))}" ${r.image?`poster="${h(media(r,'image'))}"`:''}></video></section>`}</div>`;
  }
  function method(r){return `<div class="rc-recipe-columns"><section class="rc-ingredients"><div class="rc-section-heading"><h2>Ingredients</h2><span>${M.format(scale)}× batch</span></div><p class="rc-muted">Check off ingredients as you prep.</p>${r.ingredients.map((i,n)=>`<label class="rc-ingredient"><input type="checkbox" data-check="ingredient-${n}" ${checked.has('ingredient-'+n)?'checked':''}><span><b>${h(M.amount(i,scale,units))}</b> ${h(i.name)}</span></label>`).join('')}</section><section class="rc-method"><div class="rc-section-heading"><h2>Let’s make it</h2><span>${r.instructions.length} steps</span></div>${r.instructions.map((text,n)=>`<label class="rc-step"><input type="checkbox" data-check="step-${n}" ${checked.has('step-'+n)?'checked':''} aria-label="Step ${n+1} complete"><span><b>${n+1}.</b> ${h(text)}</span></label>`).join('')||'<p>No cooking steps have been added yet.</p>'}</section></div>`;}
  function nutrients(r){const n=nutrition(r);return `<div class="rc-nutrition-sources">${r.sourceNutrition?button('source','Creator’s values',source==='publisher'?'selected':'','data-source="publisher"'):''}${button('source','Ingredient estimate',source==='ingredients'?'selected':'','data-source="ingredients"')}</div><h2>Nutrition per portion</h2><p class="rc-nutrition-note">${source==='publisher'?'Creator’s original serving values, adjusted to your batch.':`${n.matched} of ${n.total} ingredients matched and weighed. ${n.matched<n.total?'Totals are partial. ':''}Automatic matches are estimates.`} Values can vary with ingredients and preparation. Missing nutrients appear as —.</p><div class="rc-macros">${M.nutrients.slice(0,4).map(([key,label,unit])=>`<div><span>${label}</span><strong>${n.values[key]==null?'—':M.format(n.values[key])}<small>${unit}</small></strong></div>`).join('')}</div><section class="rc-nutrient-table"><h3>Vitamins, minerals & more</h3>${M.nutrients.slice(4).map(([key,label,unit])=>`<div><span>${label}${source==='ingredients'&&n.coverage[key]>0&&n.coverage[key]<n.total?' · partial':''}</span><b>${n.values[key]==null?'—':M.format(n.values[key])+' '+unit}</b></div>`).join('')}</section><p class="rc-muted">Ingredient data: <a href="https://www.matvaretabellen.no/en/" target="_blank" rel="noopener noreferrer">Matvaretabellen</a> and <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener noreferrer">USDA FoodData Central</a>.</p>`;}
  function cooking(r){return `<section class="rc-cook"><div class="rc-section-heading">${button('close-cook',`${icon('arrow-left')} Recipe`,'quiet')}<span>${step+1} / ${r.instructions.length}</span></div><p class="rc-eyebrow">${h(r.title)}</p><span class="rc-cook-number">STEP ${step+1}</span><h1 tabindex="-1">${h(r.instructions[step])}</h1><details><summary>Ingredients at a glance</summary><ul>${r.ingredients.map(i=>`<li>${h(M.amount(i,scale,units))} ${h(i.name)}</li>`).join('')}</ul></details><div class="rc-cook-actions">${button('previous','Previous','',step===0?'disabled':'')}${button('next',step===r.instructions.length-1?'Finished':'Next step','primary')}</div></section>`;}
  function render(focus){
    root.innerHTML=header()+(active?(step===null?detail(active):cooking(active)):home())+'<footer>Shared from a private Vault. Changes to portions and checkmarks stay on this page.</footer>';
    document.title=(active?.title||'Shared cookbook')+' · Vault';
    root.querySelectorAll('img').forEach(img=>img.onerror=()=>{img.outerHTML=`<div class="rc-art-empty">${icon('bowl-food')}<span>Photo unavailable</span></div>`;});
    if(focus)root.querySelector(focus)?.focus({preventScroll:true});
  }
  function navigate(){
    const recipeId=location.hash.slice(1);active=data.kind==='recipe'?data.recipes[0]:data.recipes.find(r=>r.id===recipeId)||null;
    scale=1;meals=active?.servings||1;section='recipe';source=active?.sourceNutrition?'publisher':'ingredients';step=null;checked.clear();render(active?'h1':undefined);window.scrollTo(0,0);
  }
  root.onclick=e=>{
    const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;
    if(action==='theme'){const theme=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=theme;try{localStorage.setItem('vault-theme',theme);}catch{}b.innerHTML=icon('sun')+`<span>${theme==='light'?'Dark':'Light'} mode</span>`;return;}
    if(action==='open'){location.hash=b.dataset.id;return;}
    if(action==='home'){location.hash='';return;}
    if(action==='section')section=b.dataset.section;
    if(action==='source')source=b.dataset.source;
    if(action==='cook')step=0;
    if(action==='close-cook')step=null;
    if(action==='previous')step=Math.max(0,step-1);
    if(action==='next'){checked.add('step-'+step);step=step===active.instructions.length-1?null:step+1;}
    render(['section','source'].includes(action)?`[data-action="${action}"][data-${action}="${b.dataset[action]}"]`:'h1');
    if(['cook','close-cook','previous','next'].includes(action))window.scrollTo(0,0);
  };
  root.onchange=e=>{
    if(e.target.dataset.check){e.target.checked?checked.add(e.target.dataset.check):checked.delete(e.target.dataset.check);return;}
    if(e.target.id==='shareScale')scale=Number(e.target.value);
    if(e.target.id==='shareUnits')units=e.target.value;
    if(e.target.id==='shareMeals'){const value=Number(e.target.value);if(!Number.isInteger(value)||value<1||value>1000){e.target.value=meals;return;}meals=value;}
    render('#'+e.target.id);
  };
  root.onsubmit=e=>{e.preventDefault();query=root.querySelector('#recipeSearch').value.trim();render('#recipeSearch');};
  window.addEventListener('hashchange',()=>{if(data)navigate();});
  fetch(base,{cache:'no-store'}).then(async res=>{if(!res.ok)throw Error(res.status===410?'This link has expired, was revoked, or its recipes are no longer available.':'Could not load these recipes. Refresh to try again.');return res.json();}).then(value=>{data=value;navigate();}).catch(error=>{root.innerHTML=header()+`<section class="rc-empty" role="alert"><h1>Recipes unavailable</h1><p>${h(error.message)}</p><p>Ask the owner for a new link if this one no longer works.</p></section>`;});
})();
