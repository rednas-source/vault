/* A read-only reader: every request is scoped to the share capability. */
(()=>{
  const M=RecipeModel,X=RecipeExtras,L=RecipeLanguage,root=document.getElementById('sharedRecipes');
  const id=location.pathname.split('/').filter(Boolean).pop(),base='/api/share/'+encodeURIComponent(id)+'/recipes';
  const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=name=>`<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const button=(action,label,style='',extra='')=>`<button type="button" class="rc-button ${style}" data-action="${action}" ${extra}>${label}</button>`;
  const media=(r,kind)=>base+'/'+encodeURIComponent(r.id)+'/media/'+kind+'?v='+encodeURIComponent(r.updated);
  const art=r=>(r.image||r.aiImage)?`<img src="${h(media(r,X.photoKind(r)))}" alt="${h(r.title)}" loading="lazy">`:`<div class="rc-art-empty" aria-label="No recipe photo">${icon('bowl-food')}</div>`;
  let data,active=null,scale=1,meals=1,units='metric',section='recipe',source='ingredients',query='',step=null;
  const checked=new Set();
  function header(){return `<header class="rc-top"><div class="rc-wordmark">${icon('fork-knife')}<span>Recipes<small>SHARED FROM VAULT</small></span></div><div class="rc-top-actions">${L.control()}${button('theme',`${icon('sun')}<span>${document.documentElement.dataset.theme==='light'?'Dark':'Light'} mode</span>`)}</div></header>`;}
  function home(){
    const recipes=data.recipes.filter(r=>([r.title,r.description,...r.ingredients.map(i=>i.name)].flatMap(t=>[t,L.text(t)]).join(' ')).toLowerCase().includes(query.toLowerCase()));
    return `<section class="rc-home-head"><span class="rc-eyebrow">A SHARED COOKBOOK</span><h1>Something good<br><em>to make together.</em></h1><p>Explore the recipes, adjust your portions, and follow along in the kitchen.</p></section><form class="rc-cookbook-search"><label for="recipeSearch">${icon('magnifying-glass')}<span class="rc-sr-only">Search recipes or ingredients</span></label><input id="recipeSearch" value="${h(query)}" placeholder="Search recipes or ingredients"><button class="rc-button quiet">Search</button></form><div class="rc-section-heading"><h2>${query?'Search results':'The cookbook'}</h2><span>${recipes.length} ${recipes.length===1?'recipe':'recipes'}</span></div>${recipes.length?`<div class="rc-grid">${recipes.map(r=>`<article class="rc-card"><button class="rc-card-open" data-action="open" data-id="${h(r.id)}"><div class="rc-card-art">${art(r)}${r.video?`<span class="rc-video-badge">${icon('play')} Video</span>`:''}</div><div class="rc-card-body"><span class="rc-card-meta">${h(L.text(r.time))} · ${r.servings} servings</span><h3>${h(r.title)}</h3><p>${h(r.description)}</p></div></button></article>`).join('')}</div>`:`<div class="rc-search-empty"><h2>${query?'No recipes found':'No recipes here yet'}</h2><p>${query?'Try another dish or ingredient.':'Recipes will appear here when the owner adds them.'}</p></div>`}`;
  }
  function nutrition(r){return M.nutrition(r,scale,meals,source);}
  function detail(r){
    const n=nutrition(r),label=n.source==='publisher'?'CREATOR’S VALUES':n.matched<n.total?'PARTIAL INGREDIENT ESTIMATE':'INGREDIENT ESTIMATE';
    return `<div class="rc-detail-nav">${data.kind==='cookbook'?button('home',`${icon('arrow-left')} Cookbook`,'quiet'):'<span class="rc-muted">Shared recipe · Read-only</span>'}</div><section class="rc-hero"><div class="rc-hero-photo"><div class="rc-hero-art">${art(r)}</div>${X.photoControls(r,media,false)}</div><div class="rc-hero-copy"><span class="rc-eyebrow">FROM A SHARED COOKBOOK</span><h1 tabindex="-1">${h(r.title)}</h1>${r.description?`<p>${h(r.description)}</p>`:''}<div class="rc-macro-summary"><small>PER PORTION · ${label}</small><div>${['protein','carbs','fat'].map(key=>`<span><b>${n.values[key]==null?'—':M.format(n.values[key])+' g'}</b>${{protein:'Protein',carbs:'Carbs',fat:'Fat'}[key]}</span>`).join('')}</div></div><div class="rc-recipe-meta">${r.time?`<span>${icon('clock')} ${h(L.text(r.time))}</span>`:''}<span>${icon('users')} ${r.servings} original servings</span></div>${r.instructions.length?button('cook',`${icon('play')} Start cooking`,'primary'):''}${r.sourceUrl?`<a class="rc-source" href="${h(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">View original recipe ${icon('arrow-up-right')}</a>`:''}</div></section>${X.controls(r,scale,meals,units,'share')}<nav class="rc-tabs" aria-label="Recipe sections">${['recipe','nutrition',...(r.video?['video']:[])].map(key=>button('section',key[0].toUpperCase()+key.slice(1),section===key?'selected':'',`data-section="${key}" aria-pressed="${section===key}"`)).join('')}</nav>${r.reviewNote?`<p class="rc-nutrition-note">${h(r.reviewNote)}</p>`:''}<div class="rc-detail-content">${section==='recipe'?method(r):section==='nutrition'?nutrients(r):`<section class="rc-video"><video controls playsinline preload="metadata" src="${h(media(r,'video'))}" ${r.image?`poster="${h(media(r,'image'))}"`:''}></video></section>`}</div>`;
  }
  function method(r){return `<div class="rc-recipe-columns"><section class="rc-ingredients"><div class="rc-section-heading"><h2>Ingredients</h2><span>${M.format(scale)}× batch</span></div><p class="rc-muted">Check off ingredients as you prep.</p>${r.ingredients.map((i,n)=>`<label class="rc-ingredient"><input type="checkbox" data-check="ingredient-${n}" ${checked.has('ingredient-'+n)?'checked':''}><span><b>${h(X.amount(i,scale,units))}</b> ${h(L.text(i.name))}</span></label>`).join('')}</section><section class="rc-method"><div class="rc-section-heading"><h2>Let’s make it</h2><span>${r.instructions.length} steps</span></div>${r.instructions.map((text,n)=>`<div class="rc-method-step"><label class="rc-step"><input type="checkbox" data-check="step-${n}" ${checked.has('step-'+n)?'checked':''} aria-label="Step ${n+1} complete"><span><b>${n+1}.</b> ${h(X.stepText(r,n,scale))}</span></label>${X.stepAside(r,n,scale,units)}</div>`).join('')||'<p>No cooking steps have been added yet.</p>'}</section></div>`;}
  function nutrients(r){const n=nutrition(r);return `<div class="rc-nutrition-sources">${r.sourceNutrition?button('source','Creator’s values',source==='publisher'?'selected':'','data-source="publisher"'):''}${button('source','Ingredient estimate',source==='ingredients'?'selected':'','data-source="ingredients"')}</div><h2>Nutrition per portion</h2><p class="rc-nutrition-note">${source==='publisher'?'Creator’s original serving values, adjusted to your batch.':`${n.matched} of ${n.total} ingredients matched and weighed. ${n.matched<n.total?'Totals are partial. ':''}Automatic matches are estimates.`} Values can vary with ingredients and preparation. Missing nutrients appear as —.</p><div class="rc-macros">${M.nutrients.slice(0,4).map(([key,label,unit])=>`<div><span>${label}</span><strong>${n.values[key]==null?'—':M.format(n.values[key])}<small>${unit}</small></strong></div>`).join('')}</div><section class="rc-nutrient-table"><h3>Vitamins, minerals & more</h3>${M.nutrients.slice(4).map(([key,label,unit])=>`<div><span>${label}${source==='ingredients'&&n.coverage[key]>0&&n.coverage[key]<n.total?' · partial':''}</span><b>${n.values[key]==null?'—':M.format(n.values[key])+' '+unit}</b></div>`).join('')}</section><p class="rc-muted">Ingredient data: <a href="https://www.matvaretabellen.no/en/" target="_blank" rel="noopener noreferrer">Matvaretabellen</a> and <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener noreferrer">USDA FoodData Central</a>.</p>`;}
  function cooking(r){return `<section class="rc-cook"><div class="rc-section-heading">${button('close-cook',`${icon('arrow-left')} Recipe`,'quiet')}<span>${step+1} / ${r.instructions.length}</span></div><p class="rc-eyebrow">${h(r.title)}</p><span class="rc-cook-number">STEP ${step+1}</span><h1 tabindex="-1">${h(X.stepText(r,step,scale))}</h1>${X.stepAside(r,step,scale,units)}<details><summary>Ingredients at a glance</summary><ul>${r.ingredients.map(i=>`<li>${h(X.amount(i,scale,units))} ${h(L.text(i.name))}</li>`).join('')}</ul></details><div class="rc-cook-actions">${button('previous','Previous','',step===0?'disabled':'')}${button('next',step===r.instructions.length-1?'Finished':'Next step','primary')}</div></section>`;}
  function render(focus){
    root.innerHTML=header()+(active?(step===null?detail(active):cooking(active)):home())+'<footer>Shared from a private Vault. Changes to portions and checkmarks stay on this page.</footer>';
    document.title=(active?.title||'Shared cookbook')+' · Vault';
    root.querySelectorAll('img').forEach(img=>img.onerror=()=>{img.outerHTML=`<div class="rc-art-empty">${icon('bowl-food')}<span>Photo unavailable</span></div>`;});
    L.apply(root);
    if(focus)root.querySelector(focus)?.focus({preventScroll:true});
  }
  function navigate(){
    const recipeId=location.hash.slice(1);active=data.kind==='recipe'?data.recipes[0]:data.recipes.find(r=>r.id===recipeId)||null;
    scale=1;meals=active?.servings||1;section='recipe';source=active?.sourceNutrition?'publisher':'ingredients';step=null;checked.clear();render(active?'h1':undefined);window.scrollTo(0,0);
  }
  root.onclick=e=>{
    const photo=e.target.closest('[data-photo]');if(photo){active.cover=photo.dataset.photo;render();return;}
    const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;
    if(action==='theme'){const theme=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=theme;try{localStorage.setItem('vault-theme',theme);}catch{}b.innerHTML=icon('sun')+`<span>${theme==='light'?'Dark':'Light'} mode</span>`;L.apply(b);return;}
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
    if(e.target.matches('[data-recipe-language]')){L.set(e.target.value);render();return;}
    if(['shareScale','shareCustom','shareMake'].includes(e.target.id)){const next=e.target.id==='shareMake'?RecipeDetails.scaleFor(active,e.target.value):Number(e.target.value);if(next>0&&next<=1000&&next*active.servings<=1000){scale=next;meals=active.servings*scale;}render();return;}
    if(e.target.id==='shareUnits')units=e.target.value;
    if(e.target.id==='shareMeals'){const value=Number(e.target.value);if(!Number.isFinite(value)||value<=0||value>1000){e.target.value=meals;return;}meals=value;}
    render('#'+e.target.id);
  };
  root.onsubmit=e=>{e.preventDefault();query=root.querySelector('#recipeSearch').value.trim();render('#recipeSearch');};
  window.addEventListener('hashchange',()=>{if(data)navigate();});
  fetch(base,{cache:'no-store'}).then(async res=>{if(!res.ok)throw Error(res.status===410?'This link has expired, was revoked, or its recipes are no longer available.':'Could not load these recipes. Refresh to try again.');return res.json();}).then(value=>{data=value;navigate();}).catch(error=>{root.innerHTML=header()+`<section class="rc-empty" role="alert"><h1>Recipes unavailable</h1><p>${h(error.message)}</p><p>Ask the owner for a new link if this one no longer works.</p></section>`;L.apply(root);});
})();
