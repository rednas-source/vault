# ArtCraft in Vault

Vault includes all 13 ArtCraft tools in Apps, alongside each user's personal apps. Icons and previews are from the official ArtCraft app pages. Local licence and attribution copies are in `public/artcraft/licenses/`; image provenance is recorded beside each asset.

An administrator selects **Install browser app** once per tool. Vault downloads that app's official GitHub release web ZIP, verifies its published SHA-256 digest and compressed size, checks archive paths and expansion limits, and installs it under the configured storage directory's `.artcraft` folder. It never executes a native installer on the server. All accounts can open installed browser apps. Desktop installers are direct official GitHub links, with platform and architecture shown in the Download menu.

**Check for updates** refreshes stable release metadata and download links. Each installed tool with a newer release offers **Update browser**. Opening Apps also starts a metadata check when the last check is older than six hours. An app already open retains its version while an update installs; reopening uses the new version. A failed download or checksum leaves the previous version available. GitHub's anonymous API quota applies; failed checks keep cached release information and show an error. This follows published releases, not development commits.

The [ArtCraft Launcher](https://github.com/storytold/craft-launcher) maintains native applications on a user's computer. A website cannot silently update installed desktop programs; users install new standalone downloads or use the launcher.

## App files and autosave

Managed browser apps save into the **App files** shelf, grouped by app: `App files / GridCraft / Book1.xlsx`, for example. Vault captures the editor's file saves and exports; it never uploads a rendered screenshot in place of the actual document. **Open saved file** sends a selected file back to its editor. Files also remain available through the normal Vault library, download and sharing controls.

Vault requests a native save after editing stops for a few seconds, and **Save to Vault** requests one immediately. This is separate from any autosave switch inside the upstream editor. A first save can require completing the editor's own filename or format dialog. Only the **Saved** status confirms that Vault has received the bytes. If an upstream release does not respond to the save shortcut, Vault stops automatic attempts and asks you to use the editor's File → Save command. Close app tries to save pending changes and warns before discarding anything unconfirmed.

GridCraft `.xlsx`, WordCraft `.docx` and PhotoCraft `.psd` saves were exercised in the browser on 2026-10-13, including a GridCraft edit/save/reopen round trip. Other editors' save/export hooks use the same bridge, but formats and first-save dialogs depend on upstream releases. **LightCraft uses explicit export or library backup**, rather than automatic snapshots of its photo library. **FigCraft v0.5.1 cannot save from its browser build**; Vault states this instead of showing an autosave claim. Use its desktop app for persistent work. Media projects may reference source files: saving a project alone is not a guarantee that every linked media asset is bundled.

The shelf uses ordinary Vault shelf permissions; it is not a private per-user drive. Files are uploaded in bounded chunks (512 MiB maximum), finalized atomically, and changes in another editor produce a conflict with a **Save a copy** action. New documents with an existing name get a numbered filename. Failed uploads keep the editor open with a retry action. The sandboxed editor receives only explicitly opened document bytes; authenticated requests remain in the Vault parent window.

Update tests cover a complete older-to-newer browser installation, refreshed native installer URLs, retaining the old bundle for an already-open session, persistence across a server restart, and retaining the installed version after a failed checksum. These are controlled release fixtures; a future upstream release still needs a smoke test because its editor and file format can change independently of Vault.

## Browser isolation and limitations

Downloaded web builds run inside an opaque-origin sandbox. They cannot access Vault's DOM, cookies, local storage, or private API responses. The file-serving response enforces the sandbox even in another tab. Launch URLs grant access only to an installed public application bundle, expire after 24 hours, and disappear on server restart. They contain no user files. Bundle requests use `/api/share/artcraft/:token/` so they work with the existing `/api/share` Cloudflare Access exception; account-only catalog, installation and launch controls remain under `/api/artcraft`. No broader Cloudflare exception is needed.

Vault disables upstream service-worker startup and provides a small module-worker entry shim so EffectCraft can start inside the sandbox. Verified release files remain unchanged on disk; the shim is inserted when HTML is served. The content policy limits script and network requests to that launch's bundle.

This isolation disables persistent browser storage such as IndexedDB and localStorage. Some apps show a storage warning; preferences, recovery data and custom brush storage may last only for the session. Document files confirmed as saved to Vault survive closing the editor. A future dedicated app origin can support persistent browser storage without granting access to Vault's origin. Do not add `allow-same-origin` as a workaround. Feature parity depends on upstream web builds; desktop packages can offer capabilities unavailable in browsers.

All 13 official release ZIPs were verified on 2026-10-13, including FilmCraft's newly available web build. GitHub releases are the update source; the upstream website can lag behind new releases.
