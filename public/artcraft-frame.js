/* Runs inside the opaque editor frame. It can exchange only document saves with
   its embedding Vault window; it never receives cookies or API credentials. */
(()=>{
 const host=new URL(document.currentScript.src).origin;
 let channel=null,enabled=false,dirty=false,lastInput=0,sequence=0,generation=0,waiting=false,automatic=true,autoAllowed=true,appId='';
 const pending=new Map(),urls=new Map(),createURL=URL.createObjectURL.bind(URL),revokeURL=URL.revokeObjectURL.bind(URL);
 const send=(type,data={})=>{if(channel)parent.postMessage({vaultApp:1,channel,type,...data},host);};
 const status=text=>send('status',{text,dirty});
 URL.createObjectURL=blob=>{const url=createURL(blob);urls.set(url,blob);return url;};
 URL.revokeObjectURL=url=>{urls.delete(url);revokeURL(url);};
 function save(name,blob){
  if(!enabled)return Promise.reject(Error('Vault connection unavailable.'));
  if(!(blob instanceof Blob)||blob.size<1||blob.size>512*1024**2)return Promise.reject(Error('File must be between 1 byte and 512 MB.'));
  const request=++sequence;waiting=true;status('Saving to Vault…');
  return new Promise((resolve,reject)=>{pending.set(request,{resolve,reject,generation});send('save',{request,generation,name:String(name).split(/[\\/]/).pop()||'Untitled',blob});});
 }
 const click=HTMLAnchorElement.prototype.click;
 function download(anchor){const blob=urls.get(anchor.href);if(!enabled||!anchor.download||!blob)return false;void save(anchor.download,blob).catch(e=>status(e.message));return true;}
 HTMLAnchorElement.prototype.click=function(){if(!download(this))return click.call(this);};
 document.addEventListener('click',e=>{const a=e.target.closest?.('a[download]');if(a&&download(a)){e.preventDefault();e.stopImmediatePropagation();}},true);
 const nativePicker=window.showSaveFilePicker?.bind(window);
 window.showSaveFilePicker=async options=>{
  if(!enabled){if(nativePicker)return nativePicker(options);throw Error('Open the app inside Vault to save.');}
  const name=options?.suggestedName||'Untitled';
  return {kind:'file',name,createWritable:async()=>{let chunks=[],closed=false;return {write:async data=>{if(closed)throw Error('File is closed.');if(data&&typeof data==='object'&&data.type==='write')data=data.data;chunks.push(data);},close:async()=>{if(closed)return;closed=true;await save(name,new Blob(chunks));chunks=[];},abort:async()=>{chunks=[];closed=true;}};}};
 };
 function requestSave(manual=false){
  if(!enabled||waiting||!document.querySelector('canvas'))return;
  if(!manual&&!dirty)return;
  waiting=true;status('Saving to Vault…');
  const target=document.querySelector('canvas'),mac=/Mac|iPhone|iPad/.test(navigator.platform);
  window.focus();target.focus?.({preventScroll:true});
  // GridCraft's ordinary Save can target its in-memory imported path. Save As
  // always serializes the workbook through the web download service instead.
  const key=appId==='gridcraft'?{key:'F12',code:'F12',keyCode:123,which:123}:{key:'s',code:'KeyS',keyCode:83,which:83,ctrlKey:!mac,metaKey:mac};
  target.dispatchEvent(new KeyboardEvent('keydown',{...key,bubbles:true,cancelable:true}));
  // egui consumes shortcuts during its next render frame. Releasing Control in
  // the same task can erase the modifier before that frame sees the shortcut.
  setTimeout(()=>{target.dispatchEvent(new KeyboardEvent('keyup',{...key,bubbles:true}));target.dispatchEvent(new KeyboardEvent('keyup',{key:mac?'Meta':'Control',code:mac?'MetaLeft':'ControlLeft',bubbles:true}));},100);
  setTimeout(()=>{if(waiting&&!pending.size){waiting=false;automatic=false;status('Use the editor’s File → Save to finish saving this document.');send('save-unavailable');}},12000);
 }
 for(const event of ['input','keydown','pointerup','drop','paste'])document.addEventListener(event,e=>{if(!e.isTrusted||!enabled)return;if(event==='keydown'&&(e.ctrlKey||e.metaKey||['Shift','Control','Alt','Meta','Tab','Escape'].includes(e.key)))return;dirty=true;generation++;lastInput=Date.now();send('dirty',{generation});},true);
 window.addEventListener('message',async e=>{
  if(e.source!==parent||e.origin!==host||e.data?.vaultApp!==1)return;const m=e.data;
  if(m.type==='connect'){channel=m.channel;appId=m.appId;enabled=true;autoAllowed=m.automatic!==false;automatic=autoAllowed;send('ready');return;}
  if(!channel||m.channel!==channel)return;
  if(m.type==='saved'||m.type==='failed'){const p=pending.get(m.request);if(!p){if(m.type==='saved'){dirty=m.generation!==generation;automatic=true;if(dirty)send('dirty',{generation});}return;}pending.delete(m.request);waiting=pending.size>0;if(m.type==='saved'){dirty=p.generation!==generation;automatic=true;p.resolve();if(dirty)send('dirty',{generation});}else{dirty=true;automatic=false;p.reject(Error(m.error));}return;}
  if(m.type==='save-now'){automatic=true;requestSave(true);}
  if(m.type==='open'&&m.blob instanceof Blob){const transfer=new DataTransfer();transfer.items.add(new File([m.blob],m.name));const canvas=document.querySelector('canvas');if(!canvas){send('open-failed');return;}canvas.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));dirty=false;send('opened');}
 });
 setInterval(()=>{if(enabled&&autoAllowed&&automatic&&dirty&&!waiting&&Date.now()-lastInput>2500)requestSave();},5000);
 if(parent!==window)parent.postMessage({vaultApp:1,type:'hello'},host);
})();
