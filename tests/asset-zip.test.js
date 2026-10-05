const fs=require('node:fs/promises'),test=require('node:test'),assert=require('node:assert/strict');
const load=fs.readFile(require('node:path').join(__dirname,'../public/asset-zip.js'),'utf8').then(s=>import('data:text/javascript;base64,'+Buffer.from(s).toString('base64')));
const entry=(filename,more={})=>({filename,uncompressedSize:10,externalFileAttributes:0,directory:false,...more});
test('ZIP entries preserve nested package paths and ignore desktop metadata',async()=>{const {validateEntries}=await load;assert.deepEqual(validateEntries([entry('pack/asset.json'),entry('pack/models/ore.glb'),entry('__MACOSX/ignored'),entry('pack/.DS_Store')]).map(e=>e.filename),['pack/asset.json','pack/models/ore.glb']);});
test('ZIP validation rejects traversal, drive paths, aliases, duplicates and links',async()=>{const {validateEntries}=await load;for(const p of ['../x','a/../b','/root/x','C:/x','a\\x','a//x','a/./b','a/CON.txt','a/trailing.'])assert.throws(()=>validateEntries([entry(p)]));assert.throws(()=>validateEntries([entry('a/ONE'),entry('a/one')]));assert.throws(()=>validateEntries([entry('a'),entry('a/file')]));assert.throws(()=>validateEntries([entry('link',{externalFileAttributes:0xa1ff0000})]));});
test('ZIP validation bounds entry counts, declared size and encryption',async()=>{const {validateEntries}=await load;for(const e of [entry('a',{uncompressedSize:-1}),entry('a',{uncompressedSize:11*1024**3}),entry('a',{encrypted:true})])assert.throws(()=>validateEntries([e]));assert.throws(()=>validateEntries(Array.from({length:5001},(_,i)=>entry('f'+i))));assert.throws(()=>validateEntries([0,1,2].map(i=>entry('f'+i,{uncompressedSize:8*1024**3}))));});

test('duplicate loose filenames get deterministic variant suffixes and preserve bytes',async()=>{
 const {expandAssetZips}=await load;
 const a=new File(['original'],'rock.glb',{lastModified:1}),b=new File(['second'],'rock.glb',{lastModified:2}),c=new File(['third'],'ROCK.glb'),taken=new File(['reserved'],'rock (variant).glb');
 const files=await expandAssetZips([a,b,c,taken,a]);assert.deepEqual(files.map(f=>f.name),['rock.glb','rock (variant 2).glb','ROCK (variant 3).glb','rock (variant).glb']);assert.equal(await files[1].text(),'second');assert.equal(await files[1].slice(0,3).text(),'sec');assert.equal(files[1].lastModified,2);
 assert.deepEqual((await expandAssetZips([a,b,c,taken,a])).map(f=>f.webkitRelativePath),files.map(f=>f.webkitRelativePath));
});
test('dragged folder relative paths survive ZIP preprocessing without flattening',async()=>{
 const {expandAssetZips}=await load;const a=new File(['a'],'model.glb'),b=new File(['b'],'model.glb'),paths=new Map([[a,'Collection/Oak/models/model.glb'],[b,'Collection/Birch/models/model.glb']]);
 const out=await expandAssetZips([a,b],()=>{},f=>paths.get(f)||f.webkitRelativePath||'');assert.deepEqual(out.map(f=>f.webkitRelativePath),[...paths.values()]);assert.equal(await out[1].text(),'b');
});
test('lazy connected files keep their materializer and original subfolders',async()=>{
 const {uniqueSelectedFiles}=await load;let count=0;const file={name:'model.glb',webkitRelativePath:'pack/models/model.glb',size:3,lastModified:0,materialize:async()=>{count++;return{file:new File(['abc'],'model.glb'),dispose:async()=>{}}},text:async()=>'abc'};
 const out=uniqueSelectedFiles([file,{...file}]);assert.equal(out[1].webkitRelativePath,'pack/models/model (variant).glb');const data=await out[1].materialize();assert.equal(await data.file.text(),'abc');assert.equal(count,1);
});
