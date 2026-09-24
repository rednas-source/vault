'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveEntry } = require('./archive');
const KINDS = ['model','texture','material','animation','audio','vfx','source','scene','ui','other'];
const ROLES = ['model','rig','animation','vfx','texture','preview','reference','source','documentation','other'];
const IMAGE = /\.(png|jpe?g|webp|avif)$/i;
const fail = (message,status=400) => Object.assign(new Error(message),{status});
const text = (v,max=200) => typeof v === 'string' ? v.trim().slice(0,max) : '';
function relative(value) {
  if(typeof value!=='string'||value.length>900||value.includes('\\')||value.includes(':')||value.includes('\0')||value.split('/').some(s=>!s||s.startsWith('.')||/[<>"|?*\x00-\x1f]/.test(s))) throw fail('Invalid asset file path.');
  return value;
}
function metadata(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw fail('Invalid asset metadata.');
  const name=text(input.name,140);if(!name)throw fail('Give this asset a name.');
  const strings=v=>[...new Set((Array.isArray(v)?v:[]).map(x=>text(x,60)).filter(Boolean))].slice(0,40);
  return {schemaVersion:1,name,trashedAt:Number.isFinite(input.trashedAt)?Math.max(0,input.trashedAt):0,kind:KINDS.includes(input.kind)?input.kind:'model',category:text(input.category,80)||'Unsorted',
    style:text(input.style,120)||'Unspecified',collection:text(input.collection,120),tags:strings(input.tags),
    description:text(input.description,4000),notes:text(input.notes,12000),license:text(input.license,2000),
    source:text(input.source,200),sourceAssetId:text(input.sourceAssetId||input.id,140),version:text(input.version,40)||'1.0',status:['ready','review','draft'].includes(input.status)?input.status:'review',
    preview:input.preview?relative(input.preview):'',primary:input.primary?relative(input.primary):'',
    files:(Array.isArray(input.files)?input.files:[]).slice(0,5000).map(f=>({path:relative(f.path),role:ROLES.includes(f.role)?f.role:inferRole(f.path),label:text(f.label,160),...( /^[a-f0-9]{64}$/.test(f.sha256||'')?{sha256:f.sha256}:{})})),
    // Only bounded descriptive values travel with a package; no arbitrary objects or URLs.
    provenance:{generator:text(input.provenance?.generator,120),model:text(input.provenance?.model,120),prompt:text(input.provenance?.prompt,8000),texturePrompt:text(input.provenance?.texturePrompt,4000)},
  };
}
function inferRole(file) {
  if(/(^|\/)(preview|thumbnail|cover)[^/]*\.(png|jpe?g|webp|avif)$/i.test(file))return 'preview';
  if(/(^|\/)(reference|concept)/i.test(file))return 'reference';
  if(/\.(md|txt|pdf|json)$/i.test(file))return 'documentation';
  if(/\.(vfx|vfxgraph|niagara|pop|pfx)$/i.test(file)||/(^|\/)(particles?|vfx|effects?)[/_-]/i.test(file))return 'vfx';
  if(/\.(blend|psd|kra|spp|ztl)$/i.test(file))return 'source';
  if(/\.(glb|gltf|fbx|obj|usd[acz]?)$/i.test(file))return /animation|motion|running|walking/i.test(file)?'animation':/rig/i.test(file)?'rig':'model';
  if(/\.(png|jpe?g|tga|exr|hdr|ktx2?|dds|webp)$/i.test(file))return 'texture';
  return 'other';
}
async function readJson(file,max=2*1024*1024) {
  const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>max)throw fail('Asset metadata is too large or unavailable.');
  return JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
}
async function glbInfo(file) {
  const handle=await fs.open(file,'r');
  try {
    const head=Buffer.alloc(20);await handle.read(head,0,20,0);
    const size=head.readUInt32LE(12);
    if(head.toString('ascii',0,4)!=='glTF'||head.readUInt32LE(4)!==2||head.readUInt32LE(16)!==0x4e4f534a||size>32*1024*1024)throw fail('Unsupported GLB.');
    const raw=Buffer.alloc(size);await handle.read(raw,0,size,20);const data=JSON.parse(raw.toString());
    const access=data.accessors||[];let triangles=0;
    for(const mesh of data.meshes||[])for(const primitive of mesh.primitives||[])if((primitive.mode??4)===4)triangles+=Math.floor((access[primitive.indices]?.count||access[primitive.attributes?.POSITION]?.count||0)/3);
    const clips=(data.animations||[]).map((a,i)=>({name:a.name||`Clip ${i+1}`,duration:Math.max(0,...(a.samplers||[]).map(s=>access[s.input]?.max?.[0]||0))}));
    const external=[...(data.buffers||[]),...(data.images||[])].some(x=>x.uri&&!/^data:/i.test(x.uri));
    return {triangles,bones:Math.max(0,...(data.skins||[]).map(s=>s.joints.length)),materials:(data.materials||[]).length,textures:(data.images||[]).length,clips,embedded:!external};
  }finally{await handle.close();}
}
function containedKinds(r){
  const kinds=new Set((r.files||[]).map(f=>f.role).filter(v=>['texture','animation','vfx','model','rig','source'].includes(v)));
  if(r.technical?.clips?.length)kinds.add('animation');
  if(r.technical?.textures)kinds.add('texture');
  return [...kinds];
}
function matchesKind(r,kind,belongs){
  if(belongs==='model'&&r.kind!=='model')return false;
  if(!kind)return true;
  const attached=r.kind==='model'&&containedKinds(r).includes(kind);
  return belongs==='standalone'?r.kind===kind:belongs==='model'?attached:r.kind===kind||attached;
}
class AssetLibrary {
  constructor(root){this.root=root;this.items=new Map();this.errors=[];this.loaded=0;this.pending=null;this.queue=Promise.resolve();this.glbCache=new Map();}
  invalidate(){this.loaded=0;}
  exclusive(work){const next=this.queue.then(work,work);this.queue=next.catch(()=>{});return next;}
  async scan(force=false){
    if(this.pending)return this.pending;
    if(!force&&this.loaded&&Date.now()-this.loaded<300000)return;
    this.pending=(async()=>{
      const items=new Map(),errors=[];let visited=0;
      const walk=async(rel,depth=0)=>{
        if(depth>8||++visited>100000)throw fail('Asset scan limit reached. Use shallower package folders.');
        const entry=await resolveEntry(this.root,rel,['assets']);
        const children=await fs.readdir(entry.full,{withFileTypes:true});
        if(children.some(c=>c.name==='asset.json'&&c.isFile())){
          try{const item=await this.readPackage(rel);items.set(item.id,item);}catch(e){errors.push({path:rel,message:e.message});}return;
        }
        for(const child of children)if(child.isDirectory()&&!child.isSymbolicLink()&&!child.name.startsWith('.'))await walk(`${rel}/${child.name}`,depth+1);
      };
      await walk('assets');this.items=items;this.errors=errors;this.loaded=Date.now();
    })().finally(()=>{this.pending=null;});return this.pending;
  }
  async readPackage(rel){
    const manifest=await resolveEntry(this.root,`${rel}/asset.json`,['assets']);
    const raw=await readJson(manifest.full),meta=metadata(raw),files=[];
    const roles=new Map(meta.files.map(f=>[f.path,f]));
    const walk=async(dir,depth=0)=>{
      if(depth>12||files.length>5000)throw fail('Too many files in one asset. Split it into smaller packages.');
      const entry=await resolveEntry(this.root,dir?`${rel}/${dir}`:rel,['assets']);
      for(const child of await fs.readdir(entry.full,{withFileTypes:true})){
        if(child.name.startsWith('.')||child.isSymbolicLink()||child.name==='asset.json')continue;
        const name=dir?`${dir}/${child.name}`:child.name;
        if(child.isDirectory())await walk(name,depth+1);
        else if(child.isFile()){
          const f=await resolveEntry(this.root,`${rel}/${name}`,['assets']);
          const tagged=roles.get(name)||{};files.push({path:name,role:tagged.role||inferRole(name),label:tagged.label||child.name,rel:f.rel,size:f.stat.size,modified:f.stat.mtimeMs,ext:path.extname(name).slice(1).toLowerCase(),...(tagged.sha256?{sha256:tagged.sha256}:{})});
        }
      }
    };await walk('');
    const primary=files.find(f=>f.path===meta.primary)||files.find(f=>f.role==='model'&&f.ext==='glb')||files.find(f=>['model','rig','animation'].includes(f.role))||files[0];
    const preview=files.find(f=>f.path===meta.preview&&IMAGE.test(f.path))||files.find(f=>f.role==='preview'&&IMAGE.test(f.path))||files.find(f=>f.role==='reference'&&IMAGE.test(f.path))||files.find(f=>IMAGE.test(f.path));
    let technical=null;
    if(primary?.ext==='glb'){
      const key=`${primary.rel}:${primary.size}:${primary.modified}`;
      try{technical=this.glbCache.get(key)||await glbInfo((await resolveEntry(this.root,primary.rel,['assets'])).full);this.glbCache.set(key,technical);}catch{technical={error:'This GLB could not be inspected. Download it to check in your 3D editor.'};}
    }
    if(this.glbCache.size>20000)this.glbCache.clear();
    const id=crypto.createHash('sha256').update(rel).digest('hex').slice(0,24);
    return {...meta,id,rel,importKey:/^[a-f0-9]{64}$/.test(raw.importKey||'')?raw.importKey:'',created:raw.created||manifest.stat.birthtimeMs,modified:manifest.stat.mtimeMs,revision:crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex').slice(0,24),files,primary:primary?.path||'',preview:preview?.path||'',previewRole:preview?.role||'',size:files.reduce((n,f)=>n+f.size,0),fileCount:files.length,technical,rigged:!!technical?.bones,animated:!!technical?.clips?.length||files.some(f=>f.role==='animation')};
  }
  async list(query={}){
    await this.scan();let rows=[...this.items.values()].filter(r=>query.trash==='1'?!!r.trashedAt:!r.trashedAt);
    const facets={};for(const field of ['kind','category','style','collection'])facets[field]=[...new Set(rows.map(r=>r[field]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const words=text(query.q,300).toLowerCase().split(/\s+/).filter(Boolean);
    rows=rows.filter(r=>['category','style','collection','status','sourceAssetId'].every(k=>!query[k]||r[k]===query[k])&&matchesKind(r,query.kind,query.belongs)&&(!query.rig||r[query.rig]===true)&&(!query.format||r.files.some(f=>f.ext===query.format))&&(!query.ids||query.ids.split(',').includes(r.id))&&words.every(w=>`${r.name} ${r.description} ${r.category} ${r.style} ${r.collection} ${r.tags.join(' ')} ${r.files.map(f=>f.path).join(' ')}`.toLowerCase().includes(w)));
    const sort=query.sort||'name';rows.sort((a,b)=>sort==='newest'?b.created-a.created:sort==='size'?b.size-a.size:a.name.localeCompare(b.name,undefined,{numeric:true}));
    const total=rows.length,limit=Math.min(96,Math.max(1,Number(query.limit)||48)),offset=Math.max(0,Number(query.offset)||0);
    return {items:rows.slice(offset,offset+limit).map(({files,notes,provenance,importKey,...r})=>({...r,containedKinds:containedKinds({...r,files})})),total,libraryTotal:[...this.items.values()].filter(r=>!r.trashedAt).length,trashTotal:[...this.items.values()].filter(r=>r.trashedAt).length,offset,limit,facets,issues:this.errors};
  }
  async get(id){if(!/^[a-f0-9]{24}$/.test(id))throw fail('Asset not found.',404);await this.scan();const item=this.items.get(id);if(!item)throw fail('Asset not found.',404);return item;}
  async write(rel,data){
    const folder=await resolveEntry(this.root,rel,['assets']);
    const temp=path.join(folder.full,`.asset-${crypto.randomBytes(8).toString('hex')}.tmp`);
    try{await fs.writeFile(temp,JSON.stringify(data,null,2),{flag:'wx'});await fs.rename(temp,path.join(folder.full,'asset.json'));}finally{await fs.rm(temp,{force:true});}
    this.invalidate();
  }
  create(input){return this.exclusive(async()=>{
    const meta=metadata(input);await this.scan();
    const key=/^[a-f0-9]{64}$/.test(input.importKey||'')?input.importKey:typeof input.importIdentity==='string'&&input.importIdentity.length<=1024*1024?crypto.createHash('sha256').update(input.importIdentity).digest('hex'):'';
    if(meta.sourceAssetId){
      const matches=[...this.items.values()].filter(r=>r.sourceAssetId===meta.sourceAssetId&&r.collection===meta.collection);
      if(matches.length>1)throw fail('More than one asset has this source ID and collection. Resolve duplicates before importing.',409);
      if(matches.length){if(matches[0].trashedAt)throw fail('This asset is in Trash. Restore or permanently delete it before importing.',409);const current=await this.readPackage(matches[0].rel);this.items.set(current.id,current);return {...current,existing:true};}
    }
    if(key&&!meta.sourceAssetId){const existing=[...this.items.values()].find(r=>r.importKey===key);if(existing){const current=await this.readPackage(existing.rel);this.items.set(current.id,current);return {...current,existing:true};}}
    const slug=meta.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'asset';
    const rel=`assets/${slug}-${crypto.randomBytes(5).toString('hex')}`;
    await resolveEntry(this.root,'assets',['assets']);await fs.mkdir(path.join(this.root,rel));
    await this.write(rel,{...meta,status:'draft',created:Date.now(),importKey:key});
    const record=await this.readPackage(rel);this.items.set(record.id,record);this.loaded=Date.now();return record;
  });}
  update(id,input){return this.exclusive(async()=>{
    const item=await this.get(id);const current=await this.readPackage(item.rel);
    if(input.revision!==current.revision)throw fail('This asset changed in another window. Reopen it and try again.',409);
    const meta=metadata({...current,...input,files:input.files||current.files});
    if(meta.primary&&!current.files.some(f=>f.path===meta.primary))throw fail('Choose an existing main file.');
    if(meta.preview&&!current.files.some(f=>f.path===meta.preview&&IMAGE.test(f.path)))throw fail('Choose an existing PNG, JPEG, WebP or AVIF preview.');
    await this.write(item.rel,{...meta,importKey:current.importKey,created:current.created});const record=await this.readPackage(item.rel);this.items.set(record.id,record);this.loaded=Date.now();return record;
  });}
  bulk(input){return this.exclusive(async()=>{
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>200)throw fail('Select between 1 and 200 assets.');
    if(!['edit','trash','restore'].includes(input.action))throw fail('Unknown bulk action.');
    const seen=new Set(),records=[];
    for(const selected of input.items){
      if(seen.has(selected.id))throw fail('Duplicate asset selection.');seen.add(selected.id);
      const item=await this.get(selected.id),current=await this.readPackage(item.rel);
      if(selected.revision!==current.revision)throw fail('An asset changed since selection. Refresh and select it again.',409);
      records.push(current);
    }
    const changes=input.changes||{},allowed=['category','style','collection','status','addTags','removeTags'];
    if(Object.keys(changes).some(k=>!allowed.includes(k)))throw fail('Unsupported bulk field.');
    if(changes.status&&!['review','ready'].includes(changes.status))throw fail('Invalid review status.');
    const completed=[],errors=[];
    for(const current of records){try{
      const next={...current};
      if(input.action==='trash')next.trashedAt=Date.now();
      else if(input.action==='restore')next.trashedAt=0;
      else{
        for(const key of ['category','style','collection','status'])if(Object.hasOwn(changes,key))next[key]=changes[key];
        const additions=Array.isArray(changes.addTags)?changes.addTags:[],removals=new Set(Array.isArray(changes.removeTags)?changes.removeTags:[]);
        next.tags=[...new Set([...current.tags,...additions])].filter(t=>!removals.has(t));
      }
      await this.write(current.rel,{...metadata(next),created:current.created,importKey:current.importKey});
      const updated=await this.readPackage(current.rel);this.items.set(updated.id,updated);completed.push(updated.id);
    }catch(e){errors.push({id:current.id,name:current.name,message:'Could not save this asset. Retry after checking storage.'});}}
    this.loaded=Date.now();return {completed,errors};
  });}
  remove(id,revision){return this.exclusive(async()=>{
    const item=await this.get(id),current=await this.readPackage(item.rel);
    if(revision!==current.revision)throw fail('This asset changed. Reopen it before deleting.',409);
    const folder=await resolveEntry(this.root,current.rel,['assets']);
    const shelf=path.resolve(this.root,'assets'),target=path.resolve(folder.full);
    if(!folder.stat.isDirectory()||!target.startsWith(shelf+path.sep))throw fail('Invalid asset package.');
    await fs.rm(target,{recursive:true,force:false});
    this.items.delete(id);this.invalidate();return {id,name:current.name,deletedFiles:current.fileCount};
  });}
  async favoriteData(){
    try{return await readJson(path.join(this.root,'.asset-favorites.json'),16*1024*1024);}
    catch(e){if(e.code==='ENOENT')return {};throw e;}
  }
  favoriteKey(user){return crypto.createHash('sha256').update(user).digest('hex');}
  async favorites(user){
    const data=await this.favoriteData();await this.scan();
    return (data[this.favoriteKey(user)]||[]).filter(id=>this.items.has(id));
  }
  saveFavorites(user,{id,saved,ids}){return this.exclusive(async()=>{
    const data=await this.favoriteData(),key=this.favoriteKey(user);await this.scan();
    const selected=new Set((data[key]||[]).filter(v=>this.items.has(v)));
    if(ids!==undefined){
      if(!Array.isArray(ids)||ids.length>10000||ids.some(v=>typeof v!=='string'||!/^[a-f0-9]{24}$/.test(v)))throw fail('Invalid saved assets.');
      for(const value of ids)if(this.items.has(value))selected.add(value);
    }else{
      await this.get(id);if(typeof saved!=='boolean')throw fail('Choose whether to save this asset.');
      saved?selected.add(id):selected.delete(id);
    }
    if(selected.size>10000)throw fail('You can save up to 10,000 assets.');
    data[key]=[...selected];const target=path.join(this.root,'.asset-favorites.json'),temp=path.join(this.root,'.asset-favorites-'+crypto.randomBytes(8).toString('hex')+'.tmp');
    try{await fs.writeFile(temp,JSON.stringify(data),{flag:'wx'});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}
    return data[key];
  });}
  finish(id){return this.exclusive(async()=>{
    const old=await this.get(id),current=await this.readPackage(old.rel);
    if(!current.files.length)throw fail('No files uploaded yet. Choose the same files to resume.');
    const manifest=await readJson(path.join(this.root,current.rel,'asset.json'));
    const missing=(manifest.files||[]).filter(f=>!current.files.some(x=>x.path===f.path));
    if(missing.length)throw fail(`${missing.length} package files are missing. Choose the same folder to resume.`);
    await this.write(current.rel,{...metadata(current),created:current.created,importKey:current.importKey,status:'review'});const record=await this.readPackage(current.rel);this.items.set(record.id,record);this.loaded=Date.now();return record;
  });}
}
function mountAssetRoutes(app,{root,auth,canUse,note}){
  const library=new AssetLibrary(root);
  const access=(req,res,next)=>{res.setHeader('Cache-Control','private, no-store');return canUse(req.user,'assets')?next():res.status(404).json({error:'Asset library unavailable for this account.'});};
  const route=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){res.status(e.status||400).json({error:e.status?e.message:'Could not complete this asset action. Check that storage is available.'});}};
  app.get('/api/assets',auth,access,route(async(req,res)=>res.json(await library.list({...req.query,...(req.query.saved==='1'?{ids:(await library.favorites(req.user.name)).join(',')||'none'}:{})}))));
  app.post('/api/assets/refresh',auth,access,route(async(req,res)=>{await library.scan(true);res.json({total:library.items.size,issues:library.errors});}));
  app.post('/api/assets',auth,access,route(async(req,res)=>{const item=await library.create(req.body);note(req.user.name,'asset-create',item.name);res.status(item.existing?200:201).json(item);}));
  app.post('/api/assets/bulk',auth,access,route(async(req,res)=>{const result=await library.bulk(req.body);note(req.user.name,'asset-'+req.body.action,result.completed.length+' assets');res.json(result);}));
  app.get('/api/assets/favorites',auth,access,route(async(req,res)=>res.json({ids:await library.favorites(req.user.name)})));
  app.post('/api/assets/favorites',auth,access,route(async(req,res)=>res.json({ids:await library.saveFavorites(req.user.name,{ids:req.body.ids})})));
  app.put('/api/assets/:id/favorite',auth,access,route(async(req,res)=>res.json({ids:await library.saveFavorites(req.user.name,{id:req.params.id,saved:req.body.saved})})));
  app.delete('/api/assets/:id',auth,access,route(async(req,res)=>{const result=await library.remove(req.params.id,req.body.revision);note(req.user.name,'asset-delete',result.name);res.json(result);}));
  app.get('/api/assets/:id',auth,access,route(async(req,res)=>res.json(await library.readPackage((await library.get(req.params.id)).rel))));
  app.patch('/api/assets/:id',auth,access,route(async(req,res)=>{const item=await library.update(req.params.id,req.body);note(req.user.name,'asset-edit',item.name);res.json(item);}));
  app.post('/api/assets/:id/finish',auth,access,route(async(req,res)=>res.json(await library.finish(req.params.id))));
  return library;
}
module.exports={AssetLibrary,mountAssetRoutes,metadata,relative,inferRole,glbInfo};

