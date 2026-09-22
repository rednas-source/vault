(function(root,factory){
  const model=factory();
  if(typeof module==='object'&&module.exports)module.exports=model;
  else root.WatchModel=model;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const tidy=value=>String(value||'').replace(/[._]+/g,' ').replace(/\s+/g,' ').trim();
  function episode(file){
    const name=file.name||'',parts=(file.dir||'').split('/').filter(Boolean);
    const match=/(?:^|[ ._-])S(\d{1,3})[ ._-]*E(\d{1,4})(?!\d)/i.exec(name)||/(?:^|[ ._-])(\d{1,3})x(\d{1,4})(?!\d)/i.exec(name);
    const folderIndex=parts.findIndex(part=>/^(?:season[ ._-]*\d+|s\d{1,3}|specials)(?:\b|$)/i.test(part));
    const folder=folderIndex>=0?parts[folderIndex]:'';
    const folderSeason=/^specials/i.test(folder)?0:Number((folder.match(/\d+/)||[])[0]);
    const inferred=/^(?:E(?:pisode)?[ ._-]*)?(\d{1,4})(?:[ ._-]|$)/i.exec(name);
    const season=folder?folderSeason:match?Number(match[1]):parts.length?1:-1;
    const number=match?Number(match[2]):inferred?Number(inferred[1]):null;
    const showPath=folderIndex>0?parts.slice(0,folderIndex).join('/'):folderIndex<0?parts.slice(0,1).join('/'):'';
    const parsedShow=match?tidy(name.slice(0,match.index)).replace(/[\s-]+$/,''):'';
    const show=showPath?tidy(showPath.split('/').pop()):parsedShow||'Unsorted shows';
    const key=showPath?`folder:${showPath.toLowerCase()}`:`title:${show.toLowerCase()}`;
    let title=name.replace(/\.[^.]+$/,'');
    if(match)title=title.slice(match.index+match[0].length);
    else if(inferred)title=title.slice(inferred[0].length);
    title=tidy(title.replace(/\[[^\]]*\]/g,'')).replace(/^[\s-]+|[\s-]+$/g,'');
    const noise=title.search(/\b(?:720p|1080p|2160p|WEBRip|WEB[ -]DL|BluRay|x26[45]|HEVC)\b/i);
    if(noise>=0)title=title.slice(0,noise).replace(/[\s-]+$/,'');
    return {show,key,season,episode:number,title:title||(number===null?'Episode':`Episode ${number}`)};
  }
  function groupSeries(files){
    const groups=new Map();
    for(const file of files){
      const info=episode(file);
      if(info.episode===null&&/(?:^|[\/ ._-])(?:sample|trailer|featurette)(?:[\/ ._-]|$)/i.test(file.name))continue;
      if(!groups.has(info.key))groups.set(info.key,{key:info.key,label:info.show,files:[]});
      groups.get(info.key).files.push(file);
    }
    return [...groups.values()].map(group=>{
      group.files.sort((a,b)=>{const ea=episode(a),eb=episode(b);return ea.season-eb.season||(ea.episode??Infinity)-(eb.episode??Infinity)||a.name.localeCompare(b.name,undefined,{numeric:true});});
      group.seasons=[...new Set(group.files.map(file=>episode(file).season))].sort((a,b)=>a-b);
      const partial=group.files.filter(file=>file.watch&&!file.watch.done&&file.watch.pos>0).sort((a,b)=>(b.watch.at||0)-(a.watch.at||0));
      group.representative=partial[0]||group.files.find(file=>!file.watch?.done)||group.files[0];
      group.modified=Math.max(...group.files.map(file=>file.modified||0));
      return group;
    }).sort((a,b)=>b.modified-a.modified||a.label.localeCompare(b.label));
  }
  const seasonName=season=>season===0?'Specials':season<0?'Unsorted episodes':`Season ${season}`;
  return {episode,groupSeries,seasonName};
});
