'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { createZip } = require('../lib/create-zip');
const { listSharedLinks } = require('../lib/shared-links');

// Inspect the central directory and decompress these small fixture entries.
function readZip(buffer) {
  const entries = new Map();
  let offset = buffer.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  while (offset >= 0 && buffer.readUInt32LE(offset) === 0x02014b50) {
    const method = buffer.readUInt16LE(offset + 10), size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString();
    const local = buffer.readUInt32LE(offset + 42);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const body = buffer.subarray(start, start + size);
    entries.set(name, method === 8 ? zlib.inflateRawSync(body).toString() : body.toString());
    offset += 46 + nameLength + extra + comment;
  }
  return entries;
}

test('saved ZIPs contain nested and empty folders, deduplicate selections, and leave originals intact', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-zip-'));
  try {
    await fs.mkdir(path.join(root, 'docs/Project/Empty'), { recursive: true });
    await fs.mkdir(path.join(root, 'docs/Project/Notes'));
    const content = 'readable content\n'.repeat(200);
    await fs.writeFile(path.join(root, 'docs/Project/Notes/Readme.txt'), content);
    await fs.writeFile(path.join(root, 'docs/Project/.private'), 'hidden');
    const result = await createZip(root, { rels: ['docs/Project','docs/Project/Notes/Readme.txt'], destination: 'docs/Project', name: 'Saved archive' }, ['docs']);
    assert.equal(result.rel, 'docs/Project/Saved archive.zip');
    const entries = readZip(await fs.readFile(path.join(root, result.rel)));
    assert.deepEqual([...entries.keys()].sort(), ['Project/','Project/Empty/','Project/Notes/','Project/Notes/Readme.txt']);
    assert.equal(entries.get('Project/Notes/Readme.txt'), content);
    assert.equal(await fs.readFile(path.join(root, 'docs/Project/Notes/Readme.txt'), 'utf8'), content);
    assert(!(await fs.readdir(path.join(root, 'docs/Project'))).some(name => name.endsWith('.part')));
    await assert.rejects(createZip(root, { rels: ['docs/Project'], destination: 'docs/Project', name: 'Saved archive.zip' }, ['docs']), error => error.status === 409);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('ZIP publication never overwrites competing jobs and rejects inaccessible or unsafe paths', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-zip-safety-'));
  try {
    await fs.mkdir(path.join(root, 'docs'));await fs.mkdir(path.join(root, 'private'));
    await fs.writeFile(path.join(root, 'docs/A.txt'), 'A');await fs.writeFile(path.join(root, 'private/Secret.txt'), 'secret');
    const request = { rels: ['docs/A.txt'], destination: 'docs', name: 'Together.zip' };
    const results = await Promise.allSettled([createZip(root, request, ['docs']),createZip(root, request, ['docs'])]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(readZip(await fs.readFile(path.join(root, 'docs/Together.zip'))).get('A.txt'), 'A');
    for (const change of [{ name:'../bad.zip' }, { name:'.hidden.zip' }, { name:' .hidden.zip' }, { name:'CON.zip' }, { name:' CON.zip' }, { destination:'private' }, { rels:['private/Secret.txt'] }, { rels:['docs/../private/Secret.txt'] }, { rels:[] }]) {
      await assert.rejects(createZip(root, { ...request, name:'new.zip', ...change }, ['docs']));
    }
    const controller = new AbortController();controller.abort();
    await assert.rejects(createZip(root, { ...request, name:'cancelled.zip' }, ['docs'], { signal:controller.signal }));
    assert.deepEqual((await fs.readdir(path.join(root, 'docs'))).sort(), ['A.txt','Together.zip']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('shared-link overview scopes ownership and reports remaining limits, expiry and missing files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-shares-'));
  try {
    await fs.mkdir(path.join(root, 'docs'));await fs.writeFile(path.join(root, 'docs/A.txt'), 'A');
    const now=Date.now(),base={rel:'docs/A.txt',by:'alice',created:now,expires:0,maxUses:5,uses:2};
    const shares={active:{...base},expired:{...base,expires:now-1},spent:{...base,uses:7},unlimited:{...base,maxUses:0},missing:{...base,rel:'docs/missing.txt'},other:{...base,by:'bob'}};
    const mine=await listSharedLinks(root,shares,{name:'alice',role:'user'},()=>['docs'],now);
    assert.equal(mine.length,5);assert(!mine.some(link=>link.by==='bob'));
    const find=id=>mine.find(link=>link.id===id);
    assert.equal(find('active').remaining,3);assert.equal(find('active').status,'active');
    assert.equal(find('expired').status,'expired');assert.equal(find('spent').remaining,0);assert.equal(find('spent').status,'exhausted');
    assert.equal(find('unlimited').remaining,null);assert.equal(find('missing').status,'missing');
    assert.equal((await listSharedLinks(root,shares,{name:'owner',role:'admin'},()=>['docs'],now)).length,6);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
