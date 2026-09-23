'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function load(extra={}){const scope={document:{addEventListener(){}},...extra};vm.runInNewContext(fs.readFileSync(require.resolve('../public/captions.js'),'utf8'),scope);vm.runInNewContext(fs.readFileSync(require.resolve('../public/player.js'),'utf8'),scope);return scope;}
test('buffer readout counts only the contiguous playable range, not a later disconnected segment',()=>{
 const {playerBufferedEnd}=load();const ranges=[[0,10],[20,40]],video={currentTime:5,buffered:{length:2,start:i=>ranges[i][0],end:i=>ranges[i][1]}};
 assert.equal(playerBufferedEnd(video)-video.currentTime,5);video.currentTime=12;assert.equal(playerBufferedEnd(video)-video.currentTime,0);video.currentTime=22;assert.equal(playerBufferedEnd(video)-video.currentTime,18);video.buffered.length=0;assert.equal(playerBufferedEnd(video),22);
});
test('subtitle timing is always based on original cues across HLS offsets and repeated adjustments',()=>{
 const {applySubtitleOffset}=load(),cue={startTime:125,endTime:129},entry={track:{cues:[cue]}};
 applySubtitleOffset(entry,-120);assert.equal(cue.startTime,5);assert.equal(cue.endTime,9);
 applySubtitleOffset(entry,-119.5);assert.equal(cue.startTime,5.5);assert.equal(cue.endTime,9.5);
 applySubtitleOffset(entry,0);assert.equal(cue.startTime,125);assert.equal(cue.endTime,129);
});
test('watch progress preserves full duration and absolute position after source or quality switches',()=>{
 const sent=[],events={};let duration=0,base=0;
 const {trackProgress}=load({fetch:(_url,options)=>{sent.push(JSON.parse(options.body));return Promise.resolve();}});
 const video={currentTime:12,duration:60,addEventListener:(name,listener)=>{events[name]=listener;}};
 trackProgress(video,{rel:'movies/example.mkv'},()=>base,()=>duration);video.__report();assert.deepEqual(sent[0],{rel:'movies/example.mkv',pos:12,dur:60});
 duration=60;base=30;video.currentTime=4;video.duration=12;events.pause();assert.deepEqual(sent[1],{rel:'movies/example.mkv',pos:34,dur:60});
});

test('mini-player geometry stays usable and reachable after resize or old saved positions',()=>{
 const {playerMiniBounds}=load();
 const wide=playerMiniBounds({width:700,left:1400,top:900},{width:1440,height:900,top:80});
 assert.equal(wide.width,700);assert(wide.left+wide.width<=1428);assert(wide.top+wide.height<=888);
 const phone=playerMiniBounds(wide,{width:390,height:844,top:162});
 assert.equal(phone.width,366);assert(phone.left>=12);assert(phone.top>=162);assert.equal(phone.height,phone.width*9/16);
 const short=playerMiniBounds({width:900,left:-100,top:-10},{width:640,height:300,top:124});
 assert(short.top+short.height<=288);assert(short.left>=12);
});

test('AI completion while closed preserves the saved enable intent and retires the pending job',async()=>{
 const storage=new Map([['vault-cc-track:movies/example.mp4','@ai'],['vault-ai-job:movies/example.mp4','job']]);
 const scope=load({$:()=>null,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},fetch:async()=>({ok:true,status:200,json:async()=>({id:'job',status:'complete'})})});
 const task={id:'job',status:'running'};await scope.watchPlayerSubtitleJob({rel:'movies/example.mp4'},task);await new Promise(setImmediate);
 assert.equal(task.status,'complete');assert.equal(task.polling,false);assert.equal(storage.get('vault-cc-track:movies/example.mp4'),'@ai');assert.equal(storage.has('vault-ai-job:movies/example.mp4'),false);
});
test('temporary polling failure retries without marking the completed worker as failed',async()=>{
 let attempt=0,retry;const scope=load({$:()=>null,localStorage:{removeItem(){}},setTimeout:fn=>{retry=fn;},fetch:async()=>{if(!attempt++)throw Error('offline');return {ok:true,status:200,json:async()=>({status:'complete'})};}});
 const task={id:'job',status:'running'};await scope.watchPlayerSubtitleJob({rel:'movies/example.mp4'},task);await new Promise(setImmediate);
 assert.equal(task.status,'running');assert.match(task.message,/Rechecking/);await retry();assert.equal(task.status,'complete');assert.equal(task.polling,false);
});
test('an obsolete subtitle lookup cannot remove the current player tracks',async()=>{
 let resolve,removed=0;const scope=load({url:()=>'/subs',fetch:()=>new Promise(done=>{resolve=done;})});
 const video={isConnected:true,querySelectorAll:()=>[{remove(){removed++;}}]};let current=true;
 const pending=scope.attachSubtitles(video,{rel:'movie'},()=>current);current=false;resolve({ok:true,json:async()=>({tracks:[]})});
 assert.equal(await pending,null);assert.equal(removed,0);
});
test('caption display expires on silence and ignores stale active cues after seeking or switching Off',()=>{
 const {captionTextAt}=load(),cue={startTime:2,endTime:182,text:'A short sentence.'},entry={selected:true,source:'ai',track:{activeCues:[cue]}};
 assert.equal(captionTextAt(entry,3),'A short sentence.');assert.equal(captionTextAt(entry,30),'');assert.equal(captionTextAt(entry,1),'');
 entry.source='file';assert.equal(captionTextAt(entry,30),'A short sentence.');entry.selected=false;assert.equal(captionTextAt(entry,3),'');
});
test('AI silence guard survives timing offsets without accumulating changes or altering external tracks',()=>{
 const {applySubtitleOffset}=load(),cue={startTime:125,endTime:300,text:'Hello.'},entry={source:'ai',track:{cues:[cue]}};
 applySubtitleOffset(entry,-120);assert.equal(cue.startTime,5);assert.equal(cue.endTime,8);
 applySubtitleOffset(entry,-119);assert.equal(cue.endTime,9);applySubtitleOffset(entry,0);assert.equal(cue.endTime,128);
 const authored={startTime:0,endTime:90,text:'Title card'};applySubtitleOffset({source:'file',track:{cues:[authored]}},0);assert.equal(authored.endTime,90);
});
test('caption preferences and drag bounds stay safe after moving from theater to a small player',()=>{
 const {captionPreferences,captionPosition}=load();
 const prefs=captionPreferences({font:'bad',size:500,outline:'yes',position:{x:-2,y:4}});assert.equal(prefs.font,'sans');assert.equal(prefs.size,1);assert.equal(prefs.outline,false);assert.equal(prefs.position.y,1);
 const point=captionPosition(prefs.position,{width:320,height:180},{width:280,height:32},70);
 assert(point.x>=148&&point.x<=172);assert(point.y>=24&&point.y<=86);
});
