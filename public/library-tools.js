/* Archive creation and the Library's shared-link overview. */
let sharedLinks=null, sharedOwner=null, sharesLoading=false, sharesError='', sharesFilter='all';
let sharedRequest=0;

function openSharedLinks(){
  closeFileMenu();
  if(layers.length){
    window.addEventListener('popstate',openSharedLinks,{once:true});
    closeAllLayers();return;
  }
  state.mode='shares';state.picked.clear();selectionAnchor=null;state.q='';$('#q').value='';
  render();$('#scroll').scrollTop=0;
  if(sharedLinks&&!sharesLoading)refreshSharedLinks();
}
async function refreshSharedLinks(){
  if(sharesLoading)return;
  sharesLoading=true;sharesError='';
  const request=++sharedRequest, owner=state.user?.name||state.user;
  if(state.mode==='shares')renderSharedLinks();
  try{
    const response=await fetch('/api/shares',{cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Could not load shared links.');
    if(request!==sharedRequest||owner!==(state.user?.name||state.user))return;
    sharedLinks=result.shares;
  }catch(error){sharesError=error.message||'Could not load shared links. Please try again.';}
  finally{if(request===sharedRequest){sharesLoading=false;if(state.mode==='shares')renderSharedLinks();}}
}
function shareTimeLeft(expires){
  if(!expires)return 'No expiry';
  const left=expires-Date.now();
  if(left<=0)return 'Expired';
  if(left<60000)return 'Less than a minute';
  if(left<3600000)return `${Math.ceil(left/60000)} min left`;
  if(left<86400000)return `${Math.ceil(left/3600000)} hours left`;
  const days=Math.ceil(left/86400000);return `${days} ${days===1?'day':'days'} left`;
}
function renderSharedLinks(){
  const owner=state.user?.name||state.user;
  if(sharedOwner!==owner){sharedOwner=owner;sharedLinks=null;sharesError='';sharesLoading=false;sharedRequest++;}
  if(sharedLinks===null&&!sharesLoading&&!sharesError){refreshSharedLinks();return;}
  const links=(sharedLinks||[]).map(link=>({...link,status:link.expires&&link.expires<=Date.now()?'expired':link.status}));
  const q=state.q.toLowerCase();
  const shown=links.filter(link=>(sharesFilter==='all'||(sharesFilter==='active'?link.status==='active':link.status!=='active'))&&`${link.rel} ${link.label} ${link.by}`.toLowerCase().includes(q));
  const labels={active:'Active',expired:'Expired',exhausted:'Limit reached',missing:'Item missing',unavailable:'Unavailable'};
  $('#librarySummary').textContent=sharedLinks?`${links.length} ${links.length===1?'link':'links'}`:'';
  $('#scroll').innerHTML=`<section class="shared-links" aria-label="Shared links overview">
    <div class="shares-toolbar"><label>Show <select id="sharesFilter" aria-label="Filter shared links"><option value="all">All links</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><button class="ghost" id="refreshShares" ${sharesLoading?'disabled':''}>${icon('arrow-clockwise')} ${sharesLoading?'Refreshing…':'Refresh'}</button></div>
    <p class="shares-help">File links are read-only. Editable folder links allow uploads, subfolders, renames, and deletions until they expire or are revoked.</p>
    ${sharesError?`<p class="operation-error" role="alert">${esc(sharesError)} Use Refresh to try again.</p>`:''}
    ${!sharedLinks&&sharesLoading?'<p class="shares-empty" role="status">Loading shared links…</p>':shown.length?`
    <div class="shares-table" role="table" aria-label="Shared items"><div class="share-row share-table-head" role="row"><span role="columnheader">Shared item</span><span role="columnheader">Status</span><span role="columnheader">Time left</span><span role="columnheader">Access</span><span role="columnheader" class="sr-only">Actions</span></div>
    ${shown.map(link=>`<div class="share-row" role="row" data-share-id="${esc(link.id)}">
      <div class="share-file" role="cell">${icon(link.kind==='folder'?'folder':'link')}<div><b>${esc(link.rel.split('/').pop())}</b><small title="${esc(link.rel)}">${esc(link.rel)}</small>${link.label?`<small>${esc(link.label)}</small>`:''}<small>${link.kind==='folder'?'Editable folder':'Read-only file'} · Shared by ${esc(link.by)}</small></div></div>
      <div role="cell" class="share-state ${link.status==='active'?'active':''}"><span class="mobile-label">Status</span>${esc(labels[link.status]||'Unavailable')}</div>
      <div role="cell" class="share-value"><span class="mobile-label">Time left</span><b>${shareTimeLeft(link.expires)}</b>${link.expires?`<small>${esc(new Date(link.expires).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}))}</small>`:''}</div>
      <div role="cell" class="share-value"><span class="mobile-label">Access</span><b>${link.kind==='folder'?'Edit access':link.remaining===null?'Unlimited downloads':`${link.remaining} of ${link.maxUses}`}</b><small>${link.kind==='folder'?'Expires or revokes as one workspace':`${link.uses} used`}</small></div>
      <div role="cell" class="share-actions"><button class="ghost" data-copy-share="${esc(link.id)}" ${link.status!=='active'?'disabled':''} aria-label="Copy link for ${esc(link.rel.split('/').pop())}">Copy link</button><button class="ghost" data-revoke-share="${esc(link.id)}" aria-label="Revoke link for ${esc(link.rel.split('/').pop())}">Revoke</button></div>
    </div>`).join('')}</div>`:`<div class="shares-empty"><h3>${links.length?'No matching links':'No shared links yet'}</h3><p>${links.length?'Try another search or show all links.':'Open an item’s options and choose Share. Files stay read-only; folders become collaborative workspaces.'}</p>${!links.length?'<button class="ghost" id="sharesBrowse">Browse files</button>':''}</div>`}
    </section>`;
  $('#sharesFilter').value=sharesFilter;$('#sharesFilter').onchange=event=>{sharesFilter=event.target.value;renderSharedLinks();};
  $('#refreshShares').onclick=refreshSharedLinks;
  if($('#sharesBrowse'))$('#sharesBrowse').onclick=goLibraryRoot;
  $('#scroll').querySelectorAll('[data-copy-share]').forEach(button=>button.onclick=async()=>{
    const link=`${location.origin}/s/${button.dataset.copyShare}`;
    try{await navigator.clipboard.writeText(link);toast('Link copied');}
    catch{sheet(`<h3>Copy shared link</h3><input class="copy-link-input" id="copySharedUrl" readonly value="${esc(link)}" aria-label="Shared link"><div class="sheet-row"><button class="ghost" id="done">Done</button></div>`);$('#copySharedUrl').select();$('#done').onclick=closeSheet;}
  });
  $('#scroll').querySelectorAll('[data-revoke-share]').forEach(button=>button.onclick=()=>revokeSharedLink(links.find(link=>link.id===button.dataset.revokeShare)));
}
function revokeSharedLink(link){
  sheet(`<h3>Revoke shared link?</h3><p>The link for <b>${esc(link.rel.split('/').pop())}</b> will stop working immediately. Everything already in your vault stays there.</p><p class="operation-error" id="revokeError" role="alert"></p><div class="sheet-row"><button class="ghost" id="no">Cancel</button><button class="ghost danger" id="yes">Revoke link</button></div>`);
  $('#no').onclick=closeSheet;
  $('#yes').onclick=async()=>{
    $('#yes').disabled=true;
    try{
      const response=await fetch(`/api/shares/${encodeURIComponent(link.id)}`,{method:'DELETE'});
      if(!response.ok){const result=await response.json();throw new Error(result.error||'Could not revoke this link.');}
      sharedLinks=sharedLinks.filter(item=>item.id!==link.id);closeSheet();toast('Link revoked');await refreshSharedLinks();
    }catch(error){if($('#revokeError')){$('#revokeError').textContent=error.message;$('#yes').disabled=false;}}
  };
}
// Keep counts fresh only while the overview is actually being used.
setInterval(()=>{if(state.user&&state.mode==='shares'&&!document.hidden&&!layers.length)refreshSharedLinks();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user&&state.mode==='shares')refreshSharedLinks();});

function askCreateZip(rels){
  closeFileMenu();
  const first=rels[0], preferred=state.shelf!=='all'?[state.shelf,state.folder].filter(Boolean).join('/'):first.split('/').slice(0,-1).join('/')||first;
  const folders=[...SHELF_ORDER.map(shelf=>({rel:shelf,name:SHELF_LABEL[shelf]})),...state.folders.map(folder=>({rel:folder.rel,name:`${SHELF_LABEL[folder.shelf]||folder.shelf} / ${folder.rel.split('/').slice(1).join(' / ')}`}))];
  const name=rels.length===1?`${first.split('/').pop().replace(/\.[^.]+$/,'')}.zip`:'Archive.zip';
  sheet(`<h3>Create ZIP in Vault</h3><p>Save ${rels.length===1?'this item':`${rels.length} selected items`} as a ZIP. Your original files stay in place.</p><div class="zip-fields"><label for="zipName">Archive name</label><input id="zipName" value="${esc(name)}" maxlength="180" autocomplete="off"><label for="zipDestination">Save in</label><select id="zipDestination">${folders.map(folder=>`<option value="${esc(folder.rel)}" ${folder.rel===preferred?'selected':''}>${esc(folder.name)}</option>`).join('')}</select></div><p id="zipProgress" role="status"></p><p class="operation-error" id="zipError" role="alert"></p><div class="sheet-row"><button class="ghost" id="no">Cancel</button><button class="ghost accent" id="createZip">Create ZIP</button></div>`);
  $('#no').onclick=closeSheet;$('#zipName').focus();$('#zipName').select();
  const start=async()=>{
    if($('#createZip').disabled)return;
    const name=$('#zipName').value.trim(),destination=$('#zipDestination').value;
    if(!name){$('#zipError').textContent='Enter a name for the ZIP.';return;}
    $('#createZip').disabled=true;$('#zipError').textContent='';
    try{
      const response=await fetch('/api/files/zip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rels,destination,name})});
      const job=await response.json();if(!response.ok)throw new Error(job.error||'Could not create this ZIP.');
      $('#zipName').disabled=true;$('#zipDestination').disabled=true;$('#no').textContent='Run in background';
      $('#zipProgress').dataset.job=job.id;$('#zipProgress').textContent='Preparing archive…';
      pollZipJob(job.id);
    }catch(error){if($('#zipError')){$('#zipError').textContent=error.message;$('#createZip').disabled=false;}}
  };
  $('#createZip').onclick=start;$('#zipName').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();start();}};
}
async function pollZipJob(id){
  try{
    const response=await fetch(`/api/files/zip/${id}`,{cache:'no-store'});
    const job=await response.json();if(!response.ok)throw new Error(job.error||'Could not check ZIP progress. Refresh the folder to check for the archive.');
    const progress=$('#zipProgress'),ownsDialog=progress?.dataset.job===id;
    if(job.status==='working'){
      if(ownsDialog)progress.textContent=job.total?`Archiving ${job.processed} of ${job.total} items…`:'Preparing archive…';
      setTimeout(()=>pollZipJob(id),1200);return;
    }
    if(job.status==='failed')throw new Error(job.error);
    toast(`Created ${job.name}`);await load();
    if(ownsDialog&&$('#zipProgress')?.dataset.job===id){
      progress.textContent=`Saved in ${job.rel.split('/').slice(0,-1).join(' / ')}`;
      $('#createZip').disabled=false;$('#createZip').textContent='Download ZIP';$('#createZip').onclick=()=>location.assign(url('download',job.rel));$('#no').textContent='Done';
    }
  }catch(error){
    if($('#zipProgress')?.dataset.job===id){$('#zipProgress').textContent='';$('#zipError').textContent=error.message;$('#no').textContent='Close';}
    else toast(error.message,'bad');
  }
}
