'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('saving an older generation keeps newer edits visibly pending until they reach Vault',async()=>{
 const listeners={},node={dataset:{}},source={postMessage(){}},frame={contentWindow:source,addEventListener(){}};let finish;
 const json=data=>({ok:true,json:async()=>data});
 const context={Blob,AbortSignal,crypto:{randomUUID:()=> 'channel'},setTimeout(){},window:{addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){}},document:{getElementById:id=>id==='craftSaveStatus'?node:null},fetch:async url=>{
  if(url.endsWith('/files'))return json({files:[]});
  if(url.endsWith('/saves'))return json({id:'upload',chunkSize:4194304});
  if(url.includes('/chunk'))return json({offset:1});
  if(url.endsWith('/finish'))return new Promise(resolve=>finish=()=>resolve(json({name:'Book.xlsx',revision:'new',size:1})));
  throw Error('Unexpected request');
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/artcraft-files.js'),'utf8')+';this.bridge=ArtcraftFiles;',context);
 const controller=context.bridge.attach(frame,{appId:'gridcraft',name:'GridCraft'});
 const message=data=>listeners.message({source,origin:'null',data:{vaultApp:1,channel:'channel',...data}});
 message({type:'ready'});message({type:'dirty',generation:1});message({type:'save',request:1,generation:1,name:'Book.xlsx',blob:new Blob(['a'])});
 await new Promise(setImmediate);assert.equal(typeof finish,'function');message({type:'dirty',generation:2});finish();await new Promise(setImmediate);
 assert.equal(controller.dirty,true);assert.match(node.textContent,/Unsaved changes.*pending/);assert.doesNotMatch(node.textContent,/^Saved/);
 message({type:'save',request:2,generation:2,name:'Book.xlsx',blob:new Blob(['b'])});await new Promise(setImmediate);finish();await new Promise(setImmediate);
 assert.equal(controller.dirty,false);assert.match(node.textContent,/^Saved · App files \/ GridCraft \/ Book.xlsx/);
 controller.dispose();assert.equal(context.bridge.active,null);
});
