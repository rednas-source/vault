'use strict';

const fs = require('fs/promises');
const path = require('path');
const { resolveEntry } = require('./archive');

function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function selectedEntries(root, rels, allowed) {
  if (!Array.isArray(rels) || !rels.length || rels.length > 500) throw invalid('Select between 1 and 500 items.');
  const entries = await Promise.all([...new Set(rels)].map(async rel => {
    if (typeof rel !== 'string' || !rel.includes('/')) throw invalid('Shelf roots cannot be moved, renamed, or deleted.');
    try { return await resolveEntry(root, rel, allowed); }
    catch { throw invalid('An item is missing or you do not have access. Refresh and try again.', 404); }
  }));
  return entries.filter(entry => !entries.some(parent => parent !== entry && entry.rel.startsWith(parent.rel + '/')));
}

async function operate(root, { action, rels, destination, name }, allowed) {
  if (!['move', 'delete', 'rename'].includes(action)) throw invalid('Unknown file action.');
  const entries = await selectedEntries(root, rels, allowed);
  let target;
  if (action === 'move') {
    try { target = await resolveEntry(root, destination, allowed); }
    catch { throw invalid('The destination is missing or you do not have access.', 404); }
    if (!target.stat.isDirectory()) throw invalid('Choose a destination folder.');
    if (entries.some(e => destination === e.rel || destination.startsWith(e.rel + '/'))) {
      throw invalid('A folder cannot be moved into itself or one of its subfolders.');
    }
  }
  if (action === 'rename' && (entries.length !== 1 || typeof name !== 'string' || !name.trim()
      || name.startsWith('.') || /[<>:"/\\|?*\x00-\x1f]/.test(name) || name.length > 200)) {
    throw invalid('Enter a name without path separators or special characters.');
  }
  const planned = new Set();
  const plan = [];
  // Validate every destination first. Conflicts never merge folders or overwrite.
  for (const entry of entries) {
    let to = null;
    if (action !== 'delete') {
      to = path.join(action === 'move' ? target.full : path.dirname(entry.full), action === 'rename' ? name : path.basename(entry.full));
      if (to !== entry.full) {
        const key = process.platform === 'win32' ? to.toLowerCase() : to;
        if (planned.has(key)) throw invalid('Two selected items have the same name. Rename one first.', 409);
        planned.add(key);
        try { await fs.lstat(to); throw invalid('An item with that name already exists in the destination. Rename it first.', 409); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
    plan.push({ ...entry, to });
  }
  let done = 0;
  const failed = [];
  const changes = [];
  for (const entry of plan) {
    try {
      if (action === 'delete') await fs.rm(entry.full, { recursive: entry.stat.isDirectory() });
      else if (entry.to !== entry.full) await fs.rename(entry.full, entry.to);
      changes.push({ from: entry.rel, to: entry.to ? path.relative(root, entry.to).split(path.sep).join('/') : null });
      done++;
    } catch { failed.push(entry.rel); }
  }
  return { done, failed: failed.length, changes };
}

async function createFile(root, { shelf, directory = '', name }, allowed) {
  if (typeof name !== 'string' || !name.trim() || name !== name.trim() || name.startsWith('.')
      || name.endsWith('.') || /[<>:"/\\|?*\x00-\x1f]/.test(name) || name.length > 200
      || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
    throw invalid('Enter a file name without path separators or special characters.');
  }
  if (typeof shelf !== 'string' || shelf.includes('/') || typeof directory !== 'string') throw invalid('Invalid destination.');
  if (!allowed.includes(shelf)) throw invalid('No permission for that shelf.', 403);
  let parent;
  try { parent = await resolveEntry(root, directory ? `${shelf}/${directory}` : shelf, allowed); }
  catch { throw invalid('The destination folder is missing or unavailable.', 404); }
  if (!parent.stat.isDirectory()) throw invalid('Choose a destination folder.');
  try { await fs.writeFile(path.join(parent.full, name), '', { flag:'wx' }); }
  catch (error) {
    if (error.code === 'EEXIST') throw invalid('An item with that name already exists.', 409);
    throw error;
  }
  return { name, shelf, rel:`${parent.rel}/${name}` };
}

module.exports = { operate, createFile };
