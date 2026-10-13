'use strict';
const path=require('node:path');
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const {createRecipeStore}=require('./recipes');
const isRecipeShare=share=>['recipe','cookbook'].includes(share?.kind);
const publicDir=path.join(__dirname,'..','public');
const iconDir=path.dirname(require.resolve('@phosphor-icons/web/regular/style.css'));
// Only reader dependencies are available through the Cloudflare share exception.
// Never turn this into a general static mount for the application or filesystem.
const readerAssets=new Map([
  ...['recipes.css','share-recipes.css','recipe-model.js','recipe-norwegian.js','recipe-language.js','recipe-details.js','recipe-extras.js','share-recipes.js','recipe-contribute.js'].map(name=>[name,path.join(publicDir,name)]),
  ...['style.css','Phosphor.woff2','Phosphor.woff','Phosphor.ttf','Phosphor.svg'].map(name=>[name,path.join(iconDir,name)]),
]);
async function recipeSharePage(id){
  const html=await fs.readFile(path.join(publicDir,'share-recipes.html'),'utf8');
  return html.replaceAll('__RECIPE_ASSETS__','/api/share/'+encodeURIComponent(id)+'/recipes/assets');
}

// The public representation deliberately excludes shopping, favourites, owner
// information and internal media filenames. A cookbook is a live, read-only view.
function publicRecipe(recipe){
  const fields=['id','title','description','time','reviewNote','servings','ingredients','instructions','sourceUrl','sourceNutrition','updated','stepIngredients','cover'];
  return {...Object.fromEntries(fields.map(key=>[key,recipe[key]])),image:!!recipe.image,aiImage:!!recipe.aiImage,video:!!recipe.video};
}

function mountRecipeShares(app,{root,auth,config={},getShares,saveShares,resolveShare,ownerActive,note=()=>{}}){
  const store=createRecipeStore(path.join(root,'.recipes'));
  function context(id){
    const result=resolveShare(id),share=result.share;
    if(result.error||!isRecipeShare(share)||share.writable||!ownerActive(share.by))throw Error('Unavailable');
    const recipes=share.kind==='recipe'?[store.get(share.by,share.recipeId)].filter(Boolean):store.read(share.by).recipes;
    if(share.kind==='recipe'&&!recipes.length)throw Error('Unavailable');
    if(share.kind==='recipe')for(const key of share.contributions||[]){const r=store.get(share.by,key);if(r)recipes.push(r);}
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
      shares[id]={kind:req.body.kind,recipeId:recipe?.id,rel:recipe?.title||'Whole cookbook',writable:false,allowAddRecipes:req.body.allowAddRecipes===true,by:req.user.name,label:String(req.body.label||'').slice(0,60),created:Date.now(),expires:days?Date.now()+days*864e5:0,maxUses:0,uses:0};
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
    res.json({kind:share.kind,allowAddRecipes:share.allowAddRecipes===true,recipes:recipes.map(publicRecipe)});
  }));
  const contributor=require('./recipe-routes')({root,config,auth:(req,res,next)=>next()});
  const contributionBudgets=new Map();
  app.use('/api/share/:id/recipes/contribute',(req,res,next)=>{
    const id=req.params.id;
    const check=()=>{const c=context(id);if(c.share.allowAddRecipes!==true)throw Error('Read-only');return c;};
    try{
      const {share}=check(),p=req.path;
      const upload=p.match(/^\/([a-f0-9-]{36})\/upload$/);
      const allowed=req.method==='POST'&&(p==='/'||p==='/import'||upload&&(share.contributions||[]).includes(upload[1])||/^\/uploads\/[a-f0-9-]{36}\/(chunk|finish)$/.test(p))||req.method==='DELETE'&&/^\/uploads\/[a-f0-9-]{36}$/.test(p);
      if(!allowed)return res.status(403).json({error:'This link only allows adding new recipes.'});
      req.user={name:share.by};
      req.recipeContribution={id,check,added:key=>{check();share.contributions=[...(share.contributions||[]),key];saveShares();note(share.by,'recipe-contribution',key);}};
      if(req.method==='POST'&&(p==='/'||p==='/import')){
        const now=Date.now();let budget=contributionBudgets.get(share.by);
        if(!budget||now-budget.at>3600000){budget={at:now,count:0};contributionBudgets.set(share.by,budget);}
        if(++budget.count>30)return res.status(429).json({error:'Recipe contribution limit reached. Try again in an hour.'});
      }
      contributor(req,res,next);
    }catch{return res.status(410).json({error:'This link no longer accepts recipes.'});}
  });
  app.get('/api/share/:id/recipes/assets/:name',route(async(req,res)=>{
    const file=readerAssets.get(req.params.name);
    if(!file)return res.sendStatus(404);
    res.sendFile(file,error=>{if(error&&!res.headersSent)res.status(404).end();});
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
module.exports={mountRecipeShares,isRecipeShare,publicRecipe,recipeSharePage};
