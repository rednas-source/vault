'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const catalog=require('./artcraft-catalog.json');
const MAX_ZIP=160*1024**2,MAX_FILES=5000,MAX_EXPANDED=600*1024**2;
const fail=(message,status=400)=>Object.assign(Error(message),{status});
// Module workers need a blob entry point in an opaque-origin frame. Imports still
// resolve against the verified bundle, and CSP prevents requests outside it.
function browserBootstrap(bundle){return `<script>(()=>{const NativeWorker=window.Worker,base=${JSON.stringify(bundle).replaceAll('<','\\u003c')};window.Worker=class extends NativeWorker{constructor(url,options){const target=new URL(url,location.href);let entry;if(options?.type==='module'&&target.href.startsWith(base)){entry=URL.createObjectURL(new Blob(['import '+JSON.stringify(target.href)+';'],{type:'text/javascript'}));}super(entry||url,options);if(entry){const release=()=>URL.revokeObjectURL(entry);this.addEventListener('error',release,{once:true});setTimeout(release,60000);}}};})();</script>`;}
function releaseAsset(id,url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='github.com'&&!u.username&&!u.password&&u.pathname.startsWith('/storytold/'+id+'/releases/download/');}catch{return false;}}
function cleanRelease(id,value){
 if(!/^v?[\w.-]{1,64}$/.test(value.tag_name||''))throw fail('Invalid release version.');
 const assets=(value.assets||[]).filter(a=>releaseAsset(id,a.browser_download_url)&&Number.isSafeInteger(a.size)&&a.size>0).map(a=>({name:a.name,url:a.browser_download_url,size:a.size,digest:a.digest}));
 return {tag:value.tag_name,published:value.published_at,url:'https://github.com/storytold/'+id+'/releases/tag/'+encodeURIComponent(value.tag_name),assets};
}
async function bytes(url,max,fetcher=fetch){
 const res=await fetcher(url,{signal:AbortSignal.timeout(180000),headers:{'User-Agent':'Vault-ArtCraft','Accept':'application/octet-stream'}});
 if(!res.ok)throw fail('Official download failed ('+res.status+'). Try again.',502);
 if(Number(res.headers.get('content-length'))>max)throw fail('Download exceeds the size limit.');
 let size=0;const chunks=[];for await(const chunk of res.body){size+=chunk.length;if(size>max)throw fail('Download exceeds the size limit.');chunks.push(chunk);}return Buffer.concat(chunks);
}
async function extractWeb(buffer,destination){
 const {ZipReader,Uint8ArrayReader,Uint8ArrayWriter}=require('@zip.js/zip.js');
 const zip=new ZipReader(new Uint8ArrayReader(buffer),{useWebWorkers:false});
 try{
  const entries=await zip.getEntries();if(entries.length>MAX_FILES)throw fail('Too many files in web build.');
  let total=0;const seen=new Set();
  for(const entry of entries){
   const name=entry.filename,parts=name.split('/');
   if(!name||name.includes('\\')||name.startsWith('/')||parts.some(p=>p==='..'||p==='.'||/[\x00-\x1f:]/.test(p)||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))||entry.encrypted||((entry.externalFileAttributes>>>16)&0xf000)===0xa000)throw fail('Unsafe file in web build.');
   const key=name.toLowerCase();if(seen.has(key))throw fail('Duplicate file in web build.');seen.add(key);
   total+=entry.uncompressedSize;if(!Number.isSafeInteger(total)||total>MAX_EXPANDED||entry.uncompressedSize>MAX_ZIP*3)throw fail('Expanded web build is too large.');
  }
  for(const entry of entries){const file=path.join(destination,entry.filename);if(entry.directory){await fs.mkdir(file,{recursive:true});continue;}await fs.mkdir(path.dirname(file),{recursive:true});const data=await entry.getData(new Uint8ArrayWriter(),{checkSignature:true});if(data.length!==entry.uncompressedSize)throw fail('Invalid file size.');await fs.writeFile(file,data,{flag:'wx'});}
  const index=entries.filter(e=>!e.directory&&/(^|\/)index\.html$/.test(e.filename)).sort((a,b)=>a.filename.split('/').length-b.filename.split('/').length)[0];
  if(!index||!entries.some(e=>e.filename.endsWith('.wasm')))throw fail('Release does not contain a runnable web build.');
  return path.dirname(index.filename).replaceAll('\\','/');
 }finally{await zip.close();}
}
function createArtcraft(directory,{fetcher=fetch}={}){
 let records={},checkedAt=0,checking=null;const jobs=new Map(),tickets=new Map();
 const stateFile=path.join(directory,'releases.json');
 const ready=fs.readFile(stateFile,'utf8').then(s=>{const d=JSON.parse(s);records=d.records||{};checkedAt=d.checkedAt||0;}).catch(e=>{if(e.code!=='ENOENT')throw e;});
 let writes=Promise.resolve();
 const save=()=>{writes=writes.catch(()=>{}).then(async()=>{await fs.mkdir(directory,{recursive:true});const file=stateFile+'.tmp';await fs.writeFile(file,JSON.stringify({records,checkedAt}),{mode:0o600});await fs.rename(file,stateFile);});return writes;};
 const info=id=>{const app=catalog.find(a=>a.id===id);if(!app)throw fail('App not found.',404);return app;};
 const record=id=>records[id]||(records[id]={});
 async function list(){await ready;return {checkedAt,checking:!!checking,apps:catalog.map(app=>{const r=record(app.id),release=r.release||app.release;return {...app,release,installed:r.installed?.tag||null,updateAvailable:!!r.installed&&r.installed.tag!==release.tag,status:jobs.has(app.id)?'installing':r.error?'error':r.installed?'ready':'available',error:r.error||'',url:r.installed?'/api/artcraft/'+app.id+'/launch':null};})};}
 async function check(){await ready;if(checking)return checking;if(checkedAt&&Date.now()-checkedAt<60000)return list();
  checking=(async()=>{for(const app of catalog){try{const res=await fetcher('https://api.github.com/repos/storytold/'+app.id+'/releases/latest',{headers:{Accept:'application/vnd.github+json','User-Agent':'Vault-ArtCraft'},signal:AbortSignal.timeout(20000)});if(!res.ok)throw fail('Update check failed ('+res.status+'). Try again later.');record(app.id).release=cleanRelease(app.id,await res.json());delete record(app.id).error;}catch(e){record(app.id).error=e.message;}}checkedAt=Date.now();await save();})();
  try{await checking;}finally{checking=null;}return list();
 }
 async function install(id){await ready;const app=info(id);if(jobs.has(id))return jobs.get(id);if(jobs.size>=2)throw fail('Two apps are being prepared. Try again shortly.',429);
  const job=(async()=>{const r=record(id),release=r.release||app.release;if(r.installed?.tag===release.tag)return;
   const asset=release.assets.find(a=>new RegExp('^'+id+'-web-[\\w.-]+\\.zip$').test(a.name));
   if(!asset)throw fail('This release has no browser build. Use the desktop download.');
   if(!releaseAsset(id,asset.url)||asset.size>MAX_ZIP||!/^sha256:[a-f0-9]{64}$/.test(asset.digest||''))throw fail('The web build has no verifiable SHA-256 digest. Keeping the current version.');
   const staging=path.join(directory,'staging-'+crypto.randomUUID());
   try{const archive=await bytes(asset.url,MAX_ZIP,fetcher);if(archive.length!==asset.size||'sha256:'+crypto.createHash('sha256').update(archive).digest('hex')!==asset.digest)throw fail('Download verification failed. Keeping the current version.');
    await fs.mkdir(staging,{recursive:true});const entry=await extractWeb(archive,staging);const folder=id+'-'+crypto.randomUUID();await fs.rename(staging,path.join(directory,folder));
    r.installed={tag:release.tag,folder,entry};delete r.error;await save();
   }catch(e){r.error=e.message;await save();throw e;}finally{await fs.rm(staging,{recursive:true,force:true});}
  })();jobs.set(id,job);try{await job;}catch(e){record(id).error=e.message;await save();throw e;}finally{jobs.delete(id);}
 }
 async function launch(id){await ready;info(id);const installed=record(id).installed;if(!installed)throw fail('Prepare the browser app first.',409);const token=crypto.randomBytes(24).toString('base64url');for(const [key,t]of tickets)if(t.expires<Date.now())tickets.delete(key);tickets.set(token,{...installed,expires:Date.now()+86400000});return '/api/share/artcraft/'+token+'/?nosw=1';}
 function ticket(token){const t=tickets.get(token);if(!t||t.expires<Date.now())throw fail('This app session expired. Reopen it from Apps.',410);return t;}
 return {list,check,install,launch,ticket,directory};
}
function mountArtcraft(app,{root,auth,adminOnly}){
 const store=createArtcraft(path.join(root,'.artcraft'));
 const route=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res)).catch(e=>{if(!res.headersSent)res.status(e.status||500).json({error:e.message||'App request failed.'});else next(e);});
 app.get('/api/artcraft',auth,route(async(req,res)=>{res.set('Cache-Control','no-store');const data=await store.list();res.json(data);if(Date.now()-data.checkedAt>21600000)void store.check().catch(()=>{});}));
 const sameSite=(req,res,next)=>{if(req.get('Sec-Fetch-Site')==='cross-site')return res.sendStatus(403);try{if(req.get('Origin')&&new URL(req.get('Origin')).host!==req.get('host'))return res.sendStatus(403);}catch{return res.sendStatus(403);}next();};
 app.post('/api/artcraft/check',auth,adminOnly,sameSite,route(async(req,res)=>{res.json(await store.check());}));
 app.post('/api/artcraft/:id/install',auth,adminOnly,sameSite,route(async(req,res)=>{const listing=await store.list();if(!listing.apps.some(a=>a.id===req.params.id))throw fail('App not found.',404);void store.install(req.params.id).catch(()=>{});res.status(202).json({status:'installing'});}));
 app.post('/api/artcraft/:id/launch',auth,sameSite,route(async(req,res)=>{res.json({url:await store.launch(req.params.id)});}));
 app.get('/api/share/artcraft/:token/*',route(async(req,res)=>{
  const t=store.ticket(req.params.token),rel=req.params[0]||'index.html';
  if(rel.split('/').some(p=>p==='..'||p.startsWith('.'))||rel.includes('\\')||rel.includes(':'))return res.sendStatus(404);
  const dir=path.join(store.directory,t.folder,t.entry),file=path.resolve(dir,rel);
  if(!file.startsWith(path.resolve(dir)+path.sep))return res.sendStatus(404);
  // Opaque-origin sandbox: downloaded apps cannot read Vault cookies, DOM or APIs.
  const bundle=req.protocol+'://'+req.get('host')+'/api/share/artcraft/'+encodeURIComponent(req.params.token)+'/';
  res.set({'Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin','Cache-Control':'private, max-age=86400','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':`sandbox allow-scripts allow-downloads allow-modals; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' ${bundle} blob:; style-src 'unsafe-inline' ${bundle}; img-src data: blob: ${bundle}; font-src data: ${bundle}; connect-src ${bundle} blob:; worker-src blob:; media-src blob: data:; frame-src 'none'; form-action 'none'; base-uri 'none'`});
  if(path.extname(file)==='.html'){
   let html;try{html=await fs.readFile(file,'utf8');}catch{return res.sendStatus(404);}
   const bootstrap=browserBootstrap(bundle);res.type('html').send(/<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,head=>head+bootstrap):bootstrap+html);return;
  }
  res.sendFile(file,error=>{if(error&&!res.headersSent)res.sendStatus(404);});
 }));
 return store;
}
module.exports={createArtcraft,mountArtcraft,extractWeb,cleanRelease,releaseAsset,browserBootstrap};
