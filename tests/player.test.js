'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function load(extra={}){const scope={document:{addEventListener(){}},...extra};vm.runInNewContext(fs.readFileSync(require.resolve('../public/player.js'),'utf8'),scope);return scope;}
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
