/* Phone Listen keeps the shared audio element alive across every view. */
const listenMobile=()=>matchMedia('(max-width:900px)').matches;
let listenExpandedPage='now',listenExpandedKey='',listenExpandedReturn=null;
function listenBottomNav(page){
  const selected=page==='search'?'search':['library','albums','songs','liked','playlists','playlist','album'].includes(page)?'library':'home';
  return `<nav class="listen-bottom-nav" aria-label="Music navigation">${[['home','house','Home'],['search','magnifying-glass','Search'],['library','books','Your Library']].map(([key,glyph,label])=>`<button data-listen-page="${key}" ${selected===key?'aria-current="page"':''}>${icon(glyph,selected===key?'ph-fill':'')}<span>${label}</span></button>`).join('')}</nav>`;
}
function listenLibraryPage(albums){
  return `<section class="listen-section listen-library-page"><div class="listen-section-heading"><h1>Your Library</h1><button class="listen-icon" data-create-playlist aria-label="Create playlist">${icon('plus')}</button></div><div class="listen-filters"><button data-listen-page="albums">Albums</button><button data-listen-page="playlists">Playlists</button><button data-listen-page="songs">Songs</button></div><div class="listen-library-items"><button class="listen-side-item" data-listen-page="liked"><span class="listen-liked-cover">${icon('heart','ph-fill')}</span><span><b>Liked Songs</b><small>${listenSongCount(listenSaved.liked.filter(rel=>listenFiles().some(file=>file.rel===rel)).length)}</small></span></button>${listenSaved.playlists.map(list=>`<button class="listen-side-item" data-listen-playlist="${esc(list.id)}"><span class="listen-playlist-cover">${icon('playlist')}</span><span><b>${esc(list.name)}</b><small>Playlist · ${listenSongCount(list.rels.length)}</small></span></button>`).join('')}${albums.map(group=>`<button class="listen-side-item" data-listen-album="${esc(group.key)}">${listenArt(group.files[0])}<span><b data-listen-album-name="${esc(group.files[0].rel)}">${esc(group.name)}</b><small data-listen-artist="${esc(group.files[0].rel)}">${esc(group.artist)}</small></span></button>`).join('')}</div><button class="listen-files-link" data-listen-files>${icon('folder-open')} Open music files</button></section>`;
}
function listenSearchResults(files){
  const q=state.q.trim().toLowerCase();
  if(!q)return `<div class="listen-search-intro"><h2>Find your next song</h2><p>Search your songs, artists, and albums.</p><div class="listen-filters"><button data-listen-page="albums">Browse albums</button><button data-listen-page="liked">Liked Songs</button></div></div>`;
  const matches=files.filter(file=>{const info=listenInfo(file);return `${file.name} ${file.dir} ${info.title} ${info.artist} ${info.album}`.toLowerCase().includes(q);});
  return matches.length?`<h2 class="listen-search-count">${listenSongCount(matches.length)}</h2>${listenTracks(matches)}`:listenEmpty('No results found','Try another song, album, or artist.','search');
}
function listenSearchPage(files){return `<section class="listen-section listen-search-page"><h1>Search</h1><label class="listen-search-input">${icon('magnifying-glass')}<input id="listenSearch" type="search" placeholder="Songs, artists, or albums" aria-label="Search music" value="${esc(state.q)}" autocomplete="off" enterkeyhint="search"></label><div id="listenSearchResults">${listenSearchResults(files)}</div></section>`;}
function wireListenSearch(files){
  const input=$('#listenSearch');if(!input)return;
  input.oninput=()=>{
    state.q=input.value;$('#q').value=input.value;recordBrowserLocation();
    const results=$('#listenSearchResults');results.innerHTML=listenSearchResults(files);
    results.querySelectorAll('[data-listen-page]').forEach(button=>button.onclick=()=>navigateListen(button.dataset.listenPage));
    results.querySelectorAll('[data-listen-album]').forEach(button=>button.onclick=()=>navigateListen('album',button.dataset.listenAlbum));
    results.querySelectorAll('[data-play-track]').forEach(button=>button.onclick=()=>{const file=files.find(file=>file.rel===button.dataset.playTrack);if(file){if(listenCurrent()?.rel===file.rel)toggleMusic();else playMusic(file,files);}});
    results.querySelectorAll('[data-like-track]').forEach(button=>button.onclick=()=>toggleLike(button.dataset.likeTrack));
    results.querySelectorAll('[data-track-options]').forEach(button=>button.onclick=()=>listenTrackOptions(files.find(file=>file.rel===button.dataset.trackOptions)));
    results.querySelector('[data-listen-clear]')?.addEventListener('click',()=>{input.value='';input.oninput();input.focus();});
    hydrateListen(files);
  };
  input.onkeydown=event=>{if(event.key==='Enter')input.blur();};
}
function ensureListenExpanded(){
  let panel=$('#listenExpanded');if(panel)return panel;
  panel=document.createElement('section');panel.id='listenExpanded';panel.className='listen-expanded';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Now playing');document.body.append(panel);
  panel.addEventListener('keydown',event=>{
    if(layers.at(-1)?.name!=='musicExpanded')return;
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();closeLayer();}
    if(event.key==='Tab'){
      const controls=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  return panel;
}
function openListenExpanded(page='now'){
  const panel=ensureListenExpanded();listenExpandedPage=page;listenExpandedKey='';
  if(panel.hidden){listenExpandedReturn=document.activeElement;panel.hidden=false;document.body.classList.add('listen-expanded-open');$('#app').inert=true;openLayer('musicExpanded',()=>{panel.hidden=true;$('#app').inert=false;document.body.classList.remove('listen-expanded-open');if(listenExpandedReturn?.isConnected)listenExpandedReturn.focus({preventScroll:true});else $('#musicNowTitle')?.focus({preventScroll:true});});}
  syncListenExpanded();panel.querySelector('button')?.focus({preventScroll:true});
}
function listenExpandedMarkup(){
  const file=listenCurrent(),info=listenInfo(file),queue=listenExpandedPage==='queue';
  const btn=(id,glyph,label,extra='')=>`<button class="listen-icon ${extra}" id="${id}" aria-label="${label}">${icon(glyph)}</button>`;
  if(queue)return `<div class="listen-expanded-inner queue-view"><header class="listen-expanded-head">${btn('listenNowBack','caret-left','Back to now playing')}<h1>Queue</h1>${btn('listenNowClose','caret-down','Close player')}</header><div class="listen-expanded-queue">${file?`<h2>Now playing</h2><div class="listen-queue-current">${listenArt(file)}<span><b>${esc(info.title)}</b><small>${esc(info.artist)}</small></span></div><h2>Next up</h2>`:''}${musicQueue.slice(musicIndex+1).map((track,i)=>`<button class="listen-queue-item" data-expanded-queue="${musicIndex+1+i}">${listenArt(track)}<span><b>${esc(listenInfo(track).title)}</b><small>${esc(listenInfo(track).artist)}</small></span>${icon('play')}</button>`).join('')||'<p class="listen-helper">Nothing else queued. Add songs from their options menu.</p>'}</div></div>`;
  return `<div class="listen-expanded-inner"><header class="listen-expanded-head">${btn('listenNowClose','caret-down','Close player')}<h1>Now playing</h1>${btn('listenNowOptions','dots-three','Track options')}</header><div class="listen-expanded-art">${listenArt(file)}</div><div class="listen-expanded-body"><div class="listen-expanded-title"><div><h2 id="listenNowTitle">${esc(info.title)}</h2><p id="listenNowArtist">${esc(info.artist)}</p></div>${btn('listenNowLike','heart','Like song')}</div><div class="listen-expanded-seek"><input id="listenNowSeek" type="range" min="0" max="1000" value="0" aria-label="Playback position"><div><span id="listenNowAt">0:00</span><span id="listenNowDuration">0:00</span></div></div><div class="listen-expanded-transport">${btn('listenNowShuffle','shuffle','Shuffle')}${btn('listenNowPrevious','skip-back','Previous track')}${btn('listenNowPlay','play','Play','listen-expanded-play')}${btn('listenNowNext','skip-forward','Next track')}${btn('listenNowRepeat','repeat','Repeat off')}</div><div class="listen-expanded-tools">${btn('listenNowMute','speaker-high','Mute')}<input id="listenNowVolume" type="range" min="0" max="100" value="100" aria-label="Music volume">${btn('listenNowQueue','queue','Show queue')}</div></div></div>`;
}
function syncListenExpanded(){
  const panel=$('#listenExpanded');if(!panel||panel.hidden)return;
  const file=listenCurrent(),info=listenInfo(file),audio=$('#musicAudio');
  const key=JSON.stringify([listenExpandedPage,file?.rel,info.title,info.artist,info.cover,musicIndex,listenExpandedPage==='queue'?musicQueue.map(track=>track.rel):null]);
  if(key!==listenExpandedKey){
    const focused=panel.contains(document.activeElement)?document.activeElement.id:'';
    listenExpandedKey=key;panel.innerHTML=listenExpandedMarkup();panel.setAttribute('aria-label',listenExpandedPage==='queue'?'Queue':'Now playing');
    panel.querySelector('#listenNowClose').onclick=()=>closeLayer();
    panel.querySelector('#listenNowBack')?.addEventListener('click',()=>openListenExpanded());
    panel.querySelector('#listenNowOptions')?.addEventListener('click',()=>listenTrackOptions(listenCurrent()));
    for(const [id,target]of [['Play','musicPlay'],['Like','musicLike'],['Previous','musicPrev'],['Next','musicNext'],['Shuffle','musicShuffle'],['Repeat','musicRepeat'],['Mute','musicMute']])panel.querySelector('#listenNow'+id)?.addEventListener('click',()=>$('#'+target).click());
    panel.querySelector('#listenNowQueue')?.addEventListener('click',()=>openListenExpanded('queue'));
    panel.querySelector('#listenNowSeek')?.addEventListener('input',event=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(event.target.value)/1000*audio.duration;syncListenExpandedTime();});
    panel.querySelector('#listenNowVolume')?.addEventListener('input',event=>{const original=$('#musicVolume');original.value=event.target.value;original.dispatchEvent(new Event('input'));});
    panel.querySelectorAll('[data-expanded-queue]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.expandedQueue);playMusic(musicQueue[index],musicQueue,index);});
    const head=panel.querySelector('header');let touch=null;
    head.onpointerdown=event=>{if(event.target.closest('button'))return;touch={x:event.clientX,y:event.clientY};head.setPointerCapture(event.pointerId);};
    head.onpointerup=event=>{if(touch&&event.clientY-touch.y>70&&Math.abs(event.clientX-touch.x)<50)closeLayer();touch=null;};head.onpointercancel=()=>{touch=null;};
    if(focused)(panel.querySelector('#'+focused)||panel.querySelector('button'))?.focus({preventScroll:true});
  }
  const mirror=(suffix,source)=>{const target=$('#listenNow'+suffix),original=$('#'+source);if(!target)return;target.innerHTML=original.innerHTML;target.setAttribute('aria-label',original.getAttribute('aria-label'));target.classList.toggle('on',original.classList.contains('on'));if(original.hasAttribute('aria-pressed'))target.setAttribute('aria-pressed',original.getAttribute('aria-pressed'));target.disabled=!file;};
  for(const [suffix,source]of [['Play','musicPlay'],['Like','musicLike'],['Shuffle','musicShuffle'],['Repeat','musicRepeat'],['Mute','musicMute']])mirror(suffix,source);
  for(const id of ['listenNowPrevious','listenNowNext','listenNowOptions'])if($('#'+id))$('#'+id).disabled=!file;
  syncListenExpandedTime();
}
function syncListenExpandedTime(){
  const panel=$('#listenExpanded');if(!panel||panel.hidden)return;
  const audio=$('#musicAudio'),duration=Number.isFinite(audio.duration)?audio.duration:0,seek=$('#listenNowSeek');
  if(seek){seek.disabled=!duration;seek.value=duration?Math.round(audio.currentTime/duration*1000):0;paintMusicRange(seek);$('#listenNowAt').textContent=fmtTime(audio.currentTime);$('#listenNowDuration').textContent=fmtTime(duration);}
  const volume=$('#listenNowVolume');if(volume){volume.value=audio.muted?0:audio.volume*100;paintMusicRange(volume);}
}
function listenVaultTools(){
  const actions=[['btnUpload','upload-simple','Add to Vault'],['btnActivity','clock-counter-clockwise','Activity'],['btnUsers','gear-six','Manage Vault']].filter(([id])=>!$('#'+id).hidden);
  sheet(`<h3>Vault tools</h3><div class="listen-track-menu">${actions.map(([id,glyph,label])=>`<button data-vault-tool="${id}">${icon(glyph)}${label}</button>`).join('')}</div><div class="sheet-row"><button id="done" class="ghost">Close</button></div>`);
  $('#done').onclick=closeSheet;document.querySelectorAll('[data-vault-tool]').forEach(button=>button.onclick=()=>{const id=button.dataset.vaultTool;window.addEventListener('popstate',()=>$('#'+id).click(),{once:true});closeSheet();});
}
document.addEventListener('DOMContentLoaded',()=>{
  const tool=document.createElement('button');tool.id='listenVaultTools';tool.className='ghost header-icon';tool.setAttribute('aria-label','Vault tools');tool.innerHTML=icon('dots-three');tool.onclick=listenVaultTools;$('.header-actions').append(tool);
  const audio=$('#musicAudio');for(const event of ['timeupdate','loadedmetadata'])audio.addEventListener(event,syncListenExpandedTime);audio.addEventListener('volumechange',syncListenExpanded);
  $('.music-now').addEventListener('click',event=>{if(listenMobile()&&listenCurrent()&&!event.target.closest('button'))openListenExpanded();});
  matchMedia('(max-width:900px)').addEventListener('change',()=>{if(!listenMobile()&&!$('#listenExpanded')?.hidden&&layers.at(-1)?.name==='musicExpanded')closeLayer();});
});
