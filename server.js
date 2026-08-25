/**
 * VAULT — private file vault
 * Single-file Node/Express backend. Run on your own machine, expose via Cloudflare Tunnel.
 */

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

// ---------------------------------------------------------------- config

const CONFIG_PATH = path.join(__dirname, 'config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch {
  console.error('No config.json found. Copy config.example.json to config.json first.');
  process.exit(1);
}

const PORT = process.env.PORT || config.port || 8420;
// A deliberately visible deployment fingerprint. It is returned by both the
// session and health endpoints so an operator can prove which process is live.
const BUILD_ID = 'vault-cinema-rails-convert-20260825';
const ROOT = path.resolve(config.storagePath || path.join(__dirname, 'storage'));
const SECRET = config.sessionSecret;
const MAX_DAYS = config.sessionDays || 30;
const USERS_PATH = path.join(__dirname, 'users.json');
const MAX_BYTES = (config.maxFileGB || 64) * 1024 ** 3;

// Scratch space for in-flight chunked uploads, and the thumbnail cache.
// Both live under ROOT so a part-file and its final home are on one
// filesystem — that makes the finishing move an atomic rename, not a copy.
const PARTS_DIR = path.join(ROOT, '.uploads');
const THUMB_DIR = path.join(ROOT, '.thumbs');
const HLS_DIR = path.join(ROOT, '.hls');
const CONVERSION_DIR = path.join(ROOT, '.conversions');

const PART_TTL_MS = (config.partTtlHours || 24) * 3600 * 1000;

if (!SECRET || SECRET === 'CHANGE-ME') {
  console.error('Set a real sessionSecret in config.json.');
  process.exit(1);
}

// ---------------------------------------------------------------- shelves
/**
 * Shelves are data, not a constant — they live in shelves.json and are edited
 * from the admin panel. Each has a stable `id` (which is also the folder name
 * on disk and what permissions refer to) and a `label` that can be renamed
 * freely without touching either.
 */
const SHELVES_PATH = path.join(__dirname, 'shelves.json');

const DEFAULT_SHELVES = [
  { id: 'movies',   label: 'Movies',    exts: ['mp4','mkv','avi','mov','webm','m4v','wmv','flv','mpg','mpeg','ts'] },
  { id: 'series',   label: 'Series',    exts: [] },
  { id: 'music',    label: 'Music',     exts: ['mp3','flac','wav','aac','ogg','m4a','opus','wma','aiff'] },
  { id: 'photos',   label: 'Photos',    exts: ['jpg','jpeg','png','gif','webp','bmp','svg','heic','tiff','avif'] },
  { id: 'docs',     label: 'Documents', exts: ['pdf','doc','docx','txt','md','epub','mobi','xlsx','pptx','csv','rtf'] },
  { id: 'archives', label: 'Archives',  exts: ['zip','rar','7z','tar','gz','bz2','iso','dmg','xz'] },
  { id: 'misc',     label: 'Other',     exts: [] },
];

const SHELF_ID_RE = /^[a-z0-9][a-z0-9-]{0,23}$/;

// Folder names the app uses for itself, plus a few that would confuse a path.
const RESERVED_IDS = ['uploads', 'thumbs', 'api', 'public', 'node-modules', 'all'];

let shelves = [];

const shelfIds  = () => shelves.map((s) => s.id);
const shelfById = (id) => shelves.find((s) => s.id === id) || null;

function saveShelves() {
  fs.writeFileSync(SHELVES_PATH, JSON.stringify(shelves, null, 2));
}

function loadShelves() {
  try {
    const raw = JSON.parse(fs.readFileSync(SHELVES_PATH, 'utf8'));
    if (Array.isArray(raw) && raw.length) {
      shelves = raw
        .filter((s) => s && SHELF_ID_RE.test(s.id))
        .map((s) => ({
          id: s.id,
          label: String(s.label || s.id).slice(0, 40),
          exts: Array.isArray(s.exts) ? s.exts.map((e) => String(e).toLowerCase()).slice(0, 60) : [],
        }));
      if (shelves.length) return;
    }
  } catch { /* first run, or unreadable — seed the defaults below */ }
  shelves = DEFAULT_SHELVES.map((s) => ({ ...s, exts: s.exts.slice() }));
  saveShelves();
}

/** Turn a human label into a usable folder name. */
function slugify(label) {
  return String(label || '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

/** Normalise a user-supplied extension list: lowercase, no dots, no duplicates. */
function cleanExts(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(
    input.map((e) => String(e).toLowerCase().replace(/^[.\s]+|\s+$/g, ''))
         .filter((e) => /^[a-z0-9]{1,10}$/.test(e))
  )].slice(0, 60);
}

/**
 * Auto-sort takes the first shelf whose list contains the extension, so a rule
 * repeated further down the order never fires. Report those so the UI can say
 * so rather than leaving someone puzzled.
 */
function shadowedExts(id) {
  const idx = shelves.findIndex((s) => s.id === id);
  if (idx <= 0) return [];
  const earlier = new Set(shelves.slice(0, idx).flatMap((s) => s.exts));
  return shelves[idx].exts.filter((e) => earlier.has(e));
}

/** The catch-all shelf. Falls back to the last shelf if 'misc' was removed. */
const fallbackShelf = () =>
  (shelfById('misc') ? 'misc' : (shelves.length ? shelves[shelves.length - 1].id : null));

const MIME = {
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
  mov: 'video/quicktime', avi: 'video/x-msvideo', ts: 'video/mp2t',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', flac: 'audio/flac', wav: 'audio/wav',
  ogg: 'audio/ogg', opus: 'audio/ogg', aac: 'audio/aac',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp',
  pdf: 'application/pdf', txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8',
};

const ext = (n) => path.extname(n).slice(1).toLowerCase();

function shelfFor(filename) {
  const e = ext(filename);
  for (const s of shelves) if (s.exts.includes(e)) return s.id;
  return fallbackShelf();
}

// ---------------------------------------------------------------- accounts
// Stored in users.json, written by the app. Passwords are scrypt hashes —
// nothing here can be read back out, only checked against.

let accounts = {};   // name -> { hash, role, created, disabled, v }

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `scrypt:${salt}:${key}`;
}

function passwordMatches(pw, stored) {
  const [alg, salt, key] = String(stored).split(':');
  if (alg !== 'scrypt' || !salt || !key) return false;
  const known = Buffer.from(key, 'hex');
  const given = crypto.scryptSync(pw, salt, 64);
  return known.length === given.length && crypto.timingSafeEqual(known, given);
}

function saveAccounts() {
  fs.writeFileSync(USERS_PATH, JSON.stringify(accounts, null, 2));
}

function loadAccounts() {
  try {
    accounts = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    return;
  } catch { /* first run — fall through to bootstrap */ }

  // Bootstrap from config.json's plaintext users, once. First one becomes admin.
  const seed = config.users || {};
  const names = Object.keys(seed);
  if (!names.length) {
    console.error('No accounts yet. Add a "users" block to config.json to create the first one.');
    process.exit(1);
  }
  names.forEach((name, i) => {
    accounts[name] = {
      hash: hashPassword(seed[name]),
      role: i === 0 ? 'admin' : 'member',
      created: Date.now(),
      disabled: false,
      v: 1,
    };
  });
  saveAccounts();
  console.log(`Created ${names.length} account(s) from config.json and hashed the passwords.`);
  console.log('You can now delete the "users" block from config.json — it is no longer read.');
}

const NAME_RE = /^[a-zA-Z0-9._-]{2,32}$/;

function validateNewAccount(name, pass) {
  if (!NAME_RE.test(name || '')) return 'Names use 2–32 letters, numbers, dot, dash or underscore.';
  if (accounts[name]) return 'That name is taken.';
  if (!pass || pass.length < 8) return 'Passwords need at least 8 characters.';
  return null;
}

const adminCount = () =>
  Object.values(accounts).filter((a) => a.role === 'admin' && !a.disabled).length;

// ---------------------------------------------------------------- activity log
/**
 * Anyone with access to a shelf can delete anything on it — that's the model,
 * and it suits a handful of friends. What it lacks is any record, so "where did
 * that film go" has no answer. This is that record: append-only, capped, and
 * readable by admins.
 */
const LOG_PATH = path.join(__dirname, 'activity.log');
const LOG_MAX = config.activityMax || 4000;

let logBuffer = [];
let logDirty = false;

function loadLog() {
  try {
    logBuffer = fs.readFileSync(LOG_PATH, 'utf8')
      .split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .slice(-LOG_MAX);
  } catch { logBuffer = []; }
}

function note(user, action, detail) {
  logBuffer.push({ t: Date.now(), u: user || '-', a: action, d: detail || '' });
  if (logBuffer.length > LOG_MAX) logBuffer = logBuffer.slice(-LOG_MAX);
  logDirty = true;
}

/** Batched to disk — a busy upload shouldn't mean a write per chunk. */
function flushLog() {
  if (!logDirty) return;
  logDirty = false;
  try {
    fs.writeFileSync(LOG_PATH, logBuffer.map((e) => JSON.stringify(e)).join('\n') + '\n');
  } catch { /* logging must never take the app down */ }
}

// ---------------------------------------------------------------- shares
/**
 * A share is an unauthenticated door into one specific file. That makes it the
 * most dangerous thing in this codebase, so it is deliberately narrow:
 *
 *  - the id is 24 random bytes, not a guessable counter
 *  - it names exactly one file, resolved and re-validated on every use
 *  - it can expire, and it can be limited to a number of opens
 *  - it grants read only: no listing, no directory, no sibling files
 *  - revoking is instant, and revocation survives a restart
 *
 * The permission that created it is checked at creation time, not at use time —
 * a share outliving its creator's access is intentional, the same way handing
 * someone a copy of a file is. Revoke it if that isn't what you want.
 */
const SHARES_PATH = path.join(__dirname, 'shares.json');
let shares = {};              // id -> { rel, by, created, expires, maxUses, uses, label }

function loadShares() {
  try { shares = JSON.parse(fs.readFileSync(SHARES_PATH, 'utf8')); }
  catch { shares = {}; }
}
function saveShares() {
  try { fs.writeFileSync(SHARES_PATH, JSON.stringify(shares, null, 2)); } catch { /* non-fatal */ }
}

const SHARE_ID_RE = /^[A-Za-z0-9_-]{32}$/;

/** Returns the share if it is currently usable, or a reason why it isn't. */
function resolveShare(id) {
  if (!SHARE_ID_RE.test(id || '')) return { error: 'bad' };
  const sh = shares[id];
  if (!sh) return { error: 'missing' };
  if (sh.expires && Date.now() > sh.expires) return { error: 'expired' };
  if (sh.maxUses && sh.uses >= sh.maxUses) return { error: 'used-up' };

  // Re-check the path every time: the file may have been renamed, moved, or
  // deleted since, and the stored string is not trusted on its own.
  const full = safePath(sh.rel);
  if (!full || !shelfOf(sh.rel)) return { error: 'missing' };
  return { share: sh, full };
}

function pruneShares() {
  const now = Date.now();
  let changed = false;
  for (const [id, sh] of Object.entries(shares)) {
    const dead = (sh.expires && now > sh.expires) || (sh.maxUses && sh.uses >= sh.maxUses);
    // Keep spent shares briefly so the UI can show why a link stopped working.
    if (dead && now - (sh.lastUsed || sh.created) > 7 * 864e5) { delete shares[id]; changed = true; }
  }
  if (changed) saveShares();
}

// ---------------------------------------------------------------- watch state
/**
 * Where each person got to in each file. Kept separate from users.json so a
 * position update — which happens every few seconds during playback — never
 * rewrites the account file.
 */
const PROGRESS_PATH = path.join(__dirname, 'progress.json');
let progress = {};            // user -> rel -> { pos, dur, at }
let progressDirty = false;

function loadProgress() {
  try { progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8')); }
  catch { progress = {}; }
}
function flushProgress() {
  if (!progressDirty) return;
  progressDirty = false;
  try { fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress)); } catch { /* non-fatal */ }
}

const WATCHED_AT = 0.92;      // past this fraction, call it finished

function setProgress(user, rel, pos, dur) {
  if (!progress[user]) progress[user] = {};
  const done = dur > 0 && pos / dur >= WATCHED_AT;
  progress[user][rel] = { pos: done ? 0 : Math.round(pos), dur: Math.round(dur), at: Date.now(), done };
  // Don't let one person's history grow without bound.
  const keys = Object.keys(progress[user]);
  if (keys.length > 2000) {
    keys.sort((a, b) => progress[user][a].at - progress[user][b].at)
        .slice(0, keys.length - 2000)
        .forEach((k) => delete progress[user][k]);
  }
  progressDirty = true;
}

// ---------------------------------------------------------------- permissions
/**
 * Each account carries a shelf list. `"*"` (or a missing field, so existing
 * accounts keep working after an upgrade) means everything. Admins always get
 * everything regardless of what's stored.
 *
 * This is enforced on every endpoint that touches a file, not just in the UI —
 * hiding a shelf in the sidebar stops nobody who can open dev tools.
 */
function allowedShelves(user) {
  if (!user) return [];
  if (user.role === 'admin') return shelfIds();
  const acct = accounts[user.name];
  const list = acct && acct.shelves;
  if (!list || list === '*') return shelfIds();
  return shelfIds().filter((s) => list.includes(s));
}

const canUse = (user, shelf) => allowedShelves(user).includes(shelf);

/** The shelf a relative path belongs to, or null if it isn't shelf-shaped. */
function shelfOf(rel) {
  const first = String(rel || '').replace(/^\/+/, '').split('/')[0];
  return shelfIds().includes(first) ? first : null;
}

function normaliseShelves(input) {
  if (input === '*' || input === undefined || input === null) return '*';
  if (!Array.isArray(input)) return null;
  const ids = shelfIds();
  const clean = [...new Set(input)].filter((s) => ids.includes(s));
  return clean.length === ids.length ? '*' : clean;
}

/** Guard for routes whose target shelf comes from a path parameter. */
function requireShelf(req, res, rel) {
  const shelf = shelfOf(rel);
  if (!shelf || !canUse(req.user, shelf)) {
    res.status(404).json({ error: 'Not found' });   // don't confirm it exists
    return null;
  }
  return shelf;
}

// ---------------------------------------------------------------- API tokens
/**
 * For scripts and servers. A token is `vlt_<id>_<secret>`: the id finds the
 * record, the secret is compared against a SHA-256 digest. Plain SHA is right
 * here where it would be wrong for passwords — these are 32 random bytes, so
 * there's no dictionary to attack and no reason to pay scrypt's cost per call.
 */
const tokenDigest = (secret) => crypto.createHash('sha256').update(secret).digest('hex');

function issueToken(name, label) {
  const id = crypto.randomBytes(6).toString('hex');
  const secret = crypto.randomBytes(32).toString('base64url');
  const acct = accounts[name];
  acct.tokens = acct.tokens || [];
  acct.tokens.push({
    id,
    label: String(label || 'untitled').slice(0, 40),
    hash: tokenDigest(secret),
    created: Date.now(),
    lastUsed: null,
  });
  saveAccounts();
  return `vlt_${id}_${secret}`;          // shown once, never recoverable
}

function userFromToken(raw) {
  if (typeof raw !== 'string') return null;
  const m = /^vlt_([a-f0-9]{12})_([A-Za-z0-9_-]{20,})$/.exec(raw.trim());
  if (!m) return null;
  const [, id, secret] = m;
  const digest = Buffer.from(tokenDigest(secret), 'hex');

  for (const [name, acct] of Object.entries(accounts)) {
    if (acct.disabled || !Array.isArray(acct.tokens)) continue;
    for (const t of acct.tokens) {
      if (t.id !== id) continue;
      const known = Buffer.from(t.hash, 'hex');
      if (known.length !== digest.length || !crypto.timingSafeEqual(known, digest)) return null;
      t.lastUsed = Date.now();
      return { name, role: acct.role };
    }
  }
  return null;
}

// ---------------------------------------------------------------- auth
// Stateless signed cookie — survives server restarts, needs no session store.

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/**
 * A valid signature isn't enough — the account has to still exist, still be
 * enabled, and still be on the password version the cookie was issued for.
 * That's what makes "delete account" and "reset password" kick someone out.
 */
function currentUser(req) {
  // Scripts authenticate with a bearer token; browsers with the signed cookie.
  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  const raw = (bearer && bearer[1]) || req.headers['x-vault-token'];
  if (raw) return userFromToken(raw);

  const session = verify(readCookie(req, 'ds_auth'));
  if (!session) return null;
  const acct = accounts[session.u];
  if (!acct || acct.disabled || acct.v !== session.v) return null;
  return { name: session.u, role: acct.role };
}

function auth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  req.user = user;
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  next();
}

// Throttle brute force: 5 failures per IP per 10 min.
const failures = new Map();
function tooManyAttempts(ip) {
  const rec = failures.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > 10 * 60 * 1000) { failures.delete(ip); return false; }
  return rec.count >= 5;
}
function noteFailure(ip) {
  const rec = failures.get(ip) || { count: 0, first: Date.now() };
  rec.count++;
  failures.set(ip, rec);
}

// ---------------------------------------------------------------- paths

/** Resolve a client-supplied relative path, refusing anything outside ROOT. */
function safePath(rel) {
  const clean = path.normalize(rel || '').replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.resolve(ROOT, clean);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  return full;
}

function safeName(name) {
  return path.basename(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 200) || 'untitled';
}

/**
 * Clean a relative directory supplied by an uploader. Unlike safePath(), this
 * rejects traversal outright: silently turning "../x" into "x" would put an
 * upload somewhere the person did not choose. Each segment is sanitised with
 * the same rules as a filename and the result is still resolved below ROOT.
 */
function safeRelativeDir(value) {
  const raw = String(value || '').replace(/\\/g, '/').trim();
  if (!raw) return '';
  if (raw.includes('\0') || raw.startsWith('/') || /^[a-z]:\//i.test(raw)) return null;

  const parts = raw.split('/').filter(Boolean);
  if (!parts.length || parts.length > 32 || parts.some((p) => p === '.' || p === '..')) return null;
  const clean = parts.map((p) => safeName(p));
  if (clean.some((p) => !p || p === '.' || p === '..' || p.startsWith('.'))) return null;

  const joined = clean.join(path.sep);
  return joined.length <= 1000 ? joined : null;
}

function uploadDir(req, shelf) {
  const relative = safeRelativeDir(req.body && req.body.directory);
  if (relative === null) return null;
  const dir = path.resolve(ROOT, shelf, relative);
  const shelfRoot = path.resolve(ROOT, shelf);
  return dir === shelfRoot || dir.startsWith(shelfRoot + path.sep) ? dir : null;
}

async function uniqueName(dir, name) {
  const base = path.parse(name).name;
  const e = path.extname(name);
  let candidate = name;
  let i = 1;
  while (true) {
    try {
      await fsp.access(path.join(dir, candidate));
      candidate = `${base} (${i++})${e}`;
    } catch { return candidate; }
  }
}

/**
 * Walk one shelf without following symlinks. Folder uploads can be nested, so
 * the browser and CLI need the same complete view rather than only the shelf's
 * first level. Dot-directories remain private bookkeeping and are skipped.
 */
async function scanShelf(shelf) {
  const files = [];
  const folders = [];
  const shelfRoot = path.join(ROOT, shelf);

  async function visit(dir, relative = '', depth = 0) {
    if (depth > 32) return;
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }

    const videoStems = new Set(
      entries.filter((e) => e.isFile() && THUMBABLE.includes(ext(e.name)))
             .map((e) => path.parse(e.name).name.toLowerCase())
    );
    const isAttachedSubtitle = (name) => {
      if (!SIDECAR_EXT.includes(ext(name))) return false;
      const base = path.parse(name).name.toLowerCase();
      for (const stem of videoStems) {
        if (base === stem || base.startsWith(stem + '.')) return true;
      }
      return false;
    };

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      try {
        const st = await fsp.stat(full);
        if (entry.isDirectory()) {
          folders.push({
            kind: 'folder', name: entry.name, shelf,
            rel: `${shelf}/${childRelative}`, dir: relative,
            size: 0, modified: st.mtimeMs, ext: '',
          });
          await visit(full, childRelative, depth + 1);
        } else if (entry.isFile() && !isAttachedSubtitle(entry.name)) {
          files.push({
            kind: 'file', name: entry.name, shelf,
            rel: `${shelf}/${childRelative}`, dir: relative,
            size: st.size, modified: st.mtimeMs, ext: ext(entry.name),
          });
        }
      } catch { /* vanished mid-scan */ }
    }
  }

  await visit(shelfRoot);
  return { files, folders };
}

// ---------------------------------------------------------------- uploads (single-shot)

/**
 * Pick a destination shelf the uploader is actually allowed to write to.
 * If auto-sort would file something on a forbidden shelf, it lands on the
 * first shelf they do have instead — better than vanishing into a folder
 * they can't open.
 */
function targetShelf(req, originalName) {
  const allowed = allowedShelves(req.user);
  if (!allowed.length) return null;
  const asked = req.body && req.body.shelf;
  if (shelfIds().includes(asked)) return allowed.includes(asked) ? asked : null;
  const guess = shelfFor(originalName);
  return allowed.includes(guess) ? guess : allowed[0];
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const shelf = targetShelf(req, file.originalname);
      if (!shelf) return cb(new Error('No permission for that shelf'));
      const dir = uploadDir(req, shelf);
      if (!dir) return cb(new Error('Bad folder path'));
      await fsp.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (e) { cb(e); }
  },
  filename: async (req, file, cb) => {
    try {
      const shelf = targetShelf(req, file.originalname);
      if (!shelf) return cb(new Error('No permission for that shelf'));
      const dir = uploadDir(req, shelf);
      if (!dir) return cb(new Error('Bad folder path'));
      const clean = safeName(Buffer.from(file.originalname, 'latin1').toString('utf8'));
      cb(null, await uniqueName(dir, clean));
    } catch (e) { cb(e); }
  },
});

const upload = multer({ storage, limits: { fileSize: MAX_BYTES } });

// ---------------------------------------------------------------- uploads (chunked)
/**
 * Why this exists: Cloudflare's free plan refuses any single request body over
 * 100 MB, and a tunnel can't be set to bypass the proxy. So large files are cut
 * into pieces small enough to pass, appended to one part-file server-side, and
 * renamed into place once the byte count matches exactly.
 *
 * The upload id is derived from the file's identity rather than randomly
 * generated, so reopening the browser and picking the same file resumes the
 * same part-file instead of starting a second one.
 */

const uploadIdFor = (user, name, size, shelf, directory = '') =>
  crypto.createHmac('sha256', SECRET)
    .update(`${user}\u0000${name}\u0000${size}\u0000${shelf}\u0000${directory}`)
    .digest('hex').slice(0, 32);

const HEX32 = /^[a-f0-9]{32}$/;
const partPath = (id) => path.join(PARTS_DIR, `${id}.part`);
const metaPath = (id) => path.join(PARTS_DIR, `${id}.json`);

async function readMeta(id) {
  try { return JSON.parse(await fsp.readFile(metaPath(id), 'utf8')); } catch { return null; }
}

async function partSize(id) {
  try { return (await fsp.stat(partPath(id))).size; } catch { return 0; }
}

/** One writer per upload id. Two chunks racing would interleave bytes. */
const writing = new Set();

async function discardUpload(id) {
  await fsp.rm(partPath(id), { force: true }).catch(() => {});
  await fsp.rm(metaPath(id), { force: true }).catch(() => {});
}

/** Delete part-files nobody came back for. Runs at boot and hourly. */
async function sweepParts() {
  let entries;
  try { entries = await fsp.readdir(PARTS_DIR); } catch { return; }
  const cutoff = Date.now() - PART_TTL_MS;
  for (const name of entries) {
    const full = path.join(PARTS_DIR, name);
    try {
      const st = await fsp.stat(full);
      if (st.mtimeMs < cutoff) await fsp.rm(full, { force: true });
    } catch { /* already gone */ }
  }
}

// ---------------------------------------------------------------- thumbnails
/**
 * One frame from 10% into the video, cached as a small JPEG. Generated on first
 * request rather than by scanning the library, so adding this feature doesn't
 * peg the CPU for an hour. If ffmpeg isn't installed the endpoint simply 404s
 * and the grid falls back to its extension placeholder.
 */

const HAS_FFMPEG = (() => {
  try {
    return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
        && spawnSync('ffprobe', ['-version'], { stdio: 'ignore' }).status === 0;
  } catch { return false; }
})();

const HAS_LIBX264 = (() => {
  if (!HAS_FFMPEG) return false;
  try {
    const check = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
    return check.status === 0 && /\blibx264\b/.test(`${check.stdout || ''}\n${check.stderr || ''}`);
  } catch { return false; }
})();

/**
 * Pick a real H.264 encoder, not merely one listed by ffmpeg. Distribution
 * builds often advertise NVENC/QSV/VAAPI even when the machine has no matching
 * device or driver, so auto mode verifies each candidate with a tiny frame.
 * `transcodeEncoder` can pin a known-good encoder when a host needs it.
 */
const FFMPEG_ENCODERS = (() => {
  if (!HAS_FFMPEG) return '';
  try {
    const check = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
    return check.status === 0 ? `${check.stdout || ''}\n${check.stderr || ''}` : '';
  } catch { return ''; }
})();

const hasEncoder = (name) => new RegExp(`\\b${name}\\b`).test(FFMPEG_ENCODERS);
const ENCODER_DIAGNOSTICS = {};

function encoderProbe(kind) {
  const common = ['-nostdin', '-hide_banner', '-loglevel', 'error'];
  let args;
  if (kind === 'nvenc') {
    args = [...common, '-f', 'lavfi', '-i', 'color=s=128x72:d=0.08', '-frames:v', '1',
      '-c:v', 'h264_nvenc', '-f', 'null', '-'];
  } else if (kind === 'qsv') {
    args = [...common, '-f', 'lavfi', '-i', 'color=s=128x72:d=0.08', '-frames:v', '1',
      '-vf', 'format=nv12', '-c:v', 'h264_qsv', '-f', 'null', '-'];
  } else if (kind === 'vaapi') {
    const device = config.vaapiDevice || '/dev/dri/renderD128';
    if (!fs.existsSync(device)) {
      ENCODER_DIAGNOSTICS[kind] = `device missing: ${device}`;
      return false;
    }
    args = [...common, '-vaapi_device', device, '-f', 'lavfi', '-i', 'color=s=128x72:d=0.08',
      '-frames:v', '1', '-vf', 'format=nv12,hwupload', '-c:v', 'h264_vaapi', '-f', 'null', '-'];
  } else {
    ENCODER_DIAGNOSTICS[kind] = HAS_LIBX264 ? 'available' : 'libx264 not compiled';
    return HAS_LIBX264;
  }
  try {
    const result = spawnSync('ffmpeg', args, { encoding: 'utf8', timeout: 8000 });
    const ok = result.status === 0;
    ENCODER_DIAGNOSTICS[kind] = ok ? 'available'
      : String(result.stderr || result.error?.message || `exit ${result.status}`).replace(/\s+/g, ' ').trim().slice(0, 400);
    return ok;
  } catch (error) {
    ENCODER_DIAGNOSTICS[kind] = error.message || 'probe failed';
    return false;
  }
}

function detectTranscoder() {
  if (!HAS_FFMPEG) return null;
  const wanted = String(config.transcodeEncoder || 'auto').toLowerCase();
  const definitions = {
    nvenc: { kind: 'nvenc', encoder: 'h264_nvenc', label: 'NVIDIA NVENC', hardware: true },
    qsv: { kind: 'qsv', encoder: 'h264_qsv', label: 'Intel Quick Sync', hardware: true },
    vaapi: { kind: 'vaapi', encoder: 'h264_vaapi', label: 'VAAPI GPU', hardware: true },
    cpu: { kind: 'cpu', encoder: 'libx264', label: 'CPU libx264', hardware: false },
  };
  const compiled = (kind) => kind === 'cpu' ? HAS_LIBX264 : hasEncoder(definitions[kind].encoder);
  if (wanted !== 'auto') {
    const picked = definitions[wanted];
    if (picked && compiled(wanted) && encoderProbe(wanted)) return { ...picked, verified: true };
    console.warn(`[media] configured transcodeEncoder "${wanted}" failed its live probe; falling back to auto`);
  }
  for (const kind of ['nvenc', 'qsv', 'vaapi', 'cpu']) {
    if (compiled(kind) && encoderProbe(kind)) return { ...definitions[kind], verified: true };
  }
  return HAS_LIBX264 ? { ...definitions.cpu, verified: true } : null;
}

const TRANSCODER = detectTranscoder();
const HAS_H264_ENCODER = !!TRANSCODER;
const CPU_TRANSCODER = HAS_LIBX264
  ? { kind: 'cpu', encoder: 'libx264', label: 'CPU libx264', hardware: false, verified: true }
  : null;
// x264's automatic thread count is aggressive on 4K sources and can make a
// memory-limited container kill ffmpeg with SIGKILL (Node then reports a null
// exit code). Background conversions use a small, configurable ceiling and
// automatically retry with one thread if the first attempt is terminated.
const CONVERSION_THREADS = Math.max(1, Math.min(Number(config.convertThreads) || 2, 8));

const QUALITY_PROFILES = Object.freeze({
  '720':  { id: '720',  label: '720p',  width: 1280, height: 720,  bitrate: '3M',  maxrate: '4M',  bufsize: '6M' },
  '1080': { id: '1080', label: '1080p', width: 1920, height: 1080, bitrate: '6M',  maxrate: '8M',  bufsize: '12M' },
  '2160': { id: '2160', label: '4K',    width: 3840, height: 2160, bitrate: '16M', maxrate: '22M', bufsize: '32M' },
  original:{ id: 'original', label: 'Original', width: 0, height: 0, bitrate: '0', maxrate: '0', bufsize: '0' },
});

function qualityProfile(value) {
  const id = String(value || config.defaultTranscodeQuality || '1080').toLowerCase();
  return QUALITY_PROFILES[id] || QUALITY_PROFILES['1080'];
}

const THUMBABLE = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v', 'wmv', 'flv', 'mpg', 'mpeg', 'ts'];

// Subtitle files that sit beside a video rather than inside it.
const SIDECAR_EXT = ['srt', 'vtt', 'ass', 'ssa', 'sub'];

// Cap parallel ffmpeg processes — a grid of 30 tiles must not fork 30 encoders.
const MAX_JOBS = config.thumbJobs || 2;
let running = 0;
const waiting = [];

function jobSlot() {
  if (running < MAX_JOBS) { running++; return Promise.resolve(); }
  return new Promise((resolve) => waiting.push(resolve));
}
function releaseSlot() {
  const next = waiting.shift();
  if (next) next(); else running--;
}

/** Arguments go as an array, never a shell string — the path is user data. */
function runDetailed(cmd, args, timeoutMs = 25000, maxOutputBytes = 64 * 1024) {
  return new Promise((resolve) => {
    let done = false;
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    let outputBytes = 0;
    let overflow = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ stdout: out, stderr: err.trim(), ...result });
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ ok: false, reason: 'timeout' });
    }, timeoutMs);
    child.stdout.on('data', (d) => {
      outputBytes += d.length;
      if (outputBytes > maxOutputBytes) {
        overflow = true;
        child.kill('SIGKILL');
        return;
      }
      out += d;
    });
    // Keep enough stderr to diagnose a bad container without allowing a noisy
    // child process to grow memory indefinitely.
    child.stderr.on('data', (d) => {
      const remaining = 16 * 1024 - Buffer.byteLength(err);
      if (remaining > 0) err += d.subarray(0, remaining).toString('utf8');
    });
    child.on('error', (e) => finish({ ok: false, reason: 'spawn-error', error: e.message }));
    child.on('close', (code) => {
      finish({
        ok: code === 0 && !overflow,
        reason: overflow ? 'output-limit' : (code === 0 ? null : `exit-${code}`),
      });
    });
  });
}

async function run(cmd, args, timeoutMs = 25000, maxOutputBytes = 64 * 1024) {
  const result = await runDetailed(cmd, args, timeoutMs, maxOutputBytes);
  return result.ok ? result.stdout.trim() : null;
}

async function durationOf(file) {
  const out = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], 15000);
  const n = parseFloat(out);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function makeThumb(src, dest) {
  const dur = await durationOf(src);
  // 10% in dodges black opening frames; fall back to 3s for streams with no duration.
  const seek = dur ? Math.max(1, Math.min(dur * 0.1, dur - 0.5)) : 3;
  const tmp = `${dest}.${process.pid}.tmp`;
  const ok = await run('ffmpeg', [
    '-nostdin', '-loglevel', 'error',
    '-ss', seek.toFixed(2), '-i', src,
    '-frames:v', '1',
    '-vf', 'scale=480:-2',
    '-q:v', '4',
    '-f', 'image2', '-y', tmp,
  ]);
  if (ok === null) { await fsp.rm(tmp, { force: true }).catch(() => {}); return false; }
  try {
    const st = await fsp.stat(tmp);
    if (!st.size) throw new Error('empty');
    await fsp.rename(tmp, dest);
    return true;
  } catch {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    return false;
  }
}

// ---------------------------------------------------------------- media
/**
 * Browsers never shipped Matroska support, so .mkv files can't play natively.
 * Compatible H.264/AAC streams are repackaged into fragmented MP4 without
 * quality loss. Unsupported audio is converted to AAC and unsupported video
 * is converted to H.264, giving every probed MKV a browser-safe fallback.
 */

// These codecs are dependable inside an MP4 in current browsers. Other MKV
// video is transcoded to H.264 and other audio to AAC. The old implementation
// copied HEVC/VP8/VP9/FLAC into MP4 and left the browser to decide; in practice
// that produced an MP4 response which many browsers still could not decode.
const COPYABLE_VIDEO = ['h264', 'avc1'];
const COPYABLE_AUDIO = ['aac'];

const probeCache = new Map();      // rel -> { at, info }
const PROBE_TTL = 10 * 60 * 1000;

function compatibilityVideoInfo(file, reason = 'forced-compatibility') {
  return {
    duration: null,
    video: 'unknown',
    audio: 'unknown',
    width: null,
    height: null,
    pixelFormat: null,
    subtitles: 0,
    videoOk: false,
    audioOk: false,
    videoMode: 'h264',
    audioMode: 'aac',
    transcodeAvailable: HAS_H264_ENCODER,
    remuxable: HAS_H264_ENCODER && THUMBABLE.includes(ext(file)),
    transcoding: true,
    inferred: true,
    probeFailure: reason,
  };
}

function inferredVideoInfo(file, reason, detail) {
  const rel = path.relative(ROOT, file).replace(/[\r\n\t]/g, '?');
  const why = String(detail || reason || 'unknown error').replace(/\s+/g, ' ').trim().slice(0, 800);
  console.warn(`[media] ffprobe ${reason} for ${rel}${why ? `: ${why}` : ''}`);

  // ffprobe is useful for choosing a cheap stream-copy path, but it should not
  // be a single point of failure. ffmpeg performs its own input detection, so
  // an unknown video can still take the universal H.264/AAC conversion path.
  return compatibilityVideoInfo(file, reason);
}

async function probe(file) {
  const hit = probeCache.get(file);
  if (hit && Date.now() - hit.at < PROBE_TTL) return hit.info;

  const result = await runDetailed('ffprobe', [
    '-v', 'error',
    // Large/high-bitrate Matroska files on network storage sometimes need more
    // than ffprobe's small default analysis window.
    '-probesize', '52428800', '-analyzeduration', '30000000',
    '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,pix_fmt',
    '-of', 'json', file,
  ], 60000, 256 * 1024);
  if (!result.ok) {
    const info = inferredVideoInfo(file, result.reason, result.stderr || result.error);
    probeCache.set(file, { at: Date.now(), info });
    return info;
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    const info = inferredVideoInfo(file, 'invalid-json', result.stdout.slice(0, 300));
    probeCache.set(file, { at: Date.now(), info });
    return info;
  }

  const streams = parsed.streams || [];
  const v = streams.find((x) => x.codec_type === 'video');
  const a = streams.find((x) => x.codec_type === 'audio');
  const subs = streams.filter((x) => x.codec_type === 'subtitle').length;

  const info = {
    duration: parseFloat((parsed.format || {}).duration) || null,
    video: v ? v.codec_name : null,
    audio: a ? a.codec_name : null,
    width: v ? v.width : null,
    height: v ? v.height : null,
    pixelFormat: v ? v.pix_fmt : null,
    subtitles: subs,
  };
  // High-10/4:2:2 H.264 is legal in MKV but not broadly decodable in a browser.
  const browserPixelFormat = !info.pixelFormat || ['yuv420p', 'yuvj420p', 'nv12'].includes(info.pixelFormat);
  info.videoOk = !!info.video && COPYABLE_VIDEO.includes(info.video) && browserPixelFormat;
  info.audioOk = !info.audio || COPYABLE_AUDIO.includes(info.audio);
  info.videoMode = info.videoOk ? 'copy' : 'h264';
  info.audioMode = info.audioOk ? 'copy' : 'aac';
  info.transcodeAvailable = HAS_H264_ENCODER;
  // Any probed video can use the media endpoint. Compatible streams are only
  // repackaged; everything else gets the smallest browser-safe conversion.
  info.remuxable = !!info.video && (info.videoOk || HAS_H264_ENCODER);
  info.transcoding = !info.videoOk;

  probeCache.set(file, { at: Date.now(), info });
  return info;
}

// Each live preparation holds a process open while someone is watching, and a
// video conversion can be CPU-heavy, so keep a firm shared cap.
const MAX_STREAMS = config.remuxStreams || 3;
let streaming = 0;
const streamFailures = new Map();  // full path -> { at, error }
const hlsSessions = new Map();     // id -> live segmented conversion
const HLS_IDLE_MS = 2 * 60 * 1000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function stopHlsSession(id) {
  const session = hlsSessions.get(id);
  if (!session) return;
  hlsSessions.delete(id);
  session.stopping = true;
  if (session.child && session.child.exitCode === null) session.child.kill('SIGKILL');
  // Let ffmpeg release its current segment before removing the private cache.
  setTimeout(() => fsp.rm(session.dir, { recursive: true, force: true }).catch(() => {}), 750).unref();
}

async function sweepHlsSessions() {
  const cutoff = Date.now() - HLS_IDLE_MS;
  for (const [id, session] of hlsSessions) {
    if (session.lastAccess < cutoff) await stopHlsSession(id);
  }
}

async function waitForHls(session, timeoutMs = 75000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (session.error) return false;
    try {
      const playlist = await fsp.readFile(path.join(session.dir, 'index.m3u8'), 'utf8');
      if (/seg-\d{6}\.ts/.test(playlist)) return true;
    } catch { /* first segment is still being encoded */ }
    await wait(250);
  }
  session.error = 'Timed out while preparing the first video segment';
  return false;
}

function encoderInputArgs(transcoder = TRANSCODER) {
  return transcoder && transcoder.kind === 'vaapi'
    ? ['-vaapi_device', config.vaapiDevice || '/dev/dri/renderD128'] : [];
}

function scaleFilter(profile) {
  if (!profile.width || !profile.height) return null;
  return `scale=w='min(iw,${profile.width})':h='min(ih,${profile.height})':force_original_aspect_ratio=decrease:force_divisible_by=2`;
}

function videoEncodeArgs(profile, { lowLatency = false, transcoder = TRANSCODER, safe = false } = {}) {
  if (!transcoder) return [];
  const scale = scaleFilter(profile);
  const filters = [];
  if (scale) filters.push(scale);
  if (transcoder.kind === 'vaapi') filters.push('format=nv12', 'hwupload');
  const args = filters.length ? ['-vf', filters.join(',')] : [];

  if (transcoder.kind === 'nvenc') {
    args.push('-c:v', 'h264_nvenc', '-preset', lowLatency ? 'p3' : 'p5',
      '-tune', lowLatency ? 'll' : 'hq', '-rc:v', 'vbr', '-cq:v', '22');
  } else if (transcoder.kind === 'qsv') {
    args.push('-c:v', 'h264_qsv', '-preset', lowLatency ? 'veryfast' : 'medium',
      '-global_quality:v', '22', '-look_ahead', '0');
  } else if (transcoder.kind === 'vaapi') {
    args.push('-c:v', 'h264_vaapi', '-qp', '22');
  } else {
    // File conversions favour a quick, bounded-memory encode. Safe mode is a
    // second attempt used after a signal/encoder failure and intentionally
    // trades a little compression efficiency for much lower peak memory.
    const preset = lowLatency ? 'veryfast' : (safe ? 'ultrafast' : 'veryfast');
    args.push('-c:v', 'libx264', '-preset', preset, '-crf', safe ? '23' : '22',
      '-threads:v', String(safe ? 1 : CONVERSION_THREADS));
    if (lowLatency) args.push('-tune', 'zerolatency');
    else if (safe) args.push('-tune', 'fastdecode');
  }
  if (profile.bitrate !== '0') {
    args.push('-b:v', profile.bitrate, '-maxrate', profile.maxrate, '-bufsize', profile.bufsize);
  }
  args.push('-pix_fmt', 'yuv420p', '-profile:v', 'high');
  return args;
}

function mediaOutputArgs(info, profile, {
  lowLatency = false, allowCopy = true, transcoder = TRANSCODER, safe = false,
} = {}) {
  const direct = allowCopy && profile.id === 'original' && info && info.videoOk;
  const video = direct
    ? ['-c:v', 'copy']
    : videoEncodeArgs(profile, { lowLatency, transcoder, safe });
  const audio = info && info.audioOk ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '192k', '-ac', '2'];
  return { direct, args: [...video, ...audio] };
}

async function startHlsConversion(full, user, startAt, requestedQuality) {
  const id = crypto.randomBytes(16).toString('hex');
  const dir = path.join(HLS_DIR, id);
  const quality = qualityProfile(requestedQuality);
  const info = await probe(full);
  const output = mediaOutputArgs(info, quality, { lowLatency: true, allowCopy: true });
  const session = {
    id, dir, full, user, startAt, quality: quality.id,
    qualityLabel: quality.label, direct: output.direct,
    encoder: output.direct ? 'stream copy' : TRANSCODER.label,
    child: null, error: '', stderr: '',
    created: Date.now(), lastAccess: Date.now(), stopping: false, finished: false,
  };
  await fsp.mkdir(dir, { recursive: true });
  hlsSessions.set(id, session);

  const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', ...encoderInputArgs()];
  if (startAt > 0) args.push('-ss', startAt.toFixed(2));
  // Event HLS keeps every completed segment until the private session ends.
  // That lets a GPU prepare ahead at full speed without racing a sliding
  // window, while pause/close still kills the process and clears the cache.
  args.push('-i', full, '-map', '0:v:0', '-map', '0:a:0?',
    ...output.args,
    ...(output.direct ? [] : ['-force_key_frames', 'expr:gte(t,n_forced*2)']),
    '-sn', '-dn', '-map_metadata', '-1', '-max_muxing_queue_size', '4096',
    '-avoid_negative_ts', 'make_zero',
    '-f', 'hls', '-hls_time', '2', '-hls_list_size', '0',
    '-hls_playlist_type', 'event', '-hls_allow_cache', '0',
    '-hls_flags', 'independent_segments+temp_file',
    '-hls_segment_filename', path.join(dir, 'seg-%06d.ts'),
    path.join(dir, 'index.m3u8'));

  streaming++;
  const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  session.child = child;
  child.stderr.on('data', (d) => {
    const remaining = 16 * 1024 - Buffer.byteLength(session.stderr);
    if (remaining > 0) session.stderr += d.subarray(0, remaining).toString('utf8');
  });
  child.on('error', (e) => { session.error = e.message || 'Could not start ffmpeg'; });
  child.on('close', (code) => {
    streaming = Math.max(0, streaming - 1);
    session.finished = code === 0;
    if (!session.stopping && code !== 0) {
      const clean = session.stderr.replace(full, path.basename(full))
        .replace(/\s+/g, ' ').trim().slice(0, 1200);
      session.error = clean || `ffmpeg exited with code ${code}`;
      const rel = path.relative(ROOT, full).replace(/[\r\n\t]/g, '?');
      console.warn(`[media] HLS conversion failed for ${rel}: ${session.error}`);
    }
  });
  return session;
}

// ---------------------------------------------------------------- app

const app = express();
const HLS_JS_PATH = require.resolve('hls.js/dist/hls.min.js');
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false }));
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // These responses describe the process currently serving the request. A
  // cached copy can pair old browser code with a new backend and make a fixed
  // feature look broken, so neither browsers nor intermediary CDNs may reuse it.
  if (req.path === '/api/session' || req.path === '/api/health'
      || req.path.startsWith('/api/mediainfo/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
  }
  next();
});

app.get('/vendor/hls.min.js', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(HLS_JS_PATH);
});

app.post('/api/login', (req, res) => {
  const ip = req.ip;
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Wait 10 minutes.' });
  }
  const { user, pass } = req.body || {};
  const acct = accounts[user];
  if (!acct || acct.disabled || !passwordMatches(pass || '', acct.hash)) {
    noteFailure(ip);
    note(user ? String(user).slice(0, 32) : '-', 'login-failed', ip);
    return res.status(401).json({ error: 'Wrong name or key' });
  }
  failures.delete(ip);
  acct.lastSeen = Date.now();
  saveAccounts();
  const token = sign({ u: user, v: acct.v, exp: Date.now() + MAX_DAYS * 864e5 });
  res.setHeader('Set-Cookie',
    `ds_auth=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_DAYS * 86400}` +
    (config.https === false ? '' : '; Secure'));
  res.json({ user, role: acct.role });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'ds_auth=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  const u = currentUser(req);
  res.json(u
    ? { user: u.name, role: u.role, thumbs: HAS_FFMPEG, build: BUILD_ID }
    : { user: null, build: BUILD_ID });
});

// ---------------------------------------------------------------- accounts API

app.get('/api/users', auth, adminOnly, (req, res) => {
  res.json({
    users: Object.entries(accounts).map(([name, a]) => ({
      name, role: a.role, created: a.created, lastSeen: a.lastSeen || null, disabled: !!a.disabled,
      shelves: a.shelves === undefined ? '*' : a.shelves,
      tokens: (a.tokens || []).map((t) => ({
        id: t.id, label: t.label, created: t.created, lastUsed: t.lastUsed,
      })),
    })).sort((x, y) => x.created - y.created),
    you: req.user.name,
    allShelves: shelves.map((s) => ({ id: s.id, label: s.label })),
  });
});

app.post('/api/users', auth, adminOnly, (req, res) => {
  const { name, pass, role } = req.body || {};
  const problem = validateNewAccount(name, pass);
  if (problem) return res.status(400).json({ error: problem });
  const shelves = normaliseShelves(req.body.shelves);
  if (shelves === null) return res.status(400).json({ error: 'Bad shelf list' });
  accounts[name] = {
    hash: hashPassword(pass),
    role: role === 'admin' ? 'admin' : 'member',
    shelves,
    created: Date.now(),
    disabled: false,
    v: 1,
    tokens: [],
  };
  saveAccounts();
  note(req.user.name, 'account-create', name);
  res.json({ name });
});

app.patch('/api/users/:name', auth, adminOnly, (req, res) => {
  const name = req.params.name;
  const acct = accounts[name];
  if (!acct) return res.status(404).json({ error: 'No such account' });
  const { pass, role, disabled } = req.body || {};

  if (pass !== undefined) {
    if (!pass || pass.length < 8) return res.status(400).json({ error: 'Passwords need at least 8 characters.' });
    acct.hash = hashPassword(pass);
    acct.v++;                       // invalidates that person's existing sessions
  }
  if (role !== undefined && role !== acct.role) {
    if (acct.role === 'admin' && adminCount() < 2) {
      return res.status(400).json({ error: 'This is the last admin. Promote someone else first.' });
    }
    acct.role = role === 'admin' ? 'admin' : 'member';
  }
  if (req.body.shelves !== undefined) {
    const shelves = normaliseShelves(req.body.shelves);
    if (shelves === null) return res.status(400).json({ error: 'Bad shelf list' });
    acct.shelves = shelves;
  }
  if (disabled !== undefined && !!disabled !== !!acct.disabled) {
    if (name === req.user.name) return res.status(400).json({ error: "You can't disable your own account." });
    if (!acct.disabled && acct.role === 'admin' && adminCount() < 2) {
      return res.status(400).json({ error: 'This is the last admin. Promote someone else first.' });
    }
    acct.disabled = !!disabled;
    acct.v++;
  }
  saveAccounts();
  res.json({ ok: true });
});

app.delete('/api/users/:name', auth, adminOnly, (req, res) => {
  const name = req.params.name;
  if (!accounts[name]) return res.status(404).json({ error: 'No such account' });
  if (name === req.user.name) return res.status(400).json({ error: "You can't delete your own account." });
  if (accounts[name].role === 'admin' && adminCount() < 2) {
    return res.status(400).json({ error: 'This is the last admin. Promote someone else first.' });
  }
  delete accounts[name];
  saveAccounts();
  note(req.user.name, 'account-delete', name);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- shelves API

/** Everyone needs the labels to render; only admins get the extension rules. */
app.get('/api/shelves', auth, (req, res) => {
  const mine = allowedShelves(req.user);
  const admin = req.user.role === 'admin';
  res.json({
    shelves: shelves
      .filter((sh) => admin || mine.includes(sh.id))
      .map((sh) => (admin ? { ...sh } : { id: sh.id, label: sh.label })),
    all: admin ? shelves.map((sh) => ({ id: sh.id, label: sh.label })) : undefined,
  });
});

app.post('/api/shelves', auth, adminOnly, async (req, res) => {
  const label = String(req.body.label || '').trim();
  if (!label) return res.status(400).json({ error: 'Give the shelf a name.' });
  if (shelves.length >= 24) return res.status(400).json({ error: 'That is enough shelves (24 max).' });

  const id = req.body.id ? slugify(req.body.id) : slugify(label);
  if (!SHELF_ID_RE.test(id)) {
    return res.status(400).json({ error: 'That name has no usable letters or numbers in it.' });
  }
  if (shelfById(id)) return res.status(400).json({ error: 'A shelf with that name already exists.' });

  // The id becomes a folder name next to our own bookkeeping directories.
  // slugify has already stripped any leading dot, so compare against the
  // bare names rather than the dotted ones.
  if (RESERVED_IDS.includes(id)) {
    return res.status(400).json({ error: 'That name is reserved — pick another.' });
  }

  const exts = cleanExts(req.body.exts);
  shelves.push({ id, label: label.slice(0, 40), exts });
  saveShelves();
  note(req.user.name, 'shelf-create', label);
  await fsp.mkdir(path.join(ROOT, id), { recursive: true });
  res.json({ id, label, exts, shadowed: shadowedExts(id) });
});

app.patch('/api/shelves/:id', auth, adminOnly, (req, res) => {
  const sh = shelfById(req.params.id);
  if (!sh) return res.status(404).json({ error: 'No such shelf' });

  if (req.body.label !== undefined) {
    const label = String(req.body.label).trim();
    if (!label) return res.status(400).json({ error: 'A shelf needs a name.' });
    sh.label = label.slice(0, 40);
  }
  if (req.body.exts !== undefined) sh.exts = cleanExts(req.body.exts);

  // Reordering: the client sends the full id list in the order it wants.
  if (Array.isArray(req.body.order)) {
    const wanted = req.body.order.filter((id) => shelfById(id));
    if (wanted.length === shelves.length) {
      shelves = wanted.map((id) => shelfById(id));
    }
  }
  saveShelves();
  res.json({ ok: true, shadowed: shadowedExts(sh.id) });
});

app.delete('/api/shelves/:id', auth, adminOnly, async (req, res) => {
  const sh = shelfById(req.params.id);
  if (!sh) return res.status(404).json({ error: 'No such shelf' });
  if (shelves.length <= 1) return res.status(400).json({ error: 'You need at least one shelf.' });

  const dir = path.join(ROOT, sh.id);
  let contents = [];
  try {
    contents = (await fsp.readdir(dir, { withFileTypes: true }))
      .map((e) => e.name);
  } catch { /* folder never created */ }

  const moveTo = req.body && req.body.moveTo;
  if (contents.length) {
    // Never delete files as a side effect of removing a shelf. Either the
    // caller nominates somewhere for them to go, or nothing happens.
    if (!moveTo) {
      return res.status(409).json({
        error: `That shelf holds ${contents.length} item${contents.length === 1 ? '' : 's'}. Choose where they should go.`,
        count: contents.length,
      });
    }
    const target = shelfById(moveTo);
    if (!target || target.id === sh.id) return res.status(400).json({ error: 'Pick a different shelf to move them to.' });

    const targetDir = path.join(ROOT, target.id);
    await fsp.mkdir(targetDir, { recursive: true });
    // Moving each top-level item preserves any uploaded directory tree.
    for (const name of contents) {
      const dest = path.join(targetDir, await uniqueName(targetDir, name));
      try { await fsp.rename(path.join(dir, name), dest); }
      catch { return res.status(500).json({ error: `Could not move ${name}. Nothing was deleted.` }); }
    }
  }

  shelves = shelves.filter((x) => x.id !== sh.id);
  saveShelves();

  // Drop the shelf from every account's permissions so it can't linger as a
  // dangling reference if the id is ever reused.
  let touched = false;
  for (const acct of Object.values(accounts)) {
    if (Array.isArray(acct.shelves) && acct.shelves.includes(sh.id)) {
      acct.shelves = acct.shelves.filter((x) => x !== sh.id);
      touched = true;
    }
  }
  if (touched) saveAccounts();

  await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  note(req.user.name, 'shelf-delete', `${sh.label}${contents.length ? ` (${contents.length} moved to ${moveTo})` : ''}`);
  res.json({ ok: true, moved: contents.length });
});

// ---------------------------------------------------------------- tokens API

app.post('/api/users/:name/tokens', auth, adminOnly, (req, res) => {
  const name = req.params.name;
  if (!accounts[name]) return res.status(404).json({ error: 'No such account' });
  if ((accounts[name].tokens || []).length >= 10) {
    return res.status(400).json({ error: 'That account already has 10 tokens.' });
  }
  const token = issueToken(name, req.body && req.body.label);
  note(req.user.name, 'token-create', `for ${name}`);
  res.json({ token });          // the only time it is ever returned
});

app.delete('/api/users/:name/tokens/:id', auth, adminOnly, (req, res) => {
  const acct = accounts[req.params.name];
  if (!acct) return res.status(404).json({ error: 'No such account' });
  const before = (acct.tokens || []).length;
  acct.tokens = (acct.tokens || []).filter((t) => t.id !== req.params.id);
  if (acct.tokens.length === before) return res.status(404).json({ error: 'No such token' });
  saveAccounts();
  res.json({ ok: true });
});

// ---------------------------------------------------------------- plain text API
/**
 * Tab-separated so shell scripts can use cut and awk without needing jq.
 * Columns: shelf, size in bytes, epoch ms, name.
 */
app.get('/api/list', auth, async (req, res) => {
  const wanted = req.query.shelf;
  const mine = allowedShelves(req.user);
  const shelves = wanted ? mine.filter((s) => s === wanted) : mine;
  const lines = [];
  for (const shelf of shelves) {
    const scanned = await scanShelf(shelf);
    for (const file of scanned.files) {
      const withinShelf = file.rel.split('/').slice(1).join('/');
      lines.push(`${shelf}\t${file.size}\t${Math.round(file.modified)}\t${withinShelf}`);
    }
  }
  res.type('text/plain; charset=utf-8').send(lines.join('\n') + (lines.length ? '\n' : ''));
});

app.get('/api/whoami', auth, (req, res) => {
  res.json({ user: req.user.name, role: req.user.role, shelves: allowedShelves(req.user) });
});

app.get('/api/files', auth, async (req, res) => {
  const out = [];
  const folders = [];
  const mine = allowedShelves(req.user);
  for (const shelf of mine) {
    const scanned = await scanShelf(shelf);
    out.push(...scanned.files);
    folders.push(...scanned.folders);
  }

  let disk = null;
  try {
    const s = await fsp.statfs(ROOT);
    disk = { free: s.bfree * s.bsize, total: s.blocks * s.bsize };
  } catch { /* statfs unavailable on this platform */ }

  const mineProgress = progress[req.user.name] || {};
  for (const f of out) {
    const pr = mineProgress[f.rel];
    if (pr) f.watch = { pos: pr.pos, dur: pr.dur, done: !!pr.done, at: pr.at };
  }

  res.json({
    files: out, folders, disk, thumbs: HAS_FFMPEG, mkvTranscode: HAS_H264_ENCODER,
    transcoder: TRANSCODER ? { label: TRANSCODER.label, hardware: TRANSCODER.hardware } : null,
    qualities: Object.values(QUALITY_PROFILES).map(({ id, label }) => ({ id, label })),
    aiSubtitles: { available: HAS_AI_SUBTITLES, model: config.whisperModel || 'medium', device: config.whisperDevice || 'auto', diagnostic: AI_SUBTITLE_STATUS.diagnostic },
    role: req.user.role, artwork: !!TMDB_KEY,
    shelves: shelves.filter((sh) => mine.includes(sh.id)).map((sh) => ({ id: sh.id, label: sh.label })),
  });
});

app.post('/api/folders', auth, async (req, res) => {
  const shelf = String(req.body.shelf || '');
  if (!shelfById(shelf)) return res.status(400).json({ error: 'Unknown shelf' });
  if (!canUse(req.user, shelf)) return res.status(403).json({ error: 'No permission for that shelf' });

  const parent = safeRelativeDir(req.body.directory);
  const rawName = String(req.body.name || '').trim();
  const name = safeName(rawName);
  if (parent === null) return res.status(400).json({ error: 'Bad folder path' });
  if (!rawName || name !== rawName || name === '.' || name === '..' || name.startsWith('.')) {
    return res.status(400).json({ error: 'Use a folder name without path or special characters.' });
  }

  const parentDir = path.resolve(ROOT, shelf, parent);
  const shelfRoot = path.resolve(ROOT, shelf);
  if (parentDir !== shelfRoot && !parentDir.startsWith(shelfRoot + path.sep)) {
    return res.status(400).json({ error: 'Bad folder path' });
  }
  try {
    const st = await fsp.stat(parentDir);
    if (!st.isDirectory()) throw new Error('not a directory');
  } catch { return res.status(404).json({ error: 'The parent folder no longer exists.' }); }

  const full = path.join(parentDir, name);
  try { await fsp.mkdir(full); }
  catch (e) {
    if (e && e.code === 'EEXIST') return res.status(409).json({ error: 'A folder with that name already exists.' });
    return res.status(500).json({ error: 'Could not create the folder.' });
  }
  const relative = path.relative(ROOT, full).split(path.sep).join('/');
  note(req.user.name, 'folder-create', relative);
  res.json({ name, rel: relative, shelf });
});

app.post('/api/upload', auth, (req, res) => {
  upload.array('files')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Could not upload that file' });
    const uploaded = (req.files || []).map((f) => path.relative(ROOT, f.path).split(path.sep).join('/'));
    if (uploaded.length) note(req.user.name, 'upload', uploaded.join(', ').slice(0, 200));
    res.json({ uploaded });
  });
});

// ── chunked upload

app.post('/api/upload/init', auth, async (req, res) => {
  const rawName = typeof req.body.name === 'string' ? req.body.name : '';
  const size = Number(req.body.size);
  const name = safeName(rawName);
  const directory = safeRelativeDir(req.body.directory);

  if (!rawName) return res.status(400).json({ error: 'Missing file name' });
  if (directory === null) return res.status(400).json({ error: 'Bad folder path' });
  if (!Number.isSafeInteger(size) || size <= 0) return res.status(400).json({ error: 'Bad file size' });
  if (size > MAX_BYTES) {
    return res.status(413).json({ error: `That file is over the ${config.maxFileGB || 64} GB limit.` });
  }

  const shelf = targetShelf(req, name);
  if (!shelf) return res.status(403).json({ error: 'No permission for that shelf' });
  const id = uploadIdFor(req.user.name, name, size, shelf, directory);

  await fsp.mkdir(PARTS_DIR, { recursive: true });
  const existing = await readMeta(id);
  if (!existing) {
    await fsp.writeFile(metaPath(id), JSON.stringify({
      name, shelf, directory, size, user: req.user.name, started: Date.now(),
    }));
  }

  res.json({ id, received: await partSize(id), size, shelf, name, directory });
});

app.get('/api/upload/status/:id', auth, async (req, res) => {
  const id = req.params.id;
  if (!HEX32.test(id)) return res.status(400).json({ error: 'Bad upload id' });
  const meta = await readMeta(id);
  if (!meta || meta.user !== req.user.name) return res.status(404).json({ error: 'No such upload' });
  res.json({ id, received: await partSize(id), size: meta.size });
});

app.post('/api/upload/chunk/:id', auth, async (req, res) => {
  const id = req.params.id;
  if (!HEX32.test(id)) return res.status(400).json({ error: 'Bad upload id' });

  const meta = await readMeta(id);
  if (!meta || meta.user !== req.user.name) return res.status(404).json({ error: 'No such upload' });

  const offset = Number(req.query.offset);
  if (!Number.isSafeInteger(offset) || offset < 0) return res.status(400).json({ error: 'Bad offset' });

  if (writing.has(id)) return res.status(409).json({ error: 'Another chunk is still being written' });

  const have = await partSize(id);
  if (offset !== have) {
    // Client and server disagree about progress — tell it where to resume from
    // rather than appending bytes to the wrong place.
    return res.status(409).json({ error: 'Offset mismatch', received: have });
  }

  writing.add(id);
  let written = 0;
  try {
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(partPath(id), { flags: 'a' });
      const fail = (e) => { out.destroy(); reject(e); };

      req.on('data', (buf) => {
        written += buf.length;
        if (have + written > meta.size) fail(new Error('Body longer than declared size'));
      });
      req.on('aborted', () => fail(new Error('Client aborted')));
      req.on('error', fail);
      out.on('error', fail);
      out.on('finish', resolve);
      req.pipe(out);
    });
  } catch (e) {
    writing.delete(id);
    // Truncate back to the last known-good offset so a torn write can't corrupt.
    await fsp.truncate(partPath(id), have).catch(() => {});
    return res.status(400).json({ error: 'Chunk failed', received: have });
  }
  writing.delete(id);

  res.json({ received: await partSize(id), size: meta.size });
});

app.post('/api/upload/finish/:id', auth, async (req, res) => {
  const id = req.params.id;
  if (!HEX32.test(id)) return res.status(400).json({ error: 'Bad upload id' });

  const meta = await readMeta(id);
  if (!meta || meta.user !== req.user.name) return res.status(404).json({ error: 'No such upload' });

  const have = await partSize(id);
  if (have !== meta.size) {
    // A silently truncated file is worse than a failed upload. Refuse.
    return res.status(409).json({ error: 'Incomplete upload', received: have, size: meta.size });
  }
  // Permissions may have changed since init — check again before it lands.
  if (!canUse(req.user, meta.shelf)) {
    return res.status(403).json({ error: 'No permission for that shelf' });
  }

  const directory = safeRelativeDir(meta.directory);
  if (directory === null) return res.status(400).json({ error: 'Bad folder path' });
  const dir = path.resolve(ROOT, meta.shelf, directory);
  const shelfRoot = path.resolve(ROOT, meta.shelf);
  if (dir !== shelfRoot && !dir.startsWith(shelfRoot + path.sep)) {
    return res.status(400).json({ error: 'Bad folder path' });
  }
  await fsp.mkdir(dir, { recursive: true });
  const finalName = await uniqueName(dir, meta.name);
  const dest = path.join(dir, finalName);

  try {
    await fsp.rename(partPath(id), dest);
  } catch {
    // Different filesystem, or a rename the NAS refused — fall back to a copy.
    try {
      await fsp.copyFile(partPath(id), dest);
      await fsp.rm(partPath(id), { force: true });
    } catch {
      return res.status(500).json({ error: 'Could not save the finished file' });
    }
  }
  await fsp.rm(metaPath(id), { force: true }).catch(() => {});

  const rel = path.relative(ROOT, dest).split(path.sep).join('/');
  note(req.user.name, 'upload', rel);
  res.json({ name: finalName, rel });
});

app.delete('/api/upload/:id', auth, async (req, res) => {
  const id = req.params.id;
  if (!HEX32.test(id)) return res.status(400).json({ error: 'Bad upload id' });
  const meta = await readMeta(id);
  if (!meta || meta.user !== req.user.name) return res.status(404).json({ error: 'No such upload' });
  await discardUpload(id);
  res.json({ ok: true });
});

app.delete('/api/file', auth, async (req, res) => {
  const full = safePath(req.query.rel);
  if (!full) return res.status(400).json({ error: 'Bad path' });
  if (!requireShelf(req, res, req.query.rel)) return;
  try {
    await fsp.unlink(full);
    note(req.user.name, 'delete', req.query.rel);
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

app.patch('/api/file', auth, async (req, res) => {
  const from = safePath(req.body.rel);
  const shelf = req.body.shelf;
  const newName = req.body.name ? safeName(req.body.name) : null;
  if (!from) return res.status(400).json({ error: 'Bad path' });
  if (shelf && !shelfById(shelf)) return res.status(400).json({ error: 'Unknown shelf' });

  // Both ends must be permitted: you can't drag a file out of a shelf you
  // can't see, nor push one into a shelf you don't have.
  if (!requireShelf(req, res, req.body.rel)) return;
  if (shelf && !canUse(req.user, shelf)) {
    return res.status(403).json({ error: 'No permission for that shelf' });
  }

  // A rename stays beside the original, including inside nested folders. A
  // move to another shelf intentionally lands at that shelf's root.
  const targetDir = shelf ? path.join(ROOT, shelf) : path.dirname(from);
  await fsp.mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, await uniqueName(targetDir, newName || path.basename(from)));
  try {
    await fsp.rename(from, target);
    const now = path.relative(ROOT, target).split(path.sep).join('/');
    note(req.user.name, newName ? 'rename' : 'move', `${req.body.rel} -> ${now}`);
    res.json({ rel: now });
  } catch (e) {
    res.status(500).json({ error: 'Could not move file' });
  }
});

/** Streams with HTTP range support so video and audio can seek. */
async function sendFile(req, res, { download }) {
  const full = safePath(req.params[0]);
  if (!full) return res.status(400).end();

  let st;
  try { st = await fsp.stat(full); } catch { return res.status(404).end(); }
  if (!st.isFile()) return res.status(404).end();

  const type = MIME[ext(full)] || 'application/octet-stream';
  const name = path.basename(full);

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`);

  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m[1] ? parseInt(m[1], 10) : 0;
    let end = m[2] ? parseInt(m[2], 10) : st.size - 1;
    if (isNaN(start) || isNaN(end) || start > end || end >= st.size) {
      res.setHeader('Content-Range', `bytes */${st.size}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${st.size}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(full, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', st.size);
    fs.createReadStream(full).pipe(res);
  }
}

const shelfGate = (req, res, next) => {
  const shelf = shelfOf(req.params[0]);
  if (!shelf || !canUse(req.user, shelf)) return res.status(404).end();
  next();
};

app.get('/api/stream/*', auth, shelfGate, (req, res) => sendFile(req, res, { download: false }));
app.get('/api/download/*', auth, shelfGate, (req, res) => sendFile(req, res, { download: true }));

// ── thumbnails

app.get('/api/thumb/*', auth, shelfGate, async (req, res) => {
  if (!HAS_FFMPEG) return res.status(404).end();

  const full = safePath(req.params[0]);
  if (!full) return res.status(400).end();
  if (!THUMBABLE.includes(ext(full))) return res.status(404).end();

  let st;
  try { st = await fsp.stat(full); } catch { return res.status(404).end(); }
  if (!st.isFile()) return res.status(404).end();

  // Key on size and mtime too, so a replaced file gets a fresh frame.
  const key = crypto.createHash('sha256')
    .update(`${full}\u0000${st.size}\u0000${Math.round(st.mtimeMs)}`)
    .digest('hex').slice(0, 32);
  const cached = path.join(THUMB_DIR, `${key}.jpg`);

  const serve = () => {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=604800');
    fs.createReadStream(cached).pipe(res);
  };

  try { await fsp.access(cached); return serve(); } catch { /* generate below */ }

  await fsp.mkdir(THUMB_DIR, { recursive: true });
  await jobSlot();
  let ok = false;
  try {
    try { await fsp.access(cached); ok = true; }   // another request won the race
    catch { ok = await makeThumb(full, cached); }
  } finally { releaseSlot(); }

  if (!ok) return res.status(404).end();
  serve();
});

app.post('/api/thumbs/clear', auth, adminOnly, async (req, res) => {
  await fsp.rm(THUMB_DIR, { recursive: true, force: true }).catch(() => {});
  await fsp.mkdir(THUMB_DIR, { recursive: true }).catch(() => {});
  res.json({ ok: true });
});

// ---------------------------------------------------------------- health
/**
 * Deliberately unauthenticated and deliberately thin: an uptime monitor needs
 * to reach it without a credential, so it must not leak anything. No paths, no
 * file counts, no account names — just whether the thing is actually working.
 *
 * "Working" means the storage is writable, which is the failure that matters
 * here: if the NFS mount drops, the app keeps serving pages and silently loses
 * every upload. A liveness check that only proves the process is running would
 * miss exactly that.
 */
app.get('/api/health', async (req, res) => {
  const probeFile = path.join(ROOT, '.health');
  let storage = 'ok';
  try {
    await fsp.writeFile(probeFile, String(Date.now()));
    await fsp.rm(probeFile, { force: true });
  } catch {
    storage = 'unwritable';
  }

  /**
   * Writable isn't sufficient. If a network mount drops, the path reverts to
   * an empty local directory that writes just fine — the app would look
   * healthy while every upload landed on the wrong disk. The shelf folders are
   * created on the mount at boot, so their absence is the tell.
   */
  if (storage === 'ok' && shelves.length) {
    try {
      const here = await fsp.readdir(ROOT);
      const missing = shelfIds().filter((id) => !here.includes(id));
      if (missing.length === shelfIds().length) storage = 'detached';
      else if (missing.length) storage = 'incomplete';
    } catch {
      storage = 'unreadable';
    }
  }

  let free = null;
  try {
    const st = await fsp.statfs(ROOT);
    free = Math.round(st.bfree * st.bsize / 1024 / 1024);   // MB
  } catch { /* not available everywhere */ }

  const ok = storage === 'ok';
  res.status(ok ? 200 : 503).json({
    ok,
    build: BUILD_ID,
    storage,
    freeMB: free,
    thumbnails: HAS_FFMPEG,
    mkvTranscode: HAS_H264_ENCODER,
    mkvTransport: HAS_H264_ENCODER ? 'hls' : null,
    transcoder: TRANSCODER ? TRANSCODER.label : null,
    gpuTranscode: !!(TRANSCODER && TRANSCODER.hardware),
    encoderDiagnostics: ENCODER_DIAGNOSTICS,
    aiSubtitles: HAS_AI_SUBTITLES,
    aiSubtitleDiagnostics: AI_SUBTITLE_STATUS.diagnostic,
    metadata: !!TMDB_KEY,
    qualities: Object.keys(QUALITY_PROFILES),
    uptimeSec: Math.round(process.uptime()),
  });
});

// ---------------------------------------------------------------- media info

app.get('/api/mediainfo/*', auth, shelfGate, async (req, res) => {
  const full = safePath(req.params[0]);
  if (!full) return res.status(400).end();
  if (!HAS_FFMPEG) return res.json({ probed: false, reason: 'ffmpeg-missing' });
  try { await fsp.stat(full); } catch { return res.status(404).end(); }
  const info = await probe(full);
  res.json(info
    ? { probed: !info.inferred, ...info }
    : { probed: false, reason: 'probe-failed', remuxable: false });
});

/**
 * Fragmented MP4, streamed. A live conversion can't answer byte-range requests, so
 * the browser gets no seek bar — instead the client re-requests from a
 * timestamp, and `-ss` before `-i` makes ffmpeg jump there without decoding
 * everything in between.
 */
/** Shared by the signed-in player and by public share links. */
function pipeRemux(req, res, full, info, t) {
  const args = ['-nostdin', '-loglevel', 'error'];
  if (t > 0) args.push('-ss', t.toFixed(2));
  args.push('-i', full, '-map', '0:v:0');
  if (info.audio) args.push('-map', '0:a:0?');

  if (info.videoOk) {
    args.push('-c:v', 'copy');
  } else {
    // A fast software conversion is the universal fallback for HEVC, AV1,
    // MPEG-2 and high-bit-depth H.264 MKVs. Compatible H.264 is still copied,
    // so the common path remains virtually free.
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-profile:v', 'high');
  }

  if (info.audio) {
    args.push('-c:a', info.audioOk ? 'copy' : 'aac',
      ...(info.audioOk ? [] : ['-b:a', '192k', '-ac', '2']));
  }
  args.push('-sn', '-dn', '-map_metadata', '-1', '-max_muxing_queue_size', '4096',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof+negative_cts_offsets',
    '-f', 'mp4', 'pipe:1');

  streaming++;
  const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  streamFailures.delete(full);
  let ffmpegError = '';
  child.stderr.on('data', (d) => {
    const remaining = 16 * 1024 - Buffer.byteLength(ffmpegError);
    if (remaining > 0) ffmpegError += d.subarray(0, remaining).toString('utf8');
  });

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearTimeout(lifetime);
    streaming--;
    child.kill('SIGKILL');           // orphaned encoders would pile up otherwise
  };

  /**
   * If a viewer's network drops without closing the connection, the server
   * never sees a disconnect: ffmpeg fills the pipe, blocks, and sits there
   * holding a slot indefinitely. A stream can't legitimately outlive its own
   * runtime by much, so bound it — generously enough that pausing partway
   * through a film is fine.
   */
  const lifetime = setTimeout(cleanup,
    Math.min(((info.duration || 7200) - t + 3600) * 1000, 6 * 3600 * 1000));

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Vault-Remux', info.videoOk
    ? (info.audioOk ? 'copy' : 'audio-aac')
    : 'video-h264');

  const recordFailure = (fallback) => {
    const clean = ffmpegError.replace(full, path.basename(full))
      .replace(/\s+/g, ' ').trim().slice(0, 1200) || fallback;
    if (streamFailures.size >= 200) streamFailures.delete(streamFailures.keys().next().value);
    streamFailures.set(full, { at: Date.now(), error: clean });
    return clean;
  };

  child.stdout.pipe(res);
  child.on('error', (e) => {
    recordFailure(e.message || 'Could not start ffmpeg');
    cleanup();
    res.destroy();
  });
  child.on('exit', (code) => {
    if (closed || code === 0) return;
    const rel = path.relative(ROOT, full).replace(/[\r\n\t]/g, '?');
    const why = recordFailure(`ffmpeg exited with code ${code}`);
    console.warn(`[media] ffmpeg stream failed for ${rel}: ${why}`);
  });
  child.on('close', cleanup);
  res.on('close', cleanup);
  req.on('aborted', cleanup);
}

app.get('/api/media-status/*', auth, shelfGate, (req, res) => {
  const full = safePath(req.params[0]);
  if (!full) return res.status(400).json({ ok: false, error: 'Bad media path' });
  const failure = streamFailures.get(full);
  if (!failure) return res.json({ ok: true });
  if (Date.now() - failure.at > 5 * 60 * 1000) {
    streamFailures.delete(full);
    return res.json({ ok: true });
  }
  res.json({ ok: false, error: failure.error });
});

// Cloudflare Tunnel buffers a never-ending origin response. HLS avoids that
// failure mode: ffmpeg writes short, complete segments and every HTTP request
// finishes normally, while hls.js joins the segments in the browser.
app.post('/api/hls/start/*', auth, shelfGate, async (req, res) => {
  if (!HAS_H264_ENCODER) return res.status(503).json({ error: 'ffmpeg has no usable H.264 encoder' });
  if (streaming >= MAX_STREAMS) {
    return res.status(503).json({ error: 'Too many streams running. Try again in a moment.' });
  }

  const full = safePath(req.params[0]);
  if (!full || !THUMBABLE.includes(ext(full))) return res.status(400).json({ error: 'Bad video path' });
  try { await fsp.stat(full); } catch { return res.status(404).json({ error: 'Video not found' }); }

  const startAt = Math.max(0, Math.min(Number(req.query.t) || 0, 24 * 3600));
  const quality = qualityProfile(req.query.quality);
  let session;
  try {
    session = await startHlsConversion(full, req.user.name, startAt, quality.id);
    const ready = await waitForHls(session);
    if (!ready) {
      const error = session.error || 'Could not prepare the first video segment';
      await stopHlsSession(session.id);
      return res.status(500).json({ error });
    }
  } catch (e) {
    if (session) await stopHlsSession(session.id);
    return res.status(500).json({ error: e.message || 'Could not start video conversion' });
  }

  session.lastAccess = Date.now();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    id: session.id,
    url: `/api/hls/${session.id}/index.m3u8`,
    quality: session.quality,
    qualityLabel: session.qualityLabel,
    direct: session.direct,
    encoder: session.encoder,
  });
});

const ownedHls = (req) => {
  const session = hlsSessions.get(req.params.id);
  return session && session.user === req.user.name ? session : null;
};

app.delete('/api/hls/:id', auth, async (req, res) => {
  const session = ownedHls(req);
  if (session) await stopHlsSession(session.id);
  res.json({ ok: true });
});

app.get('/api/hls/:id/status', auth, (req, res) => {
  const session = ownedHls(req);
  if (!session) return res.status(404).json({ ok: false, error: 'Conversion session ended' });
  session.lastAccess = Date.now();
  res.setHeader('Cache-Control', 'no-store');
  res.json(session.error ? { ok: false, error: session.error } : { ok: true, finished: session.finished });
});

app.get('/api/hls/:id/index.m3u8', auth, async (req, res) => {
  const session = ownedHls(req);
  if (!session) return res.status(404).end();
  session.lastAccess = Date.now();
  try {
    const raw = await fsp.readFile(path.join(session.dir, 'index.m3u8'), 'utf8');
    // ffmpeg normally writes relative segment names; normalise defensively so
    // an absolute filesystem path can never leak into the playlist URL.
    const playlist = raw.split(/\r?\n/).map((line) => {
      if (!line || line.startsWith('#')) return line;
      return path.basename(line);
    }).join('\n');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(playlist);
  } catch {
    res.status(session.error ? 500 : 404).end();
  }
});

app.get('/api/hls/:id/:segment', auth, async (req, res) => {
  const session = ownedHls(req);
  if (!session || !/^seg-\d{6}\.ts$/.test(req.params.segment)) return res.status(404).end();
  session.lastAccess = Date.now();
  const segment = path.join(session.dir, req.params.segment);
  try {
    const st = await fsp.stat(segment);
    if (!st.isFile()) return res.status(404).end();
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Content-Length', st.size);
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(segment).pipe(res);
  } catch {
    res.status(404).end();
  }
});

// ---------------------------------------------------------------- durable MP4 conversions
// These jobs are deliberately separate from live HLS sessions: one may run in
// the background, reports progress, and atomically moves its completed MP4
// beside the original. Explicit replacement jobs remove an MKV only after the
// MP4 has been committed and independently verified.
const MAX_CONVERSIONS = Math.max(1, Math.min(Number(config.convertJobs) || 1, 4));
const conversionJobs = new Map();
const conversionQueue = [];
let converting = 0;

function publicConversion(job) {
  return {
    id: job.id, status: job.status, rel: job.rel, outputRel: job.outputRel || null,
    quality: job.quality.label, progress: Math.max(0, Math.min(100, job.progress || 0)),
    encoder: job.encoder, direct: !!job.direct, error: job.error || '',
    attempt: job.attempt || 0, retrying: !!job.retrying, signal: job.signal || null,
    replace: !!job.replace, sourceDeleted: !!job.sourceDeleted,
    created: job.created, finished: job.finished || null,
  };
}

function finishConversionSlot(job) {
  converting = Math.max(0, converting - 1);
  job.child = null;
  runNextConversion();
}

function conversionFailure(job, result) {
  const clean = String(result.stderr || '')
    .replace(job.full, path.basename(job.full)).replace(/\s+/g, ' ').trim().slice(0, 1200);
  if (result.spawnError) return result.spawnError;
  if (result.signal) {
    const hint = result.signal === 'SIGKILL'
      ? ' The server or container most likely reached its memory limit.' : '';
    return `ffmpeg was terminated by ${result.signal}.${hint}`;
  }
  return clean || `ffmpeg exited with code ${result.code}`;
}

function runConversionAttempt(job, { safe = false } = {}) {
  return new Promise((resolve) => {
    const transcoder = safe && CPU_TRANSCODER ? CPU_TRANSCODER : TRANSCODER;
    const output = mediaOutputArgs(job.info, job.quality, {
      lowLatency: false, allowCopy: !safe, transcoder, safe,
    });
    job.attempt = safe ? 2 : 1;
    job.retrying = safe;
    job.signal = null;
    job.stderr = '';
    job.spawnError = '';
    job.direct = output.direct;
    job.encoder = output.direct ? 'stream copy'
      : (safe ? 'CPU libx264 · safe retry' : transcoder.label);

    const bounded = !output.direct && transcoder.kind === 'cpu';
    const args = ['-nostdin', '-hide_banner', '-loglevel', 'error',
      ...encoderInputArgs(transcoder),
      ...(bounded ? ['-threads', String(safe ? 1 : CONVERSION_THREADS), '-filter_threads', '1'] : []),
      '-i', job.full, '-map', '0:v:0', '-map', '0:a:0?', ...output.args,
      '-sn', '-dn', '-map_metadata', '0', '-max_muxing_queue_size', '4096',
      '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', '-y', job.tmp];

    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    job.child = child;
    let progressText = '';
    child.stdout.on('data', (chunk) => {
      progressText += chunk.toString('utf8');
      const lines = progressText.split(/\r?\n/);
      progressText = lines.pop() || '';
      for (const line of lines) {
        const m = /^out_time_(?:us|ms)=(\d+)$/.exec(line);
        if (m && job.info.duration) {
          job.progress = Math.min(99.5, (+m[1] / 1e6) / job.info.duration * 100);
        }
      }
    });
    child.stderr.on('data', (chunk) => {
      const remaining = 16 * 1024 - Buffer.byteLength(job.stderr);
      if (remaining > 0) job.stderr += chunk.subarray(0, remaining).toString('utf8');
    });
    child.on('error', (error) => { job.spawnError = error.message || 'Could not start ffmpeg'; });
    child.on('close', (code, signal) => {
      job.signal = signal || null;
      resolve({ code, signal: signal || null, stderr: job.stderr, spawnError: job.spawnError, direct: output.direct });
    });
  });
}

async function runConversion(job) {
  converting++;
  job.status = 'running';
  try {
    let result = await runConversionAttempt(job);
    if (job.cancelled) {
      job.status = 'cancelled';
      job.finished = Date.now();
      await fsp.rm(job.tmp, { force: true }).catch(() => {});
      return;
    }

    // A null code plus a signal is commonly an OOM kill in a Proxmox/LXC
    // container. Hardware encoders can also fail after their startup probe.
    // Retry once through conservative single-threaded libx264 before giving up.
    if ((result.code !== 0 || result.spawnError) && !result.direct && CPU_TRANSCODER) {
      const firstFailure = conversionFailure(job, result);
      console.warn(`[media] conversion attempt 1 failed for ${job.rel}; retrying safely: ${firstFailure}`);
      await fsp.rm(job.tmp, { force: true }).catch(() => {});
      job.progress = 0;
      job.error = '';
      result = await runConversionAttempt(job, { safe: true });
    }

    if (job.cancelled) {
      job.status = 'cancelled';
      job.finished = Date.now();
      await fsp.rm(job.tmp, { force: true }).catch(() => {});
      return;
    }
    if (result.code !== 0 || result.spawnError) {
      job.status = 'failed';
      job.error = conversionFailure(job, result);
      if (result.signal === 'SIGKILL') {
        job.error += ' Safe mode also failed; raise the container memory limit or select 1080p.';
      }
      job.finished = Date.now();
      await fsp.rm(job.tmp, { force: true }).catch(() => {});
      return;
    }

    const finalName = await uniqueName(job.destDir, job.desiredName);
    const dest = path.join(job.destDir, finalName);
    await fsp.rename(job.tmp, dest);
    job.outputRel = path.relative(ROOT, dest).split(path.sep).join('/');
    if (job.replace) {
      // Destructive replacement is only allowed after ffmpeg succeeded, the
      // MP4 was committed, and ffprobe independently confirmed a video stream.
      // If verification fails both files are kept.
      const verified = await probe(dest);
      if (!verified || verified.inferred || !verified.video) {
        throw new Error('The MP4 was created but could not be verified; the MKV was kept for safety');
      }
      await fsp.unlink(job.full);
      probeCache.delete(job.full);
      job.sourceDeleted = true;
    }
    job.progress = 100;
    job.retrying = false;
    job.status = 'complete';
    job.finished = Date.now();
    note(job.user, job.replace ? 'convert-replace' : 'convert', `${job.rel} -> ${job.outputRel}`);
  } catch (error) {
    job.status = 'failed';
    job.error = error.message || 'Could not save the converted MP4';
    job.finished = Date.now();
    await fsp.rm(job.tmp, { force: true }).catch(() => {});
  } finally {
    finishConversionSlot(job);
  }
}

function runNextConversion() {
  while (converting < MAX_CONVERSIONS && conversionQueue.length) {
    const id = conversionQueue.shift();
    const job = conversionJobs.get(id);
    if (job && !job.cancelled && job.status === 'queued') runConversion(job);
  }
}

app.post('/api/convert/*', auth, shelfGate, async (req, res) => {
  if (!HAS_H264_ENCODER) return res.status(503).json({ error: 'No usable H.264 encoder is available' });
  if (conversionQueue.length >= 200) return res.status(503).json({ error: 'The conversion queue is full' });
  const full = safePath(req.params[0]);
  if (!full || !THUMBABLE.includes(ext(full))) return res.status(400).json({ error: 'Bad video path' });
  try { await fsp.stat(full); } catch { return res.status(404).json({ error: 'Video not found' }); }

  const info = await probe(full);
  if (!info || (!info.video && !info.inferred)) return res.status(415).json({ error: 'No video stream found' });
  // A query-only POST has no request body. Express intentionally leaves
  // req.body undefined in that case, which used to make every conversion from
  // the browser fail before a job was even queued.
  const body = req.body || {};
  const quality = qualityProfile(req.query.quality || body.quality);
  const replace = req.query.replace === '1' || body.replace === true;
  const desiredName = `${path.parse(full).name}${replace || quality.id === 'original' ? '' : ` (${quality.label})`}.mp4`;
  if (replace) {
    try {
      await fsp.access(path.join(path.dirname(full), desiredName));
      return res.status(409).json({ error: 'An MP4 with this name already exists. The MKV was kept; remove or rename the existing MP4 first.' });
    } catch (error) {
      if (error && error.code !== 'ENOENT') return res.status(500).json({ error: 'Could not check the MP4 destination' });
    }
  }
  const id = crypto.randomBytes(16).toString('hex');
  const job = {
    id, user: req.user.name, rel: req.params[0], full, info, quality,
    destDir: path.dirname(full), desiredName,
    tmp: path.join(CONVERSION_DIR, `${id}.mp4`), status: 'queued', progress: 0,
    encoder: TRANSCODER.label, direct: false, replace, sourceDeleted: false, stderr: '', error: '',
    attempt: 0, retrying: false, signal: null, created: Date.now(),
    finished: null, child: null, cancelled: false,
  };
  conversionJobs.set(id, job);
  conversionQueue.push(id);
  runNextConversion();
  res.status(202).json(publicConversion(job));
});

app.get('/api/convert/:id', auth, (req, res) => {
  const job = conversionJobs.get(req.params.id);
  if (!job || job.user !== req.user.name) return res.status(404).json({ error: 'Conversion not found' });
  res.setHeader('Cache-Control', 'no-store');
  res.json(publicConversion(job));
});

app.delete('/api/convert/:id', auth, async (req, res) => {
  const job = conversionJobs.get(req.params.id);
  if (!job || job.user !== req.user.name) return res.status(404).json({ error: 'Conversion not found' });
  job.cancelled = true;
  if (job.status === 'queued') {
    job.status = 'cancelled'; job.finished = Date.now();
  } else if (job.child && job.child.exitCode === null) {
    job.child.kill('SIGKILL');
  }
  await fsp.rm(job.tmp, { force: true }).catch(() => {});
  res.json({ ok: true });
});

app.get('/api/media/*', auth, shelfGate, async (req, res) => {
  if (!HAS_FFMPEG) return res.status(503).end();

  const full = safePath(req.params[0]);
  if (!full) return res.status(400).end();
  try { await fsp.stat(full); } catch { return res.status(404).end(); }

  // Compatibility mode deliberately bypasses ffprobe. ffmpeg performs its own
  // demuxer/codec detection and converts the first video/audio streams to the
  // browser-safe formats below. This keeps a broken metadata probe from being
  // able to block playback a second time.
  const info = req.query.compat === '1'
    ? compatibilityVideoInfo(full)
    : await probe(full);
  if (!info || !info.remuxable) return res.status(415).json({ error: 'No video stream found' });
  if (streaming >= MAX_STREAMS) {
    return res.status(503).json({ error: 'Too many streams running. Try again in a moment.' });
  }

  const t = Math.max(0, Math.min(parseFloat(req.query.t) || 0, (info.duration || 0)));
  pipeRemux(req, res, full, info, t);
});

/**
 * A strip of nine frames spread across the running time, laid out end to end.
 * One request, one cached file — the alternative is nine requests per tile,
 * which turns a grid of thirty videos into a stampede.
 */
app.get('/api/scrub/*', auth, shelfGate, async (req, res) => {
  if (!HAS_FFMPEG) return res.status(404).end();

  const full = safePath(req.params[0]);
  if (!full) return res.status(400).end();
  if (!THUMBABLE.includes(ext(full))) return res.status(404).end();

  let st;
  try { st = await fsp.stat(full); } catch { return res.status(404).end(); }

  const key = crypto.createHash('sha256')
    .update(`scrub\u0000${full}\u0000${st.size}\u0000${Math.round(st.mtimeMs)}`)
    .digest('hex').slice(0, 32);
  const cached = path.join(THUMB_DIR, `${key}.strip.jpg`);

  const serve = () => {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=604800');
    res.setHeader('X-Scrub-Frames', '9');
    fs.createReadStream(cached).pipe(res);
  };

  try { await fsp.access(cached); return serve(); } catch { /* build it */ }

  const info = await probe(full);
  if (!info || !info.duration) return res.status(404).end();

  await fsp.mkdir(THUMB_DIR, { recursive: true });
  await jobSlot();
  let ok = false;
  try {
    try { await fsp.access(cached); ok = true; }
    catch {
      // Sample at 5%..85% so titles and credits don't dominate the strip.
      const step = info.duration * 0.8 / 8;
      const start = info.duration * 0.05;
      const tmp = `${cached}.${process.pid}.tmp`;
      const parts = [];
      for (let i = 0; i < 9; i++) {
        const at = (start + step * i).toFixed(2);
        const frame = `${tmp}.${i}.jpg`;
        const r = await run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-ss', at, '-i', full,
          '-frames:v', '1', '-vf', 'scale=240:-2', '-q:v', '6', '-f', 'image2', '-y', frame], 20000);
        if (r !== null) parts.push(frame);
      }
      if (parts.length === 9) {
        const inputs = parts.flatMap((f) => ['-i', f]);
        const r = await run('ffmpeg', ['-nostdin', '-loglevel', 'error', ...inputs,
          '-filter_complex', 'hstack=inputs=9', '-q:v', '6', '-f', 'image2', '-y', tmp], 25000);
        if (r !== null) { await fsp.rename(tmp, cached).then(() => { ok = true; }).catch(() => {}); }
      }
      for (const f of parts) await fsp.rm(f, { force: true }).catch(() => {});
      await fsp.rm(tmp, { force: true }).catch(() => {});
    }
  } finally { releaseSlot(); }

  if (!ok) return res.status(404).end();
  serve();
});

// ---------------------------------------------------------------- subtitles
/**
 * Two sources: tracks embedded in the container, and sidecar files sitting
 * next to the video. Both are converted to WebVTT, which is the only format
 * a <track> element accepts.
 */

const LOCAL_WHISPER_PYTHON = process.platform === 'win32'
  ? path.join(__dirname, '.venv', 'Scripts', 'python.exe')
  : path.join(__dirname, '.venv', 'bin', 'python');
const WHISPER_PYTHON = config.whisperPython || (fs.existsSync(LOCAL_WHISPER_PYTHON) ? LOCAL_WHISPER_PYTHON : 'python3');
const WHISPER_SCRIPT = path.join(__dirname, 'scripts', 'transcribe.py');
const WHISPER_MODELS = new Set(['tiny', 'base', 'small', 'medium', 'large-v3']);
const AI_SUBTITLE_STATUS = (() => {
  if (!fs.existsSync(WHISPER_SCRIPT)) return { available: false, diagnostic: 'transcription script missing' };
  try {
    const result = spawnSync(WHISPER_PYTHON, ['-c', 'import faster_whisper, importlib.metadata as m; print(m.version("faster-whisper"))'], {
      encoding: 'utf8', timeout: 12000,
    });
    if (result.status === 0) return { available: true, diagnostic: `ready via ${WHISPER_PYTHON} (${String(result.stdout || '').trim() || 'version unknown'})` };
    const detail = String(result.stderr || result.error?.message || `Python exited ${result.status}`).replace(/\s+/g, ' ').trim().slice(0, 360);
    return { available: false, diagnostic: detail || `faster-whisper is not installed for ${WHISPER_PYTHON}` };
  } catch (error) {
    return { available: false, diagnostic: error.message || `could not run ${WHISPER_PYTHON}` };
  }
})();
const HAS_AI_SUBTITLES = AI_SUBTITLE_STATUS.available;
const MAX_SUBTITLE_JOBS = Math.max(1, Math.min(Number(config.subtitleJobs) || 1, 2));
const subtitleJobs = new Map();
const subtitleQueue = [];
let subtitling = 0;

function publicSubtitleJob(job) {
  return {
    id: job.id, rel: job.rel, status: job.status, progress: Math.max(0, Math.min(100, job.progress || 0)),
    model: job.model, device: job.actualDevice || job.device, language: job.detectedLanguage || job.language,
    outputRel: job.outputRel || null, error: job.error || '', created: job.created, finished: job.finished || null,
  };
}

function runNextSubtitle() {
  while (subtitling < MAX_SUBTITLE_JOBS && subtitleQueue.length) {
    const id = subtitleQueue.shift();
    const job = subtitleJobs.get(id);
    if (job && !job.cancelled && job.status === 'queued') runSubtitleJob(job);
  }
}

function runSubtitleJob(job) {
  subtitling++;
  job.status = 'running';
  const args = [WHISPER_SCRIPT, '--input', job.full, '--output', job.output,
    '--model', job.model, '--device', job.device, '--language', job.language];
  const child = spawn(WHISPER_PYTHON, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  job.child = child;
  let lines = '';
  child.stdout.on('data', (chunk) => {
    lines += chunk.toString('utf8');
    const complete = lines.split(/\r?\n/); lines = complete.pop() || '';
    for (const line of complete) {
      try {
        const event = JSON.parse(line);
        if (Number.isFinite(event.progress)) job.progress = event.progress;
        if (event.device) job.actualDevice = event.device;
        if (event.language) job.detectedLanguage = event.language;
        if (event.kind === 'error' && event.message) job.error = event.message;
      } catch { /* diagnostic line from a dependency */ }
    }
  });
  child.stderr.on('data', (chunk) => {
    const remaining = 16 * 1024 - Buffer.byteLength(job.stderr);
    if (remaining > 0) job.stderr += chunk.subarray(0, remaining).toString('utf8');
  });
  child.on('error', (error) => { job.spawnError = error.message || 'Could not start AI subtitles'; });
  child.on('close', async (code) => {
    try {
      if (job.cancelled) {
        job.status = 'cancelled';
        await fsp.rm(`${job.output}.part`, { force: true }).catch(() => {});
      } else if (code !== 0 || job.spawnError) {
        job.status = 'failed';
        job.error = job.error || job.spawnError || job.stderr.replace(job.full, path.basename(job.full)).replace(/\s+/g, ' ').trim().slice(0, 1200) || `subtitle process exited with code ${code}`;
        await fsp.rm(`${job.output}.part`, { force: true }).catch(() => {});
      } else {
        const stat = await fsp.stat(job.output);
        if (!stat.size) throw new Error('AI subtitle file was empty');
        job.status = 'complete'; job.progress = 100;
        job.outputRel = path.relative(ROOT, job.output).split(path.sep).join('/');
        note(job.user, 'ai-subtitles', job.rel);
      }
    } catch (error) {
      job.status = 'failed'; job.error = error.message || 'Could not save AI subtitles';
    } finally {
      job.finished = Date.now(); job.child = null; subtitling = Math.max(0, subtitling - 1); runNextSubtitle();
    }
  });
}

app.post('/api/ai-subtitles/*', auth, shelfGate, async (req, res) => {
  if (!HAS_AI_SUBTITLES) return res.status(503).json({ error: 'AI subtitles are not installed. Install faster-whisper on the server.' });
  if (subtitleQueue.length >= 60) return res.status(503).json({ error: 'The subtitle queue is full' });
  const full = safePath(req.params[0]);
  if (!full || !THUMBABLE.includes(ext(full))) return res.status(400).json({ error: 'Bad video path' });
  try { await fsp.stat(full); } catch { return res.status(404).json({ error: 'Video not found' }); }
  const model = WHISPER_MODELS.has(String(req.body.model || config.whisperModel || 'medium'))
    ? String(req.body.model || config.whisperModel || 'medium') : 'medium';
  const requestedLanguage = String(req.body.language || 'auto').toLowerCase();
  const language = requestedLanguage === 'auto' || /^[a-z]{2,8}(?:-[a-z]{2,8})?$/.test(requestedLanguage)
    ? requestedLanguage : 'auto';
  const device = ['auto', 'cuda', 'cpu'].includes(String(config.whisperDevice || 'auto'))
    ? String(config.whisperDevice || 'auto') : 'auto';
  const tag = language === 'auto' ? 'ai' : `ai.${language}`;
  const output = path.join(path.dirname(full), `${path.parse(full).name}.${tag}.vtt`);
  const id = crypto.randomBytes(16).toString('hex');
  const job = { id, user: req.user.name, rel: req.params[0], full, output, model, language, device,
    status: 'queued', progress: 0, error: '', stderr: '', created: Date.now(), finished: null,
    child: null, cancelled: false, actualDevice: '', detectedLanguage: '', outputRel: '' };
  subtitleJobs.set(id, job); subtitleQueue.push(id); runNextSubtitle();
  res.status(202).json(publicSubtitleJob(job));
});

app.get('/api/ai-subtitles/:id', auth, (req, res) => {
  const job = subtitleJobs.get(req.params.id);
  if (!job || job.user !== req.user.name) return res.status(404).json({ error: 'Subtitle job not found' });
  res.setHeader('Cache-Control', 'no-store'); res.json(publicSubtitleJob(job));
});

app.delete('/api/ai-subtitles/:id', auth, async (req, res) => {
  const job = subtitleJobs.get(req.params.id);
  if (!job || job.user !== req.user.name) return res.status(404).json({ error: 'Subtitle job not found' });
  job.cancelled = true;
  if (job.status === 'queued') { job.status = 'cancelled'; job.finished = Date.now(); }
  else if (job.child && job.child.exitCode === null) job.child.kill('SIGKILL');
  await fsp.rm(`${job.output}.part`, { force: true }).catch(() => {});
  res.json({ ok: true });
});

async function subtitleTracks(full) {
  const out = [];

  // sidecars: "Film.en.srt", "Film.srt"
  const dir = path.dirname(full);
  const stem = path.parse(full).name.toLowerCase();
  let siblings = [];
  try { siblings = await fsp.readdir(dir); } catch { /* nothing */ }
  for (const name of siblings) {
    const e = ext(name);
    if (!SIDECAR_EXT.includes(e)) continue;
    const base = path.parse(name).name.toLowerCase();
    if (base !== stem && !base.startsWith(stem + '.')) continue;
    const tag = base.length > stem.length ? base.slice(stem.length + 1) : '';
    out.push({ id: `file:${name}`, label: tag ? tag.toUpperCase() : 'Subtitles', source: 'file' });
  }

  // embedded
  if (HAS_FFMPEG) {
    const raw = await run('ffprobe', ['-v', 'error', '-print_format', 'json',
      '-show_streams', '-select_streams', 's', full], 15000);
    if (raw) {
      try {
        const streams = JSON.parse(raw).streams || [];
        streams.forEach((st, i) => {
          const tags = st.tags || {};
          const lang = (tags.language || '').toUpperCase();
          const title = tags.title || '';
          out.push({
            id: `embed:${i}`,
            label: title || lang || `Track ${i + 1}`,
            lang: lang.toLowerCase().slice(0, 3) || undefined,
            source: 'embedded',
          });
        });
      } catch { /* no subtitle streams */ }
    }
  }
  return out;
}

app.get('/api/subs/*', auth, shelfGate, async (req, res) => {
  const full = safePath(req.params[0]);
  if (!full) return res.status(400).end();
  try { await fsp.stat(full); } catch { return res.status(404).end(); }
  res.json({ tracks: await subtitleTracks(full) });
});

app.get('/api/sub/*', auth, shelfGate, async (req, res) => {
  const full = safePath(req.params[0]);
  if (!full) return res.status(400).end();
  const track = String(req.query.track || '');

  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  if (track.startsWith('file:')) {
    // Resolve the sidecar through safePath too — the name came from the client.
    const wanted = path.basename(track.slice(5));
    const side = path.join(path.dirname(full), wanted);
    if (!safePath(path.relative(ROOT, side))) return res.status(400).end();
    if (!SIDECAR_EXT.includes(ext(side))) return res.status(400).end();
    try { await fsp.stat(side); } catch { return res.status(404).end(); }

    if (ext(side) === 'vtt') return fs.createReadStream(side).pipe(res);
    if (!HAS_FFMPEG) return res.status(503).end();
    const out = await run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', side, '-f', 'webvtt', 'pipe:1'], 20000, 8 * 1024 * 1024);
    return out === null ? res.status(500).end() : res.send(out);
  }

  const m = /^embed:(\d{1,2})$/.exec(track);
  if (!m) return res.status(400).end();
  if (!HAS_FFMPEG) return res.status(503).end();
  const out = await run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', full,
    '-map', `0:s:${m[1]}`, '-f', 'webvtt', 'pipe:1'], 30000, 8 * 1024 * 1024);
  if (out === null) return res.status(404).end();
  res.send(out);
});

// ---------------------------------------------------------------- artwork
/**
 * Optional. Without a TMDB key in config.json the endpoint simply reports that
 * it's off and the grid keeps using video frames — nothing else changes.
 *
 * Matching is done on a title guessed from the filename, so it will sometimes
 * be wrong. A wrong poster is worse than none, so anything below a confidence
 * threshold is discarded rather than shown.
 */
const TMDB_KEY = config.tmdbKey || '';
const META_DIR = path.join(ROOT, '.meta');

/**
 * Strip release-name noise down to something searchable.
 *
 * The awkward case is a title that contains a number — "Blade Runner 2049
 * (2017)" has two year-shaped tokens and only one of them is the year. A
 * parenthesised year always wins; otherwise the last one is taken, and only
 * when something precedes it, so "2012.mkv" stays a title rather than becoming
 * an empty string with a date.
 */
const NOISE = /\b(2160p|1080p|720p|480p|4k|uhd|hdr10?|dv|x264|x265|h ?264|h ?265|hevc|av1|bluray|blu-ray|bdrip|brrip|webrip|web-?dl|hdtv|dvdrip|remux|aac\d?|ac3|dts(-hd)?|truehd|atmos|ddp?\s?5[. ]1|flac|opus|proper|repack|extended|remastered|unrated|directors?[. ]cut|internal|limited|multi|dual|subbed|dubbed)\b/i;

function guessTitle(filename) {
  let n = path.parse(filename).name;

  // Series first: everything before the episode marker is the show.
  const ep = /^(.*?)[\s._-]*(?:[Ss](\d{1,2})[\s._-]*[Ee](\d{1,3})|(\d{1,2})x(\d{1,3})\b)/.exec(n);
  if (ep && ep[1] && ep[1].trim().length > 1) {
    return {
      title: ep[1].replace(/[._]+/g, ' ').replace(/[\s-]+$/, '').trim(),
      year: null,
      season: +(ep[2] || ep[4]),
      episode: +(ep[3] || ep[5]),
      kind: 'tv',
    };
  }

  let year = null;
  const paren = n.match(/[\(\[](19\d{2}|20\d{2})[\)\]]/);
  if (paren) {
    year = paren[1];
    n = n.slice(0, paren.index);
  } else {
    // Only a year with something after it — a resolution, a codec, anything —
    // is really a release year. A trailing number is part of the title:
    // "Blade Runner 2049" is a film, not a 1982 film released in 2049.
    const all = [...n.matchAll(/(?<=[\s._-])(19\d{2}|20\d{2})(?=[\s._-])/g)];
    if (all.length) {
      const last = all[all.length - 1];
      year = last[1];
      n = n.slice(0, last.index);
    }
  }

  n = n.replace(/[._]+/g, ' ');
  const noise = n.search(NOISE);
  if (noise > 0) n = n.slice(0, noise);
  n = n.replace(/[\[\(].*?[\]\)]/g, '').replace(/[-–—\s]+$/, '');

  return { title: n.replace(/\s+/g, ' ').trim(), year, kind: 'movie' };
}

app.get('/api/meta/*', auth, shelfGate, async (req, res) => {
  if (!TMDB_KEY) return res.json({ enabled: false });

  const full = safePath(req.params[0]);
  if (!full) return res.status(400).end();
  let st;
  try { st = await fsp.stat(full); } catch { return res.status(404).end(); }

  const key = crypto.createHash('sha256').update(`meta-v4\u0000${full}\u0000${st.size}`).digest('hex').slice(0, 32);
  const cacheFile = path.join(META_DIR, `${key}.json`);
  try {
    return res.json(JSON.parse(await fsp.readFile(cacheFile, 'utf8')));
  } catch { /* look it up */ }

  const mediaShelf = shelfOf(req.params[0]);
  const relParts = String(req.params[0]).replace(/\\/g, '/').split('/').filter(Boolean);
  // A movie folder is usually a cleaner identity than the release filename
  // inside it (and handles generic names such as movie.mkv or main.mkv).
  const name = mediaShelf === 'movies' && relParts.length > 2 ? relParts[1] : path.basename(full);
  const guessed = guessTitle(name);
  const title = guessed.title;
  const year = guessed.year;
  const season = guessed.season;
  // The shelf is stronger evidence than a fuzzy search result. Movies should
  // never turn into a TV match merely because search/multi ranked one first.
  const guessKind = mediaShelf === 'series' ? 'tv' : mediaShelf === 'movies' ? 'movie' : guessed.kind;
  if (!title || title.length < 2) return res.json({ enabled: true, found: false });

  let data = { enabled: true, found: false, guessed: title };
  try {
    const q = new URLSearchParams({ api_key: TMDB_KEY, query: title, include_adult: 'false', language: 'en-US' });
    if (year) q.set(guessKind === 'tv' ? 'first_air_date_year' : 'year', year);
    // A filename that parsed as an episode is a show, so don't let a film with
    // a similar name win the match.
    const endpoint = guessKind === 'tv' ? 'search/tv' : guessKind === 'movie' ? 'search/movie' : 'search/multi';
    const r = await fetch(`https://api.themoviedb.org/3/${endpoint}?${q}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const j = await r.json();
      const hit = guessKind === 'tv' || guessKind === 'movie'
        ? (j.results || [])[0]
        : (j.results || []).find((x) => x.media_type === 'movie' || x.media_type === 'tv');
      if (hit) {
        const actualKind = hit.media_type || guessKind;
        data = {
          enabled: true, found: true, guessed: title,
          title: hit.title || hit.name,
          year: (hit.release_date || hit.first_air_date || '').slice(0, 4),
          overview: (hit.overview || '').slice(0, 600),
          rating: hit.vote_average ? Math.round(hit.vote_average * 10) / 10 : null,
          poster: hit.poster_path ? `https://image.tmdb.org/t/p/w400${hit.poster_path}` : null,
          backdrop: hit.backdrop_path ? `https://image.tmdb.org/t/p/w1280${hit.backdrop_path}` : null,
          tmdbId: hit.id,
          kind: actualKind,
          season: season || undefined,
        };
        try {
          const detailType = actualKind === 'tv' ? 'tv' : 'movie';
          const detailQuery = new URLSearchParams({ api_key: TMDB_KEY, append_to_response: 'credits,recommendations,similar' });
          const detailResponse = await fetch(`https://api.themoviedb.org/3/${detailType}/${hit.id}?${detailQuery}`, {
            signal: AbortSignal.timeout(8000),
          });
          if (detailResponse.ok) {
            const detail = await detailResponse.json();
            const related = (detail.recommendations?.results?.length
              ? detail.recommendations.results : detail.similar?.results || []).slice(0, 18);
            data = {
              ...data,
              tagline: (detail.tagline || '').slice(0, 180),
              genres: (detail.genres || []).map((genre) => genre.name).filter(Boolean).slice(0, 6),
              runtime: detail.runtime || (detail.episode_run_time || [])[0] || null,
              status: detail.status || null,
              cast: (detail.credits?.cast || []).slice(0, 14).map((person) => ({
                name: person.name, character: person.character || '',
                photo: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
              })),
              recommendations: related.map((item) => ({
                id: item.id, title: item.title || item.name,
                year: (item.release_date || item.first_air_date || '').slice(0, 4),
                overview: (item.overview || '').slice(0, 260),
                poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
                backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
                rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
              })),
            };
          }
        } catch { /* base match remains useful when detail lookup fails */ }
      }
    }
  } catch { /* network trouble — cache the miss briefly rather than retrying hard */ }

  await fsp.mkdir(META_DIR, { recursive: true }).catch(() => {});
  await fsp.writeFile(cacheFile, JSON.stringify(data)).catch(() => {});
  res.json(data);
});

app.post('/api/meta/clear', auth, adminOnly, async (req, res) => {
  await fsp.rm(META_DIR, { recursive: true, force: true }).catch(() => {});
  res.json({ ok: true });
});

// ---------------------------------------------------------------- bulk actions

app.post('/api/files/bulk', auth, async (req, res) => {
  const rels = Array.isArray(req.body.rels) ? req.body.rels.slice(0, 500) : [];
  const action = req.body.action;
  if (!rels.length) return res.status(400).json({ error: 'Nothing selected' });
  if (!['move', 'delete'].includes(action)) return res.status(400).json({ error: 'Unknown action' });

  let targetDir = null;
  if (action === 'move') {
    const shelf = req.body.shelf;
    if (!shelfById(shelf)) return res.status(400).json({ error: 'Unknown shelf' });
    if (!canUse(req.user, shelf)) return res.status(403).json({ error: 'No permission for that shelf' });
    targetDir = path.join(ROOT, shelf);
    await fsp.mkdir(targetDir, { recursive: true });
  }

  let done = 0;
  const failed = [];
  for (const rel of rels) {
    const full = safePath(rel);
    const shelf = shelfOf(rel);
    // Each file is checked on its own — a selection spanning shelves must not
    // let one permitted file carry a forbidden one along with it.
    if (!full || !shelf || !canUse(req.user, shelf)) { failed.push(rel); continue; }
    try {
      if (action === 'delete') {
        await fsp.unlink(full);
      } else {
        const dest = path.join(targetDir, await uniqueName(targetDir, path.basename(full)));
        await fsp.rename(full, dest);
      }
      done++;
    } catch { failed.push(rel); }
  }

  note(req.user.name, action === 'delete' ? 'bulk-delete' : 'bulk-move',
       `${done} file${done === 1 ? '' : 's'}${action === 'move' ? ' to ' + req.body.shelf : ''}`);
  res.json({ done, failed: failed.length });
});

// ---------------------------------------------------------------- activity

app.get('/api/activity', auth, adminOnly, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 120, 1), 500);
  res.json({ events: logBuffer.slice(-limit).reverse() });
});

// ---------------------------------------------------------------- shares API

app.get('/api/shares', auth, async (req, res) => {
  const admin = req.user.role === 'admin';
  const mine = Object.entries(shares)
    .filter(([, sh]) => admin || sh.by === req.user.name)
    .map(([id, sh]) => ({
      id, rel: sh.rel, by: sh.by, label: sh.label,
      created: sh.created, expires: sh.expires, maxUses: sh.maxUses, uses: sh.uses,
      lastUsed: sh.lastUsed || null,
      dead: !!((sh.expires && Date.now() > sh.expires) || (sh.maxUses && sh.uses >= sh.maxUses)),
    }))
    .sort((a, b) => b.created - a.created);
  res.json({ shares: mine });
});

app.post('/api/shares', auth, async (req, res) => {
  const rel = String(req.body.rel || '');
  const full = safePath(rel);
  const shelf = shelfOf(rel);
  // You can only share what you can already reach.
  if (!full || !shelf || !canUse(req.user, shelf)) return res.status(404).json({ error: 'Not found' });
  try {
    const st = await fsp.stat(full);
    if (!st.isFile()) throw new Error('not a file');
  } catch { return res.status(404).json({ error: 'Not found' }); }

  const days = Math.min(Math.max(parseInt(req.body.days, 10) || 0, 0), 365);
  const maxUses = Math.min(Math.max(parseInt(req.body.maxUses, 10) || 0, 0), 10000);

  const id = crypto.randomBytes(24).toString('base64url');   // 32 chars
  shares[id] = {
    rel, by: req.user.name,
    label: String(req.body.label || '').slice(0, 60),
    created: Date.now(),
    expires: days ? Date.now() + days * 864e5 : 0,
    maxUses, uses: 0,
  };
  saveShares();
  note(req.user.name, 'share-create', rel);
  res.json({ id, url: `/s/${id}` });
});

app.delete('/api/shares/:id', auth, (req, res) => {
  const sh = shares[req.params.id];
  if (!sh) return res.status(404).json({ error: 'No such link' });
  if (sh.by !== req.user.name && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'That link belongs to someone else' });
  }
  delete shares[req.params.id];
  saveShares();
  note(req.user.name, 'share-revoke', sh.rel);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- public share
/**
 * Everything below this line is reachable without signing in. It must expose
 * exactly one file and nothing else — no listing, no neighbours, no metadata
 * about the vault.
 */

function shareGone(res, why) {
  const msg = {
    expired: 'This link has expired.',
    'used-up': 'This link has already been used the maximum number of times.',
  }[why] || 'This link is no longer valid.';
  res.status(410).type('html').send(sharePage({ error: msg }));
}

/** Self-contained page — the app's own HTML would leak the whole interface. */
function sharePage({ name, id, kind, error, size }) {
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const body = error
    ? `<p class="err">${esc(error)}</p>`
    : `
      <div class="name">${esc(name)}</div>
      <div class="meta">${esc(size)}</div>
      ${kind === 'video' ? `<video src="/api/share/${id}/file" controls playsinline preload="metadata"></video>` : ''}
      ${kind === 'remux' ? `<video src="/api/share/${id}/media" controls playsinline autoplay muted onloadeddata="this.muted=false"></video>
         <div class="meta" style="margin:10px 0 0">Prepared for your browser · seeking unavailable on this link</div>` : ''}
      ${kind === 'audio' ? `<audio src="/api/share/${id}/file" controls preload="metadata"></audio>` : ''}
      ${kind === 'image' ? `<img src="/api/share/${id}/file" alt="${esc(name)}">` : ''}
      <a class="dl" href="/api/share/${id}/file?dl=1">Download</a>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${error ? 'Link unavailable' : esc(name)}</title>
<style>
:root{--bg:#070809;--fg:#eef3f8;--dim:#aab5c3;--line:#2a313c;--star:#7fd9ff;--flare:#ff6a58;
--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--fg);min-height:100vh;display:grid;place-items:center;
padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
background-image:radial-gradient(900px 420px at 50% -12%,rgba(127,217,255,.06),transparent 70%)}
.card{width:min(880px,100%);text-align:center}
.mark{width:26px;height:26px;margin:0 auto 26px;position:relative}
.mark::before{content:'';position:absolute;inset:0;border:1px solid rgba(127,217,255,.3);border-radius:50%}
.mark::after{content:'';position:absolute;inset:8px;border-radius:50%;background:var(--star);
box-shadow:0 0 18px 3px rgba(127,217,255,.45)}
.name{font-size:19px;font-weight:500;margin-bottom:8px;word-break:break-word}
.meta{font-family:var(--mono);font-size:13px;color:var(--dim);letter-spacing:.06em;margin-bottom:24px}
video,img{width:100%;max-height:70vh;background:#000;display:block;border:1px solid var(--line)}
audio{width:100%}
.dl{display:inline-block;margin-top:22px;padding:11px 22px;background:var(--star);color:#04080c;
text-decoration:none;font-family:var(--mono);font-size:13px;font-weight:700;letter-spacing:.16em}
.dl:hover{filter:brightness(1.12)}
.err{font-family:var(--mono);font-size:15px;color:var(--flare);letter-spacing:.04em}
.foot{margin-top:34px;font-family:var(--mono);font-size:11px;letter-spacing:.16em;
text-transform:uppercase;color:#3d444f}
</style></head><body><div class="card"><div class="mark"></div>${body}
<div class="foot">Shared from a private vault</div></div></body></html>`;
}

const bytesHuman = (n) => {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 4);
  const v = n / Math.pow(1024, i);
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
};

app.get('/s/:id', async (req, res) => {
  const { share, full, error } = resolveShare(req.params.id);
  if (error) return shareGone(res, error);

  let st;
  try { st = await fsp.stat(full); } catch { return shareGone(res, 'missing'); }

  const e = ext(full);
  let kind = ['mp4', 'm4v', 'webm', 'mov'].includes(e) ? 'video'
    : ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'wav', 'flac'].includes(e) ? 'audio'
    : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(e) ? 'image' : 'file';

  // A shared MKV that only offers a download is a poor gift. If it can be
  // prepared for a browser, let the recipient watch it in place.
  if (kind === 'file' && HAS_FFMPEG && THUMBABLE.includes(e)) {
    const info = await probe(full);
    if (info && info.remuxable) kind = 'remux';
  }

  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.type('html').send(sharePage({
    name: path.basename(full), id: req.params.id, kind, size: bytesHuman(st.size),
  }));
});

app.get('/api/share/:id/media', async (req, res) => {
  const { share, full, error } = resolveShare(req.params.id);
  if (error) return res.status(410).end();
  if (!HAS_FFMPEG) return res.status(503).end();

  try { await fsp.stat(full); } catch { return res.status(404).end(); }
  const info = await probe(full);
  if (!info || !info.remuxable) return res.status(415).end();

  // The same cap as signed-in playback: a public link must not be able to
  // spawn unlimited encoders.
  if (streaming >= MAX_STREAMS) return res.status(503).end();

  share.uses = (share.uses || 0) + 1;
  share.lastUsed = Date.now();
  saveShares();

  pipeRemux(req, res, full, info, 0);
});

app.get('/api/share/:id/file', async (req, res) => {
  const { share, full, error } = resolveShare(req.params.id);
  if (error) return res.status(410).end();

  let st;
  try { st = await fsp.stat(full); } catch { return res.status(404).end(); }
  if (!st.isFile()) return res.status(404).end();

  // Count an open once, not once per range request, or a video seeking about
  // would burn through a use-limited link in seconds.
  if (!req.headers.range || (req.headers.range || '').startsWith('bytes=0-')) {
    share.uses = (share.uses || 0) + 1;
    share.lastUsed = Date.now();
    saveShares();
  }

  const type = MIME[ext(full)] || 'application/octet-stream';
  const name = path.basename(full);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', type);
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Disposition',
    `${req.query.dl ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`);

  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? parseInt(m[2], 10) : st.size - 1;
    if (isNaN(start) || isNaN(end) || start > end || end >= st.size) {
      res.setHeader('Content-Range', `bytes */${st.size}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${st.size}`);
    res.setHeader('Content-Length', end - start + 1);
    return fs.createReadStream(full, { start, end }).pipe(res);
  }
  res.setHeader('Content-Length', st.size);
  fs.createReadStream(full).pipe(res);
});

// ---------------------------------------------------------------- watch state

app.post('/api/progress', auth, (req, res) => {
  const rel = String(req.body.rel || '');
  const shelf = shelfOf(rel);
  if (!shelf || !canUse(req.user, shelf)) return res.status(404).json({ error: 'Not found' });
  if (req.body.done === true) {
    if (!progress[req.user.name]) progress[req.user.name] = {};
    const previous = progress[req.user.name][rel];
    const dur = Math.max(0, Number(req.body.dur) || Number(previous && previous.dur) || 0);
    progress[req.user.name][rel] = { pos: 0, dur: Math.round(dur), at: Date.now(), done: true };
    progressDirty = true;
    return res.json({ ok: true, done: true });
  }
  const pos = Math.max(0, Number(req.body.pos) || 0);
  const dur = Math.max(0, Number(req.body.dur) || 0);
  setProgress(req.user.name, rel, pos, dur);
  res.json({ ok: true });
});

app.delete('/api/progress', auth, (req, res) => {
  const rel = String(req.query.rel || '');
  const shelf = shelfOf(rel);
  if (!shelf || !canUse(req.user, shelf)) return res.status(404).json({ error: 'Not found' });
  if (progress[req.user.name]) delete progress[req.user.name][rel];
  progressDirty = true;
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public'), {
  index: 'index.html',
  setHeaders: (res, file) => {
    if (path.basename(file) !== 'index.html') return;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  },
}));

// ---------------------------------------------------------------- boot

(async () => {
  loadShelves();
  loadAccounts();
  loadLog();
  loadShares();
  loadProgress();
  pruneShares();
  for (const id of shelfIds()) await fsp.mkdir(path.join(ROOT, id), { recursive: true });
  await fsp.mkdir(PARTS_DIR, { recursive: true });
  await fsp.mkdir(THUMB_DIR, { recursive: true });
  // HLS sessions are disposable and process-bound; a restart invalidates all
  // their URLs, so clear only this dedicated cache directory at boot.
  await fsp.rm(HLS_DIR, { recursive: true, force: true });
  await fsp.mkdir(HLS_DIR, { recursive: true });
  await fsp.rm(CONVERSION_DIR, { recursive: true, force: true });
  await fsp.mkdir(CONVERSION_DIR, { recursive: true });

  await sweepParts();
  setInterval(sweepParts, 3600 * 1000).unref();
  setInterval(sweepHlsSessions, 30 * 1000).unref();
  setInterval(() => {
    const cutoff = Date.now() - 6 * 3600 * 1000;
    for (const [id, job] of conversionJobs) {
      if (job.finished && job.finished < cutoff) conversionJobs.delete(id);
    }
  }, 30 * 60 * 1000).unref();
  setInterval(() => {
    const cutoff = Date.now() - 6 * 3600 * 1000;
    for (const [id, job] of subtitleJobs) if (job.finished && job.finished < cutoff) subtitleJobs.delete(id);
  }, 30 * 60 * 1000).unref();
  setInterval(flushLog, 5000).unref();
  setInterval(flushProgress, 5000).unref();
  setInterval(pruneShares, 6 * 3600 * 1000).unref();
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      for (const session of hlsSessions.values()) {
        session.stopping = true;
        if (session.child && session.child.exitCode === null) session.child.kill('SIGKILL');
      }
      for (const job of conversionJobs.values()) {
        if (job.child && job.child.exitCode === null) job.child.kill('SIGKILL');
      }
      for (const job of subtitleJobs.values()) {
        if (job.child && job.child.exitCode === null) job.child.kill('SIGKILL');
      }
      flushLog();
      flushProgress();
      process.exit(0);
    });
  }

  app.listen(PORT, config.bind || '0.0.0.0', () => {
    console.log(`VAULT listening on ${config.bind || '0.0.0.0'}:${PORT}`);
    console.log(`Vault: ${ROOT}`);
    console.log(`Thumbnails: ${HAS_FFMPEG ? 'on' : 'off (ffmpeg not found)'}`);
    console.log(`Media transcoder: ${TRANSCODER ? TRANSCODER.label : 'off (no usable H.264 encoder)'}`);
    console.log(`AI subtitles: ${HAS_AI_SUBTITLES ? `${config.whisperModel || 'medium'} via ${config.whisperDevice || 'auto'}` : `off (${AI_SUBTITLE_STATUS.diagnostic})`}`);
  });
})();
