# Assets surface record

Scope: the reusable game asset catalog, detail/3D inspection, metadata editing and import flow inside Vault's existing Library. Visitor mode: working and finding, for a creator who wants to reuse a coherent asset without hunting for its textures, rig or animation files.

The task sequence is find a package, inspect what it contains, then get its complete files. Real supplied previews provide recognition; connected files, measured model statistics and provenance provide evidence. The catalog groups by reusable asset rather than presenting every dependency as an independent result. Style remains descriptive, independent of polygon count. Assets joins the existing sidebar above Entertainment and inherits the incumbent design world.

The implemented composition uses a compact filter area over a preview grid, then a focused detail view pairing object inspection with metadata. On phones, two preview columns remain visible and secondary filters collapse behind More filters & sorting. The object preview is the memorable element; related-file organization remains the operational priority. Missing or unsupported previews retain an honest text state and download path.

Built sources: `public/assets.js`, `public/assets.css`, `public/asset-viewer.js`, and the Library navigation in `public/index.html`. Durable product behavior is in `PRODUCT.md`; visual scope is in the Assets sections of `DESIGN.md`; package setup and limitations are in `ASSETS.md`.

Evidence supplied for this documentation pass: `.impeccable/review/assets-final/desktop.png`, `detail.png`, `gold-3d.png`, `character-3d.png`, `import.png`; `.impeccable/review/assets-corrections/mobile.png`, `mobile-detail.png`, `light-actual.png`. These are browser captures with verification content, not bundled catalog assets. Documentation records the implementation and supplied evidence; it does not claim a fresh interaction test, a physical-device test or production-scale benchmark.

Known boundaries: GLB-only 3D interpretation with self-contained resources and a 256 MB preview limit; other formats download. Saved assets are browser-local per account. Versions are descriptive and declared checksums are not universally validated. Catalog scans have explicit bounds. Import recovery requires selecting the same unchanged files and keeping the transfer tab open.
