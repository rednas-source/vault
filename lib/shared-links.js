'use strict';
const { resolveEntry } = require('./archive');

async function listSharedLinks(root, shares, user, accessForOwner, now = Date.now()) {
  const visible = Object.entries(shares).filter(([, share]) => user.role === 'admin' || share.by === user.name);
  const result = [];
  // Sequential checks avoid opening thousands of filesystem requests at once.
  for (const [id, share] of visible) {
    let status = share.expires && now >= share.expires ? 'expired'
      : share.maxUses && (share.uses || 0) >= share.maxUses ? 'exhausted' : 'active';
    const allowed = accessForOwner(share.by);
    if (status === 'active') {
      if (!allowed.includes(share.rel.split('/')[0])) status = 'unavailable';
      else {
        try { const entry = await resolveEntry(root, share.rel, allowed); if (!entry.stat.isFile()) status = 'missing'; }
        catch { status = 'missing'; }
      }
    }
    result.push({ id, rel: share.rel, by: share.by, label: share.label || '', created: share.created,
      expires: share.expires || 0, maxUses: share.maxUses || 0, uses: share.uses || 0,
      remaining: share.maxUses ? Math.max(0, share.maxUses - (share.uses || 0)) : null,
      lastUsed: share.lastUsed || null, status, dead: status !== 'active' });
  }
  return result.sort((a, b) => b.created - a.created);
}

module.exports = { listSharedLinks };
