/* Watch direction: the user chose Netflix / HBO / Emby conventions. Artwork leads,
   simple rows and posters support browsing, and shows open into seasons then episodes.
   This scope changes presentation only; file paths, Library and Listen stay intact. */
const watchActive=()=>state.mode==='entertainment'&&['movies','series'].includes(state.shelf);
const watchEpisode=file=>WatchModel.episode(file);
const watchSeasonName=season=>WatchModel.seasonName(Number(season));
const watchProgress=file=>file.watch?.dur?Math.min(100,Math.max(0,file.watch.pos/file.watch.dur*100)):0;
const watchMetaCache=new Map();
let watchRenderVersion=0;

function watchCatalog(list){
  const shows=seriesGroups(list.filter(file=>file.shelf==='series')).map(group=>({...group,type:'show'}));
  const movies=movieGroups(list.filter(file=>file.shelf==='movies')).map(group=>({...group,type:'movie',modified:group.representative.modified||0}));
  return [...shows,...movies];
}
const watchMetaKey=group=>group.type+':'+group.key;
const watchMeta=group=>watchMetaCache.get(watchMetaKey(group))||{};
const watchTitle=group=>watchMeta(group).title||group.label;
function watchDetailAttrs(group){return `data-watch-detail="${esc(group.key)}" data-kind="${group.type}"`;}
function watchFacts(group){
  const meta=watchMeta(group),facts=[];
  if(meta.year||group.year)facts.push(meta.year||group.year);
  if(group.type==='show')facts.push(`${group.seasons.length} ${group.seasons.length===1?'season':'seasons'}`);
  else if(meta.runtime)facts.push(`${Math.floor(meta.runtime/60)}h ${meta.runtime%60}m`);
  if(meta.genres?.length)facts.push(meta.genres.slice(0,2).join(' · '));
  return facts.join(' · ')|| (group.type==='show'?`${group.files.length} episodes`:'Movie');
}
function watchImage(group,kind='poster'){
  const meta=watchMeta(group);
  return kind==='backdrop'?(meta.backdrop||meta.poster):(meta.poster||meta.backdrop);
}
function watchArt(group,{wide=false,priority=false}={}){
  const image=watchImage(group,wide?'backdrop':'poster');
  const fallback=state.thumbs?url('thumb',group.representative.rel):'';
  return `<span class="watch-art ${image?'has-art':''}" data-art-rel="${esc(group.representative.rel)}" data-art-kind="${wide?'backdrop':'poster'}"><span class="watch-art-fallback">${icon(group.type==='show'?'television-simple':'film-strip')}<span>${esc(group.label)}</span></span>${image||fallback?`<img src="${esc(image||fallback)}" alt="" ${priority?'fetchpriority="high"':'loading="lazy"'} onerror="this.remove()">`:''}</span>`;
}
function watchNav(){
  const tab=state.watchTab||'home';
  return `<nav class="watch-navigation" aria-label="Watch"><div>${[['home','Home'],['movies','Movies'],['shows','TV Shows']].map(([key,label])=>`<button data-watch-tab="${key}" class="${tab===key?'on':''}" ${tab===key?'aria-current="page"':''}>${label}</button>`).join('')}</div><div class="watch-nav-actions"><button class="watch-search-button" data-watch-scan aria-label="Scan metadata" title="Scan metadata" aria-expanded="${metadataPanelOpen}">${icon('arrows-clockwise')}<span>${metadataJob?.status==='running'?'Scanning…':'Scan metadata'}</span></button><button class="watch-search-button" data-watch-search aria-label="Search Watch">${icon('magnifying-glass')}<span>Search</span></button></div></nav><div id="watchScanPanel" ${metadataPanelOpen?'':'hidden'}></div>`;
}
function watchPoster(group){
  return `<button class="watch-poster" ${watchDetailAttrs(group)} aria-label="${esc(group.type==='show'?'View seasons of '+watchTitle(group):'View '+watchTitle(group))}">${watchArt(group)}<span class="watch-poster-title" data-title-rel="${esc(group.representative.rel)}">${esc(watchTitle(group))}</span><span class="watch-poster-meta">${group.type==='show'?`${group.seasons.length} ${group.seasons.length===1?'season':'seasons'}`:watchMeta(group).year||group.year||'Movie'}</span></button>`;
}
function watchResumeCard(group,list){
  const file=group.representative,ep=group.type==='show'?watchEpisode(file):null,progress=watchProgress(file);
  return `<article class="watch-resume-card"><button class="watch-resume-open" data-act="open" data-i="${list.indexOf(file)}" aria-label="Continue ${esc(watchTitle(group))}">${watchArt(group,{wide:true})}<span class="watch-play-overlay">${icon('play','ph-fill')}</span><span class="watch-progress"><i style="width:${progress}%"></i></span></button><div class="watch-resume-copy"><button ${watchDetailAttrs(group)} data-title-rel="${esc(file.rel)}">${esc(watchTitle(group))}</button><span>${ep?`${watchSeasonName(ep.season)}${ep.episode!==null?` · Episode ${ep.episode}`:''}`:'Continue movie'}</span></div><button class="watch-icon-button watch-resume-more" data-watch-tools="${list.indexOf(file)}" aria-label="Options for ${esc(watchTitle(group))}">${icon('dots-three')}</button></article>`;
}
function watchRail(title,content,{wide=false,tab=''}={}){
  if(!content)return '';
  return `<section class="watch-rail ${wide?'wide':''}"><div class="watch-section-heading"><h2>${esc(title)}</h2><div>${tab?`<button class="watch-see-all" data-watch-tab="${tab}">View all ${icon('caret-right')}</button>`:''}<button class="watch-icon-button" data-watch-scroll="-1" aria-label="Previous ${esc(title)}">${icon('caret-left')}</button><button class="watch-icon-button" data-watch-scroll="1" aria-label="Next ${esc(title)}">${icon('caret-right')}</button></div></div><div class="watch-rail-track">${content}</div></section>`;
}
function watchHero(group,list,{detail=false}={}){
  const file=group.representative,meta=watchMeta(group),isShow=group.type==='show';
  const partial=file.watch&&!file.watch.done&&file.watch.pos>0;
  const title=watchTitle(group),fallback=isShow?`${group.seasons.length} ${group.seasons.length===1?'season':'seasons'} in your library. Choose a season to explore its episodes.`:'Ready to watch from your library.';
  return `<section class="watch-feature ${detail?'watch-detail-feature':''}" data-feature-rel="${esc(file.rel)}">${watchArt(group,{wide:true,priority:true})}<div class="watch-feature-shade"></div><div class="watch-feature-copy">${detail?'<button class="watch-back" data-watch-back>'+icon('arrow-left')+' Back</button>':''}<h1 data-title-rel="${esc(file.rel)}">${esc(title)}</h1><p class="watch-feature-facts" data-facts-rel="${esc(file.rel)}">${esc(watchFacts(group))}</p><p class="watch-synopsis" data-overview-rel="${esc(file.rel)}">${esc(meta.overview||fallback)}</p><div class="watch-feature-actions"><button class="watch-primary" data-act="open" data-i="${list.indexOf(file)}">${icon('play','ph-fill')} ${partial?'Resume':isShow?'Play next episode':'Play'}</button>${detail?`<button class="watch-secondary" data-watch-tools="${list.indexOf(file)}">${icon('dots-three')} More</button>`:`<button class="watch-secondary" ${watchDetailAttrs(group)}>${icon('info')} ${isShow?'Seasons & episodes':'More info'}</button>`}</div>${partial?`<p class="watch-resume-hint">${isShow?`${watchSeasonName(watchEpisode(file).season)} · Episode ${watchEpisode(file).episode??'—'} · `:''}${Math.round(watchProgress(file))}% watched</p>`:''}</div></section>`;
}
function watchSeasonCard(group,season){
  const episodes=group.files.filter(file=>watchEpisode(file).season===season),done=episodes.filter(file=>file.watch?.done).length;
  return `<button class="watch-season-card" data-watch-season="${season}">${watchArt(group)}<span class="watch-season-number">${season>0?season:season===0?'S':'—'}</span><span class="watch-season-title">${watchSeasonName(season)}</span><span class="watch-season-meta">${episodes.length} ${episodes.length===1?'episode':'episodes'}${done?` · ${done} watched`:''}</span></button>`;
}
function watchEpisodeRow(file,list){
  const ep=watchEpisode(file),progress=watchProgress(file),partial=file.watch&&!file.watch.done&&file.watch.pos>0;
  return `<article class="watch-episode"><span class="watch-episode-number">${ep.episode??'—'}</span><button class="watch-episode-image" data-act="open" data-i="${list.indexOf(file)}" aria-label="Play ${esc(ep.title)}">${state.thumbs?`<img src="${url('thumb',file.rel)}" alt="" loading="lazy" onerror="this.remove()">`:''}<span class="watch-play-overlay">${icon('play','ph-fill')}</span>${progress?`<span class="watch-progress"><i style="width:${progress}%"></i></span>`:''}</button><button class="watch-episode-copy" data-act="open" data-i="${list.indexOf(file)}"><span><b>${esc(ep.title)}</b>${file.watch?.done?`<span class="watch-seen">${icon('check')} Watched</span>`:''}</span><small>${partial?`Resume · ${Math.round(progress)}% watched`:`${watchSeasonName(ep.season)}${ep.episode!==null?` · Episode ${ep.episode}`:''}`}</small></button><button class="watch-icon-button" data-watch-tools="${list.indexOf(file)}" aria-label="Options for ${esc(ep.title)}">${icon('dots-three')}</button></article>`;
}
function watchShowDetail(group,list){
  const selected=state.watchSeason!==null&&state.watchSeason!==undefined&&group.seasons.includes(Number(state.watchSeason));
  const season=Number(state.watchSeason),episodes=selected?group.files.filter(file=>watchEpisode(file).season===season):[];
  return `${watchHero(group,list,{detail:true})}<section class="watch-detail-content"><div class="watch-section-heading"><h2>${selected?'Episodes':'Seasons'}</h2>${selected?`<div><button class="watch-text-button" data-watch-all-seasons>${icon('squares-four')} All seasons</button><select id="watchSeasonPicker" aria-label="Choose season">${group.seasons.map(s=>`<option value="${s}" ${s===season?'selected':''}>${watchSeasonName(s)}</option>`).join('')}</select><button class="watch-icon-button" data-watch-season-tools aria-label="Season options">${icon('dots-three')}</button></div>`:`<span>${group.seasons.length} ${group.seasons.length===1?'season':'seasons'}</span>`}</div>${selected?`<div class="watch-episode-list">${episodes.map(file=>watchEpisodeRow(file,list)).join('')}</div>`:`<div class="watch-season-grid">${group.seasons.map(s=>watchSeasonCard(group,s)).join('')}</div>`}</section>${watchAbout(group)}`;
}
function watchAbout(group){
  const meta=watchMeta(group);
  return `<section class="watch-about" data-about-rel="${esc(group.representative.rel)}" ${!meta.cast?.length&&!meta.genres?.length&&!meta.provider?'hidden':''}>${meta.cast?.length?`<p><span>Cast:</span> ${esc(meta.cast.slice(0,8).map(person=>person.name).join(', '))}</p>`:''}${meta.genres?.length?`<p><span>Genres:</span> ${esc(meta.genres.join(', '))}</p>`:''}${meta.provider==='TVmaze'?`<p><a href="${esc(meta.sourceUrl)}" target="_blank" rel="noopener noreferrer">Metadata from TVmaze</a></p>`:''}</section>`;
}
function watchMovieDetail(group,list){
  const other=[...group.files,...group.extras].filter(file=>file!==group.representative);
  return `${watchHero(group,list,{detail:true})}${watchAbout(group)}${other.length?`<section class="watch-detail-content"><div class="watch-section-heading"><h2>Versions & extras</h2></div>${other.map(file=>`<div class="watch-version"><span>${esc(cleanMediaTitle(file.name)||file.name)}<small>${esc(file.ext.toUpperCase())} · ${bytes(file.size)}</small></span><button class="watch-secondary" data-act="open" data-i="${list.indexOf(file)}">${icon('play','ph-fill')} Play</button></div>`).join('')}</section>`:''}`;
}
function watchView(list){
  const catalog=watchCatalog(list),tab=state.watchTab||'home';
  const detail=catalog.find(group=>group.type==='show'?group.key===state.showDetail:group.key===state.movieDetail);
  if(detail&&!state.q)return `<div class="watch-app watch-detail">${watchNav()}${detail.type==='show'?watchShowDetail(detail,list):watchMovieDetail(detail,list)}</div>`;
  const q=state.q.toLowerCase();
  let groups=catalog.filter(group=>(tab==='home'||group.type===(tab==='shows'?'show':'movie'))&&(!q||`${watchTitle(group)} ${group.label} ${group.files.map(file=>file.name).join(' ')} ${watchMeta(group).genres?.join(' ')||''}`.toLowerCase().includes(q)));
  const sort=state.watchSort||'new';
  groups.sort((a,b)=>sort==='az'?watchTitle(a).localeCompare(watchTitle(b)):sort==='year'?(Number(watchMeta(b).year||b.year)||0)-(Number(watchMeta(a).year||a.year)||0):(b.modified||0)-(a.modified||0));
  if(!groups.length)return `<div class="watch-app">${watchNav()}<div class="watch-empty">${icon(q?'magnifying-glass':'film-strip')}<h1>${q?'No titles found':tab==='shows'?'Your shows live here':tab==='movies'?'Your movies live here':'Your next watch starts here'}</h1><p>${q?'Try a different title or clear your search.':'Add your movies and shows in Library. They will appear here, ready to watch.'}</p><button class="watch-primary" ${q?'data-watch-clear-search':'data-watch-library'}>${q?'Clear search':'Open Library'}</button></div></div>`;
  const resume=groups.filter(group=>group.representative.watch&&!group.representative.watch.done&&group.representative.watch.pos>0).sort((a,b)=>(b.representative.watch.at||0)-(a.representative.watch.at||0));
  if(tab!=='home'||q)return `<div class="watch-app">${watchNav()}<section class="watch-browse"><div class="watch-browse-heading"><div><h1>${q?'Search results':tab==='shows'?'TV Shows':'Movies'}</h1><p>${groups.length} ${groups.length===1?'title':'titles'}${q?` for “${esc(state.q)}”`:''}</p></div><select id="watchSort" aria-label="Sort titles"><option value="new" ${sort==='new'?'selected':''}>Recently added</option><option value="az" ${sort==='az'?'selected':''}>A–Z</option><option value="year" ${sort==='year'?'selected':''}>Release year</option></select></div><div class="watch-poster-grid">${groups.map(watchPoster).join('')}</div></section></div>`;
  const feature=resume[0]||groups[0],shows=groups.filter(group=>group.type==='show'),movies=groups.filter(group=>group.type==='movie');
  return `<div class="watch-app watch-home">${watchNav()}${watchHero(feature,list)}<div class="watch-home-rows">${watchRail('Continue watching',resume.map(group=>watchResumeCard(group,list)).join(''),{wide:true})}${watchRail('TV Shows',shows.slice(0,18).map(watchPoster).join(''),{tab:'shows'})}${watchRail('Movies',movies.slice(0,18).map(watchPoster).join(''),{tab:'movies'})}</div></div>`;
}
function navigateWatch(changes){
  closeFileMenu();Object.assign(state,{mode:'entertainment',shelf:SHELF_ORDER.includes('movies')?'movies':'series',folder:'',q:'',showDetail:null,movieDetail:null,watchSeason:null},changes);
  $('#q').value='';state.picked.clear();render();$('#scroll').scrollTop=0;
}
function watchTools(file){
  const done=!!file.watch?.done;
  sheet(`<h3>${esc(file.shelf==='series'?watchEpisode(file).title:cleanMediaTitle(file.name))}</h3><div class="watch-tools"><button data-tool="play">${icon('play')} Play</button><button data-tool="watched">${icon('check')} ${done?'Mark unwatched':'Mark watched'}</button>${file.watch&&!done?'<button data-tool="clear">'+icon('arrow-counter-clockwise')+' Clear progress</button>':''}<button data-tool="download">${icon('download-simple')} Download file</button><button data-tool="subtitles">${icon('subtitles')} Generate AI subtitles</button>${file.ext==='mkv'?`<button data-tool="convert">${icon('film-strip')} Convert to MP4</button>`:''}</div><div class="sheet-row"><button class="ghost" id="done">Close</button></div>`);
  $('#done').onclick=closeSheet;
  $('#sheet').querySelectorAll('[data-tool]').forEach(button=>button.onclick=()=>{
    const action=button.dataset.tool;
    if(action==='subtitles'){askAiSubtitles([file],file.shelf==='series'?'episode':'movie');return;}
    if(action==='convert'){askConvert(file);return;}
    if(action==='download'){location.assign(url('download',file.rel));return;}
    // Close the action layer before opening playback or refreshing watched state.
    window.addEventListener('popstate',()=>{if(action==='play')openViewer(file);else setEpisodeWatch(file,action==='clear'||done?'clear':'done');},{once:true});closeSheet();
  });
}
function wireWatch(list){
  if(!watchActive())return;
  clearTimeout(featureTimer);
  const catalog=watchCatalog(list);
  $('[data-watch-scan]').onclick=()=>{metadataPanelOpen=!metadataPanelOpen;renderMetadataPanel();if(metadataPanelOpen)void startMetadataScan();};
  renderMetadataPanel();
  $('#scroll').querySelectorAll('[data-watch-tab]').forEach(button=>button.onclick=()=>navigateWatch({watchTab:button.dataset.watchTab}));
  $('#scroll').querySelectorAll('[data-watch-detail]').forEach(button=>button.onclick=()=>navigateWatch({watchTab:button.dataset.kind==='show'?'shows':'movies',[button.dataset.kind==='show'?'showDetail':'movieDetail']:button.dataset.watchDetail}));
  $('#scroll').querySelectorAll('[data-watch-season]').forEach(button=>button.onclick=()=>navigateWatch({watchTab:'shows',showDetail:state.showDetail,watchSeason:Number(button.dataset.watchSeason)}));
  const picker=$('#watchSeasonPicker');if(picker)picker.onchange=()=>navigateWatch({watchTab:'shows',showDetail:state.showDetail,watchSeason:Number(picker.value)});
  const all=$('[data-watch-all-seasons]');if(all)all.onclick=()=>navigateWatch({watchTab:'shows',showDetail:state.showDetail});
  const back=$('[data-watch-back]');if(back)back.onclick=()=>state.watchSeason!==null&&state.watchSeason!==undefined?navigateWatch({watchTab:'shows',showDetail:state.showDetail}):navigateWatch({watchTab:state.showDetail?'shows':'movies'});
  const search=$('[data-watch-search]');if(search)search.onclick=()=>$('#q').focus();
  const clear=$('[data-watch-clear-search]');if(clear)clear.onclick=()=>{state.q='';$('#q').value='';render();};
  const library=$('[data-watch-library]');if(library)library.onclick=goLibraryRoot;
  const sort=$('#watchSort');if(sort)sort.onchange=()=>{state.watchSort=sort.value;render();};
  $('#scroll').querySelectorAll('[data-watch-tools]').forEach(button=>button.onclick=()=>watchTools(list[Number(button.dataset.watchTools)]));
  const seasonTools=$('[data-watch-season-tools]');if(seasonTools)seasonTools.onclick=()=>{
    const group=catalog.find(group=>group.key===state.showDetail),files=group.files.filter(file=>watchEpisode(file).season===Number(state.watchSeason));
    sheet(`<h3>${watchSeasonName(state.watchSeason)}</h3><div class="watch-tools"><button id="seasonDownload">${icon('download-simple')} Download season</button><button id="seasonAI">${icon('subtitles')} Generate AI subtitles</button>${files.some(file=>file.ext==='mkv')?`<button id="seasonConvert">${icon('film-strip')} Convert MKVs to MP4</button>`:''}</div><div class="sheet-row"><button class="ghost" id="done">Close</button></div>`);
    $('#done').onclick=closeSheet;$('#seasonDownload').onclick=()=>downloadSelection(files.map(file=>file.rel));$('#seasonAI').onclick=()=>askAiSubtitles(files,'season');if($('#seasonConvert'))$('#seasonConvert').onclick=()=>askMassConvert(files,'season');
  };
  $('#scroll').querySelectorAll('[data-watch-scroll]').forEach(button=>button.onclick=()=>{const track=button.closest('.watch-rail').querySelector('.watch-rail-track');track.scrollBy({left:Number(button.dataset.watchScroll)*track.clientWidth*.85,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
  hydrateWatch(catalog);
}
async function hydrateWatch(catalog){
  const version=++watchRenderVersion;if(!state.artwork)return;
  // Load only visible groups, with bounded concurrency and the existing metadata cache.
  const wanted=new Set([...$('#scroll').querySelectorAll('[data-art-rel]')].map(element=>element.dataset.artRel));
  const pending=catalog.filter(group=>wanted.has(group.representative.rel));
  async function worker(){
    while(pending.length&&version===watchRenderVersion&&watchActive()){
      const group=pending.shift(),file=group.representative;
      const meta=watchMetaCache.get(watchMetaKey(group))||await fetchMediaMeta(url('meta',file.rel));
      if(!meta.found)continue;watchMetaCache.set(watchMetaKey(group),meta);
      if(version!==watchRenderVersion||!watchActive())return;
      $('#scroll').querySelectorAll('[data-art-rel]').forEach(art=>{
        if(art.dataset.artRel!==file.rel)return;const src=watchImage(group,art.dataset.artKind);if(!src)return;
        const old=art.querySelector('img');if(old?.getAttribute('src')===src)return;
        const image=document.createElement('img');image.alt='';image.src=src;image.onload=()=>{if(art.isConnected){old?.remove();art.classList.add('has-art');}};image.onerror=()=>image.remove();art.append(image);
      });
      $('#scroll').querySelectorAll('[data-title-rel]').forEach(element=>{if(element.dataset.titleRel===file.rel)element.textContent=watchTitle(group);});
      $('#scroll').querySelectorAll('[data-facts-rel]').forEach(element=>{if(element.dataset.factsRel===file.rel)element.textContent=watchFacts(group);});
      $('#scroll').querySelectorAll('[data-overview-rel]').forEach(element=>{if(element.dataset.overviewRel===file.rel&&meta.overview)element.textContent=meta.overview;});
      const about=[...$('#scroll').querySelectorAll('[data-about-rel]')].find(element=>element.dataset.aboutRel===file.rel);if(about)about.outerHTML=watchAbout(group);
    }
  }
  await Promise.all([worker(),worker(),worker(),worker()]);
}


let metadataPanelOpen=false,metadataJob=null,metadataSettings=null,metadataTimer=null,metadataRequest=false,metadataError='';
function renderMetadataPanel(){
  const panel=$('#watchScanPanel');if(!panel)return;
  panel.hidden=!metadataPanelOpen;
  const button=$('[data-watch-scan]');button?.setAttribute('aria-expanded',String(metadataPanelOpen));
  if(button)button.querySelector('span').textContent=metadataJob?.status==='running'?'Scanning…':'Scan metadata';
  if(!metadataPanelOpen)return;
  const job=metadataJob,working=job?.status==='running',missingKey=metadataSettings&&!metadataSettings.tmdbConfigured;
  const summary=metadataRequest&&!job?'Starting scan…':working?`Scanning ${job.done} of ${job.total} titles…`:job?.status==='complete'?`${job.matched} of ${job.total} titles matched`:job?.status==='error'?'Scan could not finish':'Scan your movie and TV metadata';
  panel.innerHTML=`<section class="watch-scan-panel"><div class="watch-scan-heading"><div><h2 role="status">${esc(summary)}</h2><p>${working?'You can keep browsing while artwork and details update.':job?.status==='complete'?(job.matched?'Scan finished. Matched titles are ready in Watch.':'No titles matched. Check the details below, then scan again.'):'Retry matching titles and refresh artwork.'}</p></div><button class="watch-icon-button" id="closeMetadataPanel" aria-label="Close scan results">${icon('x')}</button></div>${metadataError?`<p role="alert">${esc(metadataError)}</p>`:''}${job?.error?`<p role="alert">${esc(job.error)}</p>`:''}${missingKey?`<p class="watch-scan-notice">Movie metadata needs a TMDB API key. ${metadataSettings.canConfigure?'Open Metadata settings to add your key, then scan again.':'Ask a Vault administrator to configure it.'} TV shows can use TVmaze without a key.</p>`:''}${job?.issues?.length?`<details class="watch-scan-issues"><summary>${job.issues.length} ${job.issues.length===1?'title needs':'titles need'} attention</summary><ul>${job.issues.map(issue=>`<li><strong>${esc(issue.name)}</strong><span>${esc(issue.reason)}</span></li>`).join('')}</ul></details>`:''}<div class="watch-scan-controls"><button class="watch-secondary" id="metadataRescan" ${working||metadataRequest?'disabled':''}>${icon('arrows-clockwise')} Scan again</button>${metadataSettings?.canConfigure?`<button class="watch-text-button" id="metadataConfigure" ${working?'disabled':''}>Metadata settings</button>`:''}</div><div id="metadataConfig"></div></section>`;
  $('#closeMetadataPanel').onclick=()=>{metadataPanelOpen=false;renderMetadataPanel();};
  $('#metadataRescan').onclick=()=>startMetadataScan();
  $('#metadataConfigure')?.addEventListener('click',showMetadataSettings);
}
function showMetadataSettings(){
  const host=$('#metadataConfig');if(!host)return;
  host.innerHTML=`<form class="watch-metadata-form"><label for="tmdbKey">TMDB API key</label><div><input id="tmdbKey" type="password" autocomplete="off" required pattern="[a-fA-F0-9]{32}" placeholder="32-character API key"><button class="watch-secondary" type="submit">Save key</button></div><p>Get an API key from <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer">your TMDB account</a>. Your key stays on the Vault server.</p><p role="alert" id="tmdbError"></p></form>`;
  $('#tmdbKey').focus();
  host.querySelector('form').onsubmit=async event=>{event.preventDefault();const submit=host.querySelector('button');submit.disabled=true;
    try{await appsRequest('/api/metadata/settings',{method:'PUT',body:JSON.stringify({tmdbKey:$('#tmdbKey').value})});metadataSettings.tmdbConfigured=true;await startMetadataScan();}
    catch(error){$('#tmdbError').textContent=error.message;submit.disabled=false;}
  };
}
async function startMetadataScan(){
  if(metadataRequest||metadataJob?.status==='running')return;
  metadataRequest=true;metadataError='';renderMetadataPanel();
  try{
    metadataSettings=await appsRequest('/api/metadata/settings');
    const scope=state.watchTab==='shows'?'series':state.watchTab==='movies'?'movies':'all';
    metadataJob=await appsRequest('/api/metadata/scan',{method:'POST',body:JSON.stringify({scope})});
    void pollMetadataScan();
  }catch(error){metadataError=error.message;}
  finally{metadataRequest=false;renderMetadataPanel();}
}
async function pollMetadataScan(){
  clearTimeout(metadataTimer);
  try{
    metadataJob=await appsRequest('/api/metadata/scan');
    if(metadataJob.status==='running'){renderMetadataPanel();metadataTimer=setTimeout(pollMetadataScan,1500);}
    else{
      mediaMetaCache.clear();watchMetaCache.clear();watchRenderVersion++;
      if(watchActive())render();
    }
  }catch(error){metadataError=error.message;renderMetadataPanel();metadataTimer=setTimeout(pollMetadataScan,5000);}
}
