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

  console.log('Collaborative folder share integration OK.');
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
