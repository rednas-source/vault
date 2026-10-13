'use strict';
const path=require('node:path');
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const {createRecipeStore}=require('./recipes');
const isRecipeShare=share=>['recipe','cookbook'].includes(share?.kind);

// The public representation deliberately excludes shopping, favourites, owner
// information and internal media filenames. A cookbook is a live, read-only view.
function publicRecipe(recipe){
  const fields=['id','title','description','time','reviewNote','servings','ingredients','instructions','sourceUrl','sourceNutrition','updated','stepIngredients','cover'];
  return {...Object.fromEntries(fields.map(key=>[key,recipe[key]])),image:!!recipe.image,aiImage:!!recipe.aiImage,video:!!recipe.video};
}

function mountRecipeShares(app,{root,auth,getShares,saveShares,resolveShare,ownerActive,note=()=>{}}){
  const store=createRecipeStore(path.join(root,'.recipes'));
  function context(id){
    const result=resolveShare(id),share=result.share;
    if(result.error||!isRecipeShare(share)||share.writable||!ownerActive(share.by))throw Error('Unavailable');
    const recipes=share.kind==='recipe'?[store.get(share.by,share.recipeId)].filter(Boolean):store.read(share.by).recipes;
    if(share.kind==='recipe'&&!recipes.length)throw Error('Unavailable');
    return {share,recipes};
  }
  app.post('/api/shares',auth,(req,res,next)=>{
    if(!isRecipeShare(req.body))return next();
    try{
      if(!ownerActive(req.user.name))return res.sendStatus(403);
      const recipe=req.body.kind==='recipe'?store.get(req.user.name,req.body.recipeId):null;
      if(req.body.kind==='recipe'&&!recipe)return res.status(404).json({error:'Recipe not found.'});
      const id=crypto.randomBytes(24).toString('base64url'),days=Math.min(365,Math.max(0,parseInt(req.body.days,10)||0));
      const shares=getShares();
      shares[id]={kind:req.body.kind,recipeId:recipe?.id,rel:recipe?.title||'Whole cookbook',writable:false,by:req.user.name,label:String(req.body.label||'').slice(0,60),created:Date.now(),expires:days?Date.now()+days*864e5:0,maxUses:0,uses:0};
      saveShares();note(req.user.name,'share-create',shares[id].rel);
      res.json({id,url:'/s/'+id,kind:req.body.kind,writable:false});
    }catch{res.status(500).json({error:'Could not create the recipe link. Try again.'});}
  });
  const route=fn=>async(req,res)=>{
    res.set({'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'});
    try{await fn(req,res,context(req.params.id));}
    catch{if(!res.headersSent)res.status(410).json({error:'This recipe link is no longer available.'});}
  };
  app.get('/api/share/:id/recipes',route(async(req,res,{share,recipes})=>{
    res.json({kind:share.kind,recipes:recipes.map(publicRecipe)});
  }));
  app.get('/api/share/:id/recipes/:recipeId/media/:kind',route(async(req,res,{share,recipes})=>{
    const recipe=recipes.find(r=>r.id===req.params.recipeId),kind=req.params.kind;
    const asset=['image','aiImage','video'].includes(kind)&&recipe?.[kind];
    if(!asset||!asset.file||path.basename(asset.file)!==asset.file||asset.file.includes('\\'))throw Error('Unavailable');
    const mediaDir=path.join(store.directory(share.by),'media'),full=path.join(mediaDir,asset.file);
    const [stat,realDir,realFile]=await Promise.all([fs.lstat(full),fs.realpath(mediaDir),fs.realpath(full)]);
    if(!stat.isFile()||stat.isSymbolicLink()||!realFile.startsWith(realDir+path.sep))throw Error('Unavailable');
    if(!/^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm|quicktime))$/.test(asset.mime))throw Error('Unavailable');
    res.type(asset.mime);res.sendFile(full,error=>{if(error&&!res.headersSent)res.status(410).end();});
  }));
  return context;
}
module.exports={mountRecipeShares,isRecipeShare,publicRecipe};
