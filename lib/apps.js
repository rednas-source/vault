'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const defaults = [{id:'flowforge',name:'FlowForge',description:'Workflow diagrams · Visio import',url:'https://flowforge-workflow-studio.sanderknuts1.chatgpt.site/',mode:'embed'}];
function validateApp(input, vaultOrigin) {
  const name=String(input.name||'').trim(), description=String(input.description||'').trim(), url=String(input.url||'').trim(), mode=input.mode;
  if(!name||name.length>80||description.length>180||url.length>2048||!['embed','tab','desktop'].includes(mode)) throw new Error('Enter a name, a valid address and an opening mode.');
  if(mode==='desktop') {
    if(!/^ms-(?:excel|word|powerpoint):of[ev]\|u\|https:\/\/[^\s]+$/i.test(url)) throw new Error('Use an Office document link, such as ms-excel:ofe|u|https://example.com/workbook.xlsx');
    const target=new URL(url.split('|u|')[1]);
    if(target.username||target.password) throw new Error('Addresses cannot contain login credentials.');
  } else {
    const target=new URL(url);
    if(!['https:','http:'].includes(target.protocol)||target.username||target.password) throw new Error('Use an HTTP or HTTPS web address without login credentials.');
    if(mode==='embed'&&vaultOrigin&&target.origin===new URL(vaultOrigin).origin)throw new Error('Open addresses on this Vault in a new tab instead of embedding them.');
  }
  return {name,description,url,mode};
}
function createAppStore(directory) {
  const filename=user=>path.join(directory,crypto.createHash('sha256').update(user).digest('hex')+'.json');
  function read(user){try{return JSON.parse(fs.readFileSync(filename(user),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return defaults.map(app=>({...app}));}}
  function write(user,apps){fs.mkdirSync(directory,{recursive:true});const file=filename(user),temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(apps),{mode:0o600});fs.renameSync(temp,file);}
  return {read,save(user,input,id,vaultOrigin){const clean=validateApp(input,vaultOrigin),apps=read(user);if(id&&!apps.some(app=>app.id===id))throw new Error('App not found.');if(!id&&apps.length>=100)throw new Error('You can save up to 100 apps.');const app={...clean,id:id||crypto.randomUUID()};write(user,id?apps.map(old=>old.id===id?app:old):[...apps,app]);return app;},remove(user,id){write(user,read(user).filter(app=>app.id!==id));}};
}
module.exports={createAppStore,validateApp};
