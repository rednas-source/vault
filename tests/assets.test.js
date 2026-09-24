'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {AssetLibrary,metadata,relative,mountAssetRoutes}=require('../lib/assets');
const express=require('express');
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-assets-'));await fs.mkdir(path.join(root,'assets'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return {root,library:new AssetLibrary(root)};}
test('asset packages persist connected files, preview roles, facets and searchable tags',async t=>{
  const {root,library}=await fixture(t);const a=await library.create({name:'Gold ore deposit',style:'Stylized Strategy',category:'Resources',tags:['mining','gold'],files:[{path:'models/ore.glb',role:'model'},{path:'reference.png',role:'reference'}],primary:'models/ore.glb',preview:'reference.png'});
  await fs.mkdir(path.join(root,a.rel,'models'));await fs.writeFile(path.join(root,a.rel,'models/ore.glb'),'model fixture');await fs.writeFile(path.join(root,a.rel,'reference.png'),'image fixture');
  const final=await library.finish(a.id);assert.equal(final.fileCount,2);assert.equal(final.previewRole,'reference');assert.equal(final.status,'review');
  const listing=await library.list({q:'MINING gold',style:'Stylized Strategy'});assert.equal(listing.total,1);assert.equal(listing.items[0].files,undefined);assert.deepEqual(listing.facets.category,['Resources']);
  assert.equal((await library.list({category:'Characters'})).total,0);assert.equal((await new AssetLibrary(root).get(a.id)).name,'Gold ore deposit');
  const edited=await library.update(a.id,{revision:final.revision,name:'Gold seam',status:'ready'});assert.equal(edited.name,'Gold seam');assert.equal(edited.status,'ready');await assert.rejects(library.update(a.id,{revision:final.revision,name:'Stale'}),e=>e.status===409);
});
test('imports resume by identity and incomplete packages do not masquerade as complete',async t=>{
  const {root,library}=await fixture(t),input={name:'Cedar',importIdentity:'stable folder identity from HTTP browser',files:[{path:'tree.glb'},{path:'texture.png'}]};const a=await library.create(input),again=await library.create(input);assert.equal(again.id,a.id);assert.equal(again.existing,true);
  await fs.writeFile(path.join(root,a.rel,'tree.glb'),'tree');const resumed=await library.create(input);assert.equal(resumed.files.length,1);assert.equal(resumed.files[0].path,'tree.glb');await assert.rejects(library.finish(a.id),/missing/);await fs.writeFile(path.join(root,a.rel,'texture.png'),'texture');const done=await library.finish(a.id);assert.equal(done.files.find(f=>f.path==='texture.png').role,'texture');
  const requests=await Promise.all([library.create({...input,importKey:'b'.repeat(64)}),library.create({...input,importKey:'b'.repeat(64)})]);assert.equal(requests[0].id,requests[1].id);
});
test('unsafe paths, metadata symlinks and malformed packages cannot escape storage',async t=>{
  const {root,library}=await fixture(t);for(const p of ['../secret','a/../../secret','/secret','a\\b','https://example.com/a','a/.hidden','a//b'])assert.throws(()=>relative(p));
  assert.throws(()=>metadata({name:'x',preview:'../private.jpg'}));
  await fs.mkdir(path.join(root,'private'));await fs.writeFile(path.join(root,'private/secret.txt'),'secret');await fs.symlink(path.join(root,'private'),path.join(root,'assets/escape'),'junction');
  await fs.mkdir(path.join(root,'assets/broken'));await fs.writeFile(path.join(root,'assets/broken/asset.json'),'not json');const listing=await library.list();assert.equal(listing.libraryTotal,0);assert.equal(listing.issues.length,1);
  await assert.rejects(library.get('../../private'));
});
test('pagination and filters remain bounded for a large cached catalog',async t=>{
  const {library}=await fixture(t);library.loaded=Date.now();for(let i=0;i<12000;i++)library.items.set(String(i),{id:String(i),name:'Rock '+i,kind:'model',category:i%2?'Rocks':'Resources',style:'Stylized',collection:'Test',tags:['stone'],files:[],created:i,size:i,technical:null});
  const result=await library.list({category:'Rocks',offset:'96',limit:'9999'});assert.equal(result.total,6000);assert.equal(result.items.length,96);assert.equal(result.offset,96);
});
test('every asset endpoint enforces existing shelf permissions and authentication',async t=>{
  const {root}=await fixture(t),app=express();app.use(express.json());mountAssetRoutes(app,{root,auth:(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={name:'tester'};next();},canUse:req=>false,note:()=>{}});
  const server=app.listen(0,'127.0.0.1');t.after(()=>new Promise(resolve=>server.close(resolve)));await new Promise(resolve=>server.on('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
  for(const [method,url] of [['GET','/api/assets'],['GET','/api/assets/abc'],['POST','/api/assets'],['POST','/api/assets/refresh'],['POST','/api/assets/abc/finish'],['PATCH','/api/assets/abc']]){assert.equal((await fetch(base+url,{method})).status,401);assert.equal((await fetch(base+url,{method,headers:{Authorization:'test'}})).status,404);}
});
