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

const PART_TTL_MS = (config.partTtlHours || 24) * 3600 * 1000;

if (!SECRET || SECRET === 'CHANGE-ME') {
  console.error('Set a real sessionSecret in config.json.');
  process.exit(1);
}

const SHELVES = ['movies', 'series', 'music', 'photos', 'docs', 'archives', 'misc'];

const EXT_MAP = {
  movies: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v', 'wmv', 'flv', 'mpg', 'mpeg', 'ts'],
  music: ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'opus', 'wma', 'aiff'],
  photos: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'tiff', 'avif'],
  docs: ['pdf', 'doc', 'docx', 'txt', 'md', 'epub', 'mobi', 'xlsx', 'pptx', 'csv', 'rtf'],
  archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso', 'dmg', 'xz'],
};

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
  for (const [shelf, list] of Object.entries(EXT_MAP)) if (list.includes(e)) return shelf;
  return 'misc';
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
  if (user.role === 'admin') return SHELVES.slice();
  const acct = accounts[user.name];
  const list = acct && acct.shelves;
  if (!list || list === '*') return SHELVES.slice();
  return SHELVES.filter((s) => list.includes(s));
}

const canUse = (user, shelf) => allowedShelves(user).includes(shelf);

/** The shelf a relative path belongs to, or null if it isn't shelf-shaped. */
function shelfOf(rel) {
  const first = String(rel || '').replace(/^\/+/, '').split('/')[0];
  return SHELVES.includes(first) ? first : null;
}

function normaliseShelves(input) {
  if (input === '*' || input === undefined || input === null) return '*';
  if (!Array.isArray(input)) return null;
  const clean = [...new Set(input)].filter((s) => SHELVES.includes(s));
  return clean.length === SHELVES.length ? '*' : clean;
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
  if (SHELVES.includes(asked)) return allowed.includes(asked) ? asked : null;
  const guess = shelfFor(originalName);
  return allowed.includes(guess) ? guess : allowed[0];
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const shelf = targetShelf(req, file.originalname);
    if (!shelf) return cb(new Error('No permission for that shelf'));
    const dir = path.join(ROOT, shelf);
    await fsp.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: async (req, file, cb) => {
    const shelf = targetShelf(req, file.originalname);
    if (!shelf) return cb(new Error('No permission for that shelf'));
    const clean = safeName(Buffer.from(file.originalname, 'latin1').toString('utf8'));
    cb(null, await uniqueName(path.join(ROOT, shelf), clean));
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

const uploadIdFor = (user, name, size, shelf) =>
  crypto.createHmac('sha256', SECRET)
    .update(`${user}\u0000${name}\u0000${size}\u0000${shelf}`)
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

const THUMBABLE = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v', 'wmv', 'flv', 'mpg', 'mpeg', 'ts'];

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
function run(cmd, args, timeoutMs = 25000) {
  return new Promise((resolve) => {
    let done = false;
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    const timer = setTimeout(() => { if (!done) { done = true; child.kill('SIGKILL'); resolve(null); } }, timeoutMs);
    child.stdout.on('data', (d) => { if (out.length < 4096) out += d; });
    child.on('error', () => { if (!done) { done = true; clearTimeout(timer); resolve(null); } });
    child.on('close', (code) => {
      if (done) return;
      done = true; clearTimeout(timer);
      resolve(code === 0 ? out.trim() : null);
    });
  });
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

// ---------------------------------------------------------------- app

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false }));
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
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
  res.json(u ? { user: u.name, role: u.role, thumbs: HAS_FFMPEG } : { user: null });
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
    allShelves: SHELVES,
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
  res.json({ ok: true });
});

// ---------------------------------------------------------------- tokens API

app.post('/api/users/:name/tokens', auth, adminOnly, (req, res) => {
  const name = req.params.name;
  if (!accounts[name]) return res.status(404).json({ error: 'No such account' });
  if ((accounts[name].tokens || []).length >= 10) {
    return res.status(400).json({ error: 'That account already has 10 tokens.' });
  }
  const token = issueToken(name, req.body && req.body.label);
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
    let entries;
    try { entries = await fsp.readdir(path.join(ROOT, shelf), { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isFile() || e.name.startsWith('.')) continue;
      try {
        const st = await fsp.stat(path.join(ROOT, shelf, e.name));
        lines.push(`${shelf}\t${st.size}\t${Math.round(st.mtimeMs)}\t${e.name}`);
      } catch { /* vanished */ }
    }
  }
  res.type('text/plain; charset=utf-8').send(lines.join('\n') + (lines.length ? '\n' : ''));
});

app.get('/api/whoami', auth, (req, res) => {
  res.json({ user: req.user.name, role: req.user.role, shelves: allowedShelves(req.user) });
});

app.get('/api/files', auth, async (req, res) => {
  const out = [];
  const mine = allowedShelves(req.user);
  for (const shelf of mine) {
    const dir = path.join(ROOT, shelf);
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue;
      try {
        const st = await fsp.stat(path.join(dir, entry.name));
        out.push({
          name: entry.name,
          shelf,
          rel: `${shelf}/${entry.name}`,
          size: st.size,
          modified: st.mtimeMs,
          ext: ext(entry.name),
        });
      } catch { /* file vanished mid-scan */ }
    }
  }

  let disk = null;
  try {
    const s = await fsp.statfs(ROOT);
    disk = { free: s.bfree * s.bsize, total: s.blocks * s.bsize };
  } catch { /* statfs unavailable on this platform */ }

  res.json({ files: out, disk, shelves: mine, thumbs: HAS_FFMPEG, role: req.user.role });
});

app.post('/api/upload', auth, (req, res) => {
  upload.array('files')(req, res, (err) => {
    if (err) return res.status(403).json({ error: 'No permission for that shelf' });
    res.json({ uploaded: (req.files || []).map((f) => f.filename) });
  });
});

// ── chunked upload

app.post('/api/upload/init', auth, async (req, res) => {
  const rawName = typeof req.body.name === 'string' ? req.body.name : '';
  const size = Number(req.body.size);
  const name = safeName(rawName);

  if (!rawName) return res.status(400).json({ error: 'Missing file name' });
  if (!Number.isSafeInteger(size) || size <= 0) return res.status(400).json({ error: 'Bad file size' });
  if (size > MAX_BYTES) {
    return res.status(413).json({ error: `That file is over the ${config.maxFileGB || 64} GB limit.` });
  }

  const shelf = targetShelf(req, name);
  if (!shelf) return res.status(403).json({ error: 'No permission for that shelf' });
  const id = uploadIdFor(req.user.name, name, size, shelf);

  await fsp.mkdir(PARTS_DIR, { recursive: true });
  const existing = await readMeta(id);
  if (!existing) {
    await fsp.writeFile(metaPath(id), JSON.stringify({
      name, shelf, size, user: req.user.name, started: Date.now(),
    }));
  }

  res.json({ id, received: await partSize(id), size, shelf, name });
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

  const dir = path.join(ROOT, meta.shelf);
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

  res.json({ name: finalName, rel: `${meta.shelf}/${finalName}` });
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
  if (shelf && !SHELVES.includes(shelf)) return res.status(400).json({ error: 'Unknown shelf' });

  // Both ends must be permitted: you can't drag a file out of a shelf you
  // can't see, nor push one into a shelf you don't have.
  if (!requireShelf(req, res, req.body.rel)) return;
  if (shelf && !canUse(req.user, shelf)) {
    return res.status(403).json({ error: 'No permission for that shelf' });
  }

  const targetDir = path.join(ROOT, shelf || path.basename(path.dirname(from)));
  await fsp.mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, await uniqueName(targetDir, newName || path.basename(from)));
  try {
    await fsp.rename(from, target);
    res.json({ rel: path.relative(ROOT, target).split(path.sep).join('/') });
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

app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

// ---------------------------------------------------------------- boot

(async () => {
  loadAccounts();
  for (const shelf of SHELVES) await fsp.mkdir(path.join(ROOT, shelf), { recursive: true });
  await fsp.mkdir(PARTS_DIR, { recursive: true });
  await fsp.mkdir(THUMB_DIR, { recursive: true });

  await sweepParts();
  setInterval(sweepParts, 3600 * 1000).unref();

  app.listen(PORT, config.bind || '0.0.0.0', () => {
    console.log(`VAULT listening on ${config.bind || '0.0.0.0'}:${PORT}`);
    console.log(`Vault: ${ROOT}`);
    console.log(`Thumbnails: ${HAS_FFMPEG ? 'on' : 'off (ffmpeg not found)'}`);
  });
})();
