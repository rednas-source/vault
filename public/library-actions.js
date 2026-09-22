/* File-browser interactions, sharing the existing app state and dialog layer. */
let navIndex=0, navMax=0, navReady=false, restoringNav=false;
let fileMenu=null, menuAnchor=null;
const ITEM_DRAG_TYPE='application/x-vault-items';
const browserLocation=()=>({mode:state.mode,shelf:state.shelf,folder:state.folder,q:state.q,showDetail:state.showDetail,movieDetail:state.movieDetail});
const locationKey=nav=>JSON.stringify([nav.mode,nav.shelf,nav.folder,nav.showDetail,nav.movieDetail]);

function recordBrowserLocation(){
  if(restoringNav)return;
  const nav=browserLocation();
  if(!navReady){
    navReady=true;
    history.replaceState({vaultNav:nav,navIndex:0},'');
  }else if(!history.state?.vaultNav || locationKey(history.state.vaultNav)!==locationKey(nav)){
    navIndex++;navMax=navIndex;
    history.pushState({vaultNav:nav,navIndex},'');
  }else{
    history.replaceState({...history.state,vaultNav:nav},'');
  }
}
function restoreBrowserLocation(){
  const nav=history.state?.vaultNav;
  if(!nav||!state.user)return;
  navIndex=history.state.navIndex||0;
  Object.assign(state,nav);
  if(state.shelf!=='all'&&!SHELF_ORDER.includes(state.shelf)){
    state.mode='files';state.shelf='all';state.folder='';
  }
  state.picked.clear();$('#q').value=state.q;
  restoringNav=true;render();restoringNav=false;$('#scroll').scrollTop=0;
}
function closeFileMenu(restoreFocus=false){
  if(!fileMenu||fileMenu.hidden)return false;
  fileMenu.hidden=true;
  if(restoreFocus&&menuAnchor?.isConnected)menuAnchor.focus();
  return true;
}
function showFileMenu(file,event){
  event?.preventDefault();event?.stopPropagation();
  const rels=state.picked.has(file.rel)?[...state.picked]:[file.rel];
  const multiple=rels.length>1,protectedRoot=rels.some(rel=>!rel.includes('/'));
  if(!fileMenu){
    fileMenu=document.createElement('div');fileMenu.id='fileMenu';fileMenu.className='file-menu';
    fileMenu.setAttribute('role','menu');fileMenu.setAttribute('aria-label','File actions');document.body.append(fileMenu);
    fileMenu.addEventListener('keydown',e=>{
      // Menu navigation must not also trigger the table's global shortcuts.
      e.stopPropagation();
      const buttons=[...fileMenu.querySelectorAll('button')],at=buttons.indexOf(document.activeElement);
      if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
        e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(at+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
      }
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeFileMenu(true);}
      if(e.key==='Tab')closeFileMenu();
    });
  }
  const actions=[];
  if(!multiple&&(file.kind==='folder'||openable(file)))actions.push(['open',file.kind==='folder'?'Open folder':'Open','folder-open']);
  actions.push(['download',multiple?'Download selection':'Download','download-simple']);
  if(!multiple&&file.kind!=='folder')actions.push(['zip','Download ZIP','file-zip']);
  if(!protectedRoot){
    actions.push(['move','Move to…','folder']);
    if(!multiple)actions.push(['rename','Rename','pencil-simple']);
    if(!multiple&&file.kind!=='folder')actions.push(['share','Share','link']);
    actions.push(['delete','Delete','trash']);
  }
  fileMenu.innerHTML=`<div class="file-menu-title">${multiple?`${rels.length} selected`:esc(file.name)}</div>`
    +actions.map(([action,label,glyph])=>`<button role="menuitem" data-menu-action="${action}" class="${action==='delete'?'danger':''}">${icon(glyph)}<span>${label}</span></button>`).join('');
  fileMenu.hidden=false;
  menuAnchor=event?.target?.closest('button,[tabindex]')||null;
  const row=event?.target?.closest('tr,.tile');
  const box=(row||menuAnchor)?.getBoundingClientRect();
  const x=event?.clientX||box?.left||20,y=box?.bottom||event?.clientY||100;
  const menuBox=fileMenu.getBoundingClientRect();
  fileMenu.style.left=`${Math.max(8,Math.min(x,innerWidth-menuBox.width-8))}px`;
  fileMenu.style.top=`${Math.max(8,Math.min(y+4,innerHeight-menuBox.height-8))}px`;
  fileMenu.querySelectorAll('[data-menu-action]').forEach(button=>button.onclick=()=>{
    closeFileMenu();
    const action=button.dataset.menuAction;
    if(action==='open')file.kind==='folder'?openFolder(file):openable(file)?openViewer(file):location.assign(url('download',file.rel));
    if(action==='download')!multiple&&file.kind!=='folder'?location.assign(url('download',file.rel)):downloadSelection(rels);
    if(action==='zip')downloadSelection(rels);
    if(action==='move')askMoveItems(rels);
    if(action==='rename')askRename(file);
    if(action==='share')askShare(file);
    if(action==='delete')askDeleteItems(rels);
  });
  if(!event?.detail)fileMenu.querySelector('button')?.focus();
}
document.addEventListener('pointerdown',event=>{if(fileMenu&&!fileMenu.contains(event.target))closeFileMenu();});
window.addEventListener('resize',()=>closeFileMenu());

async function moveItems(rels,destination){
  const response=await fetch('/api/files/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'move',rels,destination})});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Could not move these items.');
  if(result.failed)throw new Error(`Moved ${result.done}; ${result.failed} could not be moved. Refresh and try again.`);
  state.picked.clear();toast(`Moved ${result.done} ${result.done===1?'item':'items'}`);await load();
}
function askMoveItems(rels){
  closeFileMenu();
  let destination='';
  const excluded=rel=>rels.some(source=>rel===source||rel.startsWith(source+'/'));
  const folders=[...SHELF_ORDER.map(s=>({rel:s,dir:'',shelf:s,name:SHELF_LABEL[s],shelfRoot:true})),...state.folders];
  sheet(`<span class="tag">Move ${rels.length===1?'item':`${rels.length} items`}</span><p>Choose a destination folder.</p><div id="moveBrowser"></div><p class="operation-error" id="moveError" role="alert"></p><div class="sheet-row"><button class="ghost" id="no">Cancel</button><button class="ghost accent" id="moveConfirm" disabled>Move here</button></div>`);
  const draw=()=>{
    const children=folders.filter(f=>!excluded(f.rel)&&(destination?f.rel.split('/').slice(0,-1).join('/')===destination:f.shelfRoot));
    $('#moveBrowser').innerHTML=`<div class="move-path"><button class="ghost" id="moveUp" ${!destination?'disabled':''}>${icon('arrow-up')} Up</button><span>${esc(destination||'Choose a shelf')}</span></div><div class="move-folders">${children.sort((a,b)=>a.name.localeCompare(b.name)).map(f=>`<button data-move-folder="${esc(f.rel)}">${icon('folder')}<span>${esc(f.name)}</span>${icon('caret-right')}</button>`).join('')||'<p>No subfolders. You can move items here.</p>'}</div>`;
    $('#moveConfirm').disabled=!destination||excluded(destination);
    $('#moveUp').onclick=()=>{destination=destination.split('/').slice(0,-1).join('/');draw();};
    $('#moveBrowser').querySelectorAll('[data-move-folder]').forEach(b=>b.onclick=()=>{destination=b.dataset.moveFolder;draw();});
  };
  draw();$('#no').onclick=closeSheet;
  $('#moveConfirm').onclick=async()=>{
    $('#moveConfirm').disabled=true;$('#moveError').textContent='';
    try{await moveItems(rels,destination);closeSheet();}
    catch(error){$('#moveError').textContent=error.message;$('#moveConfirm').disabled=false;await load();}
  };
}
function askDeleteItems(rels){
  closeFileMenu();
  const names=rels.map(rel=>rel.split('/').pop());
  sheet(`<span class="tag">Delete ${rels.length===1?'item':`${rels.length} items`}</span><p>Permanently delete <b>${esc(names.length===1?names[0]:`${names.length} selected items`)}</b>? Folders include everything inside. This cannot be undone.</p><p class="operation-error" id="deleteError" role="alert"></p><div class="sheet-row"><button class="ghost" id="no">Cancel</button><button class="ghost danger" id="yes">Delete</button></div>`);
  $('#no').onclick=closeSheet;
  $('#yes').onclick=async()=>{
    $('#yes').disabled=true;
    try{
      const response=await fetch('/api/files/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',rels})});
      const result=await response.json();
      if(!response.ok||result.failed)throw new Error(result.error||`Deleted ${result.done}; ${result.failed} could not be deleted.`);
      state.picked.clear();closeSheet();toast(`Deleted ${result.done} ${result.done===1?'item':'items'}`);await load();
    }catch(error){$('#deleteError').textContent=error.message;$('#yes').disabled=false;await load();}
  };
}
function wireDropTarget(element,destination){
  element.ondragover=event=>{
    if(!event.dataTransfer.types.includes(ITEM_DRAG_TYPE)&&!event.dataTransfer.types.includes('Files'))return;
    event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect=event.dataTransfer.types.includes(ITEM_DRAG_TYPE)?'move':'copy';element.classList.add('drop-target');
  };
  element.ondragleave=event=>{if(!element.contains(event.relatedTarget))element.classList.remove('drop-target');};
  element.ondrop=async event=>{
    event.preventDefault();event.stopPropagation();element.classList.remove('drop-target');closeFileMenu();
    dragDepth=0;$('#drop').classList.remove('on');
    try{
      const payload=event.dataTransfer.getData(ITEM_DRAG_TYPE);
      if(payload)await moveItems(JSON.parse(payload),destination);
      else{
        const files=await filesFromDrop(event.dataTransfer);
        if(files.length){openFolder({shelf:destination.split('/')[0],rel:destination});chooseShelf(files);}
      }
    }catch(error){toast(error.message||'Could not move these items.','bad');await load();}
  };
}
function wireFileInteractions(list){
  if(state.mode!=='files'){
    $('#scroll').ondragover=null;$('#scroll').ondrop=null;$('#scroll').ondragleave=null;return;
  }
  $('#scroll').querySelectorAll('tr[data-rel],.library-tiles .tile[data-rel]').forEach(row=>{
    const file=list.find(f=>f.rel===row.dataset.rel);if(!file)return;
    row.draggable=!file.shelfRoot;
    row.ondragstart=event=>{
      if(file.shelfRoot){event.preventDefault();return;}
      closeFileMenu();
      const rels=state.picked.has(file.rel)?[...state.picked]:[file.rel];
      if(rels.some(rel=>!rel.includes('/'))){event.preventDefault();return;}
      event.dataTransfer.setData(ITEM_DRAG_TYPE,JSON.stringify(rels));event.dataTransfer.effectAllowed='move';row.classList.add('dragging');
    };
    row.ondragend=()=>{document.querySelectorAll('.dragging,.drop-target').forEach(el=>el.classList.remove('dragging','drop-target'));};
    row.onclick=null;
    row.querySelector('[data-act="focus"]')?.addEventListener('keydown',event=>{
      if(event.key==='Enter'){
        event.preventDefault();event.stopPropagation();
        file.kind==='folder'?openFolder(file):openable(file)?openViewer(file):location.assign(url('download',file.rel));
      }
      if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10'))showFileMenu(file,event);
    });
    row.oncontextmenu=event=>showFileMenu(file,event);
    row.ondblclick=event=>{
      if(event.target.closest('input,.acts,.tile-actions'))return;
      closeFileMenu();file.kind==='folder'?openFolder(file):openable(file)?openViewer(file):location.assign(url('download',file.rel));
    };
    if(file.kind==='folder')wireDropTarget(row,file.rel);
  });
  document.querySelectorAll('#shelves [data-shelf]:not([data-shelf="all"]),[data-ent-side],[data-drop-rel]').forEach(el=>wireDropTarget(el,el.dataset.dropRel||el.dataset.shelf||el.dataset.entSide));
  if(state.shelf!=='all')wireDropTarget($('#scroll'),[state.shelf,state.folder].filter(Boolean).join('/'));
  else {$('#scroll').ondragover=null;$('#scroll').ondrop=null;$('#scroll').ondragleave=null;}
}
