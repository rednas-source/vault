# Public games area

`/games/` is a public static directory under `public/games`. Its landing page shares a game directory and iframe player with the authenticated Vault Games section. The navigation button stays in Vault. Play here loads one third-party game in a sandboxed iframe; Close game removes it, and Fullscreen expands the player. It does not copy, download or proxy game code. No game packages are installed. The authenticated Vault API is unchanged.

To expose it through an existing Cloudflare Access-protected hostname, create a more-specific self-hosted Access application for `vault.sornes.cc/games` and `/games/*`, with an Everyone Bypass policy. Keep the existing protection on the parent hostname. Do not bypass `/api/*`, `/`, or the whole hostname. This repository cannot change the Cloudflare account policy: verify both the exact `/games` path and descendants in a signed-out browser, and confirm `/api/files` and `/api/economy` still reject unauthenticated requests. The landing page keeps its assets under `/games/`; no private Vault assets are required.

Official reference: https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/

For a game you own or are licensed to redistribute, place trusted static web files in `public/games/library/<slug>/` and add a directory entry. Never upload config files, saves with private information, server binaries or credentials here: this entire directory is public. An empty placeholder folder is provided.

For untrusted third-party game code, use a separate origin such as `play.sornes.cc`, and embed it from the directory using a sandboxed iframe. JavaScript hosted directly on Vault's origin can otherwise access the same authenticated origin. Keep saves and game APIs on that separate origin. Do not enable service workers across the Vault root.

External sites may block framing using CSP/X-Frame-Options. Keep an ordinary external-link fallback instead of proxying around the block. Some games require WebGL/WebGPU, persistent storage, WebSockets, cross-origin isolation or a game backend; a native game or reverse-engineered engine is not automatically a browser game. Hosting permission for source code does not necessarily cover its artwork, music or commercial game data. Assess those requirements for each actual installation.

Embedding headers checked on 2026-10-15: WoW browser project, PokéRogue, Pokédle, Globle and LoLdle returned no frame-blocking header. Wordle returned X-Frame-Options: DENY and is link-only. Publisher policy and runtime requirements may change; every entry retains an external link. The iframe permits scripts, same-origin storage, forms and pointer lock but never top navigation, popup escape or access to the Vault origin. Frame load events cannot prove a cross-origin game is playable.
