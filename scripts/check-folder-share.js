'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const repo = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(repo, '.tmp-share-test-'));
const logs = [];
let child;

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    server.close((error) => error ? reject(error) : resolve(port));
  });
});

async function main() {
  const port = await freePort();
  const indexHtml = await fsp.readFile(path.join(repo, 'public', 'index.html'), 'utf8');
  const libraryActions = await fsp.readFile(path.join(repo, 'public', 'library-actions.js'), 'utf8');
  assert(
    indexHtml.includes('class="media-folder-chip" data-rel="${esc(f.rel)}"')
      && indexHtml.includes('class="tile folder-tile" data-act="folder" data-i="${i}" data-rel="${esc(f.rel)}"'),
    'Entertainment folder cards are missing stable paths for their context menus',
  );
  assert(
    libraryActions.includes("querySelectorAll('.media-folder-chip[data-rel],.folder-tile[data-rel]')")
      && libraryActions.includes('showFileMenu(folder,event)'),
    'Entertainment folder cards are not wired to the folder action menu',
  );
  await fsp.cp(path.join(repo, 'public'), path.join(temp, 'public'), { recursive: true });
  await fsp.cp(path.join(repo, 'lib'), path.join(temp, 'lib'), { recursive: true });
  await fsp.copyFile(path.join(repo, 'server.js'), path.join(temp, 'server.js'));
  await fsp.writeFile(path.join(temp, 'config.json'), JSON.stringify({
    port, bind: '127.0.0.1', https: false,
    storagePath: path.join(temp, 'storage'),
    sessionSecret: 'integration-test-secret-that-is-long-and-random-enough',
    users: { tester: 'correct-horse-battery-staple' },
    transcodeEncoder: 'cpu',
  }));

  child = spawn(process.execPath, ['server.js'], { cwd: temp, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString()));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* booting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert(Date.now() < deadline, `Test server did not start:\n${logs.join('')}`);

  for(const origin of ['https://foreign.example','null']){
    const blocked=await fetch(`${base}/api/login`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:'{}'});
    assert(blocked.status===403,'Cross-origin browser mutation was accepted');
  }

  const games=await fetch(`${base}/games/`);
  assert(games.ok && (await games.text()).includes('id="publicGames"'), 'Public Games directory is unavailable');
  assert((await fetch(`${base}/games/games.js`)).ok, 'Public Games player script is unavailable');
  assert((await fetch(`${base}/games/games.css`)).ok, 'Games assets must stay inside the public games path');
  assert((await fetch(`${base}/games/geist.woff2`)).ok, 'Games font must stay inside the public games path');
  assert((await fetch(`${base}/api/files`)).status===401, 'Public games must not expose Vault files');
  assert((await fetch(`${base}/api/economy`)).status===401, 'Public games must not expose financial experiments');
  const login = await fetch(`${base}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'tester', pass: 'correct-horse-battery-staple' }),
  });
  assert(login.ok, `Login failed: ${await login.text()}`);
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const authed = (url, options = {}) => fetch(`${base}${url}`, {
    ...options, headers: { ...(options.headers || {}), Cookie: cookie },
  });
  const json = async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  };

  await json(await authed('/api/folders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shelf: 'docs', directory: '', name: 'Shared drop' }),
  }));
  const created = await json(await authed('/api/shares', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rel: 'docs/Shared drop', days: 1, maxUses: 1 }),
  }));
  assert(created.kind === 'folder' && created.writable === true, 'Folder share was not writable');
  const share = `${base}/api/share/${created.id}`;

  let listing = await json(await fetch(`${share}/list`));
  assert(listing.root === 'Shared drop' && listing.entries.length === 0, 'Unexpected initial folder listing');
  await json(await fetch(`${share}/folders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory: '', name: 'Incoming' }),
  }));

  const payload = Buffer.from('hello collaborative vault');
  const init = await json(await fetch(`${share}/upload/init`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'hello.txt', size: payload.length, directory: 'Incoming' }),
  }));
  await json(await fetch(`${share}/upload/chunk/${init.id}?offset=0`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: payload,
  }));
  const finished = await json(await fetch(`${share}/upload/finish/${init.id}`, { method: 'POST' }));
  assert(finished.path === 'Incoming/hello.txt', 'Upload landed at the wrong path');

  listing = await json(await fetch(`${share}/list?dir=Incoming`));
  assert(listing.entries.some((entry) => entry.name === 'hello.txt'), 'Uploaded file is missing');
  const downloaded = await fetch(`${share}/item?path=${encodeURIComponent('Incoming/hello.txt')}`);
  assert(downloaded.ok && await downloaded.text() === payload.toString(), 'Downloaded bytes do not match');
  const fileShare = await json(await authed('/api/shares', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rel: 'docs/Shared drop/Incoming/hello.txt', days: 1, maxUses: 1 }),
  }));
  assert(fileShare.kind === 'file' && fileShare.writable === false, 'File share became writable');
  const fileListAttempt = await fetch(`${base}/api/share/${fileShare.id}/list`);
  assert(fileListAttempt.status === 403, `File share exposed folder listing (${fileListAttempt.status})`);
  const sharedFile = await fetch(`${base}/api/share/${fileShare.id}/file`);
  assert(sharedFile.ok && await sharedFile.text() === payload.toString(), 'Read-only file share stopped working');

  const traversal = await fetch(`${share}/item?path=${encodeURIComponent('../users.json')}`);
  assert(traversal.status === 400, `Traversal was not rejected (${traversal.status})`);

  const renamed = await json(await fetch(`${share}/item`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'Incoming/hello.txt', name: 'renamed.txt' }),
  }));
  assert(renamed.path === 'Incoming/renamed.txt', 'Rename returned the wrong path');
  await json(await fetch(`${share}/item?path=${encodeURIComponent('Incoming/renamed.txt')}`, { method: 'DELETE' }));
  await json(await fetch(`${share}/item?path=Incoming`, { method: 'DELETE' }));

  const pending = await json(await fetch(`${share}/upload/init`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'revoked.txt', size: 3, directory: '' }),
  }));
  await json(await authed(`/api/shares/${created.id}`, { method: 'DELETE' }));
  const afterRevoke = await fetch(`${share}/upload/chunk/${pending.id}?offset=0`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.from('bye'),
  });
  assert(afterRevoke.status === 410, `Revoked link still accepted an upload (${afterRevoke.status})`);

  const recipe = await json(await authed('/api/recipes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({title:'Share test burrito',servings:2,ingredients:['200 g chicken'],instructions:['Cook chicken.']}),
  }));
  for (const kind of ['recipe','cookbook']) {
    const link = await json(await authed('/api/shares', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({kind,recipeId:recipe.id}),
    }));
    const page = await fetch(base+link.url);
    assert(page.ok, `${kind} share page failed`);
    const html = await page.text();
    assert(!html.includes('__RECIPE_ASSETS__'), 'Share asset URLs were not resolved');
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      assert(match[1].startsWith(`/api/share/${link.id}/recipes/assets/`), 'Reader depends on a protected URL');
      assert((await fetch(base+match[1])).ok, `Missing recipe reader asset: ${match[1]}`);
    }
    const shared = await json(await fetch(`${base}/api/share/${link.id}/recipes`));
    assert(shared.recipes.some(item=>item.title==='Share test burrito'), 'Shared recipe is missing');
  }
  console.log('Collaborative folder and recipe share integration OK.');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  if (logs.length) console.error(logs.join(''));
  process.exitCode = 1;
}).finally(async () => {
  if (child && child.exitCode === null) {
    const closed = new Promise((resolve) => child.once('close', resolve));
    child.kill('SIGTERM');
    await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 3000))]);
  }
  const resolved = path.resolve(temp);
  if (resolved.startsWith(repo + path.sep) && path.basename(resolved).startsWith('.tmp-share-test-')) {
    await fsp.rm(resolved, { recursive: true, force: true }).catch(() => {});
  }
});
