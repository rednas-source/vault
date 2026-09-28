'use strict';
const path=require('node:path');
const {resolveEntry,collectEntries,streamArchive}=require('./archive');
function mountAssetShares(app,{root,library,resolveShare,allowedForOwner}){
  async function context(id){
    const result=resolveShare(id);if(result.error||result.share.kind!=='asset'||result.share.writable||!allowedForOwner(result.share.by).includes('assets'))throw new Error('Link unavailable');
    const folder=await resolveEntry(root,result.share.rel,['assets']);if(!folder.stat.isDirectory())throw new Error('Link unavailable');
    const asset=await library.readPackage(result.share.rel);if(asset.trashedAt)throw new Error("Link unavailable");return {asset,share:result.share};
  }
  const route=fn=>async(req,res)=>{res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');try{await fn(req,res);}catch{if(!res.headersSent)res.status(410).json({error:'This asset link is unavailable or has expired.'});else res.destroy();}};
  app.get('/api/share/:id/asset',route(async(req,res)=>{const {asset:a}=await context(req.params.id);res.json({name:a.name,description:a.description,category:a.category,style:a.style,tags:a.tags,notes:a.notes,license:a.license,primary:a.primary,preview:a.preview,variants:a.variants,technical:a.technical,files:a.files.map(({path,role,label,size,ext})=>({path,role,label,size,ext})),size:a.size});}));
  app.get('/api/share/:id/asset/file',route(async(req,res)=>{
    const {asset}=await context(req.params.id),file=asset.files.find(f=>f.path===req.query.path);if(!file)throw new Error('Unknown file');
    const entry=await resolveEntry(root,asset.rel+'/'+file.path,['assets']);if(!entry.stat.isFile())throw new Error('Unavailable');
    const inline={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',avif:'image/avif',glb:'model/gltf-binary'};
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type',inline[file.ext]||'application/octet-stream');res.setHeader('Content-Disposition',`${req.query.download==='1'||!inline[file.ext]?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(path.basename(file.path))}`);
    res.sendFile(path.basename(entry.full),{root:path.dirname(entry.full),cacheControl:false,dotfiles:'deny'},error=>{if(error&&!res.headersSent)res.status(410).end();});
  }));
  app.get('/api/share/:id/asset/download',route(async(req,res)=>{const {asset}=await context(req.params.id);const entries=await collectEntries(root,[asset.rel],['assets']);streamArchive(res,entries,'Vault-asset.zip');}));
  return context;
}
module.exports={mountAssetShares};
