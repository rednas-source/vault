# Games in Vault

The Games space and public `/games/` page share the same directory and player.

- **Daily’s:** Wordle, Globle, Globle Capitals, LoLdle, Krillion and Pokédle.
- **Games:** WoW browser project and PokéRogue.
- **Theater mode:** fills the available workspace, keeping Vault's header in the private space. On the public page it fills the browser viewport.
- **Fullscreen:** expands the complete player, including the grouped game switcher and exit controls. Browsers without fullscreen support can still use theater mode.
- **Switch game:** select a game and press Switch. Switching unloads the previous frame, so save progress in the game first. Category changes and display-mode changes preserve the loaded frame.
- **Close game:** removes the embedded game and restores the matching directory category and keyboard focus.

Wordle and Krillion block cross-site embedding; LoLdle detects cross-site frames and does not reliably work there. These games use explicit publisher links that open in another tab, keeping Vault open. Selecting one in the player menu shows its website link instead of a broken frame.

Globle Capitals has a direct embedded entry, so it can be opened through Vault's switcher. The sandbox also permits publisher links to open separate tabs; browser popup policies still apply. Frames may run scripts, forms and pointer lock and use their own origin storage. They do not receive top-navigation permission. Vault does not proxy game code, strip publisher security headers, share Vault credentials with games or guarantee publisher sign-in/storage behavior.

Publisher availability was checked on 2026-10-15. Krillion returned `X-Frame-Options: SAMEORIGIN` and `Content-Security-Policy: frame-ancestors 'self'`; LoLdle's public client explicitly checks whether it is embedded on another origin. Globle and Globle Capitals returned no frame prohibition and loaded in the local player. These observations may change as publishers update their sites.

Entries live in `public/games/games.js`. Keep the category and embed/website-only behavior explicit when adding games. External URLs must use trusted HTTPS publisher origins. A game becoming available in an iframe should be verified in a browser, not inferred solely from missing HTTP restrictions.

## Hosting and public access

`/games/` is a public static directory under `public/games`. No game packages are installed, and the authenticated Vault API is unchanged. The public landing page keeps its assets under `/games/`; no private Vault assets are required.

To expose it through an existing Cloudflare Access-protected hostname, create a more-specific self-hosted Access application for `vault.sornes.cc/games` and `/games/*`, with an Everyone Bypass policy. Keep the existing protection on the parent hostname. Do not bypass `/api/*`, `/`, or the whole hostname. This repository cannot change the Cloudflare account policy: verify both the exact `/games` path and descendants in a signed-out browser, and confirm `/api/files` and `/api/economy` still reject unauthenticated requests. [Cloudflare path-policy documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/).

For a game you own or are licensed to redistribute, place trusted static web files in `public/games/library/<slug>/` and add a directory entry. Never upload config files, saves with private information, server binaries or credentials here: this entire directory is public. An empty placeholder folder is provided.

For untrusted third-party game code, use a separate origin such as `play.sornes.cc`, and embed it from the directory using a sandboxed iframe. JavaScript hosted directly on Vault's origin can otherwise access the same authenticated origin. Keep saves and game APIs on that separate origin. Do not enable service workers across the Vault root.

Some games require WebGL/WebGPU, persistent storage, WebSockets, cross-origin isolation or a game backend; a native game or reverse-engineered engine is not automatically a browser game. Hosting permission for source code does not necessarily cover its artwork, music or commercial game data. Assess those requirements for each actual installation. Frame load events cannot prove a cross-origin game is playable.
