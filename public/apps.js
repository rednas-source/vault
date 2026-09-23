/* Personal web tools live separately from the file and media libraries. */
let savedApps=null,appsLoading=false,appsError='',appsEditor=null,appsMountedKey=null;
let appsFrame=null;
async function appsRequest(endpoint,options={}){
  const response=await fetch(endpoint,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'The request failed. Try again.');return data;
}
async function loadApps(){
  if(appsLoading)return;appsLoading=true;appsError='';
  try{savedApps=(await appsRequest('/api/apps')).apps;}catch(error){appsError=error.message;}
  finally{appsLoading=false;if(state.mode==='apps')renderApps();}
}
function appGlyph(app){return app.id==='flowforge'?'flow-arrow':app.mode==='desktop'?'desktop':'app-window';}
function renderApps(){
  const scroll=$('#scroll');
  if(savedApps===null&&!appsLoading&&!appsError)void loadApps();
  const query=state.q.toLowerCase(),apps=(savedApps||[]).filter(app=>(app.name+' '+app.description).toLowerCase().includes(query));
  const active=(savedApps||[]).find(app=>app.id===state.appDetail);
  const key=active?.mode==='embed'?active.id+':'+active.url:null;
  // Keep the frame mounted outside the list; swapping innerHTML reloads editors.
  let workspace=$('#appsWorkspace');
  if(!workspace){workspace=document.createElement('div');workspace.id='appsWorkspace';workspace.hidden=true;$('.library-workspace').append(workspace);}
  if(key!==appsMountedKey){
    workspace.replaceChildren();appsFrame=null;appsMountedKey=key;
    if(key){appsFrame=document.createElement('iframe');appsFrame.src=active.url;appsFrame.title=active.name;appsFrame.referrerPolicy='no-referrer';appsFrame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox');workspace.append(appsFrame);}
  }
  workspace.hidden=!key;
  document.body.classList.toggle('app-open',!!key);
  scroll.innerHTML=`<div class="apps-page ${key?'apps-page-open':''}"><div class="apps-heading"><div><h1>${key?esc(active.name):'Apps'}</h1><p>${key?esc(active.description||'Your workspace, inside Vault.'):'Your projects and tools, together in Vault.'}</p></div><div class="apps-heading-actions">${key?`<a class="apps-button" href="${esc(active.url)}" target="_blank" rel="noopener noreferrer">${icon('arrow-square-out')}<span>Open in new tab</span></a><button class="apps-button" id="appsBack">${icon('x')}<span>Close app</span></button>`:`<span class="apps-experimental">Experimental</span><button class="apps-button primary" id="appsAdd">${icon('plus')} Add app</button>`}</div></div>${key?'<p class="apps-embed-hint">If the app cannot connect or requires a separate sign-in, use Open in new tab.</p>':`<div id="appsEditor"></div>${appsError?`<div class="apps-empty" role="alert"><p>${esc(appsError)}</p><button class="apps-button" id="appsRetry">Try again</button></div>`:appsLoading&&savedApps===null?'<p class="apps-empty" role="status">Loading your apps…</p>':apps.length?`<div class="apps-list"><div class="apps-list-label"><span>Application</span><span>Opens in</span><span></span></div>${apps.map(app=>`<article class="apps-row"><button class="apps-launch" data-app-open="${esc(app.id)}"><span class="apps-symbol">${icon(appGlyph(app))}</span><span><strong>${esc(app.name)}</strong><small>${esc(app.description||new URL(app.mode==='desktop'?app.url.split('|u|')[1]:app.url).hostname)}</small></span></button><span class="apps-mode">${app.mode==='embed'?'Vault':app.mode==='desktop'?'Desktop app':'New tab'}</span><button class="apps-edit" data-app-edit="${esc(app.id)}" aria-label="Edit ${esc(app.name)}">${icon('dots-three')}</button></article>`).join('')}</div>`:`<div class="apps-empty"><h2>${query?'No matching apps':'Make room for your next project'}</h2><p>${query?'Try a different name.':'Add a web app, a website or a desktop document link.'}</p></div>`}<p class="apps-footnote">Web apps can open here or in a new tab. Desktop links open documents in installed Office apps. Your app list is private to your Vault account.</p>`}</div>`;
  $('#appsAdd')?.addEventListener('click',()=>editApp());
  $('#appsRetry')?.addEventListener('click',loadApps);
  $('#appsBack')?.addEventListener('click',()=>{state.appDetail=null;render();});
  scroll.querySelectorAll('[data-app-open]').forEach(button=>button.onclick=()=>{
    const app=savedApps.find(app=>app.id===button.dataset.appOpen);
    if(app.mode==='embed'){state.appDetail=app.id;state.q='';$('#q').value='';render();}
    else if(app.mode==='tab')window.open(app.url,'_blank','noopener,noreferrer');
    else{const link=document.createElement('a');link.href=app.url;link.click();}
  });
  scroll.querySelectorAll('[data-app-edit]').forEach(button=>button.onclick=()=>editApp(savedApps.find(app=>app.id===button.dataset.appEdit)));
  if(appsEditor)editApp(appsEditor.id?savedApps.find(app=>app.id===appsEditor.id):undefined);
}
function editApp(app){
  appsEditor=app||{};
  const host=$('#appsEditor');if(!host)return;
  host.innerHTML=`<form class="apps-form"><div class="apps-form-heading"><h2>${app?'Edit app':'Add an app'}</h2><button type="button" class="apps-edit" id="appCancel" aria-label="Close app editor">${icon('x')}</button></div><div class="apps-fields"><label>Name<input name="name" maxlength="80" required value="${esc(app?.name||'')}" placeholder="My project"></label><label>Open in<select name="mode"><option value="embed">Vault · embedded web app</option><option value="tab">New browser tab</option><option value="desktop">Desktop · Office document</option></select></label><label class="apps-field-wide">Address<input name="url" required maxlength="2048" value="${esc(app?.url||'')}" placeholder="https://your-app.example"></label><label class="apps-field-wide">Description <span>(optional)</span><input name="description" maxlength="180" value="${esc(app?.description||'')}" placeholder="What you use it for"></label></div><p id="appsAddressHint">Use a trusted web app. Some websites require opening in a new tab.</p><p class="apps-form-error" role="alert"></p><div class="apps-form-actions">${app?'<button type="button" id="appRemove" class="apps-button">Remove app</button>':''}<button type="submit" class="apps-button primary">${app?'Save changes':'Add app'}</button></div></form>`;
  const form=host.querySelector('form');form.elements.mode.value=app?.mode||'embed';
  const hint=()=>{const desktop=form.elements.mode.value==='desktop';form.elements.url.placeholder=desktop?'ms-excel:ofe|u|https://example.com/workbook.xlsx':'https://your-app.example';$('#appsAddressHint').textContent=desktop?'Use an Office document link for Excel, Word or PowerPoint. The app must be installed on your computer.':'Use a trusted web app. Some websites require opening in a new tab.';};hint();form.elements.mode.onchange=hint;
  $('#appCancel').onclick=()=>{appsEditor=null;host.replaceChildren();$('#appsAdd')?.focus();};
  form.onsubmit=async event=>{event.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;
    try{await appsRequest('/api/apps'+(app?'/'+encodeURIComponent(app.id):''),{method:app?'PUT':'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});appsEditor=null;await loadApps();}
    catch(error){form.querySelector('[role=alert]').textContent=error.message;submit.disabled=false;}
  };
  $('#appRemove')?.addEventListener('click',async()=>{
    const button=$('#appRemove');if(button.dataset.confirm!=='yes'){button.dataset.confirm='yes';button.textContent='Confirm removal';return;}
    button.disabled=true;try{await appsRequest('/api/apps/'+encodeURIComponent(app.id),{method:'DELETE'});appsEditor=null;await loadApps();}catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}
  });
  form.elements.name.focus();
}
function syncAppsSurface(){
  const active=state.mode==='apps';document.body.classList.toggle('apps-mode',active);
  if(!active){document.body.classList.remove('app-open');if($('#appsWorkspace'))$('#appsWorkspace').hidden=true;}
}
