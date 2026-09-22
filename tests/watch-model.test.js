'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {episode,groupSeries,seasonName}=require('../public/watch-model');
const file=(name,dir='',extra={})=>({name,dir,rel:`series/${dir?dir+'/':''}${name}`,modified:1,...extra});

test('folder hierarchy identifies generic episode names and preserves paths',()=>{
  const files=[file('02 - Second.mkv','Show A/Season 2'),file('01 - Pilot.mkv','Show A/Season 1'),file('01 - Pilot.mkv','Show B/Season 1')];
  const before=JSON.stringify(files),groups=groupSeries(files);
  assert.equal(groups.length,2);
  assert.deepEqual(groups.find(g=>g.label==='Show A').seasons,[1,2]);
  assert.equal(episode(files[1]).title,'Pilot');
  assert.equal(JSON.stringify(files),before);
  assert.equal(groups[0].files[0],files[1]);
});
test('flat releases, underscores, alternate markers and specials retain episode identity',()=>{
  for(const name of ['The_Show_S03E012_The_Return.mkv','The.Show.3x12.The.Return.mkv']){
    const info=episode(file(name));
    assert.deepEqual([info.show,info.season,info.episode,info.title],['The Show',3,12,'The Return']);
  }
  assert.equal(episode(file('S01E01.mkv','A/Specials')).season,0);
  assert.equal(seasonName(0),'Specials');
  assert.equal(episode(file('unknown.mkv')).season,-1);
});
test('numeric episode order and resume choice are independent of scan order',()=>{
  const files=[file('E10 - Finale.mkv','A/Season 1'),file('E2 - Next.mkv','A/Season 1'),file('E1 - Pilot.mkv','A/Season 1',{watch:{done:true}})];
  let group=groupSeries(files)[0];
  assert.deepEqual(group.files.map(f=>episode(f).episode),[1,2,10]);
  assert.equal(group.representative,files[1]);
  files[0].watch={pos:30,dur:100,at:20};files[1].watch={pos:10,dur:100,at:10};
  group=groupSeries(files)[0];assert.equal(group.representative,files[0]);
  assert.equal(groupSeries([...files,file('sample.mkv','A/Season 1')])[0].files.length,3);
  assert.equal(groupSeries([file('Trailer.Park.Boys.S01E01.mkv')])[0].files.length,1);
});
