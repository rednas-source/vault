'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { episode } = require('../public/watch-model');

const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function showIdentity(file) {
  const info = episode(file);
  let title = info.show;
  const dated = title.match(/[([]((?:19|20)\d{2})[)\]]/) || title.match(/\s((?:19|20)\d{2})(?=\s|$)/);
  const year = dated?.[1] || null;
  if (dated) title = title.slice(0, dated.index);
  title = title.replace(/\b(?:season[ ._-]*\d+|s\d{1,3}|720p|1080p|2160p|webrip|web[ -]?dl|bluray)\b.*$/i, '').replace(/\s+[([]?complete(?: series)?[)\]]?$/i, '').replace(/\[[^\]]*\]/g, '').replace(/[._]+/g, ' ').replace(/[\s-]+$/, '').trim();
  return { title, year, key: `${normalize(title)}:${year || ''}`, valid: title.length > 1 && info.show !== 'Unsorted shows' };
}
function titleScore(a, b) {
  a = normalize(a); b = normalize(b);
  if (a === b) return 1;
  const left = new Set(a.split(' ')), right = new Set(b.split(' '));
  return [...left].filter(word => right.has(word)).length / new Set([...left, ...right]).size;
}
function chooseShow(results, identity) {
  return results.map(item => item.show).filter(show => show && (!identity.year || String(show.premiered || '').startsWith(identity.year)))
    .map(show => ({ show, score: titleScore(identity.title, show.name) }))
    .filter(item => item.score >= .8).sort((a, b) => b.score - a.score)[0]?.show;
}
const plainText = html => String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").slice(0, 600);
const imageUrl = value => typeof value === 'string' && value.startsWith('https://static.tvmaze.com/') ? value : null;

function createShowMetadata({ cacheDir, lookupTmdb, fetchImpl = fetch, now = Date.now, requestGap = 600 }) {
  const pending = new Map();
  let requestTail = Promise.resolve(), lastRequest = 0, generation = 0;
  // Serialize public-provider requests and stay below its 20 requests / 10 seconds limit.
  function request(endpoint) {
    const job = requestTail.then(async () => {
      const wait = requestGap - (now() - lastRequest);
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      lastRequest = now();
      const response = await fetchImpl(`https://api.tvmaze.com${endpoint}`, {
        headers: { 'User-Agent': 'Vault/1.0 (private media library)' }, signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`TV metadata lookup failed (${response.status})`);
      return response.json();
    });
    requestTail = job.catch(() => {});
    return job;
  }
  async function tvmaze(identity) {
    const results = await request(`/search/shows?q=${encodeURIComponent(identity.title)}`);
    const show = chooseShow(Array.isArray(results) ? results : [], identity);
    if (!show) return { enabled: true, found: false, guessed: identity.title };
    let cast = [], images = [], partial = false;
    try { cast = await request(`/shows/${show.id}/cast`); } catch { partial = true; }
    try { images = await request(`/shows/${show.id}/images`); } catch { partial = true; }
    const backdrop = images.find(image => image.type === 'background');
    return {
      enabled: true, found: true, guessed: identity.title, title: show.name, kind: 'tv',
      year: String(show.premiered || '').slice(0, 4), overview: plainText(show.summary),
      poster: imageUrl(show.image?.original || show.image?.medium),
      backdrop: imageUrl(backdrop?.resolutions?.original?.url),
      rating: show.rating?.average || null, genres: (show.genres || []).slice(0, 6),
      runtime: show.averageRuntime || show.runtime || null, status: show.status || null,
      cast: cast.slice(0, 14).map(entry => ({ name: entry.person?.name || '', character: entry.character?.name || '', photo: imageUrl(entry.person?.image?.medium) })),
      provider: 'TVmaze', sourceUrl: `https://www.tvmaze.com/shows/${show.id}`, partial,
    };
  }
  async function resolve(identity, version) {
    const key = crypto.createHash('sha256').update(`show-v1:${identity.key}`).digest('hex');
    const cacheFile = path.join(cacheDir, `${key}.json`);
    let cached;
    try { cached = JSON.parse(await fs.readFile(cacheFile, 'utf8')); } catch { /* no usable cache */ }
    if (cached?.data && cached.expiresAt > now()) return cached.data;
    let data, failed = false;
    if (lookupTmdb) {
      try {
        const match = await lookupTmdb(identity);
        if (match.found && titleScore(identity.title, match.title) >= .8 && (!identity.year || match.year === identity.year)) data = match;
      } catch { /* the key-free provider remains available */ }
    }
    if (!data?.found || !data.poster) {
      try {
        const fallback = await tvmaze(identity);
        if (fallback.found || !data?.found) data = fallback;
      } catch { failed = true; }
    }
    // Preserve usable artwork during outages. Misses and partial responses expire, too.
    data ||= cached?.data?.found ? cached.data : { enabled: true, found: false, guessed: identity.title };
    const ttl = failed ? 5 * 60e3 : data.partial ? 15 * 60e3 : data.found ? 7 * 86400e3 : 6 * 3600e3;
    if (version === generation) {
      const temp = `${cacheFile}.${crypto.randomUUID()}.tmp`;
      try {
        await fs.mkdir(cacheDir, { recursive: true });
        await fs.writeFile(temp, JSON.stringify({ expiresAt: now() + ttl, data }));
        if (version === generation) await fs.rename(temp, cacheFile);
      } catch { /* enrichment never blocks access to a local file */ }
      finally { await fs.rm(temp, { force: true }).catch(() => {}); }
    }
    return data;
  }
  function get(file) {
    const identity = showIdentity(file);
    if (!identity.valid) return Promise.resolve({ enabled: true, found: false });
    if (!pending.has(identity.key)) {
      const job = resolve(identity, generation).finally(() => { if (pending.get(identity.key) === job) pending.delete(identity.key); });
      pending.set(identity.key, job);
    }
    return pending.get(identity.key);
  }
  async function warm(files) {
    const seen = new Set();
    for (const file of files) {
      const identity = showIdentity(file);
      if (!identity.valid || seen.has(identity.key)) continue;
      seen.add(identity.key);
      await get(file);
    }
  }
  return { get, warm, reset() { generation++; pending.clear(); } };
}
module.exports = { createShowMetadata, showIdentity, chooseShow };
