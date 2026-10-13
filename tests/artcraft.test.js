'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {ZipWriter,Uint8ArrayWriter,TextReader}=require('@zip.js/zip.js');
const {extractWeb,cleanRelease,releaseAsset,createArtcraft,mountArtcraft}=require('../lib/artcraft');
async function zip(files){const writer=new ZipWriter(new Uint8ArrayWriter(),{useWebWorkers:false});for(const [name,text]of Object.entries(files))await writer.add(name,new TextReader(text));return Buffer.from(await writer.close());}
async function temp(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'vault-artcraft-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}
test('web archives reject traversal and only official release URLs enter the catalog',async t=>{
 const dir=await temp(t);for(const name of ['../escape','/absolute','C:/escape','dir\\escape','CON.txt'])await assert.rejects(extractWeb(await zip({[name]:'x','index.html':'test','app.wasm':'test'}),dir),/Unsafe/);
 const safe=await zip({'web/index.html':'<html>App</html>','web/app.wasm':'wasm'});assert.equal(await extractWeb(safe,dir),'web');
 assert.equal(releaseAsset('photocraft','https://github.com/storytold/photocraft/releases/download/v1/web.zip'),true);
 for(const url of ['https://evil.test/web.zip','https://github.com/other/photocraft/releases/download/v1/a.zip','https://github.com/storytold/photocraft/releases/download/../../private','file:///secret'])assert.equal(releaseAsset('photocraft',url),false);
 assert.throws(()=>cleanRelease('photocraft',{tag_name:'../../escape'}));
});
test('verified installs persist; failed updates keep the working version and active sessions',async t=>{
 const dir=await temp(t),archive=await zip({'web/index.html':'<html>App</html>','web/app.wasm':'wasm'}),digest='sha256:'+crypto.createHash('sha256').update(archive).digest('hex');
 const release={tag:'v1',assets:[{name:'photocraft-web-1.zip',size:archive.length,digest,url:'https://github.com/storytold/photocraft/releases/download/v1/photocraft-web-1.zip'}]};
 await fs.writeFile(path.join(dir,'releases.json'),JSON.stringify({records:{photocraft:{release}}}));
 let bad=false;const fetcher=async url=>url.includes('api.github.com')?new Response(JSON.stringify({tag_name:'v2',assets:[{...release.assets[0],browser_download_url:release.assets[0].url,name:'photocraft-web-2.zip'}]})):new Response(bad?Buffer.from('corrupt'):archive);
 const store=createArtcraft(dir,{fetcher});await store.install('photocraft');assert.equal((await store.list()).apps[0].installed,'v1');
 const launch=await store.launch('photocraft'),token=launch.split('/')[4],before=store.ticket(token);assert.ok(before.folder.startsWith('photocraft-'));assert.throws(()=>store.ticket('invalid'));
 await store.check();bad=true;await assert.rejects(store.install('photocraft'),/verification failed/);assert.equal((await store.list()).apps[0].installed,'v1');assert.equal(store.ticket(token).folder,before.folder);
 assert.equal((await createArtcraft(dir).list()).apps[0].installed,'v1');
});
test('ArtCraft endpoints require an account and admin writes reject cross-site requests',async t=>{
 const express=require('express'),root=await temp(t),app=express();app.use(express.json());
 const bundleDir=path.join(root,'.artcraft','photocraft-test');await fs.mkdir(bundleDir,{recursive:true});await fs.writeFile(path.join(bundleDir,'index.html'),'<html><head></head><body>Editor</body></html>');await fs.writeFile(path.join(root,'.artcraft','releases.json'),JSON.stringify({records:{photocraft:{installed:{tag:'v1',folder:'photocraft-test',entry:'.'}}}}));
 const auth=(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={role:req.headers.authorization};next();};
 mountArtcraft(app,{root,auth,adminOnly:(req,res,next)=>req.user.role==='admin'?next():res.sendStatus(403)});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/api/artcraft')).status,401);
 assert.equal((await fetch(base+'/api/artcraft/photocraft/install',{method:'POST',headers:{Authorization:'member'}})).status,403);
 assert.equal((await fetch(base+'/api/artcraft/check',{method:'POST',headers:{Authorization:'admin',Origin:'null'}})).status,403);
 assert.equal((await fetch(base+'/api/share/artcraft/invalid/index.html')).status,410);
 const launch=await(await fetch(base+'/api/artcraft/photocraft/launch',{method:'POST',headers:{Authorization:'member'}})).json();
 const page=await fetch(base+launch.url),csp=page.headers.get('content-security-policy');assert.equal(page.status,200);assert.ok(csp.includes('sandbox allow-scripts allow-downloads allow-modals'));assert.ok(!csp.includes('allow-same-origin'));assert.ok(csp.includes('connect-src '+base+launch.url.split('?')[0]));assert.equal(page.headers.get('access-control-allow-origin'),'*');assert.match(await page.text(),/NativeWorker/);
});

test('opaque-origin module worker shim imports only its own bundle and leaves other workers to native policy',()=>{
 const vm=require('node:vm'),{browserBootstrap}=require('../lib/artcraft');const calls=[],blobs=[],base='https://vault.test/api/share/artcraft/token/';
 class NativeWorker{constructor(url,options){calls.push({url,options});}addEventListener(){}}
 class FakeURL extends URL{static createObjectURL(blob){blobs.push(blob);return 'blob:worker';}static revokeObjectURL(){}}
 const context={window:{Worker:NativeWorker},URL:FakeURL,Blob:class{constructor(parts){this.parts=parts;}},location:{href:base+'?nosw=1'},setTimeout(){}};
 vm.runInNewContext(browserBootstrap(base).replace(/^<script>|<\/script>$/g,''),context);
 new context.window.Worker('worker.js',{type:'module'});assert.equal(calls[0].url,'blob:worker');assert.equal(blobs[0].parts[0],'import "'+base+'worker.js";');
 new context.window.Worker('https://other.test/worker.js',{type:'module'});assert.equal(calls[1].url,'https://other.test/worker.js');
 new context.window.Worker('classic.js',{});assert.equal(calls[2].url,'classic.js');
});
