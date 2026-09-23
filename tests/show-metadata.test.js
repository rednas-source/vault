'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createShowMetadata, showIdentity, chooseShow } = require('../lib/show-metadata');
const file = (name = '01 - Pilot.mkv', dir = 'Example Show (2020)/Season 1') => ({ name, dir });
const show = { id: 42, name: 'Example Show', premiered: '2020-01-01', summary: '<p>A show &amp; its story.</p>', genres: ['Drama'], image: { original: 'https://static.tvmaze.com/uploads/poster.jpg' } };

test('show identity follows folders or episode filenames, keeping remakes distinct', () => {
  assert.equal(showIdentity(file()).key, showIdentity(file('S02E03.mkv', 'Example Show (2020)/Season 2')).key);
  assert.equal(showIdentity(file('Example.Show.(2020).S01E01.mkv', '')).key, 'example show:2020');
  assert.equal(showIdentity(file('Example.Show.2020.S01E01.mkv', '')).key, 'example show:2020');
  assert.equal(showIdentity(file('1899.S01E01.mkv', '')).title, '1899');
  assert.equal(showIdentity(file('Complete.Savages.S01E01.mkv', '')).title, 'Complete Savages');
  assert.equal(showIdentity(file('unknown.mkv', '')).valid, false);
  assert.equal(chooseShow([{ show: { ...show, id: 1, premiered: '1990-01-01' } }, { show }], showIdentity(file())).id, 42);
  assert.equal(chooseShow([{ show: { ...show, name: 'Completely different' } }], showIdentity(file())), undefined);
});

test('automatic warming deduplicates episodes, persists across restart, and maps artwork without a key', async t => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-shows-'));
  t.after(() => fs.rm(cacheDir, { recursive: true, force: true }));
  const requests = [];
  const fetchImpl = async url => {
    requests.push(url);
    return { ok: true, json: async () => url.includes('/search/') ? [{ show }] : url.endsWith('/cast') ? [{ person: { name: 'Actor' }, character: { name: 'Character' } }] : [{ type: 'background', resolutions: { original: { url: 'https://static.tvmaze.com/uploads/backdrop.jpg' } } }] };
  };
  const service = createShowMetadata({ cacheDir, fetchImpl, requestGap: 0 });
  const files = [file(), file('02.mkv'), file('03.mkv', 'Example Show (2020)/Season 2')];
  await Promise.all([service.warm(files), ...files.map(item => service.get(item))]);
  assert.equal(requests.length, 3);
  const result = await createShowMetadata({ cacheDir, fetchImpl, requestGap: 0 }).get(files[2]);
  assert.equal(requests.length, 3);
  assert.equal(result.title, 'Example Show');
  assert.equal(result.overview, 'A show & its story.');
  assert.equal(result.provider, 'TVmaze');
  assert.equal(result.cast[0].name, 'Actor');
  assert(result.poster && result.backdrop);
});

test('temporary failures retry after expiry and preserve previously fetched show metadata', async t => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-shows-'));
  t.after(() => fs.rm(cacheDir, { recursive: true, force: true }));
  let time = 1000, down = true, calls = 0;
  const service = createShowMetadata({ cacheDir, now: () => time, requestGap: 0, fetchImpl: async url => {
    calls++;
    if (down) throw new Error('offline');
    return { ok: true, json: async () => url.includes('/search/') ? [{ show }] : [] };
  } });
  assert.equal((await service.get(file())).found, false);
  await service.get(file()); assert.equal(calls, 1);
  down = false; time += 6 * 60e3;
  assert.equal((await service.get(file())).found, true);
  down = true; time += 8 * 86400e3;
  assert.equal((await service.get(file())).title, 'Example Show');
});

test('configured TMDB results are preferred and missing art falls back automatically', async t => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-shows-'));
  t.after(() => fs.rm(cacheDir, { recursive: true, force: true }));
  const matched = createShowMetadata({ cacheDir, lookupTmdb: async () => ({ found: true, title: show.name, year: '2020', poster: 'poster.jpg' }), fetchImpl: () => { throw new Error('should not fetch'); } });
  assert.equal((await matched.get(file())).poster, 'poster.jpg');
  const fallback = createShowMetadata({ cacheDir: path.join(cacheDir, 'fallback'), requestGap: 0, lookupTmdb: async () => ({ found: false }), fetchImpl: async url => ({ ok: true, json: async () => url.includes('/search/') ? [{ show }] : [] }) });
  assert.equal((await fallback.get(file())).provider, 'TVmaze');
});

test('manual scans bypass both cached misses and successful artwork before expiry', async t => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-shows-'));
  t.after(() => fs.rm(cacheDir, { recursive: true, force: true }));
  let found=false,version=1,calls=0;
  const service=createShowMetadata({cacheDir,requestGap:0,fetchImpl:async url=>{
    calls++;return {ok:true,json:async()=>url.includes('/search/')?(found?[{show:{...show,summary:'Version '+version}}]:[]):[]};
  }});
  assert.equal((await service.get(file())).found,false);found=true;
  assert.equal((await service.get(file())).found,false);assert.equal(calls,1);
  assert.equal((await service.get(file(),{force:true})).overview,'Version 1');
  version=2;assert.equal((await service.get(file(),{force:true})).overview,'Version 2');
  assert.equal((await createShowMetadata({cacheDir,fetchImpl:()=>{throw new Error('cached')}}).get(file())).overview,'Version 2');
});
