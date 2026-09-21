'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {collectEntries}=require('../lib/archive');

test('archives keep hierarchy, empty folders, and deduplicate nested selections',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-archive-'));
 try{
  await fs.mkdir(path.join(root,'docs/Project/Notes'),{recursive:true});
  await fs.mkdir(path.join(root,'docs/Project/Empty'),{recursive:true});
  await fs.writeFile(path.join(root,'docs/Project/Notes/hello.txt'),'hello');
  await fs.writeFile(path.join(root,'docs/Project/.private'),'private');
  const entries=await collectEntries(root,['docs/Project','docs/Project/Notes/hello.txt'],['docs']);
  assert.deepEqual(entries.map(e=>e.rel).sort(),['docs/Project','docs/Project/Empty','docs/Project/Notes','docs/Project/Notes/hello.txt']);
  for(const bad of ['docs/../movies/file','docs/.private','docs\\Project','movies/file','/docs/Project']){
   await assert.rejects(collectEntries(root,[bad],['docs']));
  }
  await assert.rejects(collectEntries(root,['docs/Project','movies/file'],['docs']));
  await assert.rejects(collectEntries(root,[],['docs']));
  await assert.rejects(collectEntries(root,Array(501).fill('docs'),['docs']));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('archive collection rejects linked shelf roots and skips linked descendants',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-links-'));
 try{
  await fs.mkdir(path.join(root,'docs'));await fs.mkdir(path.join(root,'private'));
  await fs.writeFile(path.join(root,'private/secret.txt'),'secret');
  await fs.symlink(path.join(root,'private'),path.join(root,'docs/link'),'junction');
  await assert.rejects(collectEntries(root,['docs/link'],['docs']));
  assert.deepEqual((await collectEntries(root,['docs'],['docs'])).map(e=>e.rel),['docs']);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
