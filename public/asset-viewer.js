import * as THREE from '/vendor/three/build/three.module.js';
import {OrbitControls} from '/vendor/three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from '/vendor/three/examples/jsm/loaders/GLTFLoader.js';

export async function createViewer(container,asset,controlsHost){
  const shell=container.closest('.asset-viewport-shell'),visual=container.closest('.asset-visual');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x141c20);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  container.replaceChildren(renderer.domElement);renderer.domElement.setAttribute('aria-label','Interactive 3D asset preview');renderer.domElement.tabIndex=0;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.01,1000),orbit=new OrbitControls(camera,renderer.domElement);
  orbit.enableDamping=true;orbit.dampingFactor=.08;orbit.minDistance=.2;orbit.maxDistance=50;
  scene.add(new THREE.HemisphereLight(0xe4f1ff,0x716550,2.5));const sun=new THREE.DirectionalLight(0xffe9cb,3);sun.position.set(4,8,6);scene.add(sun);const fill=new THREE.DirectionalLight(0xc9ddff,1.6);fill.position.set(-5,3,-5);scene.add(fill);
  let model=null,mixer=null,action=null,skeleton=null,frame=0,disposed=false,playing=false,clips=[],loadId=0,cursor=0,duration=0;
  const controller=new AbortController(),originals=new Map(),solidMaterials=new Set();
  function release(root){const geometries=new Set(),materials=new Set(),textures=new Set();root?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});for(const t of textures)t.dispose();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();}
  function disposeModel(){mixer?.stopAllAction();if(skeleton){scene.remove(skeleton);skeleton.geometry.dispose();skeleton.material.dispose();skeleton=null;}for(const [mesh,mat] of originals)mesh.material=mat;originals.clear();if(model){scene.remove(model);release(model);}for(const m of solidMaterials)m.dispose();solidMaterials.clear();model=null;mixer=null;action=null;}
  function fit(){camera.position.set(3.1,2.1,3.8);orbit.target.set(0,.75,0);orbit.update();}
  function resize(){const {width,height}=container.getBoundingClientRect();if(!width||!height||disposed)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(container);fit();resize();
  controlsHost.hidden=false;controlsHost.className='asset-viewer-controls';controlsHost.replaceChildren();
  const create=(tag,text,parent=controlsHost)=>{const e=document.createElement(tag);if(text)e.textContent=text;parent.append(e);return e;};
  const row=create('div','');row.className='asset-viewer-row';
  const label=(name,parent=row)=>create('label',name,parent);
  const button=(name,parent=row)=>{const b=create('button',name,parent);b.type='button';b.className='asset-btn';return b;};
  const modelSelect=create('select','',label('File'));modelSelect.setAttribute('aria-label','3D model file');
  const modelFiles=asset.files.filter(f=>f.ext==='glb');for(const f of modelFiles){const o=create('option',f.label||f.path,modelSelect);o.value=f.path;}modelSelect.value=modelFiles.some(f=>f.path===asset.primary)?asset.primary:modelFiles[0].path;
  const mode=create('select','',label('Surface'));mode.setAttribute('aria-label','Surface display');for(const [value,name] of [['textured','Textured'],['solid','Solid · no textures'],['wire','Wireframe']]){const o=create('option',name,mode);o.value=value;}
  const boneLabel=label(''),bones=create('input','',boneLabel);bones.type='checkbox';bones.setAttribute('aria-label','Show rig bones');boneLabel.append(' Bones');
  const reset=button('Reset view'),expand=button('Expand'),fullscreen=button('Fullscreen');expand.setAttribute('aria-pressed','false');fullscreen.setAttribute('aria-pressed','false');
  reset.onclick=fit;expand.onclick=()=>{const on=!visual.classList.contains('is-expanded');visual.classList.toggle('is-expanded',on);expand.textContent=on?'Collapse':'Expand';expand.setAttribute('aria-pressed',String(on));};
  fullscreen.disabled=!shell.requestFullscreen;fullscreen.title=fullscreen.disabled?'Fullscreen is unavailable in this browser':'';
  fullscreen.onclick=async()=>{try{if(document.fullscreenElement===shell)await document.exitFullscreen();else await shell.requestFullscreen();}catch{status.textContent='Fullscreen was unavailable. Use Expand instead.';}};
  const fullscreenChange=()=>{const on=document.fullscreenElement===shell;fullscreen.textContent=on?'Exit fullscreen':'Fullscreen';fullscreen.setAttribute('aria-pressed',String(on));resize();};document.addEventListener('fullscreenchange',fullscreenChange);
  const motion=create('div','');motion.className='asset-motion-controls';
  const motionRow=create('div','',motion);motionRow.className='asset-viewer-row';
  const animationSelect=create('select','',label('Clip',motionRow));animationSelect.setAttribute('aria-label','Animation clip');
  const play=button('Play',motionRow);play.setAttribute('aria-pressed','false');
  const speed=create('select','',label('Speed',motionRow));speed.setAttribute('aria-label','Playback speed');for(const value of [.25,.5,1,1.5,2]){const o=create('option',value+'×',speed);o.value=value;}speed.value='1';
  const loopLabel=label('',motionRow),loop=create('input','',loopLabel);loop.type='checkbox';loop.checked=true;loop.setAttribute('aria-label','Loop preview');loopLabel.append(' Loop');
  const timelineRow=create('div','',motion);timelineRow.className='asset-timeline-row';
  const previousFrame=button('−1 frame',timelineRow),timeline=create('input','',timelineRow);timeline.type='range';timeline.min='0';timeline.step=String(1/30);timeline.setAttribute('aria-label','Animation timeline');
  const nextFrame=button('+1 frame',timelineRow),time=create('output','0.00 / 0.00 s',timelineRow);time.setAttribute('aria-label','Animation time');
  const rangeRow=create('div','',motion);rangeRow.className='asset-viewer-row asset-preview-range';
  create('span','Preview range',rangeRow);const start=create('input','',label('In',rangeRow)),end=create('input','',label('Out',rangeRow));for(const input of [start,end]){input.type='number';input.min='0';input.step='.01';}start.setAttribute('aria-label','Preview range start');end.setAttribute('aria-label','Preview range end');
  const rangeReset=button('Reset range',rangeRow);create('span','Preview only · original clips stay unchanged',rangeRow).className='asset-preview-note';
  const status=create('span','');status.className='asset-viewer-status';status.setAttribute('role','status');
  function setPlaying(value){playing=value;play.textContent=value?'Pause':'Play';play.setAttribute('aria-pressed',String(value));}
  function seek(value){cursor=Math.max(0,Math.min(duration,value));if(action){action.time=cursor;mixer.update(0);}timeline.value=String(cursor);timeline.setAttribute('aria-valuetext',cursor.toFixed(2)+' seconds');time.value=cursor.toFixed(2)+' / '+duration.toFixed(2)+' s';}
  function resetRange(){start.value='0';end.value=duration.toFixed(3);}
  function selectClip(){mixer?.stopAllAction();duration=clips[animationSelect.value]?.duration||0;timeline.max=duration;start.max=duration;end.max=duration;resetRange();action=null;if(mixer&&duration){action=mixer.clipAction(clips[animationSelect.value]);action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();}setPlaying(false);seek(0);}
  animationSelect.onchange=selectClip;play.onclick=()=>{if(cursor>=Number(end.value))seek(Number(start.value));setPlaying(!playing);};timeline.oninput=()=>{setPlaying(false);seek(Number(timeline.value));};
  previousFrame.onclick=()=>{setPlaying(false);seek(cursor-1/30);};nextFrame.onclick=()=>{setPlaying(false);seek(cursor+1/30);};rangeReset.onclick=resetRange;
  for(const input of [start,end])input.onchange=()=>{let a=Number(start.value),b=Number(end.value);if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b>duration||b-a<.001){resetRange();status.textContent='Choose a preview range within the clip, with Out after In.';}else{setPlaying(false);seek(a);status.textContent='Preview range updated. Original clip unchanged.';}};
  function surface(){for(const [mesh,original] of originals){if(mode.value==='textured')mesh.material=original;else{if(!mesh.userData.vaultSolid){mesh.userData.vaultSolid=new THREE.MeshStandardMaterial({color:0xbcc6ce,roughness:.8,metalness:0,side:THREE.DoubleSide});solidMaterials.add(mesh.userData.vaultSolid);}mesh.material=mesh.userData.vaultSolid;mesh.material.wireframe=mode.value==='wire';}}}
  mode.onchange=surface;bones.onchange=()=>{if(skeleton)skeleton.visible=bones.checked;};
  async function load(file){
    const ticket=++loadId;setPlaying(false);play.disabled=true;modelSelect.disabled=true;status.textContent='Loading model…';
    try{
      const f=asset.files.find(f=>f.path===file);if(f.size>256*1024*1024)throw new Error('This model exceeds the 256 MB browser preview limit. Download it to inspect locally.');
      const response=await fetch('/api/stream/'+`${asset.rel}/${file}`.split('/').map(encodeURIComponent).join('/'),{signal:controller.signal});if(!response.ok)throw new Error('The model file is unavailable.');const raw=await response.arrayBuffer();
      const view=new DataView(raw);if(raw.byteLength<20||view.getUint32(0,true)!==0x46546c67)throw new Error('Not a supported GLB file.');const size=view.getUint32(12,true);if(size>32*1024*1024||20+size>raw.byteLength)throw new Error('Invalid GLB metadata.');const json=JSON.parse(new TextDecoder().decode(new Uint8Array(raw,20,size)));
      if([...(json.buffers||[]),...(json.images||[])].some(x=>x.uri&&!/^data:/i.test(x.uri)))throw new Error('Preview needs a self-contained GLB with embedded textures. All source files remain downloadable.');
      const manager=new THREE.LoadingManager();manager.setURLModifier(value=>{if(/^(blob:|data:)/i.test(value))return value;throw new Error('External model resources are not loaded by this private viewer.');});
      const gltf=await new GLTFLoader(manager).parseAsync(raw,'');if(disposed||ticket!==loadId){release(gltf.scene);return;}
      disposeModel();const root=gltf.scene;root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),dimensions=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=2/Math.max(dimensions.x,dimensions.y,dimensions.z,.001);
      model=new THREE.Group();model.add(root);root.position.sub(center);model.scale.setScalar(scale);model.position.y=dimensions.y*scale/2;scene.add(model);model.updateMatrixWorld(true);fit();
      let boneCount=0;root.traverse(o=>{if(o.isMesh)originals.set(o,o.material);if(o.isBone)boneCount++;});bones.disabled=!boneCount;bones.checked=false;boneLabel.title=boneCount?boneCount+' bones':'This file has no rig';
      if(boneCount){skeleton=new THREE.SkeletonHelper(root);skeleton.material.depthTest=false;skeleton.material.transparent=true;skeleton.renderOrder=10;skeleton.visible=false;scene.add(skeleton);}surface();
      clips=gltf.animations;mixer=clips.length?new THREE.AnimationMixer(root):null;animationSelect.replaceChildren();clips.forEach((clip,i)=>{const o=create('option',clip.name||'Clip '+(i+1),animationSelect);o.value=String(i);});motion.hidden=!clips.length;play.disabled=!clips.length;selectClip();status.textContent=clips.length?`${clips.length} clips · ${boneCount} bones`:'Static model';
    }catch(e){if(!disposed){status.textContent=e.message;throw e;}}finally{modelSelect.disabled=false;}
  }
  modelSelect.onchange=()=>load(modelSelect.value).catch(()=>{});
  let previous=performance.now();function tick(now){if(disposed)return;frame=requestAnimationFrame(tick);const dt=Math.min((now-previous)/1000,.05);previous=now;if(document.hidden)return;if(playing&&action){let next=cursor+dt*Number(speed.value),a=Number(start.value),b=Number(end.value);if(next>b){if(loop.checked)next=a+(next-a)%Math.max(.001,b-a);else{next=b;setPlaying(false);}}seek(next);}orbit.update();renderer.render(scene,camera);}frame=requestAnimationFrame(tick);
  const dispose=()=>{if(disposed)return;disposed=true;controller.abort();cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('fullscreenchange',fullscreenChange);if(document.fullscreenElement===shell)document.exitFullscreen().catch(()=>{});visual.classList.remove('is-expanded');orbit.dispose();disposeModel();renderer.dispose();renderer.forceContextLoss();controlsHost.hidden=true;};
  try{await load(modelSelect.value);}catch(e){dispose();throw e;}return {dispose};
}
