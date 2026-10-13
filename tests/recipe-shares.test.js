'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),express=require('express');
const {createRecipeStore}=require('../lib/recipes');
const {mountRecipeShares,recipeSharePage}=require('../lib/recipe-shares');
const {listSharedLinks}=require('../lib/shared-links');

test('recipe links isolate owners and recipes, include live cookbook additions, and revoke all media',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-recipe-share-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const store=createRecipeStore(path.join(root,'.recipes')),input={title:'Burrito',description:'Dinner',servings:2,ingredients:['200 g chicken'],instructions:['Cook chicken.'],favorite:true};
  const first=store.save('alice',input),second=store.save('alice',{...input,title:'Private soup'}),foreign=store.save('bob',{...input,title:'Bob’s private recipe'});
  store.addShopping('alice',first.id,1);
  const dir=path.join(store.directory('alice'),'media');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'clip.mp4'),'video-fixture');
  store.media('alice',first.id,'video',{file:'clip.mp4',name:'private filename',mime:'video/mp4'});
  await fs.writeFile(path.join(dir,'ai.png'),'ai-photo-fixture');store.media('alice',first.id,'aiImage',{file:'ai.png',name:'private image name',mime:'image/png'});
  let shares={},enabled=true,saved=0;
  const app=express();app.use(express.json());
  const auth=(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={name:'alice',role:'member'};next();};
  const resolveShare=id=>{const share=shares[id];return !share||share.expires&&share.expires<=Date.now()?{error:'gone'}:{share};};
  const context=mountRecipeShares(app,{root,auth,getShares:()=>shares,saveShares:()=>saved++,resolveShare,ownerActive:()=>enabled});
  // Mirrors server startup loading persisted shares after route registration.
  shares={};
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
  const create=(body,authorized=true)=>fetch(base+'/api/shares',{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{Authorization:'test'}:{})},body:JSON.stringify(body)});
  assert.equal((await create({kind:'cookbook'},false)).status,401);
  assert.equal((await create({kind:'recipe',recipeId:foreign.id})).status,404);
  assert.equal((await create({kind:'recipe',recipeId:'../recipes.json'})).status,404);
  const single=await (await create({kind:'recipe',recipeId:first.id,days:7,maxUses:1,by:'bob',writable:true})).json();
  assert.match(single.id,/^[A-Za-z0-9_-]{32}$/);assert.equal(single.writable,false);assert.equal(shares[single.id].by,'alice');assert.equal(shares[single.id].maxUses,0);assert.ok(shares[single.id].expires>Date.now());assert.equal(saved,1);
  const url=base+'/api/share/'+single.id+'/recipes';
  const response=await fetch(url),data=await response.json();assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal(data.recipes.length,1);assert.equal(data.shopping,undefined);assert.equal(data.recipes[0].favorite,undefined);assert.equal(data.recipes[0].video,true);assert.equal(data.recipes[0].by,undefined);assert.equal(data.recipes[0].ingredients.length,1);
  assert.equal(JSON.stringify(data).includes('clip.mp4'),false);
  assert.equal(data.recipes[0].aiImage,true);assert.equal(JSON.stringify(data).includes('ai.png'),false);assert.equal(data.recipes[0].aiStatus,undefined);
  const ai=url+'/'+first.id+'/media/aiImage';assert.equal(await (await fetch(ai)).text(),'ai-photo-fixture');
  assert.equal((await fetch(url+'/'+foreign.id+'/media/aiImage')).status,410);
  const video=url+'/'+first.id+'/media/video';
  const range=await fetch(video,{headers:{Range:'bytes=0-4'}});assert.equal(range.status,206);assert.equal(await range.text(),'video');assert.match(range.headers.get('cache-control'),/no-store/);
  for(const id of [second.id,foreign.id])assert.equal((await fetch(url+'/'+id+'/media/video')).status,410);
  assert.equal((await fetch(url+'/'+first.id+'/media/ingredients')).status,410);
  assert.equal((await fetch(url,{method:'POST'})).status,404);
  const book=await (await create({kind:'cookbook',recipeId:foreign.id})).json(),bookUrl=base+'/api/share/'+book.id+'/recipes';
  // Model Access allowing only /s and /api/share: every reader dependency,
  // including the CSS's relative icon fonts, must stay inside that exception.
  for(const link of [single,book]){
    const html=await recipeSharePage(link.id);
    assert.equal(html.includes('__RECIPE_ASSETS__'),false);
    const assets=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(assets.length,9);
    for(const asset of assets){
      assert.ok(asset.startsWith('/api/share/'+link.id+'/recipes/assets/'),asset);
      const response=await fetch(base+asset);
      assert.equal(response.status,200,asset);
      assert.match(response.headers.get('cache-control'),/no-store/);
      assert.match(response.headers.get('content-type'),asset.includes('.css')?/text\/css/:/javascript/);
      const text=await response.text();
      for(const font of text.matchAll(/url\("(\.\/Phosphor\.[^"]+)"\)/g)){
        const url=new URL(font[1],base+asset);
        assert.ok(url.pathname.startsWith('/api/share/'+link.id+'/recipes/assets/'));
        assert.equal((await fetch(url)).status,200,url.href);
      }
    }
    for(const name of ['server.js','index.html','config.json','__proto__','..%2Fserver.js']){
      assert.equal((await fetch(base+'/api/share/'+link.id+'/recipes/assets/'+name)).status,404);
    }
  }
  const readerAsset=url+'/assets/recipe-model.js';
  assert.equal((await fetch(base+'/api/share/invalid/recipes/assets/recipe-model.js')).status,410);
  assert.equal((await (await fetch(bookUrl)).json()).recipes.length,2);
  store.save('alice',{...input,title:'New addition'});assert.equal((await (await fetch(bookUrl)).json()).recipes.length,3);
  store.save('alice',{...input,title:'Updated burrito'},first.id);assert.equal((await (await fetch(url)).json()).recipes[0].title,'Updated burrito');
  const rows=await listSharedLinks(root,shares,{name:'alice',role:'member'},()=>[],Date.now(),context);assert.equal(rows.length,2);assert.ok(rows.every(row=>row.status==='active'&&!row.writable));assert.ok(rows.some(row=>row.kind==='cookbook'));
  enabled=false;assert.equal((await fetch(bookUrl)).status,410);assert.equal((await fetch(video)).status,410);assert.equal((await fetch(readerAsset)).status,410);enabled=true;
  shares[single.id].expires=Date.now()-1;assert.equal((await fetch(url)).status,410);assert.equal((await fetch(video)).status,410);assert.equal((await fetch(readerAsset)).status,410);shares[single.id].expires=0;
  enabled=false;assert.equal((await fetch(ai)).status,410);enabled=true;
  store.remove('alice',first.id);assert.equal((await fetch(url)).status,410);assert.equal((await fetch(video)).status,410);assert.equal((await (await fetch(bookUrl)).json()).recipes.length,2);
  delete shares[book.id];assert.equal((await fetch(bookUrl)).status,410);assert.equal((await fetch(bookUrl+'/assets/recipes.css')).status,410);
});
