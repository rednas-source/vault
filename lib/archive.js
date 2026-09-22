'use strict';

const fsp = require('fs/promises');
const path = require('path');
const archiver = require('archiver');

// Resolve every component without following symlinks, including shelf roots.
async function resolveEntry(root, rel, allowed) {
  if (typeof rel !== 'string' || rel.includes('\\') || rel.includes('\0')) throw new Error('Invalid path');
  const parts = rel.split('/');
  if (!parts.length || parts.some(p => !p || p === '.' || p === '..' || p.startsWith('.')) || !allowed.includes(parts[0])) {
    throw new Error('Invalid path or shelf');
  }
  let full = root;
  let stat;
  for (const part of parts) {
    full = path.join(full, part);
    if (!full.startsWith(root + path.sep)) throw new Error('Invalid path');
    stat = await fsp.lstat(full);
    if (stat.isSymbolicLink()) throw new Error('Symbolic links cannot be downloaded');
  }
  if (!stat.isFile() && !stat.isDirectory()) throw new Error('Unsupported entry');
  return { full, rel, stat };
}

async function collectEntries(root, rels, allowed) {
  if (!Array.isArray(rels) || !rels.length || rels.length > 500) throw new Error('Select between 1 and 500 items');
  const selected = await Promise.all([...new Set(rels)].map(rel => resolveEntry(root, rel, allowed)));
  const roots = selected.filter(entry => !selected.some(parent => parent !== entry && entry.rel.startsWith(parent.rel + '/')));
  const entries = [];
  async function walk(entry) {
    entries.push(entry);
    if (!entry.stat.isDirectory()) return;
    const children = await fsp.readdir(entry.full, { withFileTypes: true });
    for (const child of children) {
      if (child.name.startsWith('.') || child.isSymbolicLink()) continue;
      await walk(await resolveEntry(root, `${entry.rel}/${child.name}`, allowed));
    }
  }
  for (const entry of roots) await walk(entry);
  return entries;
}

function streamArchive(res, entries, filename = 'Vault-download.zip') {
  // Stored ZIP64 streams large, already-compressed files without buffering them.
  const archive = archiver('zip', { store: true, forceZip64: true });
  res.attachment(filename);
  res.setHeader('Cache-Control', 'private, no-store');
  archive.on('error', err => res.destroy(err));
  archive.on('warning', err => res.destroy(err));
  res.on('close', () => archive.abort());
  archive.pipe(res);
  for (const entry of entries) {
    if (entry.stat.isDirectory()) archive.append('', { name: entry.rel + '/', date: entry.stat.mtime });
    // file() opens lazily; opening every stream here exhausts file descriptors
    // when a folder contains thousands of files.
    else archive.file(entry.full, { name: entry.rel, date: entry.stat.mtime });
  }
  archive.finalize().catch(err => res.destroy(err));
}

module.exports = { resolveEntry, collectEntries, streamArchive };
