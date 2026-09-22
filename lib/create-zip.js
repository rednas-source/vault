'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const archiver = require('archiver');
const { collectEntries, resolveEntry } = require('./archive');

const invalid = (message, status = 400) => Object.assign(new Error(message), { status });

async function createZip(root, { rels, destination, name }, allowed, { signal, onProgress = () => {} } = {}) {
  if (typeof name === 'string') name = name.trim();
  if (typeof name !== 'string' || !name.trim() || name.startsWith('.') || /[<>:"/\\|?*\x00-\x1f]/.test(name) || name.length > 180 || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
    throw invalid('Enter an archive name without path separators or special characters.');
  }
  if (!/\.zip$/i.test(name)) name += '.zip';
  const target = await resolveEntry(root, destination, allowed);
  if (!target.stat.isDirectory()) throw invalid('Choose a folder for the ZIP.');
  const full = path.join(target.full, name);
  try { await fsp.lstat(full); throw invalid('A file with that name already exists. Choose another name.', 409); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Snapshot before creating output so an archive inside a selected folder never includes itself.
  const entries = await collectEntries(root, rels, allowed);
  signal?.throwIfAborted();
  const roots = [...new Set(rels)].filter(rel => !rels.some(parent => parent !== rel && rel.startsWith(parent + '/')));
  const common = roots[0].split('/').slice(0, -1);
  for (const rel of roots) while (common.length && !rel.startsWith(common.join('/') + '/')) common.pop();
  const prefix = common.length ? common.join('/').length + 1 : 0;
  const temporary = path.join(target.full, `.vault-zip-${crypto.randomBytes(12).toString('hex')}.part`);
  const archive = archiver('zip', { zlib: { level: 6 }, forceZip64: true });
  const output = fs.createWriteStream(temporary, { flags: 'wx' });
  archive.on('warning', error => archive.destroy(error));
  archive.on('progress', progress => onProgress({ processed: progress.entries.processed, total: entries.length }));
  try {
    const transfer = pipeline(archive, output, { signal });
    // Handle stream failures immediately, including before finalize completes.
    transfer.catch(() => {});
    for (const entry of entries) {
      const entryName = entry.rel.slice(prefix);
      if (entry.stat.isDirectory()) archive.append('', { name: entryName + '/', date: entry.stat.mtime });
      else archive.file(entry.full, { name: entryName, date: entry.stat.mtime });
    }
    await Promise.all([archive.finalize(), transfer]);
    signal?.throwIfAborted();
    // Recheck the destination and publish exclusively: never replace an existing file.
    await resolveEntry(root, destination, allowed);
    await fsp.link(temporary, full);
    return { rel: `${destination}/${name}`, name, size: (await fsp.stat(full)).size };
  } catch (error) {
    archive.abort(); output.destroy();
    if (!output.closed) await new Promise(resolve => output.once('close', resolve));
    if (error.code === 'EEXIST') throw invalid('A file with that name already exists. Choose another name.', 409);
    throw error;
  } finally { await fsp.unlink(temporary).catch(() => {}); }
}

module.exports = { createZip };
