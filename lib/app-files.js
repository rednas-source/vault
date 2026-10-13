'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),express=require('express');
const {resolveEntry}=require('./archive');
const catalog=require('./artcraft-catalog.json');
const MAX=512*1024**2,CHUNK=4*1024**2;
const error=(message,status=400)=>Object.assign(Error(message),{status});
const revision=stat=>`${stat.mtimeMs}:${stat.size}`;
function filename(name){if(typeof name!=='string'||!name.trim()||name!==name.trim()||name.startsWith('.')||/[. ]$/.test(name)||/[<>:"/\\|?*\x00-\x1f]/.test(name)||name.length>180||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))throw error('Use a file name without path separators or special characters.');return name;}
function mountAppFiles(app,{root,auth,canUse,note=()=>{}}){
 const uploads=new Map(),locks=new Map(),scratch=path.join(root,'.app-file-uploads');let lastSweep=0;
 const route=fn=>(req,res)=>Promise.resolve().then(()=>fn(req,res)).catch(e=>{if(!res.headersSent)res.status(e.status||500).json({error:e.status?e.message:'Could not save the file. Keep this editor open and retry.'});});
 const permission=(req,res,next)=>{if(!canUse(req.user,'app-files'))return res.status(403).json({error:'Your account needs access to the App files shelf.'});next();};
 const guard=[auth,permission];
 async function directory(id){const app=catalog.find(a=>a.id===id);if(!app)throw error('Unknown app.',404);await resolveEntry(root,'app-files',['app-files']);const rel='app-files/'+app.name;try{await fs.mkdir(path.join(root,rel));}catch(e){if(e.code!=='EEXIST')throw e;}const dir=await resolveEntry(root,rel,['app-files']);if(!dir.stat.isDirectory())throw error('The app folder is unavailable.',409);return dir;}
 async function entry(id,name){const dir=await directory(id);try{const e=await resolveEntry(root,dir.rel+'/'+filename(name),['app-files']);if(!e.stat.isFile())throw error('Not a file.',404);return e;}catch(e){if(e.status)throw e;throw error('File missing or unavailable.',404);}}
 function upload(req){const u=uploads.get(req.params.upload);if(!u||u.user!==req.user.name||u.app!==req.params.id||Date.now()-u.updated>3600000)throw error('Save session expired. Retry saving.',404);return u;}
 async function serial(key,fn){const old=locks.get(key)||Promise.resolve();const current=old.catch(()=>{}).then(fn);locks.set(key,current);try{return await current;}finally{if(locks.get(key)===current)locks.delete(key);}}
 app.get('/api/artcraft/:id/files',...guard,route(async(req,res)=>{const dir=await directory(req.params.id),files=[];for(const f of await fs.readdir(dir.full,{withFileTypes:true})){if(!f.isFile()||f.name.startsWith('.'))continue;const e=await entry(req.params.id,f.name);files.push({name:f.name,rel:e.rel,size:e.stat.size,modified:e.stat.mtimeMs,revision:revision(e.stat)});}res.set('Cache-Control','no-store').json({files:files.sort((a,b)=>b.modified-a.modified).slice(0,500)});}));
 app.get('/api/artcraft/:id/file',...guard,route(async(req,res)=>{const e=await entry(req.params.id,req.query.name);res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Vault-Revision':revision(e.stat)}).type('application/octet-stream');res.attachment(path.basename(e.full));res.sendFile(e.full);}));
 app.post('/api/artcraft/:id/saves',...guard,route(async(req,res)=>{
  const dir=await directory(req.params.id),name=filename(req.body.name),size=req.body.size,base=req.body.revision;
  if(!Number.isSafeInteger(size)||size<1||size>MAX)throw error('App files must be between 1 byte and 512 MB.');
  if(base!=null&&typeof base!=='string')throw error('Invalid file revision.');
  await fs.mkdir(scratch,{recursive:true});
  for(const [id,u]of uploads)if(Date.now()-u.updated>3600000&&!u.busy){uploads.delete(id);await fs.unlink(u.temp).catch(()=>{});}
  if(Date.now()-lastSweep>3600000){lastSweep=Date.now();for(const f of await fs.readdir(scratch,{withFileTypes:true})){if(!f.isFile()||! /^[a-f0-9-]{36}\.part$/.test(f.name)||uploads.has(f.name.slice(0,-5)))continue;const file=path.join(scratch,f.name),stat=await fs.stat(file);if(Date.now()-stat.mtimeMs>3600000)await fs.unlink(file).catch(()=>{});}}
  if([...uploads.values()].filter(u=>u.user===req.user.name).length>=4)throw error('Too many saves in progress. Retry shortly.',429);
  const id=crypto.randomUUID(),temp=path.join(scratch,id+'.part');await fs.writeFile(temp,'',{flag:'wx',mode:0o600});
  uploads.set(id,{user:req.user.name,app:req.params.id,name,size,base,dir:dir.rel,temp,offset:0,updated:Date.now(),busy:false});res.status(201).json({id,chunkSize:CHUNK});
 }));
 app.post('/api/artcraft/:id/saves/:upload/chunk',...guard,express.raw({type:'application/octet-stream',limit:CHUNK}),route(async(req,res)=>{const u=upload(req);if(u.busy)throw error('A save chunk is still being written.',409);if(Number(req.query.offset)!==u.offset)throw error('Save offset changed. Retry the save.',409);if(!Buffer.isBuffer(req.body)||!req.body.length||u.offset+req.body.length>u.size)throw error('Invalid save chunk.');u.busy=true;try{await fs.appendFile(u.temp,req.body);u.offset+=req.body.length;u.updated=Date.now();res.json({offset:u.offset});}finally{u.busy=false;}}));
 app.post('/api/artcraft/:id/saves/:upload/finish',...guard,route(async(req,res)=>{const u=upload(req);if(u.busy||u.offset!==u.size)throw error('The save is not complete.',409);u.busy=true;try{
  const saved=await serial(u.dir,async()=>{
   const dir=await directory(u.app);let name=u.name,target=path.join(dir.full,name);
   if(u.base!=null){const e=await entry(u.app,name);if(revision(e.stat)!==u.base)throw error('This file changed in another editor. Save a copy to keep both versions.',409);await fs.rename(u.temp,target);}
   else{const parsed=path.parse(name);for(let n=0;;n++){name=n?`${parsed.name} (${n+1})${parsed.ext}`:u.name;target=path.join(dir.full,name);try{await fs.link(u.temp,target);await fs.unlink(u.temp);break;}catch(e){if(e.code!=='EEXIST')throw e;if(n>=999)throw error('Too many files with this name. Choose another name.',409);}}}
   const stat=await fs.stat(target);return {name,rel:dir.rel+'/'+name,size:stat.size,revision:revision(stat),modified:stat.mtimeMs};
  });uploads.delete(req.params.upload);note(req.user.name,'app-save',saved.rel);res.json(saved);
 }finally{u.busy=false;}}));
 app.delete('/api/artcraft/:id/saves/:upload',...guard,route(async(req,res)=>{const u=upload(req);if(u.busy)throw error('Save still in progress.',409);uploads.delete(req.params.upload);await fs.unlink(u.temp).catch(()=>{});res.json({ok:true});}));
}
module.exports={mountAppFiles,filename};
