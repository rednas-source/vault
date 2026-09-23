'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {subtitleModel,cudaFailure,subtitleEstimate}=require('../lib/subtitle-options');
test('subtitle speed choices respect server defaults and reject arbitrary models',()=>{
  assert.equal(subtitleModel({},'large-v3'),'large-v3');
  assert.equal(subtitleModel({model:'base'},'small'),'base');
  assert.equal(subtitleModel({profile:'fast'},'medium'),'base');
  assert.equal(subtitleModel({model:'../../model'},'small'),'small');
  assert.equal(subtitleModel({profile:'toString'},'small'),'small');
});
test('CUDA diagnostics are distinguishable from ordinary input errors',()=>{
  for(const text of ['libcudnn.so.9 could not be loaded','CUDA driver version is insufficient','cublas64_12.dll missing'])assert(cudaFailure(text));
  assert.equal(cudaFailure('Invalid audio data'),false);
});
test('subtitle ETA is unavailable during setup and derived from actual progress later',()=>{
  assert.equal(subtitleEstimate({},10000).remainingSeconds,null);
  assert.equal(subtitleEstimate({transcribingAt:1000,processedSeconds:120,durationSeconds:600},31000).remainingSeconds,120);
  assert.equal(subtitleEstimate({transcribingAt:1000,processedSeconds:600,durationSeconds:600},31000).remainingSeconds,null);
});
