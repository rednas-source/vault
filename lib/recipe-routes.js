'use strict';
const express=require('express');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {createRecipeStore,validId}=require('./recipes');
const {fetchPublic,parseHTML,parseText}=require('./recipe-import');
const Model=require('../public/recipe-model');

module.exports=function recipeRoutes({root,auth,config}){
  const router=express.Router(),store=createRecipeStore(path.join(root,'.recipes'));
  const uploads=new Map(),searchCache=new Map(),budgets=new Map();
  const assets=user=>path.join(store.directory(user),'media');
  const error=(message,status=400)=>Object.assign(Error(message),{status});
  const route=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res)).catch(next);
  router.use(auth,(req,res,next)=>{
    res.setHeader('Cache-Control','private, no-store');
    if(req.get('Sec-Fetch-Site')==='cross-site'&&!['GET','HEAD'].includes(req.method))return res.status(403).json({error:'Open Recipes in Vault to make changes.'});
    if(req.get('Origin')&&!['GET','HEAD'].includes(req.method)){
      try{if(new URL(req.get('Origin')).host!==req.get('host'))return res.status(403).json({error:'Origin not allowed.'});}catch{return res.sendStatus(403);}
    }
    next();
  });
  function limited(req){const now=Date.now(),key=req.user.name;let b=budgets.get(key);if(!b||now-b.start>3600000){b={start:now,count:0};budgets.set(key,b);}if(++b.count>90)throw error('Import/search limit reached. Try again in an hour.',429);}
  router.get('/',route((req,res)=>res.json(store.read(req.user.name))));
  async function saveRecipe(req,res,key){
    const old=key?store.get(req.user.name,key):null;
    let recipe=store.save(req.user.name,req.body,key),warning='';
    if(recipe.imageUrl&&recipe.imageUrl!==old?.imageUrl){
      try{
        const photo=await fetchPublic(recipe.imageUrl,0,'image');
        const extension={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'}[photo.type];
        const file=crypto.randomUUID()+extension;await fsp.mkdir(assets(req.user.name),{recursive:true});await fsp.writeFile(path.join(assets(req.user.name),file),photo.body,{flag:'wx',mode:0o600});
        const prior=store.media(req.user.name,recipe.id,'image',{file,mime:photo.type,name:file});
        if(prior)await fsp.unlink(path.join(assets(req.user.name),prior.file)).catch(()=>{});
        recipe=store.get(req.user.name,recipe.id);
      }catch{warning='Recipe saved, but the source photo was unavailable. Upload a photo in Edit.';}
    }
    res.status(key?200:201).json({...recipe,...(warning?{warning}:{})});
  }
  router.post('/',route((req,res)=>saveRecipe(req,res)));
  router.put('/:id',route((req,res)=>saveRecipe(req,res,req.params.id)));
  router.delete('/:id',route(async(req,res)=>{
    const recipe=store.remove(req.user.name,req.params.id);
    for(const kind of ['image','video'])if(recipe[kind])await fsp.unlink(path.join(assets(req.user.name),recipe[kind].file)).catch(()=>{});
    res.json({ok:true});
  }));
  router.post('/import',route(async(req,res)=>{
    limited(req);const {url,text}=req.body||{};
    if(typeof text==='string'&&text.trim())return res.json({draft:{...parseText(text),sourceUrl:typeof url==='string'?url:''},message:'Caption imported. Review the title, ingredients and numbered steps before saving.'});
    if(typeof url!=='string'||url.length>2048)throw error('Paste a recipe link or caption.');
    try{const page=await fetchPublic(url);res.json(parseHTML(page.html,page.url));}catch(e){throw error(e.message);}
  }));
  router.post('/shopping/add',route((req,res)=>res.json({shopping:store.addShopping(req.user.name,req.body.recipeId,Number(req.body.scale||1))})));
  router.patch('/shopping/:id',route((req,res)=>res.json({shopping:store.checkShopping(req.user.name,req.params.id,req.body.done)})));
  router.post('/shopping/clear',route((req,res)=>res.json({shopping:store.clearShopping(req.user.name)})));
  router.get('/foods',route(async(req,res)=>{
    const query=String(req.query.q||'').trim().slice(0,140);if(query.length<2)throw error('Enter an ingredient name.');
    const cached=searchCache.get(query.toLowerCase());if(cached)return res.json(cached);
    limited(req);
    const key=process.env.USDA_API_KEY||config.usdaApiKey||'DEMO_KEY';
    const address=new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    address.searchParams.set('api_key',key);
    let response;try{response=await fetch(address,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,pageSize:12,dataType:['SR Legacy','Foundation']}),signal:AbortSignal.timeout(15000)});}catch{throw error('Nutrition search could not connect. Your recipe is saved; try again shortly.',502);}
    if(!response.ok)throw error(response.status===429?'Nutrition lookup has reached its limit. Set usdaApiKey in config.json for your own free USDA allowance, or try later.':'Nutrition lookup is unavailable. Check the USDA key or try again.',response.status===429?429:502);
    const json=await response.json();const result={foods:(json.foods||[]).map(Model.fromUSDA),demo:key==='DEMO_KEY'};
    if(searchCache.size>=500)searchCache.delete(searchCache.keys().next().value);searchCache.set(query.toLowerCase(),result);res.json(result);
  }));
  router.post('/:id/upload',route(async(req,res)=>{
    if(!store.get(req.user.name,req.params.id))throw error('Recipe not found.',404);
    const {name,size,kind}=req.body||{},extension=path.extname(String(name||'')).toLowerCase();
    const allowed=kind==='image'?['.jpg','.jpeg','.png','.webp','.gif']:kind==='video'?['.mp4','.m4v','.mov','.webm']:[];
    const max=kind==='image'?15*1024**2:512*1024**2;
    if(!allowed.includes(extension)||!Number.isSafeInteger(size)||size<=0||size>max)throw error(kind==='image'?'Choose a JPG, PNG, WebP or GIF under 15 MB.':'Choose an MP4, MOV or WebM video under 512 MB.');
    const now=Date.now();for(const [id,u]of uploads){if(now-u.updated>3600000&&!u.busy){uploads.delete(id);await fsp.unlink(u.temp).catch(()=>{});}}
    if([...uploads.values()].filter(u=>u.user===req.user.name).length>=3)throw error('Finish or cancel your other recipe uploads first.');
    const id=crypto.randomUUID(),dir=assets(req.user.name);await fsp.mkdir(dir,{recursive:true});
    // Remove abandoned parts from previous server runs after a day.
    for(const entry of await fsp.readdir(dir)){if(/^[a-f0-9-]{36}\.part$/.test(entry)){const file=path.join(dir,entry),stat=await fsp.stat(file);if(now-stat.mtimeMs>86400000)await fsp.unlink(file).catch(()=>{});}}
    const temp=path.join(dir,id+'.part');await fsp.writeFile(temp,Buffer.alloc(0),{flag:'wx',mode:0o600});
    uploads.set(id,{user:req.user.name,recipe:req.params.id,kind,size,offset:0,extension,temp,updated:now});res.status(201).json({id,chunkSize:4*1024**2});
  }));
  router.post('/uploads/:id/chunk',express.raw({type:'application/octet-stream',limit:'4mb'}),route(async(req,res)=>{
    const u=uploads.get(req.params.id);if(!u||u.user!==req.user.name)throw error('Upload expired. Select the file again.',404);
    if(u.busy)throw error('A chunk is still being saved.',409);
    if(Number(req.query.offset)!==u.offset)return res.status(409).json({error:'Upload offset changed.',offset:u.offset});
    if(!Buffer.isBuffer(req.body)||!req.body.length||u.offset+req.body.length>u.size)throw error('Invalid upload chunk.');
    u.busy=true;try{await fsp.appendFile(u.temp,req.body);u.offset+=req.body.length;u.updated=Date.now();res.json({offset:u.offset});}finally{u.busy=false;}
  }));
  router.post('/uploads/:id/finish',route(async(req,res)=>{
    const u=uploads.get(req.params.id);if(!u||u.user!==req.user.name)throw error('Upload not found.',404);
    if(u.busy||u.offset!==u.size)throw error('The upload is not complete.',409);
    if(!store.get(u.user,u.recipe))throw error('Recipe no longer exists.',404);
    u.busy=true;
    try{
      const handle=await fsp.open(u.temp,'r'),header=Buffer.alloc(16);try{await handle.read(header,0,16,0);}finally{await handle.close();}
      let mime=null;
      if(u.kind==='image'){
        if(header.subarray(0,3).equals(Buffer.from([255,216,255])))mime='image/jpeg';
        if(header.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
        if(/^GIF8[79]a/.test(header.toString('ascii',0,6)))mime='image/gif';
        if(header.toString('ascii',0,4)==='RIFF'&&header.toString('ascii',8,12)==='WEBP')mime='image/webp';
      }else{
        if(header.toString('ascii',4,8)==='ftyp')mime=u.extension==='.mov'?'video/quicktime':'video/mp4';
        if(header.subarray(0,4).equals(Buffer.from([26,69,223,163])))mime='video/webm';
      }
      if(!mime)throw error('This file does not contain a supported image or video.');
      const file=req.params.id+u.extension;await fsp.rename(u.temp,path.join(assets(u.user),file));
      let previous;try{previous=store.media(u.user,u.recipe,u.kind,{file,mime,name:file});}catch(e){await fsp.unlink(path.join(assets(u.user),file)).catch(()=>{});throw e;}
      uploads.delete(req.params.id);if(previous)await fsp.unlink(path.join(assets(u.user),previous.file)).catch(()=>{});
      res.json(store.get(u.user,u.recipe));
    }finally{u.busy=false;}
  }));
  router.delete('/uploads/:id',route(async(req,res)=>{const u=uploads.get(req.params.id);if(u&&u.user===req.user.name&&!u.busy){uploads.delete(req.params.id);await fsp.unlink(u.temp).catch(()=>{});}res.json({ok:true});}));
  router.get('/:id/media/:kind',route((req,res)=>{
    const recipe=store.get(req.user.name,req.params.id),kind=req.params.kind;
    if(!recipe||!['image','video'].includes(kind)||!recipe[kind])throw error('Media not found.',404);
    res.setHeader('Content-Type',recipe[kind].mime);res.setHeader('X-Content-Type-Options','nosniff');
    res.sendFile(path.join(assets(req.user.name),recipe[kind].file),e=>{if(e&&!res.headersSent)res.status(e.status||404).end();});
  }));
  router.use((e,req,res,next)=>{if(res.headersSent)return next(e);res.status(e.status||500).json({error:e.status?e.message:'Could not save this change. Try again.'});});
  return router;
};
