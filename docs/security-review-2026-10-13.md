# Focused self-hosting review — 2026-10-13

This is a focused engineering review, not an independent penetration test or a guarantee that Vault has no vulnerabilities.

## Changes

- Git now excludes `shares.json` (bearer share capabilities), `shelves.json`, `progress.json`, environment files, private key containers, temporary JSON writes and integration directories. Existing exclusions cover accounts, configuration, logs, storage and dependencies.
- Browser mutation requests receive a server-wide same-origin check, including opaque-origin requests. Non-browser API clients without origin headers still use their existing authentication.
- Compatible npm updates remove the reported high and critical dependency findings.
- ArtCraft accepts fixed catalog repositories, validates official release URLs, verifies SHA-256 digests, bounds download/extraction sizes, rejects traversal and symlinks, and retains working versions on failure. Downloaded scripts run in an opaque-origin sandbox, including standalone launch pages.
- Recipe contribution links are opt-in. They cannot replace/delete the owner's recipes or access shopping, accounts or private recipes. Contributions have an owner-wide rate limit; media uploads retain size/type checks, chunk limits and per-link isolation. Requests recheck revocation and owner suspension.

## Evidence

- Gitleaks 8.30.1, verified against its official SHA-256 checksum: all 70 commits reachable in the available Git refs scanned with redaction; no secret findings. Runtime configuration, accounts and shares did not appear in tracked history. Detection cannot prove every possible secret is absent.
- `npm audit fix` applied compatible updates. The remaining advisory is GHSA-hp3w-g68c-fv3c / CVE-2026-97058 in `sprintf-js`, reported through `argparse` and `mammoth` (three moderate dependency entries, one root advisory). No patched version was published at review time. npm's forced resolution downgrades Mammoth to 0.3.29; that regression was not applied.
- Installed Mammoth imports `argparse` from `bin/mammoth`, not its conversion library. Vault calls the library in its existing bounded document-preview worker and does not expose that CLI. The advisory remains visible for monitoring and has not been suppressed.
- Regression coverage checks owner isolation, contribution permissions, revoked links, cross-site rejection, unsafe archives, checksum failures, persistent installs, and retaining the working app after a failed update.
- Clean installation uses a separate directory, `npm ci`, and server/client integration checks. No local configuration, accounts, shares or user storage are copied into that tree.

## Self-hosting prerequisites

Use fresh configuration and a random session secret, individual accounts, HTTPS, backups, and a supported Node release. Configure reverse-proxy trust and network exposure deliberately. Share links are bearer credentials: expire and revoke them when no longer needed. Sharing the repository does not mean copying runtime JSON files or a running installation's data directory. Monitor the remaining dependency advisory and upstream app releases.

Sources: https://github.com/advisories/GHSA-hp3w-g68c-fv3c, the installed dependency tree, and https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1.
