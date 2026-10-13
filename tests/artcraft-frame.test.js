'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('document bridge accepts only its Vault parent and acknowledges saves only after server confirmation',async()=>{
 const keys=[],messages=[],events={},domEvents={},parent={postMessage:m=>messages.push(m)},origin='https://vault.test';
 class TestURL extends URL{static createObjectURL(){return 'blob:test';}static revokeObjectURL(){}}
 class Anchor{click(){}}
 const canvas={focus(){},dispatchEvent(e){keys.push(e);}},window={focus(){},addEventListener:(name,fn)=>events[name]=fn};const document={currentScript:{src:origin+'/api/share/artcraft/token/__vault_bridge.js'},addEventListener:(name,fn)=>domEvents[name]=fn,querySelector:()=>canvas,activeElement:canvas};
 const context={window,document,parent,URL:TestURL,Blob,HTMLAnchorElement:Anchor,Map,Promise,Error,Date,navigator:{platform:'Win32'},setInterval(){},setTimeout(){},KeyboardEvent:class{constructor(type,fields){this.type=type;Object.assign(this,fields);}},console};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/artcraft-frame.js'),'utf8'),context);
 await events.message({source:{},origin,data:{vaultApp:1,type:'connect',channel:'bad'}});await assert.rejects(window.showSaveFilePicker({suggestedName:'Book.xlsx'}),/inside Vault/);
 await events.message({source:parent,origin:'https://evil.test',data:{vaultApp:1,type:'connect',channel:'bad'}});assert.equal(messages.filter(m=>m.type==='ready').length,0);
 const deliver=data=>events.message({source:parent,origin,data:{vaultApp:1,channel:'secret',...data}});await deliver({type:'connect'});assert.equal(messages.at(-1).type,'ready');
 const handle=await window.showSaveFilePicker({suggestedName:'Book.xlsx'}),stream=await handle.createWritable();await stream.write(new Uint8Array([1,2,3]));let complete=false;const closed=stream.close().then(()=>complete=true);
 const save=messages.find(m=>m.type==='save');assert.equal(save.name,'Book.xlsx');assert.equal(save.blob.size,3);assert.equal(complete,false);
 domEvents.input({isTrusted:true});await deliver({type:'saved',request:save.request,generation:0});await closed;assert.equal(complete,true);assert.equal(messages.at(-1).type,'dirty','an edit made while uploading remains dirty');
 const second=await(await window.showSaveFilePicker({suggestedName:'Book.xlsx'})).createWritable();await second.write('more');const failed=second.close();const newer=messages.filter(m=>m.type==='save').at(-1);await deliver({type:'failed',request:newer.request,error:'Offline'});await assert.rejects(failed,/Offline/);
 await deliver({type:'connect',appId:'gridcraft'});await deliver({type:'save-now'});assert.equal(keys.at(-1).key,'F12','imported GridCraft workbooks must serialize through Save As');
});
