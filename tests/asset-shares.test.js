'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),express=require('express');
const {AssetLibrary}=require('../lib/assets');
const {mountAssetShares}=require('../lib/asset-shares');
const {listSharedLinks}=require('../lib/shared-links');
test('asset capabilities scope files, stream downloads and recheck revocation, expiry and owner access',async t=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'vault-asset-share-')),root=path.join(temp,'.private-vault');t.after(()=>fs.rm(temp,{recursive:true,force:true}));await fs.mkdir(path.join(root,'assets'),{recursive:true});
 const library=new AssetLibrary(root),asset=await library.create({name:'Cedar',tags:['tree'],files:[{path:'tree.glb',role:'model'},{path:'note.html',role:'source'}],primary:'tree.glb'});
 await fs.writeFile(path.join(root,asset.rel,'tree.glb'),'model-fixture');await fs.writeFile(path.join(root,asset.rel,'note.html'),'<script>test</script>');await library.finish(asset.id);
 const neighbor=await library.create({name:'Private rock'});await fs.writeFile(path.join(root,neighbor.rel,'secret.txt'),'private');
 let active=true,allowed=true,expired=false;const share={kind:'asset',writable:false,rel:asset.rel,by:'alice',created:Date.now(),maxUses:0};
 const app=express();mountAssetShares(app,{root,library,resolveShare:()=>active&&!expired?{share}:{error:'gone'},allowedForOwner:()=>allowed?['assets']:[]});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port+'/api/share/token/asset';
 const response=await fetch(base),metadata=await response.json();assert.equal(response.status,200);assert.equal(metadata.name,'Cedar');assert.equal(metadata.rel,undefined);assert.equal(metadata.by,undefined);assert.equal(metadata.files.length,2);assert.match(response.headers.get('cache-control'),/no-store/);
 const file=await fetch(base+'/file?path=tree.glb');assert.equal(await file.text(),'model-fixture');assert.equal(file.headers.get('content-type'),'model/gltf-binary');
 const range=await fetch(base+'/file?path=tree.glb',{headers:{Range:'bytes=0-4'}});assert.equal(range.status,206);assert.equal(await range.text(),'model');
 const html=await fetch(base+'/file?path=note.html');assert.match(html.headers.get('content-disposition'),/^attachment/);await html.text();
 for(const name of ['../secret.txt',neighbor.rel+'/secret.txt','.private','asset.json'])assert.equal((await fetch(base+'/file?path='+encodeURIComponent(name))).status,410);
 const zip=await fetch(base+'/download');assert.equal(zip.status,200);assert.equal(Buffer.from(await zip.arrayBuffer()).subarray(0,2).toString(),'PK');
 const rows=await listSharedLinks(root,{token:share},{name:'alice',role:'member'},()=>['assets']);assert.equal(rows[0].kind,'asset');assert.equal(rows[0].status,'active');assert.equal(rows[0].writable,false);
 for(const state of ['revoked','expired','permission']){active=state!=='revoked';expired=state==='expired';allowed=state!=='permission';for(const suffix of ['','/file?path=tree.glb','/download'])assert.equal((await fetch(base+suffix)).status,410,state+suffix);}
 active=true;expired=false;allowed=true;await fs.rm(path.join(root,asset.rel),{recursive:true,force:true});assert.equal((await fetch(base)).status,410);
});
