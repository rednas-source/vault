'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),express=require('express');
const {metadata,relative}=require('./assets');
const {resolveEntry}=require('./archive');
const LINK_BYTES=20*1024**3,PACKAGE_BYTES=10*1024**3;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function mountAssetIntake(app,{root,library,resolveShare,allowedForOwner,saveShares,note=()=>{}}){
 const pending=path.join(root,'.asset-incoming'),locks=new Map();
 const serial=(id,fn)=>{const run=(locks.get(id)||Promise.resolve()).catch(()=>{}).then(fn);locks.set(id,run);return run.finally(()=>{if(locks.get(id)===run)locks.delete(id);});};
 function context(id){const r=resolveShare(id);if(r.error||!r.share||!['asset','asset-upload'].includes(r.share.kind)||!allowedForOwner(r.share.by).includes('assets'))throw fail('This link is unavailable or has expired.',410);return r.share;}
 function writable(id){const s=context(id);if(s.kind!=='asset-upload'&&!s.allowAssetUpload)throw fail('Uploads are not enabled for this link.',403);return s;}
 async function directory(){await fs.mkdir(pending,{recursive:true});const s=await fs.lstat(pending);if(!s.isDirectory()||s.isSymbolicLink())throw fail('Upload storage is unavailable.',503);}
 async function read(id,shareId){writable(shareId);if(!/^[a-f0-9]{32}$/.test(id))throw fail('Upload not found.',404);await directory();const full=path.join(pending,id);const st=await fs.lstat(full).catch(()=>null);if(!st?.isDirectory()||st.isSymbolicLink())throw fail('Upload not found.',404);const m=JSON.parse(await fs.readFile(path.join(full,'session.json'),'utf8'));if(m.shareId!==shareId)throw fail('Upload not found.',404);return {m,full};}
 const write=(full,m)=>fs.writeFile(path.join(full,'session.json'),JSON.stringify(m));
 const route=fn=>async(req,res)=>{res.setHeader('Cache-Control','private, no-store');try{await fn(req,res);}catch(e){if(!res.headersSent)res.status(e.status||500).json({error:e.status?e.message:'The upload could not be completed. Please retry.'});}};
 app.get('/api/share/:id/asset/info',route(async(req,res)=>{const s=context(req.params.id);res.json({uploadOnly:s.kind==='asset-upload',uploads:s.kind==='asset-upload'||!!s.allowAssetUpload,maxBytes:LINK_BYTES,remainingBytes:Math.max(0,LINK_BYTES-(s.uploadBytes||0))});}));
 app.post('/api/share/:id/asset/intake',route(async(req,res)=>serial(req.params.id,async()=>{
  const s=writable(req.params.id),raw=req.body,files=raw.files;if(!Array.isArray(files)||!files.length||files.length>1000)throw fail('Choose between 1 and 1,000 connected files per asset.');
  const paths=new Set();let total=0;for(const f of files){relative(f.path);const lower=f.path.toLowerCase();if(lower==='asset.json'||lower.endsWith('/asset.json')||paths.has(lower)||f.path.split('/').some(p=>p.endsWith('.')||p.endsWith(' ')||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p)))throw fail('The package contains duplicate or reserved paths.');paths.add(lower);if(!Number.isSafeInteger(f.size)||f.size<0)throw fail('Invalid file size.');total+=f.size;}
  for(const name of paths){let parent=name;while(parent.includes('/')){parent=parent.slice(0,parent.lastIndexOf('/'));if(paths.has(parent))throw fail('A file path conflicts with a folder path.');}}
  if(total>PACKAGE_BYTES||!Number.isSafeInteger(total))throw fail('Each asset may contain up to 10 GB.');if((s.uploadBytes||0)+total>LINK_BYTES||(s.uploadCount||0)>=200)throw fail('This upload link has reached its limit. Ask the owner for a new link.',413);
  const id=crypto.randomBytes(16).toString('hex'),meta=metadata({...raw,sourceAssetId:'external-'+id,collection:'External assets',trashedAt:0,status:'review',source:'External upload',files});
  await directory();const full=path.join(pending,id);await fs.mkdir(full);const m={shareId:req.params.id,created:Date.now(),meta,files:files.map(f=>({path:f.path,size:f.size})),total};await write(full,m);for(let i=0;i<m.files.length;i++)if(m.files[i].size===0)await fs.writeFile(path.join(full,String(i)),Buffer.alloc(0));s.uploadBytes=(s.uploadBytes||0)+total;s.uploadCount=(s.uploadCount||0)+1;saveShares();res.status(201).json({id,chunkBytes:4*1024**2});
 })));
 app.get('/api/share/:id/asset/intake/:upload',route(async(req,res)=>{const {m,full}=await read(req.params.upload,req.params.id);const received=await Promise.all(m.files.map((f,i)=>fs.stat(path.join(full,String(i))).then(s=>s.size).catch(()=>0)));res.json({received,completed:!!m.completed});}));
 app.put('/api/share/:id/asset/intake/:upload/:file',express.raw({type:'application/octet-stream',limit:'4mb'}),route(async(req,res)=>serial(req.params.upload,async()=>{
  const {m,full}=await read(req.params.upload,req.params.id);if(m.completed)throw fail('This asset is already submitted.',409);const i=Number(req.params.file),f=m.files[i];if(!Number.isInteger(i)||i<0||!f)throw fail('Unknown file.',404);if(!Buffer.isBuffer(req.body))throw fail('Expected file bytes.');const file=path.join(full,String(i)),st=await fs.lstat(file).catch(()=>null);if(st?.isSymbolicLink())throw fail('Invalid upload.',400);const received=st?.size||0;if(Number(req.query.offset)!==received)throw fail('Upload offset changed. Retry the upload.',409);if(received+req.body.length>f.size)throw fail('File exceeds its declared size.');await fs.appendFile(file,req.body);res.json({received:received+req.body.length});
 })));
 app.post('/api/share/:id/asset/intake/:upload/finish',route(async(req,res)=>serial(req.params.upload,async()=>{
  const {m,full}=await read(req.params.upload,req.params.id);if(m.completed)return res.json({ok:true,name:m.meta.name});
  for(let i=0;i<m.files.length;i++){const st=await fs.lstat(path.join(full,String(i))).catch(()=>null);if(!st?.isFile()||st.isSymbolicLink()||st.size!==m.files[i].size)throw fail('Some files are incomplete. Retry the upload.',409);}
  const asset=await library.create(m.meta,{external:true});
  for(let i=0;i<m.files.length;i++){const f=m.files[i],parts=f.path.split('/');let parent=asset.rel;for(const part of parts.slice(0,-1)){parent+='/'+part;await fs.mkdir(path.join(root,parent)).catch(e=>{if(e.code!=='EEXIST')throw e;});await resolveEntry(root,parent,['assets']);}const target=path.join(root,asset.rel,f.path);try{await fs.copyFile(path.join(full,String(i)),target,require('node:fs').constants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;const old=await resolveEntry(root,asset.rel+'/'+f.path,['assets']);if(old.stat.size!==f.size)throw fail('A submitted file changed. Contact the owner.',409);}}
  writable(req.params.id);await library.finish(asset.id);m.completed=true;await write(full,m);for(let i=0;i<m.files.length;i++)await fs.unlink(path.join(full,String(i)));note('share:'+req.params.id.slice(0,8),'asset-upload',asset.rel);res.json({ok:true,name:asset.name});
 })));
 return {context,LINK_BYTES};
}
module.exports={mountAssetIntake,LINK_BYTES};
