import * as THREE from '/vendor/three/build/three.module.js';
import {OrbitControls} from '/vendor/three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from '/vendor/three/examples/jsm/loaders/GLTFLoader.js';

export async function createViewer(container,asset,controlsHost){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x141c20);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  container.replaceChildren(renderer.domElement);renderer.domElement.setAttribute('aria-label','Interactive 3D asset preview');renderer.domElement.tabIndex=0;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,0.01,1000),orbit=new OrbitControls(camera,renderer.domElement);
  orbit.enableDamping=true;orbit.dampingFactor=.08;orbit.minDistance=.2;orbit.maxDistance=50;
  scene.add(new THREE.HemisphereLight(0xe4f1ff,0x716550,2.5));const sun=new THREE.DirectionalLight(0xffe9cb,3);sun.position.set(4,8,6);scene.add(sun);const fill=new THREE.DirectionalLight(0xc9ddff,1.6);fill.position.set(-5,3,-5);scene.add(fill);
  let model=null,mixer=null,frame=0,disposed=false,playing=false,clips=[],loadId=0;const controller=new AbortController();
  const materials=new Set(),textures=new Set();
  function disposeModel(){mixer?.stopAllAction();if(model){model.traverse(o=>{o.geometry?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});scene.remove(model);}for(const t of textures)t.dispose();for(const m of materials)m.dispose();materials.clear();textures.clear();model=null;mixer=null;}
  function fit(){camera.position.set(3.1,2.1,3.8);orbit.target.set(0,.75,0);orbit.update();}
  function resize(){const {width,height}=container.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(container);fit();resize();
  controlsHost.hidden=false;controlsHost.className='asset-viewer-controls';controlsHost.replaceChildren();
  const create=(tag,text,parent=controlsHost)=>{const e=document.createElement(tag);if(text)e.textContent=text;parent.append(e);return e;};
  const modelLabel=create('label','File '),modelSelect=create('select','',modelLabel);modelSelect.setAttribute('aria-label','3D model file');
  const modelFiles=asset.files.filter(f=>f.ext==='glb');for(const f of modelFiles){const o=create('option',f.label||f.path,modelSelect);o.value=f.path;}modelSelect.value=modelFiles.some(f=>f.path===asset.primary)?asset.primary:modelFiles[0].path;
  const animationLabel=create('label','Clip '),animationSelect=create('select','',animationLabel);animationSelect.setAttribute('aria-label','Animation clip');
  const play=create('button','Play'),reset=create('button','Reset view'),wire=create('button','Wireframe');for(const b of [play,reset,wire])b.className='asset-btn';play.setAttribute('aria-pressed','false');wire.setAttribute('aria-pressed','false');
  reset.onclick=fit;wire.onclick=()=>{const on=wire.getAttribute('aria-pressed')!=='true';wire.setAttribute('aria-pressed',String(on));model?.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))m.wireframe=on;});};
  function selectClip(){mixer?.stopAllAction();if(mixer&&clips[animationSelect.value]){mixer.clipAction(clips[animationSelect.value]).reset().play();mixer.update(0);}playing=false;play.textContent='Play';play.setAttribute('aria-pressed','false');}
  animationSelect.onchange=selectClip;play.onclick=()=>{playing=!playing;play.textContent=playing?'Pause':'Play';play.setAttribute('aria-pressed',String(playing));};
  const status=create('span','');status.setAttribute('role','status');
  async function load(file){
    const ticket=++loadId;playing=false;play.disabled=true;modelSelect.disabled=true;status.textContent='Loading model…';
    try{
      const f=asset.files.find(f=>f.path===file);if(f.size>256*1024*1024)throw new Error('This model exceeds the 256 MB browser preview limit. Download it to inspect locally.');
      const response=await fetch('/api/stream/'+`${asset.rel}/${file}`.split('/').map(encodeURIComponent).join('/'),{signal:controller.signal});if(!response.ok)throw new Error('The model file is unavailable.');const raw=await response.arrayBuffer();
      const view=new DataView(raw);if(raw.byteLength<20||view.getUint32(0,true)!==0x46546c67)throw new Error('Not a supported GLB file.');const size=view.getUint32(12,true);if(size>32*1024*1024||20+size>raw.byteLength)throw new Error('Invalid GLB metadata.');const json=JSON.parse(new TextDecoder().decode(new Uint8Array(raw,20,size)));
      if([...(json.buffers||[]),...(json.images||[])].some(x=>x.uri&&!/^data:/i.test(x.uri)))throw new Error('Preview needs a self-contained GLB with embedded textures. All source files remain downloadable.');
      const manager=new THREE.LoadingManager();manager.setURLModifier(value=>{if(/^(blob:|data:)/i.test(value))return value;throw new Error('External model resources are not loaded by this private viewer.');});
      const gltf=await new GLTFLoader(manager).parseAsync(raw,'');if(disposed||ticket!==loadId){gltf.scene.traverse(o=>o.geometry?.dispose());return;}
      disposeModel();model=gltf.scene;model.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(model);const dimensions=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=2/Math.max(dimensions.x,dimensions.y,dimensions.z,.001);
      const wrapper=new THREE.Group();wrapper.add(model);model.position.sub(center);wrapper.scale.setScalar(scale);wrapper.position.y=dimensions.y*scale/2;model=wrapper;scene.add(model);fit();
      clips=gltf.animations;mixer=clips.length?new THREE.AnimationMixer(gltf.scene):null;animationSelect.replaceChildren();clips.forEach((clip,i)=>{const o=create('option',`${clip.name||'Clip '+(i+1)} · ${clip.duration.toFixed(2)}s`,animationSelect);o.value=String(i);});
      animationLabel.hidden=!clips.length;play.disabled=!clips.length;selectClip();wire.setAttribute('aria-pressed','false');status.textContent=clips.length?`${clips.length} clips`:'Static model';
    }catch(e){if(!disposed){status.textContent=e.message;throw e;}}finally{modelSelect.disabled=false;}
  }
  modelSelect.onchange=()=>load(modelSelect.value).catch(()=>{});
  let previous=performance.now();function tick(now){if(disposed)return;frame=requestAnimationFrame(tick);const dt=Math.min((now-previous)/1000,.05);previous=now;if(document.hidden)return;if(playing)mixer?.update(dt);orbit.update();renderer.render(scene,camera);}frame=requestAnimationFrame(tick);
  const dispose=()=>{if(disposed)return;disposed=true;controller.abort();cancelAnimationFrame(frame);observer.disconnect();orbit.dispose();disposeModel();renderer.dispose();renderer.forceContextLoss();controlsHost.hidden=true;};
  try{await load(modelSelect.value);}catch(e){dispose();throw e;}return {dispose};
}
