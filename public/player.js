function playerMiniBounds(box, viewport){
  const margin=12, top=Math.max(margin,viewport.top||0), room=Math.max(1,viewport.height-top-margin);
  const maxWidth=Math.max(1,Math.min(960,viewport.width-margin*2,room*16/9));
  const minWidth=Math.min(320,maxWidth),width=Math.max(minWidth,Math.min(maxWidth,Number(box.width)||460)),height=width*9/16;
  return {width,height,left:Math.max(margin,Math.min(viewport.width-margin-width,Number(box.left)||0)),top:Math.max(top,Math.min(viewport.height-margin-height,Number(box.top)||0))};
}
function playerBufferedEnd(video){
  const at=video.currentTime||0;
  for(let i=0;i<video.buffered.length;i++){
    if(at>=video.buffered.start(i)-.05&&at<=video.buffered.end(i)+.05)return Math.max(at,video.buffered.end(i));
  }
  return at;
}
/* Vault playback: transport, viewing modes, and subtitle controls. */
function mountPlayer(f, { src, native, info = {} }){
  $('#viewer').classList.add('playing');
  let duration = native ? 0 : (info.duration || 0);
  const directSource=src||url('stream',f.rel),canDirect=native;
  let triedCompatibility=false;
  const ep = f.shelf==='series'?watchEpisode(f):null;
  const heading = ep ? ep.show : f.name;
  const subheading = ep
    ? `${watchSeasonName(ep.season)}${ep.episode!==null?' · Episode '+ep.episode:''} · ${ep.title}`
    : (info.width ? `${info.width}×${info.height}` : bytes(f.size));
  const names = {720:'720p',1080:'1080p',2160:'4K',original:'Original'};
  let quality = 'original';
  const episodeChoices=ep?state.files.filter(item=>item.shelf==='series'&&VIDEO.includes(item.ext)&&watchEpisode(item).key===ep.key).sort((a,b)=>watchEpisode(a).season-watchEpisode(b).season||(watchEpisode(a).episode??Infinity)-(watchEpisode(b).episode??Infinity)||a.name.localeCompare(b.name,undefined,{numeric:true})):[];
  const control=(id,glyph,label)=>`<button class="pl-btn" id="${id}" title="${label}" aria-label="${label}">${icon(glyph)}</button>`;
  $('#vBody').innerHTML=`<div class="player theater" id="pl" data-mode="theater">
    <div class="pl-head"><div class="pl-titles" id="plMove" title="Drag to move the mini player"><b>${esc(ep?heading:cleanMediaTitle(f.name))}</b><small>${esc(subheading)}</small></div><div class="pl-head-tools">${control('plNavToggle','browser','Hide navigation bar in theater')}${control('plPip','picture-in-picture','Picture in picture')}${control('plMini','rectangle','Mini player')}${control('plRestore','arrows-out-simple','Return to theater')}${control('plClose','x','Close player')}</div></div>
    <div class="pl-stage" id="plStage"><video id="rmx" playsinline preload="auto"></video><div class="pl-veil"><button class="pl-big" id="plBig" title="Play" aria-label="Play">${icon('play','ph-fill')}</button></div><div class="pl-buffer-overlay on" id="plBufferOverlay" role="status"><div class="buffer-signal"><svg class="vault-buffer-logo" viewBox="0 0 64 64" aria-hidden="true"><path class="vault-buffer-ghost" d="M12 14L32 51L52 14"/><path class="vault-buffer-trace" d="M12 14L32 51L52 14"/><path class="vault-buffer-inner" d="M25 14L32 27L39 14"/></svg><b id="plBufferTitle">Preparing playback</b><span id="plBufferDetail">Opening the original stream</span></div></div><div class="pl-error" id="plError" role="alert" hidden></div></div>
    <div class="pl-bar">
      <div class="pl-scrub"><div class="pl-time" id="plAt">0:00</div><div class="pl-track" id="plTrack" role="slider" tabindex="0" aria-label="Playback position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="pl-buf" id="plBuf"></div><div class="pl-fill" id="plFill"></div><div class="pl-knob" id="plKnob"></div></div><div class="pl-time pl-rem" id="plRem">-0:00</div></div>
      <div class="pl-row">${control('plPlay','play','Play')}
        <button class="pl-btn" id="plBack" title="Rewind 10 seconds" aria-label="Rewind 10 seconds"><span class="pl-skip">${icon('arrow-counter-clockwise')}<span>10</span></span></button><button class="pl-btn" id="plFwd" title="Forward 10 seconds" aria-label="Forward 10 seconds"><span class="pl-skip">${icon('arrow-clockwise')}<span>10</span></span></button>
        <div class="pl-volume-group">${control('plMute','speaker-high','Mute')}<div class="pl-volume-pop"><div class="pl-vol" id="plVol" tabindex="0" role="slider" aria-label="Volume" aria-valuemin="0" aria-valuemax="100"><div class="pl-vol-track"></div><div class="pl-vol-fill" id="plVolFill"></div><div class="pl-vol-knob" id="plVolKnob"></div></div></div></div>
        <span class="pl-buffer-state" id="plBufferState"><i></i><span id="plBuffer">Starting</span></span><div class="pl-gap"></div>
        ${episodeChoices.length?control('plEpisodesButton','stack','Episodes'):''}${control('plCC','closed-captioning','Subtitles')}${control('plGear','gear-six','Settings')}${control('plFull','corners-out','Fullscreen')}
      </div>
    </div>
    <div class="pl-menu cc-menu" id="plMenu" role="dialog" aria-label="Subtitles" hidden></div><div class="pl-menu" id="plSettings" role="dialog" aria-label="Player settings" hidden></div><div class="pl-menu" id="plSpeed" role="dialog" aria-label="Playback speed" hidden></div><div class="pl-menu" id="plQualityMenu" role="dialog" aria-label="Quality" hidden></div><div class="pl-menu pl-episodes" id="plEpisodes" role="dialog" aria-label="Episodes" hidden></div>
    <div class="pl-resize-handles">${['nw','ne','sw','se'].map(corner=>`<button class="pl-resize pl-resize-${corner}" data-corner="${corner}" aria-label="Resize mini player ${corner}" title="Drag to resize; arrow keys adjust size"></button>`).join('')}</div>
    <div class="pl-note" id="plNote">${native?'Original · direct playback':'Preparing Original'}</div><span id="plCCName" class="sr-only">Off</span>
  </div>`;

  const player=$('#pl'),stage=$('#plStage'),video=$('#rmx');
  video.dataset.rel=f.rel;
  if(info.width&&info.height) stage.style.aspectRatio=`${info.width} / ${info.height}`;
  else{stage.style.aspectRatio='16 / 9';video.addEventListener('loadedmetadata',function ratio(){if(this.videoWidth)stage.style.aspectRatio=`${this.videoWidth} / ${this.videoHeight}`;this.removeEventListener('loadedmetadata',ratio);});}

  let base=0,pausedAt=0,hls=null,hlsId='',version=0;
  let suppress=false,wantsPlay=false,preparing=false,theater=true,chromeTimer=null,keyHandler=null,keepAliveTimer=null,pauseFillTimer=null;
  let pausedBuffering=false,sessionFrozen=false,freezeInFlight=false,pauseCycle=0;
  const PAUSE_BUFFER_SECONDS=300;
  const alive=()=>player.isConnected&&$('#rmx')===video;
  let bufferingTimer=null;
  const setBuffering=(on,title='Buffering',detail='Preparing the next frames')=>{
    clearTimeout(bufferingTimer);if(!alive())return;
    const apply=()=>{if(!alive())return;$('#plBufferOverlay').classList.toggle('on',!!on);player.classList.toggle('buffering',!!on);$('#plBufferTitle').textContent=title;$('#plBufferDetail').textContent=detail;};
    if(on&&['Buffering','Seeking'].includes(title))bufferingTimer=setTimeout(apply,240);else apply();
  };
  const now=()=>native?(video.currentTime||0):base+(video.currentTime||0);
  const total=()=>duration||(f.watch&&f.watch.dur)||(native&&isFinite(video.duration)?video.duration:0)||0;
  const bufferedEnd=()=>(native?0:base)+playerBufferedEnd(video);
  const bufferAhead=()=>Math.max(0,bufferedEnd()-now());
  const pauseBufferTarget=()=>{const t=total();return t?Math.max(0,Math.min(PAUSE_BUFFER_SECONDS,t-now())):PAUSE_BUFFER_SECONDS;};
  const drawBuffer=()=>{
    if(!alive())return;const t=total(),at=now(),end=Math.max(at,bufferedEnd()),ahead=bufferAhead();
    if(t)$('#plBuf').style.width=`${Math.min(100,end/t*100)}%`;
    $('#plTrack').setAttribute('aria-valuenow',String(Math.round(at)));$('#plTrack').setAttribute('aria-valuemax',String(Math.round(t)||100));$('#plTrack').setAttribute('aria-valuetext',`${fmtTime(at)} of ${fmtTime(t)}; ${fmtTime(ahead)} buffered ahead`);
    const stateEl=$('#plBufferState'),label=$('#plBuffer');if(!stateEl||!label)return;
    stateEl.classList.toggle('ready',ahead>=30);stateEl.classList.toggle('low',!video.paused&&ahead<8);
    label.textContent=ahead>=1?`${fmtTime(ahead)} ahead`:(video.paused?'Buffer ready':'Buffering…');
  };
  const draw=()=>{if(!alive())return;const t=total(),at=now(),p=t?Math.min(100,at/t*100):0;$('#plFill').style.width=`${p}%`;$('#plKnob').style.left=`${p}%`;$('#plAt').textContent=fmtTime(at);$('#plRem').textContent=t?`-${fmtTime(Math.max(0,t-at))}`:'';drawBuffer();};
  const menuIds=['plMenu','plSettings','plSpeed','plQualityMenu','plEpisodes'];
  const closeMenus=()=>{menuIds.forEach(id=>{const el=$('#'+id);if(el)el.hidden=true;});player.querySelectorAll('[aria-expanded]').forEach(el=>el.setAttribute('aria-expanded','false'));};
  const destroyCaptions=mountCaptionPresentation(video,player);
  const layoutSubtitles=()=>video.__layoutSubtitles?.();
  const showChrome=()=>{if(!alive())return;clearTimeout(chromeTimer);player.classList.remove('chrome-hidden');layoutSubtitles();};
  const scheduleChrome=()=>{showChrome();chromeTimer=setTimeout(()=>{if(alive()&&!video.paused&&!menuIds.some(id=>!$('#'+id).hidden)&&!player.querySelector(':focus-visible')){player.classList.add('chrome-hidden');layoutSubtitles();}},2600);};
  const openMenu=(id,button)=>{const menu=$('#'+id),open=menu.hidden;closeMenus();menu.hidden=!open;button?.setAttribute('aria-expanded',String(open));showChrome();if(open)requestAnimationFrame(positionMiniMenu);};
  video.__closeMenus=closeMenus;video.__showChrome=showChrome;
  const setPlaying=(on)=>{if(!alive())return;$('#plPlay').innerHTML=icon(on?'pause':'play','ph-fill');$('#plPlay').setAttribute('aria-label',on?'Pause':'Play');player.classList.toggle('playing',on);on?scheduleChrome():showChrome();};

  const release=()=>{
    const old=hlsId;hlsId='';suppress=true;
    clearInterval(keepAliveTimer);keepAliveTimer=null;
    clearInterval(pauseFillTimer);pauseFillTimer=null;pauseCycle++;pausedBuffering=false;sessionFrozen=false;freezeInFlight=false;
    if(hls){hls.destroy();hls=null;}
    if(!native){video.pause();video.removeAttribute('src');video.load();}
    if(old)fetch(`/api/hls/${encodeURIComponent(old)}`,{method:'DELETE',keepalive:true}).catch(()=>{});
  };
  const controlSession=async(action)=>{
    if(!hlsId)return {ok:false};
    const r=await fetch(`/api/hls/${encodeURIComponent(hlsId)}/control`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
    const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`Could not ${action} playback session`);return data;
  };
  const fail=async(message)=>{
    if(!alive()||suppress)return;
    const failedVersion=version;
    let server='';if(hlsId){try{const r=await fetch(`/api/hls/${encodeURIComponent(hlsId)}/status`,{cache:'no-store'});const d=await r.json();if(d&&!d.ok)server=d.error||'';}catch{}}
    if(!alive()||failedVersion!==version)return;wantsPlay=false;preparing=false;setBuffering(false);release();
    setPlaying(false);player.classList.add('has-error');const error=$('#plError');error.hidden=false;
    error.innerHTML=`<h2>Playback interrupted</h2><p>${esc(server||message||'The stream stopped unexpectedly.')}</p><div><button id="plRetry">Try again</button><a href="${url('download',f.rel)}">Download file</a></div>`;
    $('#plRetry').onclick=()=>{error.hidden=true;player.classList.remove('has-error');if(native){suppress=false;video.src=directSource;go(pausedAt||0);}else startHls(pausedAt||now());};
  };
  const freezePausedSession=async()=>{
    if(native||wantsPlay||!pausedBuffering||sessionFrozen||freezeInFlight||!hlsId)return;
    clearInterval(pauseFillTimer);pauseFillTimer=null;if(hls)hls.stopLoad();freezeInFlight=true;const mine=pauseCycle;
    try{
      await controlSession('pause');
      // A quick play click can race the pause request through the tunnel. Undo
      // that late pause immediately so playback can never freeze underneath it.
      if(mine!==pauseCycle||wantsPlay||!pausedBuffering){await controlSession('resume').catch(()=>{});if(hls)hls.startLoad(-1);return;}
      sessionFrozen=true;drawBuffer();if($('#plNote'))$('#plNote').textContent=`Paused · ${pauseBufferTarget()<PAUSE_BUFFER_SECONDS-1?'remainder buffered':'five-minute buffer ready'} · transcoder sleeping`;
    }catch(error){if($('#plNote'))$('#plNote').textContent=`Paused · ${fmtTime(bufferAhead())} buffered · ${error.message}`;}
    finally{freezeInFlight=false;}
  };
  const fillPausedBuffer=()=>{
    clearInterval(pauseFillTimer);pauseFillTimer=null;if(hls&&!sessionFrozen)hls.startLoad(-1);
    const check=()=>{
      if(!alive()||wantsPlay||!pausedBuffering){clearInterval(pauseFillTimer);pauseFillTimer=null;return;}
      const ahead=bufferAhead(),target=pauseBufferTarget();drawBuffer();
      if($('#plNote')&&!sessionFrozen)$('#plNote').textContent=`Paused · filling buffer ${fmtTime(Math.min(ahead,target))} / ${fmtTime(target)}`;
      // HLS segments are two seconds long. Freeze one segment early so the
      // final in-flight append lands at, rather than beyond, the chosen ceiling.
      if(ahead>=Math.max(0,target-2))freezePausedSession();
    };
    check();if(!sessionFrozen)pauseFillTimer=setInterval(check,500);
  };
  const pauseConverted=()=>{
    if(native)return;pausedAt=now();if(video.__report)video.__report();wantsPlay=false;preparing=false;setPlaying(false);draw();
    if(!pausedBuffering){pausedBuffering=true;pauseCycle++;}
    fillPausedBuffer();
  };

  const resumeConverted=()=>{
    if(!hlsId)return startHls(pausedAt||now(),true);
    const wasFrozen=sessionFrozen;pauseCycle++;pausedBuffering=false;sessionFrozen=false;clearInterval(pauseFillTimer);pauseFillTimer=null;
    wantsPlay=true;preparing=false;suppress=false;if(hls)hls.startLoad(-1);
    // Play the already-buffered media immediately. Waking ffmpeg is background
    // maintenance and must not add a network round-trip to the play button.
    video.play().catch((error)=>{wantsPlay=false;setPlaying(false);if($('#plNote'))$('#plNote').textContent=`Buffer preserved · press play to resume${error&&error.message?` · ${error.message}`:''}`;});
    if($('#plNote'))$('#plNote').textContent=`Playing · ${fmtTime(bufferAhead())} buffered ahead`;
    if(wasFrozen||freezeInFlight)controlSession('resume').then(()=>{freezeInFlight=false;if(hls)hls.startLoad(-1);}).catch(()=>{freezeInFlight=false;const at=now();release();startHls(at,true);});
  };

  const startHls=async(at,autoplay=true)=>{
    const mine=++version;native=false;release();player.classList.remove('has-error');$('#plError').hidden=true;base=Math.max(0,at||0);pausedAt=base;video.__subtitleBase=base;video.dispatchEvent(new Event('vault-subtitles-updated'));wantsPlay=autoplay;preparing=true;suppress=true;draw();
    setBuffering(true,'Preparing playback',`${names[quality]} · ${state.transcoder?state.transcoder.label:'H.264 encoder'}`);$('#plNote').textContent=`Preparing ${names[quality]} · ${state.transcoder?state.transcoder.label:'H.264 encoder'}`;
    try{
      const r=await fetch(`${url('hls/start',f.rel)}?t=${base.toFixed(2)}&quality=${encodeURIComponent(quality)}`,{method:'POST'});const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||`HLS preparation returned HTTP ${r.status}`);
      if(mine!==version||!alive()){fetch(`/api/hls/${encodeURIComponent(data.id)}`,{method:'DELETE',keepalive:true}).catch(()=>{});return;}
      hlsId=data.id;
      clearInterval(keepAliveTimer);keepAliveTimer=setInterval(()=>{if(hlsId)fetch(`/api/hls/${encodeURIComponent(hlsId)}/status`,{cache:'no-store'}).catch(()=>{});},45000);
      const ready=()=>{if(mine!==version||!alive())return;preparing=false;suppress=false;$('#plNote').textContent=`${data.qualityLabel||names[quality]} · ${data.direct?'direct stream copy':data.encoder||'H.264 / AAC'}`;if(wantsPlay)video.play().catch(()=>{});else pauseConverted();};
      if(window.Hls&&Hls.isSupported()){
        const compactBuffer=matchMedia('(max-width:760px)').matches;
        hls=new Hls({
          enableWorker:true,lowLatencyMode:false,startPosition:0,startFragPrefetch:true,
          backBufferLength:compactBuffer?30:90,
          maxBufferLength:PAUSE_BUFFER_SECONDS,
          maxMaxBufferLength:PAUSE_BUFFER_SECONDS,
          maxBufferSize:compactBuffer?128*1024*1024:384*1024*1024,
          maxBufferHole:.35,highBufferWatchdogPeriod:2,nudgeMaxRetry:5,
        });
        hls.on(Hls.Events.ERROR,(_e,d)=>{if(mine===version&&d.fatal){suppress=false;fail(`HLS ${d.type||'stream'} error: ${d.details||'unknown failure'}`);}});
        hls.on(Hls.Events.MEDIA_ATTACHED,()=>{if(mine===version)hls.loadSource(data.url);});hls.on(Hls.Events.MANIFEST_PARSED,ready);hls.attachMedia(video);
      }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=data.url;video.addEventListener('loadedmetadata',ready,{once:true});}
      else throw new Error('This browser does not support HLS or Media Source playback');
    }catch(err){preparing=false;suppress=false;if(mine===version)fail(err.message||'Could not prepare playback');}
  };
  const seek=(at,play=!video.paused)=>{
    at=Math.max(0,Math.min(total()?total()-.25:1e9,at||0));
    if(!native){
      const local=at-base;
      for(let i=0;i<video.buffered.length;i++)if(local>=video.buffered.start(i)&&local<video.buffered.end(i)-.1){video.currentTime=local;if(play)resumeConverted();else draw();return;}
      return startHls(at,play);
    }
    const move=()=>{try{video.currentTime=at;}catch{}if(play)video.play().catch(()=>{setBuffering(false);setPlaying(false);});};video.readyState?move():video.addEventListener('loadedmetadata',move,{once:true});
  };
  const go=at=>seek(at,true);
  const toggle=()=>{if(native){video.paused?video.play().catch(()=>{setBuffering(false);setPlaying(false);}):video.pause();return;}if(!video.paused){video.pause();return;}if(preparing&&wantsPlay){pauseConverted();return;}resumeConverted();};
  const jump=seconds=>seek(now()+seconds,!video.paused);

  video.onplay=()=>{if($('#musicAudio')&&!$('#musicAudio').paused)$('#musicAudio').pause();wantsPlay=true;setPlaying(true);drawBuffer();};video.onpause=()=>{setPlaying(false);drawBuffer();if(!native&&!suppress)pauseConverted();};video.ontimeupdate=draw;
  video.onprogress=drawBuffer;video.onwaiting=()=>{drawBuffer();if(!video.paused)setBuffering(true,'Buffering','Holding the frame while the stream catches up');};video.onstalled=()=>{if(wantsPlay)setBuffering(true,'Reconnecting','The local stream is taking longer than expected');};video.onseeking=()=>setBuffering(true,'Seeking','Finding the requested frame');video.oncanplay=()=>{drawBuffer();if(!preparing)setBuffering(false);};video.onseeked=()=>{if(!preparing)setBuffering(false);};
  video.onerror=()=>{if(suppress)return;if(native&&state.mkvTranscode&&!triedCompatibility){triedCompatibility=true;const at=now()||f.watch?.pos||0;if(Number.isFinite(video.duration))duration=video.duration;native=false;startHls(at);return;}fail(video.error?`This browser could not play the stream (media error ${video.error.code}).`:'The stream could not be played.');};
  video.onplaying=()=>{setBuffering(false);setPlaying(true);};
  $('#plPlay').onclick=toggle;$('#plBig').onclick=toggle;video.onclick=toggle;$('#plBack').onclick=()=>jump(-10);$('#plFwd').onclick=()=>jump(10);$('#plClose').onclick=closeViewer;

  const track=$('#plTrack');let drag=false;
  const trackPos=(e)=>{const r=track.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));};
  const preview=(p)=>{const t=total();$('#plFill').style.width=`${p*100}%`;$('#plKnob').style.left=`${p*100}%`;if(t){$('#plAt').textContent=fmtTime(p*t);$('#plRem').textContent=`-${fmtTime(t-p*t)}`;}};
  track.onpointerdown=(e)=>{if(!total())return;drag=true;track.setPointerCapture(e.pointerId);preview(trackPos(e));};track.onpointermove=(e)=>{if(drag)preview(trackPos(e));};
  track.onpointerup=(e)=>{if(!drag)return;drag=false;const at=trackPos(e)*total();seek(at,!video.paused);};

  const savedVol=(()=>{try{return parseFloat(localStorage.getItem('vault-vol'));}catch{return NaN;}})();video.volume=isFinite(savedVol)?Math.max(0,Math.min(1,savedVol)):1;
  const drawVol=()=>{if(!alive())return;const n=video.muted?0:video.volume;$('#plVolFill').style.width=`${n*100}%`;$('#plVolKnob').style.left=`${n*100}%`;$('#plVol').setAttribute('aria-valuenow',String(Math.round(n*100)));$('#plMute').innerHTML=icon(n===0?'speaker-slash':n<.5?'speaker-low':'speaker-high');$('#plMute').setAttribute('aria-label',video.muted?'Unmute':'Mute');};
  $('#plMute').onclick=()=>{video.muted=!video.muted;drawVol();};const vol=$('#plVol');let volDrag=false;
  const setVol=(e)=>{const r=vol.getBoundingClientRect();video.volume=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));video.muted=false;try{localStorage.setItem('vault-vol',String(video.volume));}catch{}drawVol();};
  vol.onpointerdown=(e)=>{volDrag=true;vol.setPointerCapture(e.pointerId);setVol(e);};vol.onpointermove=(e)=>{if(volDrag)setVol(e);};vol.onpointerup=()=>{volDrag=false;};drawVol();

  const feedback=message=>{let notice=player.querySelector('.pl-feedback');if(!notice){notice=document.createElement('div');notice.className='pl-feedback';notice.setAttribute('role','status');player.append(notice);}notice.textContent=message;clearTimeout(notice._timer);notice._timer=setTimeout(()=>notice.remove(),4500);};
  const full=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else{if(player.dataset.mode==='mini')setMode('theater');await $('#viewer').requestFullscreen();}}catch{feedback('Fullscreen is unavailable in this browser.');}};
  let hideNavigation=false;try{hideNavigation=localStorage.getItem('vault-player-hide-nav')==='true';}catch{}
  const applyNavigation=()=>{const hide=hideNavigation&&player.dataset.mode==='theater';document.body.classList.toggle('video-hide-nav',hide);$('#plNavToggle').setAttribute('aria-pressed',String(hideNavigation));$('#plNavToggle').setAttribute('aria-label',hideNavigation?'Show navigation bar in theater':'Hide navigation bar in theater');$('#plNavToggle').title=hideNavigation?'Show navigation bar in theater':'Hide navigation bar in theater';};
  $('#plNavToggle').onclick=()=>{hideNavigation=!hideNavigation;try{localStorage.setItem('vault-player-hide-nav',String(hideNavigation));}catch{}applyNavigation();};
  const viewer=$('#viewer');let miniBox=null,miniGesture=null,suppressMiniClick=false;
  try{const saved=JSON.parse(localStorage.getItem('vault-mini-placement')||'null');if(saved&&['width','left','top'].every(key=>Number.isFinite(saved[key])))miniBox=saved;}catch{}
  const miniViewport=()=>({width:innerWidth,height:innerHeight,top:parseFloat(getComputedStyle(viewer).getPropertyValue('--player-top'))+12});
  const saveMini=()=>{try{localStorage.setItem('vault-mini-placement',JSON.stringify(miniBox));}catch{}};
  const applyMini=()=>{
    if(player.dataset.mode!=='mini')return;
    const viewport=miniViewport();
    if(!miniBox)miniBox={width:innerWidth<=600?innerWidth-24:460,left:innerWidth-482,top:innerHeight-460*9/16-(document.body.classList.contains('music-playing')?100:22)};
    miniBox=playerMiniBounds(miniBox,viewport);
    viewer.style.setProperty('--mini-left',miniBox.left+'px');viewer.style.setProperty('--mini-top',miniBox.top+'px');viewer.style.setProperty('--mini-width',miniBox.width+'px');
  };
  function positionMiniMenu(){
    if(!alive()||player.dataset.mode!=='mini')return;
    const box=viewer.getBoundingClientRect(),viewport=miniViewport();
    for(const id of menuIds){const menu=$('#'+id);if(menu.hidden)continue;
      const height=menu.getBoundingClientRect().height,width=menu.getBoundingClientRect().width;
      const above=box.top-height-10,below=box.bottom+10;
      const top=above>=viewport.top?above:below+height<=innerHeight-12?below:Math.max(viewport.top,Math.min(box.top,innerHeight-12-height));
      menu.style.setProperty('--mini-menu-top',top+'px');menu.style.setProperty('--mini-menu-left',Math.max(12,Math.min(innerWidth-width-12,box.right-width))+'px');
    }
  }
  video.__positionMiniMenu=positionMiniMenu;
  const moveHandle=$('#plMove');
  const endMiniGesture=()=>{if(!miniGesture)return;miniGesture=null;viewer.classList.remove('mini-moving');saveMini();scheduleChrome();};
  player.addEventListener('pointerdown',event=>{
    if(player.dataset.mode!=='mini'||event.button!==0)return;
    const corner=event.target.closest('.pl-resize')?.dataset.corner;
    if(!corner&&event.target.closest('button,input,select,a,.pl-bar,.pl-menu,.pl-captions'))return;
    const rect=viewer.getBoundingClientRect();miniGesture={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,width:rect.width,height:rect.height,corner,moved:false};
    event.target.setPointerCapture(event.pointerId);closeMenus();showChrome();
    if(corner)event.preventDefault();
  });
  player.addEventListener('pointermove',event=>{
    const gesture=miniGesture;if(!gesture||gesture.id!==event.pointerId)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(!gesture.moved&&Math.hypot(dx,dy)<4)return;
    gesture.moved=true;suppressMiniClick=true;viewer.classList.add('mini-moving');
    if(gesture.corner){
      const west=gesture.corner.includes('w'),north=gesture.corner.includes('n');
      const delta=Math.abs(dx)>=Math.abs(dy*16/9)?dx*(west?-1:1):dy*16/9*(north?-1:1);
      const viewport=miniViewport();
      const maxWidth=Math.min(west?gesture.left+gesture.width-12:innerWidth-12-gesture.left,(north?gesture.top+gesture.height-viewport.top:innerHeight-12-gesture.top)*16/9);
      const width=Math.min(maxWidth,playerMiniBounds({width:gesture.width+delta},viewport).width);
      miniBox={width,left:west?gesture.left+gesture.width-width:gesture.left,top:north?gesture.top+gesture.height-width*9/16:gesture.top};
    }else miniBox={width:gesture.width,left:gesture.left+dx,top:gesture.top+dy};
    applyMini();event.preventDefault();
  });
  player.addEventListener('pointerup',event=>{if(miniGesture?.id!==event.pointerId)return;endMiniGesture();setTimeout(()=>{suppressMiniClick=false;},0);});
  player.addEventListener('pointercancel',()=>{endMiniGesture();suppressMiniClick=false;});
  player.addEventListener('lostpointercapture',endMiniGesture);
  player.addEventListener('click',event=>{if(suppressMiniClick){event.preventDefault();event.stopImmediatePropagation();suppressMiniClick=false;}},true);
  moveHandle.onkeydown=event=>{if(player.dataset.mode!=='mini'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const step=event.shiftKey?40:10;miniBox.left+=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0;miniBox.top+=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;applyMini();saveMini();};
  player.querySelectorAll('.pl-resize').forEach(handle=>handle.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();miniBox.width+=(['ArrowRight','ArrowUp'].includes(event.key)?1:-1)*(event.shiftKey?80:20);applyMini();saveMini();});
  const resizeMini=()=>{applyMini();positionMiniMenu();};window.addEventListener('resize',resizeMini);
  const setMode=mode=>{
    if(!alive())return;const mini=mode==='mini';theater=!mini;
    if(mini&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    player.dataset.mode=mode;player.classList.toggle('mini',mini);player.classList.toggle('theater',!mini);$('#viewer').classList.toggle('mini',mini);$('#viewer').classList.toggle('theater',!mini);document.body.classList.toggle('video-theater',!mini);
    // A docked player is no longer a navigation-blocking overlay.
    if(mini){const i=layers.findIndex(layer=>layer.name==='viewer');if(i>=0){layers.splice(i,1);const current={...history.state};delete current.vaultLayer;delete current.depth;history.replaceState(current,'');}}
    else if(!layers.some(layer=>layer.name==='viewer'))openLayer('viewer',teardownViewer);
    moveHandle.tabIndex=mini?0:-1;moveHandle.setAttribute('aria-label',mini?'Move mini player with arrow keys':'Playing title');
    applyNavigation();applyMini();closeMenus();scheduleChrome();
  };
  video.__setViewMode=setMode;
  $('#plFull').onclick=full;$('#plMini').onclick=()=>setMode('mini');$('#plRestore').onclick=()=>setMode('theater');
  const fullscreenChange=()=>{if(!alive())return;$('#plFull').innerHTML=icon(document.fullscreenElement?'corners-in':'corners-out');$('#plFull').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Fullscreen');showChrome();};
  document.addEventListener('fullscreenchange',fullscreenChange);
  $('#plPip').onclick=async()=>{try{if(!document.pictureInPictureEnabled||!video.requestPictureInPicture)throw Error();if(document.pictureInPictureElement)await document.exitPictureInPicture();else await video.requestPictureInPicture();}catch{feedback('Picture-in-picture is unavailable. Try the mini player instead.');}};
  const afterFullscreen=async action=>{if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});action();};
  const settings=()=>{
    const menu=$('#plSettings');menu.innerHTML=`<div class="pl-menu-heading">Settings</div><button id="plQuality">${icon('monitor-play')}<span>Quality</span><b>${names[quality]}</b>${icon('caret-right')}</button><button id="plSpeedButton">${icon('speedometer')}<span>Playback speed</span><b>${video.playbackRate===1?'Normal':video.playbackRate+'×'}</b>${icon('caret-right')}</button><div class="pl-menu-heading">Viewing mode</div><button id="plTheater" class="${theater?'on':''}">${icon('rectangle')}<span>Theater</span>${theater?icon('check'):''}</button><button id="plMiniSetting" class="${!theater?'on':''}">${icon('picture-in-picture')}<span>Mini player</span>${!theater?icon('check'):''}</button><button id="plFullSetting">${icon('corners-out')}<span>${document.fullscreenElement?'Exit fullscreen':'Fullscreen'}</span></button>${f.ext==='mkv'?`<button id="plConvert">${icon('film-reel')}<span>Convert to MP4</span></button>`:''}<div class="pl-stream-info">${esc($('#plNote').textContent)}</div>`;
    openMenu('plSettings',$('#plGear'));$('#plQuality').onclick=qualityMenu;$('#plSpeedButton').onclick=speedMenu;$('#plTheater').onclick=()=>setMode('theater');$('#plMiniSetting').onclick=()=>setMode('mini');$('#plFullSetting').onclick=()=>{closeMenus();full();};$('#plConvert')?.addEventListener('click',()=>{closeMenus();afterFullscreen(()=>askConvert(f));});
  };
  const speedMenu=()=>{const menu=$('#plSpeed');menu.innerHTML='<button class="pl-menu-back">'+icon('caret-left')+' Playback speed</button>'+[.5,.75,1,1.25,1.5,2].map(rate=>`<button data-r="${rate}" class="${video.playbackRate===rate?'on':''}"><span>${rate===1?'Normal':rate+'×'}</span>${video.playbackRate===rate?icon('check'):''}</button>`).join('');openMenu('plSpeed');menu.querySelector('.pl-menu-back').onclick=settings;menu.querySelectorAll('[data-r]').forEach(button=>button.onclick=()=>{video.playbackRate=Number(button.dataset.r);video.defaultPlaybackRate=video.playbackRate;closeMenus();$('#plGear').focus();});};
  const qualityMenu=()=>{
    const menu=$('#plQualityMenu');menu.innerHTML='<button class="pl-menu-back">'+icon('caret-left')+' Quality</button>'+[['original','Original / direct'],['2160','4K'],['1080','1080p'],['720','720p']].map(([id,label])=>`<button data-q="${id}" class="${quality===id?'on':''}" ${id!=='original'&&!state.mkvTranscode?'disabled':''}><span>${label}</span>${quality===id?icon('check'):''}</button>`).join('')+(!state.mkvTranscode?'<p class="pl-stream-info">Other qualities need the server’s video encoder.</p>':'');openMenu('plQualityMenu');menu.querySelector('.pl-menu-back').onclick=settings;
    menu.querySelectorAll('[data-q]').forEach(button=>button.onclick=()=>{const at=now(),playing=wantsPlay||!video.paused;if(native&&Number.isFinite(video.duration))duration=video.duration;const next=button.dataset.q;closeMenus();if(quality===next)return;quality=next;if(canDirect&&quality==='original'){release();native=true;base=0;video.__subtitleBase=0;video.dispatchEvent(new Event('vault-subtitles-updated'));suppress=false;video.src=directSource;$('#plNote').textContent='Original · direct playback';seek(at,playing);}else startHls(at,playing);});
  };
  $('#plGear').onclick=settings;
  let season=ep?.season;
  const episodesMenu=()=>{
    const menu=$('#plEpisodes'),seasons=[...new Set(episodeChoices.map(item=>watchEpisode(item).season))];
    menu.innerHTML=`<div class="pl-episodes-head"><strong>${esc(ep.show)}</strong><select id="plEpisodeSeason" aria-label="Episode season">${seasons.map(value=>`<option value="${value}" ${value===season?'selected':''}>${watchSeasonName(value)}</option>`).join('')}</select></div><div class="pl-episode-list">${episodeChoices.filter(item=>watchEpisode(item).season===season).map(item=>{const detail=watchEpisode(item);return `<button class="pl-episode-option ${item.rel===f.rel?'on':''}" data-player-index="${state.files.indexOf(item)}"><span class="pl-episode-thumb">${state.thumbs?`<img src="${url('thumb',item.rel)}" alt="" loading="lazy">`:icon('play')}<b>${detail.episode??'—'}</b><span class="pl-episode-play">${icon('play','ph-fill')}</span></span><span><strong>${esc(detail.title)}</strong><small>${item.rel===f.rel?'Now playing':item.watch?.done?'Watched':item.watch?.pos?'Continue watching':'Episode '+(detail.episode??'—')}</small></span></button>`;}).join('')}</div>`;
    $('#plEpisodeSeason').onchange=event=>{season=Number(event.target.value);episodesMenu();};menu.querySelectorAll('[data-player-index]').forEach(button=>button.onclick=()=>{const next=state.files[Number(button.dataset.playerIndex)];if(next?.rel!==f.rel)openViewer(next);else closeMenus();});
  };
  $('#plEpisodesButton')?.addEventListener('click',()=>{episodesMenu();openMenu('plEpisodes',$('#plEpisodesButton'));});
  ['plCC','plGear','plEpisodesButton'].forEach(id=>$('#'+id)?.setAttribute('aria-expanded','false'));
  player.addEventListener('click',event=>{if(!event.target.closest('.pl-menu,#plCC,#plGear,#plEpisodesButton'))closeMenus();},true);
  player.onpointermove=scheduleChrome;player.onfocusin=showChrome;player.onmouseleave=()=>{if(!video.paused)scheduleChrome();};
  track.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();seek(event.key==='Home'?0:event.key==='End'?total()-.25:now()+(event.key==='ArrowLeft'?-5:5),!video.paused);}};
  vol.onkeydown=event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();video.volume=event.key==='Home'?0:event.key==='End'?1:Math.max(0,Math.min(1,video.volume+(['ArrowLeft','ArrowDown'].includes(event.key)?-.05:.05)));video.muted=false;localStorage.setItem('vault-vol',String(video.volume));drawVol();}};
  keyHandler=event=>{
    if(!alive())return;if(event.key==='Escape'&&menuIds.some(id=>!$('#'+id).hidden)){event.preventDefault();event.stopImmediatePropagation();closeMenus();$('#plGear').focus();return;}
    if(layers.at(-1)?.name&&layers.at(-1).name!=='viewer')return;
    if(['INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(document.activeElement?.tagName)||document.activeElement?.getAttribute('role')==='slider')return;
    if(event.target.closest?.('#plMove,.pl-resize,#plCaptions'))return;
    if(!theater&&!player.contains(document.activeElement)&&!player.matches(':hover'))return;
    const actions={' ':toggle,k:toggle,ArrowRight:()=>jump(10),ArrowLeft:()=>jump(-10),l:()=>jump(30),j:()=>jump(-30),m:()=>{video.muted=!video.muted;drawVol();},f:full,t:()=>setMode(theater?'mini':'theater'),c:()=>$('#plCC').click()};
    if(actions[event.key]){event.preventDefault();event.stopImmediatePropagation();actions[event.key]();}
  };

  let subtitleRequest=0;
  const reloadSubtitles=async()=>{
    if(!alive())return [];
    const request=++subtitleRequest;video.__subtitleLoading=true;video.__ccDraw?.();
    const tracks=await attachSubtitles(video,f,()=>alive()&&request===subtitleRequest);
    if(!alive()||request!==subtitleRequest)return [];
    video.__subtitleLoading=false;
    if(tracks)buildCCMenu(video,f,tracks);else video.__ccDraw?.();
    return tracks||[];
  };
  video.__reloadSubtitles=reloadSubtitles;
  document.addEventListener('keydown',keyHandler,true);trackProgress(video,f,()=>native?0:base,()=>duration);reloadSubtitles();
  const from=f.watch&&f.watch.pos>5&&(!total()||f.watch.pos<total()-20)?f.watch.pos:0;pausedAt=from;base=native?0:from;
  buildCCMenu(video,f,[]);resumePlayerSubtitleJob(f);setMode('theater');fullscreenChange();
  if(native){suppress=false;video.src=directSource;go(from);}else startHls(from);
  video.__destroyStream=()=>{window.removeEventListener('resize',resizeMini);destroyCaptions();version++;wantsPlay=false;preparing=false;clearTimeout(chromeTimer);clearTimeout(bufferingTimer);document.removeEventListener('fullscreenchange',fullscreenChange);clearInterval(keepAliveTimer);clearInterval(pauseFillTimer);if(keyHandler)document.removeEventListener('keydown',keyHandler,true);$('#viewer').classList.remove('theater','mini','mini-moving');document.body.classList.remove('video-theater','video-hide-nav');release();};

}

/** The part of an episode filename after the SxxExx marker, if there is one. */
function epTitle(name){
  const m = /[Ss]\d{1,2}[\s._-]*[Ee]\d{1,3}[\s._-]*(.+)$/.exec(name.replace(/\.[^.]+$/, ''));
  return m ? m[1].replace(/[._]+/g, ' ').replace(/^[\s-]+/, '').trim() : '';
}

function subtitleStorageKey(f, trackId){
  return `vault-cc-offset:${f.rel}:${trackId}`;
}

function applySubtitleOffset(entry, seconds){
  const cues=entry.track&&entry.track.cues;if(!cues)return;
  entry.originalTimes=entry.originalTimes||new WeakMap();
  for(const cue of cues){
    let original=entry.originalTimes.get(cue);
    if(!original){original=[cue.startTime,captionCueEnd(cue,entry.source)];entry.originalTimes.set(cue,original);}
    cue.startTime=Math.max(0,original[0]+seconds);
    cue.endTime=Math.max(cue.startTime+.05,original[1]+seconds);
  }
}

/** Track selector plus per-track sync controls. */
const playerSubtitleJobs=new Map();
const PLAYER_AI_PREFERENCE='@ai';
function playerSubtitlePreference(f){try{return localStorage.getItem(`vault-cc-track:${f.rel}`)||'';}catch{return '';}}
function savePlayerSubtitlePreference(f,value){try{localStorage.setItem(`vault-cc-track:${f.rel}`,value);}catch{}}
function rememberPlayerSubtitleJob(f,job){
  const task={...job,cancelled:false};playerSubtitleJobs.set(f.rel,task);
  try{localStorage.setItem(`vault-ai-job:${f.rel}`,task.id);}catch{}
  watchPlayerSubtitleJob(f,task);return task;
}
function resumePlayerSubtitleJob(f){
  const current=playerSubtitleJobs.get(f.rel);
  if(current){if(current.authError){current.authError=false;current.status='running';}if(!['complete','failed','cancelled'].includes(current.status))watchPlayerSubtitleJob(f,current);return;}
  let id='';try{id=localStorage.getItem(`vault-ai-job:${f.rel}`)||'';}catch{}
  if(id)rememberPlayerSubtitleJob(f,{id,status:'running',message:'Checking subtitle generation'});
}
async function watchPlayerSubtitleJob(f,task){
  if(task.polling||task.cancelled)return;task.polling=true;
  const redraw=()=>{const current=$('#rmx');if(current?.dataset.rel===f.rel)current.__ccDraw?.();return current?.dataset.rel===f.rel?current:null;};
  const forget=()=>{try{localStorage.removeItem(`vault-ai-job:${f.rel}`);}catch{}};
  const poll=async()=>{
    try{
      const response=await fetch('/api/ai-subtitles/'+encodeURIComponent(task.id),{cache:'no-store'});
      if(task.cancelled){task.polling=false;return;}
      if(response.status===401||response.status===403){task.status='failed';task.error='Sign in again to check subtitle generation.';task.authError=true;task.polling=false;redraw();return;}
      if(response.status===404){
        forget();task.status='failed';task.error='The subtitle job is no longer available. Checking for saved subtitles.';
        const current=redraw();if(current){const tracks=await current.__reloadSubtitles();if(tracks.some(entry=>entry.source==='ai')){task.status='complete';task.error='';}else task.error='The subtitle job is no longer available. No generated track was found; you can start generation again.';redraw();}
        task.polling=false;return;
      }
      if(!response.ok)throw new Error('Subtitle status could not be checked');
      const updated=await response.json();if(task.cancelled){task.polling=false;return;}
      Object.assign(task,updated);task.reconnects=0;
      if(task.status==='complete'){
        forget();task.activation='loading';const current=redraw();
        if(current){const tracks=await current.__reloadSubtitles();if(current===$('#rmx')&&!tracks.some(entry=>entry.source==='ai'))task.activationError='Subtitles were generated, but the track could not be loaded. Retry loading it.';}
        task.activation='';task.polling=false;redraw();return;
      }
      if(['failed','cancelled'].includes(task.status)){forget();task.polling=false;redraw();return;}
      redraw();
    }catch(error){
      if(task.cancelled){task.polling=false;return;}
      task.reconnects=(task.reconnects||0)+1;task.message='Connection interrupted. Rechecking subtitle generation…';redraw();
    }
    task.timer=setTimeout(poll,Math.min(10000,2000*(task.reconnects||1)));
  };
  void poll();
}
function buildCCMenu(v,f,entries=[]){
  const btn=$('#plCC'),menu=$('#plMenu');if(!btn||!menu||!document.contains(v))return;
  if(v.__ccUpdatedHandler)v.removeEventListener('vault-subtitles-updated',v.__ccUpdatedHandler);
  const tracks=entries.map(entry=>entry.track);v.__subtitleEntries=entries;
  entries.forEach(entry=>{try{entry.offset=parseFloat(localStorage.getItem(subtitleStorageKey(f,entry.id)))||0;}catch{entry.offset=0;}});
  const select=(pick,persist=true)=>{
    tracks.forEach((track,i)=>{entries[i].selected=i===pick;track.mode=i===pick?(v.__nativeCaptions?'showing':'hidden'):entries[i].loading?'hidden':'disabled';});
    if(pick>=0)applySubtitleOffset(entries[pick],(entries[pick].offset||0)-(v.__subtitleBase||0));
    v.__renderCaptions?.();v.__layoutSubtitles?.();
    btn.classList.toggle('on',pick>=0);v.__preferAI=pick>=0&&entries[pick].source==='ai';
    if(persist)savePlayerSubtitlePreference(f,pick>=0?entries[pick].id:'');
  };
  const saved=playerSubtitlePreference(f);
  const preferred=(saved===PLAYER_AI_PREFERENCE||v.__preferAI)?entries.findIndex(entry=>entry.source==='ai'):entries.findIndex(entry=>entry.id===saved);
  // Preserve a pending AI preference while the worker creates its first track.
  const waitingAI=saved===PLAYER_AI_PREFERENCE||v.__preferAI;select(preferred,preferred>=0);if(waitingAI&&preferred<0)v.__preferAI=true;
  let aiModel=state.aiSubtitles?.model||'small';try{aiModel=localStorage.getItem('vault-ai-model')||aiModel;}catch{}
  const draw=()=>{
    if(!document.contains(v))return;
    const active=entries.findIndex(entry=>entry.selected&&!entry.failed),chosen=entries[active],offset=chosen?.offset||0,job=playerSubtitleJobs.get(f.rel),running=job&&['starting','queued','running','cancelling'].includes(job.status);
    $('#plCCName').textContent=chosen?.label||'Off';
    const aiModels=[['base','Fast · quicker, less accurate'],['small','Balanced'],['medium','Detailed · slower']];if(!aiModels.some(([name])=>name===aiModel))aiModels.push([aiModel,'Server model · '+aiModel]);
    const aiTrack=entries.find(entry=>entry.source==='ai'),wantsAI=v.__preferAI||playerSubtitlePreference(f)===PLAYER_AI_PREFERENCE;
    const loadingAI=wantsAI&&(v.__subtitleLoading||job?.activation==='loading'||aiTrack?.selected&&aiTrack.loading);
    const trackError=aiTrack?.failed?(aiTrack.empty?'The generated subtitle file contains no captions. Generate it again.':'The generated subtitle track could not be loaded. Retry loading it.'):(job?.activationError||'');
    const eta=running&&job.remainingSeconds>0?` · About ${Math.max(1,Math.ceil(job.remainingSeconds/60))} min left`:'';
    menu.innerHTML=`<div class="pl-menu-heading">Subtitles</div><button class="cc-track ${active<0?'on':''}" data-cc-track="-1"><span>Off</span>${active<0?icon('check'):''}</button>`+entries.map((entry,i)=>`<button class="cc-track ${active===i?'on':''}" data-cc-track="${i}" ${entry.failed?'disabled':''}><span>${esc(entry.label||'Subtitle track')}${entry.failed?' · unavailable':''}</span>${active===i?icon('check'):''}</button>`).join('')+(!entries.length?`<p class="pl-stream-info" role="status">${v.__subtitleLoading?'Looking for subtitle tracks…':v.__subtitleError?'Could not load subtitle tracks. Try again.':'No subtitles available for this video.'}</p>${v.__subtitleError?'<button id="plRetrySubs">Retry subtitle lookup</button>':''}`:'')+`<div class="pl-ai-controls"><button id="plAIEnabled" role="switch" aria-checked="${!!(running||loadingAI||chosen?.source==='ai'&&!chosen.failed)}" ${['starting','cancelling'].includes(job?.status)||(!state.aiSubtitles?.available&&!entries.some(entry=>entry.source==='ai'))?'disabled':''}>${icon('sparkle')}<span>AI subtitles</span><span class="pl-switch" aria-hidden="true"></span></button><p class="pl-stream-info">${loadingAI?'Loading generated subtitles…':trackError?esc(trackError):running?esc(job.message||'Generating subtitles')+(job.progress?' · '+Math.round(job.progress)+'%':'')+eta:job?.error?esc(job.error):entries.some(entry=>entry.source==='ai')?chosen?.source==='ai'&&!chosen.failed?'AI subtitles enabled.': 'Generated locally. You can turn this track on or off.':state.aiSubtitles?.available?'Generate a subtitle track for this video.':'AI generation is unavailable on this server.'}</p>${!loadingAI&&(trackError||job?.status==='complete'&&!aiTrack)?`<button id="plRetryAITrack">${aiTrack?.empty?'Generate again':'Retry loading subtitles'}</button>`:''}${!entries.some(entry=>entry.source==='ai')?`<label class="pl-ai-model"><span>Transcription</span><select id="plAIModel" aria-label="AI transcription speed" ${running||!state.aiSubtitles?.available?'disabled':''}>${aiModels.map(([name,label])=>`<option value="${esc(name)}" ${name===aiModel?'selected':''}>${esc(label)}</option>`).join('')}</select></label>`:''}${job?.warning?`<p class="pl-stream-info">${esc(job.warning)}</p>`:''}${job?.diagnostic?`<details class="pl-ai-diagnostic"><summary>Technical details</summary><p>${esc(job.diagnostic)}</p><p>GPU transcription requires compatible NVIDIA drivers, CUDA and cuDNN on the server. CPU fallback remains available.</p></details>`:''}</div>${chosen?`<div class="cc-offset"><div class="cc-offset-top"><span>Subtitle timing</span><b id="ccOffsetValue">${offset>=0?'+':''}${offset.toFixed(1)}s</b></div><input id="ccOffset" aria-label="Subtitle timing in seconds" type="range" min="-10" max="10" step="0.1" value="${offset}"><div class="cc-offset-steps"><button data-cc-step="-.5">−0.5s</button><button data-cc-reset>Reset</button><button data-cc-step=".5">+0.5s</button></div><small>Negative appears earlier; positive appears later.</small></div>`:''}`;
    menu.insertAdjacentHTML('beforeend',captionAppearanceMarkup(v));bindCaptionAppearance(v,menu);
    menu.querySelectorAll('[data-cc-track]').forEach(button=>button.onclick=()=>{select(Number(button.dataset.ccTrack));draw();});
    $('#plAIModel')?.addEventListener('change',event=>{aiModel=event.target.value;try{localStorage.setItem('vault-ai-model',aiModel);}catch{}});
    $('#plRetrySubs')?.addEventListener('click',()=>v.__reloadSubtitles());
    $('#plRetryAITrack')?.addEventListener('click',async()=>{if(aiTrack?.empty){$('#plAIEnabled').click();return;}if(job)job.activationError='';v.__preferAI=true;savePlayerSubtitlePreference(f,PLAYER_AI_PREFERENCE);const tracks=await v.__reloadSubtitles();if(job&&!tracks.some(entry=>entry.source==='ai'))job.activationError='Subtitles were generated, but the track could not be loaded. Retry loading it.';v.__ccDraw?.();});
    $('#plAIEnabled').onclick=async()=>{
      const ai=entries.findIndex(entry=>entry.source==='ai');
      if(running){job.cancelled=true;const before=job.status;job.status='cancelling';job.message='Stopping generation';draw();try{if(job.id)await appsRequest('/api/ai-subtitles/'+encodeURIComponent(job.id),{method:'DELETE'});job.status='cancelled';job.message='';job.polling=false;try{localStorage.removeItem(`vault-ai-job:${f.rel}`);}catch{}clearTimeout(job.timer);v.__preferAI=false;select(-1);}catch(error){job.cancelled=false;job.status=before;job.error=error.message;job.polling=false;watchPlayerSubtitleJob(f,job);}draw();return;}
      if(ai>=0&&!entries[ai].failed){select(chosen?.source==='ai'?-1:ai);draw();return;}
      const task={status:'starting',message:'Starting subtitle generation'};playerSubtitleJobs.set(f.rel,task);
      v.__preferAI=true;savePlayerSubtitlePreference(f,PLAYER_AI_PREFERENCE);draw();
      try{
        const job=await appsRequest(url('ai-subtitles',f.rel),{method:'POST',body:JSON.stringify({model:aiModel,language:'auto'})});
        rememberPlayerSubtitleJob(f,job);
      }catch(error){task.status='failed';task.error=error.message;v.__preferAI=false;savePlayerSubtitlePreference(f,'');}draw();
    };
    if(chosen){
      const setOffset=value=>{chosen.offset=Math.max(-10,Math.min(10,Math.round(value*10)/10));applySubtitleOffset(chosen,chosen.offset-(v.__subtitleBase||0));try{localStorage.setItem(subtitleStorageKey(f,chosen.id),String(chosen.offset));}catch{}$('#ccOffsetValue').textContent=`${chosen.offset>=0?'+':''}${chosen.offset.toFixed(1)}s`;$('#ccOffset').value=chosen.offset;v.__renderCaptions?.();};
      $('#ccOffset').oninput=event=>setOffset(Number(event.target.value));menu.querySelectorAll('[data-cc-step]').forEach(button=>button.onclick=()=>setOffset(chosen.offset+Number(button.dataset.ccStep)));$('[data-cc-reset]').onclick=()=>setOffset(0);
    }
  };
  btn.onclick=()=>{const open=menu.hidden;v.__closeMenus?.();draw();menu.hidden=!open;btn.setAttribute('aria-expanded',String(open));v.__showChrome?.();if(open)requestAnimationFrame(()=>v.__positionMiniMenu?.());};
  v.__ccDraw=()=>{v.__renderCaptions?.();if(!menu.hidden)draw();};
  v.__ccUpdatedHandler=()=>{v.__layoutSubtitles?.();const active=entries.findIndex(entry=>entry.selected&&!entry.failed);if(active>=0)applySubtitleOffset(entries[active],(entries[active].offset||0)-(v.__subtitleBase||0));v.__renderCaptions?.();if(!menu.hidden)draw();};
  v.addEventListener('vault-subtitles-updated',v.__ccUpdatedHandler);draw();
}

/**
 * Report position every few seconds and once on the way out. Throttled because
 * timeupdate fires several times a second and each report is a write.
 */
function trackProgress(video, f, baseOf, knownDur){
  let last = 0;
  const send = (pos, dur) => {
    if(!dur) return;
    fetch('/api/progress', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ rel:f.rel, pos, dur }),
      keepalive: true,        // survives the page or dialog going away
    }).catch(()=>{});
  };
  /**
   * A fragmented-MP4 stream doesn't carry a reliable duration — the element
   * reports whatever it has buffered. Prefer the figure ffprobe gave us.
   */
  const total = () => (typeof knownDur==='function'?knownDur():knownDur)
    || (isFinite(video.duration) && video.duration > 0 ? video.duration : 0)
    || (f.watch && f.watch.dur) || 0;

  const report = () => send(baseOf() + (video.currentTime || 0), total());

  video.addEventListener('timeupdate', () => {
    if(Date.now() - last < 5000) return;
    last = Date.now();
    report();
  });
  video.addEventListener('pause', report);
  video.__report = report;
}

/** Attach any subtitle tracks the server can produce for this file. */
async function attachSubtitles(video, f, isCurrent=()=>video.isConnected){
  try{
    const r = await fetch(url('subs', f.rel),{cache:'no-store'});
    if(!r.ok)throw new Error('Subtitle lookup failed');
    const { tracks } = await r.json();
    if(!isCurrent())return null;
    video.__subtitleError=false;
    video.querySelectorAll('track[data-vault-track]').forEach(track=>track.remove());
    if(!tracks || !tracks.length) return [];
    const entries=[];
    tracks.forEach((t) => {
      const el = document.createElement('track');
      el.kind = 'subtitles';
      el.dataset.vaultTrack = '1';
      el.label = t.label;
      if(t.lang) el.srclang = t.lang;
      el.src = `${url('sub', f.rel)}?track=${encodeURIComponent(t.id)}&v=${Date.now()}`;
      const entry={id:t.id,label:t.label,source:t.source,element:el,track:el.track,loading:true,failed:false,offset:0,selected:false};
      el.addEventListener('load',()=>{if(!el.isConnected)return;entry.loading=false;entry.empty=!entry.track.cues?.length;entry.failed=entry.empty;entry.track.mode=entry.selected&&!entry.failed?(video.__nativeCaptions?'showing':'hidden'):'disabled';video.dispatchEvent(new Event('vault-subtitles-updated'));});
      el.addEventListener('error',()=>{if(!el.isConnected)return;entry.loading=false;entry.failed=true;entry.track.mode='disabled';video.dispatchEvent(new Event('vault-subtitles-updated'));});
      entry.track.addEventListener('cuechange',()=>{if(el.isConnected)video.__renderCaptions?.();});
      video.appendChild(el);
      // Hidden mode makes browsers fetch and parse the cues without putting
      // them on screen before the viewer has made a choice.
      el.track.mode='hidden';
      entries.push(entry);
    });

    return entries;
  }catch{ if(isCurrent())video.__subtitleError=true; }
  return null;
}

document.addEventListener('play',event=>{if(event.target.id==='musicAudio')$('#rmx')?.pause();},true);
