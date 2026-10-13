/* The authenticated parent brokers document bytes; the editor receives no API access. */
const ArtcraftFiles=(()=>{
 let active=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function request(url,options={}){const res=await fetch(url,{signal:AbortSignal.timeout(60000),...options});const data=await res.json();if(!res.ok)throw Object.assign(Error(data.error||'Could not save. Keep the editor open and retry.'),{status:res.status});return data;}
 function attach(frame,app){
  active?.dispose();
  const channel=crypto.randomUUID(),base='/api/artcraft/'+app.appId,known=new Map();
  const mode=app.appId==='figcraft'?'unavailable':app.appId==='lightcraft'?'export':'auto';
  const readyText=mode==='unavailable'?'This FigCraft browser release cannot save files. Use the desktop app for work you need to keep.':mode==='export'?'Use File → Export or library backup to save to App files / '+app.name:'Vault autosave on · App files / '+app.name;
  let files=[],queued=0,generation=0,dirty=false,busy=0,ready=false,status='Connecting to App files…',last=null,conflict=false,tail=Promise.resolve(),waiters=[],disposed=false;
  const post=(type,data={})=>frame.contentWindow?.postMessage({vaultApp:1,channel,type,...data},'*');
  const paint=()=>{if(disposed)return;const node=document.getElementById('craftSaveStatus');if(node){node.textContent=status;node.dataset.error=last?'true':'false';}const retry=document.getElementById('craftRetrySave');if(retry){retry.hidden=!last;retry.textContent=conflict?'Save a copy':'Retry save';}};
  const settle=ok=>{for(const fn of waiters.splice(0))fn(ok);};
  async function refresh(){try{files=(await request(base+'/files')).files;if(disposed)return;const select=document.getElementById('craftOpenFile');if(select)select.innerHTML=options();}catch(e){status=e.message;paint();}}
  const options=()=>'<option value="">Open saved file…</option>'+files.map(f=>`<option value="${esc(f.name)}">${esc(f.name)}</option>`).join('');
  async function save(m,copy=false){
   busy++;status='Saving to Vault…';paint();let upload;
   try{
    const previous=copy?null:known.get(m.name),name=previous?.name||m.name;
    upload=await request(base+'/saves',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,size:m.blob.size,revision:previous?.revision??null})});
    for(let offset=0;offset<m.blob.size;offset+=upload.chunkSize)await request(base+'/saves/'+upload.id+'/chunk?offset='+offset,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:m.blob.slice(offset,offset+upload.chunkSize)});
    const saved=await request(base+'/saves/'+upload.id+'/finish',{method:'POST'});upload=null;known.set(m.name,saved);known.set(saved.name,saved);
    last=null;dirty=generation!==m.generation;status=dirty?'Unsaved changes · Vault autosave pending':'Saved · App files / '+app.name+' / '+saved.name+' · '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});post('saved',{request:m.request,generation:m.generation});settle(!dirty);await refresh();
   }catch(e){last=m;conflict=e.status===409||e.status===404;dirty=true;status=e.message;post('failed',{request:m.request,error:e.message});settle(false);if(upload)void request(base+'/saves/'+upload.id,{method:'DELETE'}).catch(()=>{});}
   finally{busy--;paint();}
  }
  function onMessage(e){
   if(e.source!==frame.contentWindow||e.origin!=='null'||e.data?.vaultApp!==1||disposed)return;
   const m=e.data;if(m.type==='hello'){post('connect',{automatic:mode==='auto',appId:app.appId});return;}if(m.channel!==channel)return;
   if(m.type==='ready'){ready=true;status=readyText;paint();}
   if(m.type==='dirty'){generation=m.generation;dirty=true;if(!busy){status=mode==='auto'?'Unsaved changes · Vault autosave pending':readyText;paint();}}
   if(m.type==='status'){status=String(m.text).slice(0,300);paint();}
   if(m.type==='save-unavailable'){dirty=true;settle(false);}
   if(m.type==='save'&&Number.isSafeInteger(m.request)&&typeof m.name==='string'&&m.blob instanceof Blob&&m.blob.size<=512*1024**2){if(queued>=4){post('failed',{request:m.request,error:'Too many saves in progress. Wait and retry.'});return;}queued++;tail=tail.then(()=>save(m)).catch(()=>{}).finally(()=>queued--);}
   if(m.type==='opened'){status='Sent to editor · '+readyText;paint();}
   if(m.type==='open-failed'){status='The editor is still loading. Try opening the file again.';paint();}
  }
  window.addEventListener('message',onMessage);frame.addEventListener('load',()=>post('connect',{automatic:mode==='auto',appId:app.appId}));void refresh();
  const controller={
   html:()=>`<div class="craft-file-tools">${mode==='auto'?'<button type="button" class="apps-button" id="craftSaveNow">Save to Vault</button>':''}${mode!=='unavailable'?`<label class="craft-file-open"><span class="sr-only">Open saved app file</span><select id="craftOpenFile" aria-label="Open saved app file">${options()}</select></label>`:''}<button type="button" class="apps-button" id="craftRetrySave" ${last?'':'hidden'}>${conflict?'Save a copy':'Retry save'}</button><p id="craftSaveStatus" role="status">${esc(status)}</p></div>`,
   bind(){document.getElementById('craftSaveNow')?.addEventListener('click',()=>controller.flush(true));document.getElementById('craftRetrySave')?.addEventListener('click',()=>{if(!last||queued||busy)return;const retry=last,copy=conflict;queued++;tail=tail.then(()=>save(retry,copy)).finally(()=>queued--);});document.getElementById('craftOpenFile')?.addEventListener('change',async e=>{const f=files.find(f=>f.name===e.target.value);e.target.value='';if(!f||!await controller.flush())return;try{const res=await fetch(base+'/file?name='+encodeURIComponent(f.name));if(!res.ok)throw Error('Could not open this file. Refresh and try again.');const blob=await res.blob();known.set(f.name,{...f,revision:res.headers.get('X-Vault-Revision')});post('open',{name:f.name,blob});}catch(e){status=e.message;paint();}});},
   async flush(force=false){if(!force&&!dirty&&!busy)return true;if(!ready){status='Editor is still connecting. Try again shortly.';paint();return false;}if(busy){await tail;return !dirty;}if(mode!=='auto'){status=readyText;paint();return false;}post('save-now');return new Promise(resolve=>{waiters.push(resolve);setTimeout(()=>{const n=waiters.indexOf(resolve);if(n>=0){waiters.splice(n,1);resolve(false);}},20000);});},
   async close(){return await controller.flush()||window.confirm('Vault could not confirm that your latest changes were saved. Close this app and discard unsaved changes?');},
   get dirty(){return dirty||busy>0;},
   dispose(){disposed=true;window.removeEventListener('message',onMessage);settle(false);if(active===controller)active=null;}
  };active=controller;return controller;
 }
 window.addEventListener('beforeunload',e=>{if(active?.dirty){e.preventDefault();e.returnValue='';}});
 return {attach,get active(){return active;}};
})();
