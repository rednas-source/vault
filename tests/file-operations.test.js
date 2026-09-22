'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {operate}=require('../lib/file-operations');
async function fixture(fn){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-operations-'));
 try{
  for(const rel of ['docs/Source/Nested','docs/Target','photos','music'])await fs.mkdir(path.join(root,rel),{recursive:true});
  await fs.writeFile(path.join(root,'docs/Source/Nested/notes.txt'),'nested content');
  await fs.writeFile(path.join(root,'docs/one.txt'),'one');
  await fs.writeFile(path.join(root,'docs/two.txt'),'two');
  await fn(root);
 }finally{await fs.rm(root,{recursive:true,force:true});}
}
test('moves files and complete folders to nested destinations, deduplicates parent/child',()=>fixture(async root=>{
 let result=await operate(root,{action:'move',rels:['docs/Source','docs/Source/Nested/notes.txt'],destination:'docs/Target'},['docs']);
 assert.equal(result.done,1);assert.equal(result.failed,0);
 assert.equal(await fs.readFile(path.join(root,'docs/Target/Source/Nested/notes.txt'),'utf8'),'nested content');
 result=await operate(root,{action:'move',rels:['docs/one.txt','docs/two.txt'],destination:'docs/Target/Source/Nested'},['docs']);
 assert.equal(result.done,2);
 result=await operate(root,{action:'rename',rels:['docs/Target/Source'],name:'Renamed'},['docs']);assert.equal(result.failed,0);
 assert.equal(await fs.readFile(path.join(root,'docs/Target/Renamed/Nested/one.txt'),'utf8'),'one');
 result=await operate(root,{action:'delete',rels:['docs/Target/Renamed','docs/Target/Renamed/Nested/two.txt']},['docs']);assert.equal(result.done,1);
 await assert.rejects(fs.stat(path.join(root,'docs/Target/Renamed')));
}));
test('rejects descendants, shelf roots, conflicts, invalid paths, and denied shelves before moving anything',()=>fixture(async root=>{
 const attempt=(rels,destination,allowed=['docs'])=>operate(root,{action:'move',rels,destination},allowed);
 for(const destination of ['docs/Source','docs/Source/Nested','docs/../photos','photos','docs/one.txt'])await assert.rejects(attempt(['docs/Source'],destination));
 await assert.rejects(attempt(['docs'],'photos',['docs','photos']));
 await assert.rejects(attempt(['docs/one.txt','music/missing'],'docs/Target'));
 await fs.writeFile(path.join(root,'docs/Target/two.txt'),'existing');
 await assert.rejects(attempt(['docs/one.txt','docs/two.txt'],'docs/Target'),/already exists/);
 assert.equal(await fs.readFile(path.join(root,'docs/one.txt'),'utf8'),'one');
 assert.equal(await fs.readFile(path.join(root,'docs/Target/two.txt'),'utf8'),'existing');
 await assert.rejects(operate(root,{action:'delete',rels:['docs']},['docs']));
 await assert.rejects(operate(root,{action:'rename',rels:['docs/Source'],name:'../escape'},['docs']));
 await fs.symlink(path.join(root,'photos'),path.join(root,'docs/link'),'junction');
 await assert.rejects(attempt(['docs/one.txt'],'docs/link'));
 await assert.rejects(attempt(['docs/link'],'docs/Target'));
}));
test('same-parent moves are no-ops and cross-shelf moves require both permissions',()=>fixture(async root=>{
 let result=await operate(root,{action:'move',rels:['docs/one.txt'],destination:'docs'},['docs']);assert.equal(result.failed,0);
 await assert.rejects(operate(root,{action:'move',rels:['docs/Source'],destination:'photos'},['photos']));
 result=await operate(root,{action:'move',rels:['docs/Source'],destination:'photos'},['photos','docs']);assert.equal(result.failed,0);
 assert.equal(await fs.readFile(path.join(root,'photos/Source/Nested/notes.txt'),'utf8'),'nested content');
}));
