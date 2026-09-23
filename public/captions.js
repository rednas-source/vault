/* Caption presentation is separate from native track parsing and timing. */
const CAPTION_FONTS={sans:['Sans serif','Arial, sans-serif'],serif:['Serif','Georgia, serif'],rounded:['Rounded','"Trebuchet MS", sans-serif'],mono:['Monospace','"Courier New", monospace']};
function captionPreferences(value={}){
  return {font:Object.hasOwn(CAPTION_FONTS,value?.font)?value.font:'sans',size:[.8,1,1.25,1.5].includes(value?.size)?value.size:1,outline:value?.outline===true,
    position:Number.isFinite(value?.position?.x)&&Number.isFinite(value?.position?.y)?{x:Math.max(0,Math.min(1,value.position.x)),y:Math.max(0,Math.min(1,value.position.y))}:null};
}
function captionCueEnd(cue,source){
  // Old AI sidecars can stretch a short sentence across minutes of silence.
  // Leave authored tracks alone; bound only implausibly long AI cues.
  if(source!=='ai'||cue.endTime-cue.startTime<=15)return cue.endTime;
  const readingTime=Math.max(3,Math.min(12,String(cue.text||'').length/15+1));
  return Math.min(cue.endTime,cue.startTime+readingTime);
}
function captionTextAt(entry,time){
  if(!entry?.selected||entry.failed||!Number.isFinite(time))return '';
  return Array.from(entry.track.activeCues||[])
    .filter(cue=>time>=cue.startTime&&time<captionCueEnd(cue,entry.source))
    .map(cue=>cue.getCueAsHTML?cue.getCueAsHTML().textContent:cue.text).join('\n');
}
function captionPosition(position,box,text,clearance=0){
  const minX=text.width/2+8,maxX=Math.max(minX,box.width-minX);
  const minY=text.height/2+8,maxY=Math.max(minY,box.height-text.height/2-8-clearance);
  return {x:Math.max(minX,Math.min(maxX,(position?.x??.5)*box.width)),y:Math.max(minY,Math.min(maxY,position?position.y*box.height:maxY-16))};
}
function mountCaptionPresentation(video,player){
  const stage=player.querySelector('.pl-stage'),caption=document.createElement('div');
  caption.id='plCaptions';caption.className='pl-captions';caption.hidden=true;caption.tabIndex=0;caption.setAttribute('role','group');
  caption.setAttribute('aria-label','Subtitles. Drag to move, or use arrow keys when focused.');
  caption.title='Drag subtitles to move them';stage.append(caption);
  let saved;try{saved=JSON.parse(localStorage.getItem('vault-caption-appearance')||'{}');}catch{}
  let preferences=captionPreferences(saved),gesture=null,frame=0,lastText='',nativeSurface=false;
  video.__captionPreferences=()=>preferences;
  const layout=()=>{
    const box=stage.getBoundingClientRect();if(!box.width||!box.height)return;
    player.style.setProperty('--caption-base',Math.max(player.dataset.mode==='mini'?14:18,Math.min(24,box.width/50))+'px');
    const text=caption.getBoundingClientRect(),bar=player.querySelector('.pl-bar');
    const clearance=player.classList.contains('chrome-hidden')?0:(bar?.getBoundingClientRect().height||0)+10;
    const point=captionPosition(preferences.position,box,text,clearance);
    caption.style.left=point.x+'px';caption.style.top=point.y+'px';
  };
  const render=()=>{
    const entry=video.__subtitleEntries?.find(item=>item.selected&&!item.failed);
    const text=!nativeSurface&&!video.seeking&&!video.ended&&video.readyState>=2?captionTextAt(entry,video.currentTime):'';
    if(text!==lastText){caption.textContent=text;lastText=text;caption.hidden=!text;layout();}
  };
  const apply=()=>{
    player.style.setProperty('--caption-font',CAPTION_FONTS[preferences.font][1]);
    player.style.setProperty('--caption-scale',String(preferences.size));
    player.style.setProperty('--caption-shadow',preferences.outline?'1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000':'none');
    render();layout();
  };
  video.__setCaptionPreferences=changes=>{preferences=captionPreferences({...preferences,...changes});try{localStorage.setItem('vault-caption-appearance',JSON.stringify(preferences));}catch{}apply();};
  video.__renderCaptions=render;video.__layoutSubtitles=layout;
  const tick=()=>{render();frame=!video.paused&&!video.ended?requestAnimationFrame(tick):0;};
  const start=()=>{if(!frame)frame=requestAnimationFrame(tick);};
  const stop=()=>{cancelAnimationFrame(frame);frame=0;render();};
  const nativeMode=enabled=>{
    nativeSurface=enabled;video.__nativeCaptions=enabled;
    for(const entry of video.__subtitleEntries||[])entry.track.mode=entry.selected&&!entry.failed?(enabled?'showing':'hidden'):entry.loading?'hidden':'disabled';
    render();
  };
  video.addEventListener('enterpictureinpicture',()=>nativeMode(true));video.addEventListener('leavepictureinpicture',()=>nativeMode(false));
  video.addEventListener('webkitbeginfullscreen',()=>nativeMode(true));video.addEventListener('webkitendfullscreen',()=>nativeMode(false));
  for(const name of ['timeupdate','seeked','seeking','loadeddata','emptied','vault-subtitles-updated'])video.addEventListener(name,render);
  video.addEventListener('play',start);video.addEventListener('pause',stop);video.addEventListener('ended',stop);
  const observer=new ResizeObserver(layout);observer.observe(stage);
  caption.onpointerdown=event=>{
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();
    video.__showChrome?.();caption.focus({preventScroll:true});
    const box=caption.getBoundingClientRect();gesture={id:event.pointerId,x:event.clientX,y:event.clientY,cx:box.left+box.width/2,cy:box.top+box.height/2};
    caption.setPointerCapture(event.pointerId);caption.classList.add('dragging');
  };
  caption.onpointermove=event=>{
    if(gesture?.id!==event.pointerId)return;event.stopPropagation();
    const box=stage.getBoundingClientRect();
    video.__setCaptionPreferences({position:{x:(gesture.cx+event.clientX-gesture.x-box.left)/box.width,y:(gesture.cy+event.clientY-gesture.y-box.top)/box.height}});
  };
  const end=()=>{gesture=null;caption.classList.remove('dragging');};
  caption.onpointerup=end;caption.onpointercancel=end;caption.onlostpointercapture=end;caption.onclick=event=>event.stopPropagation();
  caption.onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    if(event.key==='Home'){video.__setCaptionPreferences({position:null});return;}
    const box=stage.getBoundingClientRect(),text=caption.getBoundingClientRect(),step=event.shiftKey?25:5;
    video.__setCaptionPreferences({position:{x:(text.left+text.width/2-box.left+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0))/box.width,y:(text.top+text.height/2-box.top+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0))/box.height}});
  };
  apply();
  return ()=>{cancelAnimationFrame(frame);observer.disconnect();};
}
function captionAppearanceMarkup(video){
  const settings=video.__captionPreferences?.()||captionPreferences();
  return `<details class="cc-appearance" ${video.__captionAppearanceOpen?'open':''}><summary>Appearance & position</summary><div class="cc-appearance-fields"><label>Font<select id="ccFont">${Object.entries(CAPTION_FONTS).map(([key,[label]])=>`<option value="${key}" ${settings.font===key?'selected':''}>${label}</option>`).join('')}</select></label><label>Size<select id="ccSize">${[[.8,'Small'],[1,'Normal'],[1.25,'Large'],[1.5,'Extra large']].map(([size,label])=>`<option value="${size}" ${settings.size===size?'selected':''}>${label}</option>`).join('')}</select></label><label class="cc-outline"><input id="ccOutline" type="checkbox" ${settings.outline?'checked':''}>Black outline</label><p>Drag the subtitles to move them. Arrow keys move focused text; Home resets its position.</p><button id="ccResetPosition">Reset position</button></div></details>`;
}
function bindCaptionAppearance(video,menu){
  const details=menu.querySelector('.cc-appearance');if(!details)return;
  details.ontoggle=()=>{video.__captionAppearanceOpen=details.open;video.__positionMiniMenu?.();};
  menu.querySelector('#ccFont').onchange=event=>video.__setCaptionPreferences({font:event.target.value});
  menu.querySelector('#ccSize').onchange=event=>video.__setCaptionPreferences({size:Number(event.target.value)});
  menu.querySelector('#ccOutline').onchange=event=>video.__setCaptionPreferences({outline:event.target.checked});
  menu.querySelector('#ccResetPosition').onclick=()=>video.__setCaptionPreferences({position:null});
}
