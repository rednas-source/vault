/* Guest additions use only the permissions carried by their cookbook link. */
const RecipeContribute=(()=>{
 const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mount(root,base,done,cancel){
  let draft={},saved=null,busy=false;
  root.innerHTML=`<section class="rc-contribute"><div class="rc-section-heading"><h1>Add a recipe</h1><button class="rc-button quiet" type="button" data-cancel>Cancel</button></div><p>Your recipe will be added to the owner's cookbook.</p><form data-import><label>Recipe link<input name="url" type="url" placeholder="https://www.instagram.com/reel/…"></label><label>Caption or recipe text<textarea name="text" rows="3"></textarea></label><button class="rc-button" type="submit">Import recipe</button></form><form data-save><div class="rc-fields"><label class="wide">Recipe name<input name="title" maxlength="160" required></label><label class="wide">A short note<textarea name="description" rows="2"></textarea></label><label>Original servings<input name="servings" type="number" min="1" max="1000" value="1" required></label><label>Time<input name="time" maxlength="80" placeholder="30 minutes"></label><label class="wide">Ingredients<textarea name="ingredients" rows="6" required placeholder="200 g chicken&#10;2 tortillas"></textarea></label><label class="wide">How to make it<textarea name="instructions" rows="6" required placeholder="One step per line"></textarea></label><label class="wide">Original recipe link<input name="sourceUrl" type="url"></label><label>Recipe photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><label>Recipe video<input name="video" type="file" accept="video/mp4,video/quicktime,video/webm"></label></div><p data-status role="status"></p><button class="rc-button primary" type="submit">Save recipe</button></form></section>`;
  RecipeLanguage.apply(root);
  const form=root.querySelector('[data-save]'),status=root.querySelector('[data-status]');
  const message=text=>status.textContent=RecipeLanguage.text(text);
  const setBusy=value=>{busy=value;root.querySelectorAll('button').forEach(b=>b.disabled=value);};
  async function request(route,body,raw=false){const res=await fetch(base+'/contribute'+route,{method:'POST',headers:{'Content-Type':raw?'application/octet-stream':'application/json'},body:raw?body:JSON.stringify(body)});const data=await res.json();if(!res.ok)throw Error(data.error||'Could not save this change. Try again.');return data;}
  root.querySelector('[data-cancel]').onclick=()=>{if(!busy)cancel();};
  root.querySelector('[data-import]').onsubmit=async e=>{
    e.preventDefault();e.stopPropagation();if(busy)return;setBusy(true);message('Importing recipe…');
    try{const imported=await request('/import',Object.fromEntries(new FormData(e.target)));draft=imported.draft;for(const key of ['title','description','servings','time','sourceUrl'])form.elements[key].value=draft[key]||'';form.elements.ingredients.value=(draft.ingredients||[]).map(i=>i.original||[i.quantity,i.unit,i.name].filter(Boolean).join(' ')).join('\n');form.elements.instructions.value=(draft.instructions||[]).join('\n');message(imported.message||'Review the recipe before saving.');}catch(error){message(error.message);}finally{setBusy(false);}
  };
  form.onsubmit=async e=>{
    e.preventDefault();e.stopPropagation();if(busy)return;setBusy(true);
    try{
      if(!saved){const fields=Object.fromEntries(new FormData(form));message('Saving recipe…');saved=await request('',{...draft,title:fields.title,description:fields.description,servings:Number(fields.servings),time:fields.time,sourceUrl:fields.sourceUrl,ingredients:fields.ingredients.split('\n').filter(Boolean),instructions:fields.instructions.split('\n').filter(Boolean)});form.querySelectorAll('input:not([type=file]),textarea').forEach(el=>el.disabled=true);}
      for(const kind of ['image','video']){const file=form.elements[kind].files[0];if(!file)continue;message('Uploading '+kind+'…');const upload=await request('/'+saved.id+'/upload',{name:file.name,size:file.size,kind});for(let offset=0;offset<file.size;offset+=upload.chunkSize)await request('/uploads/'+upload.id+'/chunk?offset='+offset,file.slice(offset,offset+upload.chunkSize),true);await request('/uploads/'+upload.id+'/finish',{});form.elements[kind].value='';}
      await done(saved.id);
    }catch(error){message((saved?'Recipe saved. Retry to finish the attachments. ':'')+error.message);}finally{setBusy(false);}
  };
 }
 return {mount};
})();
