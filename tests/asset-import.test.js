'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const {AssetLibrary}=require('../lib/assets');
test('browser import forks conflicting packages, preserves references and resumes without extra variants',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-import-collision-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.mkdir(path.join(root,'assets'));const library=new AssetLibrary(root);
 const zipSource=await fs.readFile(path.join(__dirname,'../public/asset-zip.js'),'utf8'),zipModule=await import('data:text/javascript;base64,'+Buffer.from(zipSource).toString('base64'));
 const client=await fs.readFile(path.join(__dirname,'../public/assets.js'),'utf8');let code=client.slice(client.indexOf('async function assetImportFiles('),client.indexOf('\nfunction assetAttach('));code=code.replace(/await import\('\/asset-zip\.js\?[^']+'\)/,'zipModule');
 let uploads=0,interrupt=false;
 const context={zipModule,crypto:webcrypto,TextEncoder,relativePathOf:f=>f.webkitRelativePath||'',assetAPI:async(url,options)=>{const body=JSON.parse(options.body);if(url==='/api/assets')return library.create(body);const id=url.split('/')[3];if(url.endsWith('/finish'))return library.finish(id);return library.update(id,body);},assetUpload:async(file,relative,asset)=>{if(interrupt){interrupt=false;throw Error('Connection dropped')};const target=path.join(root,asset.rel,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,Buffer.from(await file.arrayBuffer()));uploads++;}};
 vm.createContext(context);vm.runInContext(code,context);
 const pack=(content,hash,extra=false)=>{
  const meta={name:'Ore',sourceAssetId:'ore-stable',collection:'Test',primary:'models/model.glb',preview:'preview.png',variants:[{id:'gold',name:'Gold',primary:'models/model.glb',preview:'preview.png'}],files:[{path:'models/model.glb',role:'model',sha256:hash},{path:'preview.png',role:'preview'},...(extra?[{path:'source.txt',role:'source'}]:[])]};
  return [['asset.json',JSON.stringify(meta)],['models/model.glb',content],['preview.png','preview'],...(extra?[['source.txt','source']]:[])].map(([name,body])=>{const f=new File([body],name.split('/').pop(),{lastModified:1});Object.defineProperty(f,'webkitRelativePath',{value:'Ore/'+name});return f;});
 };
 const run=files=>context.assetImportFiles(files,{},()=>{});
 await run(pack('old','a'.repeat(64)));const original=(await library.list()).items[0];
 interrupt=true;await assert.rejects(run(pack('new','b'.repeat(64))),/Connection dropped/);
 await run(pack('new','b'.repeat(64)));assert.equal((await library.list()).total,2);let changed=(await library.list()).items.find(a=>a.id!==original.id);assert.equal(changed.name,'Ore (variant)');assert.equal(await fs.readFile(path.join(root,original.rel,'models/model.glb'),'utf8'),'old');assert.equal(await fs.readFile(path.join(root,changed.rel,'models/model.glb'),'utf8'),'new');
 const before=uploads;await run(pack('new','b'.repeat(64),true));assert.equal((await library.list()).total,2);assert.equal(uploads,before+1);changed=await library.get(changed.id);assert.equal(changed.variants[0].primary,'models/model.glb');assert.equal(changed.preview,'preview.png');assert.equal(changed.files.length,3);
 await run(pack('old','a'.repeat(64),true));assert.equal((await library.list()).total,2);assert.equal((await library.get(original.id)).files.length,3);
});
