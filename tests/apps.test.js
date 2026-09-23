'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createAppStore,validateApp}=require('../lib/apps');
test('app lists persist edits, isolate accounts, and do not restore deleted defaults',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vault-apps-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createAppStore(dir),input={name:'Project',description:'Notes',url:'https://example.com/app',mode:'embed'};
 const added=store.save('alice',input);assert.equal(store.read('alice').length,2);assert.equal(store.read('bob').length,1);
 assert.throws(()=>store.save('bob',input,added.id),/not found/);
 store.save('alice',{...input,name:'Updated'},added.id);assert.equal(createAppStore(dir).read('alice')[1].name,'Updated');
 store.remove('alice','flowforge');store.remove('alice',added.id);assert.deepEqual(store.read('alice'),[]);assert.equal(store.read('bob')[0].id,'flowforge');
});
test('app URLs reject executable schemes and credentials while permitting Office document links',()=>{
 const input={name:'App',description:'',mode:'embed'};
 for(const url of ['javascript:alert(1)','data:text/html,hello','file:///c:/secrets','https://user:password@example.com'])assert.throws(()=>validateApp({...input,url}));
 assert.equal(validateApp({...input,url:'http://localhost:3000'}).mode,'embed');
 assert.throws(()=>validateApp({...input,url:'https://vault.example/apps'},'https://vault.example'),/new tab/);
 assert.equal(validateApp({...input,url:'https://vault.example/apps',mode:'tab'},'https://vault.example').mode,'tab');
 assert.throws(()=>validateApp({...input,url:'https://example.com',mode:'unknown'}));
 assert.throws(()=>validateApp({...input,url:'powershell:launch',mode:'desktop'}));
 assert.equal(validateApp({...input,url:'ms-excel:ofe|u|https://example.com/workbook.xlsx',mode:'desktop'}).mode,'desktop');
});
