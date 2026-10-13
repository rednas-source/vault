# ArtCraft in Vault

Vault includes all 13 ArtCraft tools in Apps, alongside each user's personal apps. Icons and previews are from the official ArtCraft app pages. Local licence and attribution copies are in `public/artcraft/licenses/`; image provenance is recorded beside each asset.

An administrator selects **Install browser app** once per tool. Vault downloads that app's official GitHub release web ZIP, verifies its published SHA-256 digest and compressed size, checks archive paths and expansion limits, and installs it under the configured storage directory's `.artcraft` folder. It never executes a native installer on the server. All accounts can open installed browser apps. Desktop installers are direct official GitHub links, with platform and architecture shown in the Download menu.

**Check for updates** refreshes stable release metadata and download links. Each installed tool with a newer release offers **Update browser**. Opening Apps also starts a metadata check when the last check is older than six hours. An app already open retains its version while an update installs; reopening uses the new version. A failed download or checksum leaves the previous version available. GitHub's anonymous API quota applies; failed checks keep cached release information and show an error. This follows published releases, not development commits.

The [ArtCraft Launcher](https://github.com/storytold/craft-launcher) maintains native applications on a user's computer. A website cannot silently update installed desktop programs; users install new standalone downloads or use the launcher.

## Browser isolation and limitations

Downloaded web builds run inside an opaque-origin sandbox. They cannot access Vault's DOM, cookies, local storage, or private API responses. The file-serving response enforces the sandbox even in another tab. Launch URLs grant access only to an installed public application bundle, expire after 24 hours, and disappear on server restart. They contain no user files.

Vault disables upstream service-worker startup and provides a small module-worker entry shim so EffectCraft can start inside the sandbox. Verified release files remain unchanged on disk; the shim is inserted when HTML is served. The content policy limits script and network requests to that launch's bundle.

This isolation disables persistent browser storage such as IndexedDB and localStorage. Some apps show a storage warning; preferences, recovery data and custom brush storage may last only for the session. Save/export documents before closing. A future dedicated app origin can support persistent storage without granting access to Vault's origin. Do not add `allow-same-origin` as a workaround. Feature parity depends on upstream web builds; desktop packages can offer capabilities unavailable in browsers.

All 13 official release ZIPs were verified on 2026-10-13, including FilmCraft's newly available web build. GitHub releases are the update source; the upstream website can lag behind new releases.
