# Asset families and variants

One asset.json groups models, shared textures, masks and sources into one library item. Add variants for alternate shapes/materials:

```json
"variants": [
  {"id":"spire-gold","name":"Spire · Gold","primary":"models/spire-gold.glb","preview":"previews/spire-gold.png","tags":["spire","gold"]},
  {"id":"spire-iron","name":"Spire · Iron","primary":"models/spire-iron.glb","preview":"previews/spire-iron.png","tags":["spire","iron"]}
]
```

Use stable unique lowercase IDs, names, existing main files and optional existing raster previews. Maximum 256 per package. Declare all files normally in files; shared masks/textures need only one copy. Keep sourceAssetId and collection stable. Reimporting merges variants by ID and adds missing files, preserving existing package details and other variants. Existing files with conflicting sizes are rejected rather than overwritten.

The detail page and public share have an accessible thumbnail selector. Show variants expands family members into gallery cards before filtering/pagination; default search includes variant names/tags. Cards retain their parent's ID. Saving, batch selection, edits, deletion and full-package downloads operate on the family once. The detail's direct main-file download follows the selected variant.

Verification: unit coverage includes metadata validation, search, pagination, persistence, favorite grouping and complete-family deletion. Browser QA exercises owner/shared image and 3D switching, gallery expansion, selection deduplication and mobile overflow. Existing no-variant packages remain unchanged.

## Model inspection and clean packages

The 3D viewer exposes a Model chooser inside its controls. Changing a GLB reuses the renderer and keeps expanded/fullscreen inspection active. Variant selections synchronize with the chooser; the main-file download and image shown after Exit 3D follow the selected variant. Owner and public share pages use the same viewer.

Default import packs contain useful model/texture/mask/rig/animation/source/reference/preview files, provenance and a single README. Keep Godot demo projects, engine caches, QA captures and detailed inspection reports outside the import ZIP. Render previews transparently with correct proportions and uncropped framing.

Revised content uses new filenames to avoid same-size import skips. Existing imports retain old attachments and chosen defaults: select the new main model and preview in Edit details. Fresh imports use the revised manifest defaults.

2026-09-28 verification: real ore GLBs switched in owner and public viewers without replacing the canvas; expanded mode remained active; variant selectors, downloads and exit previews synchronized. Desktop/mobile captures checked layout. Six cleaned packages passed manifest/hash/GLB integrity and stable-ID reimport checks (152 files, 66 GLBs, 20 ore variants).

## Direct ZIP import

Choose ZIP or files accepts a prepared asset or collection ZIP directly. The website reads its manifests and unpacks connected files automatically as they upload, preserving normal stable-ID reimports. Shared upload links accept ZIPs too and place submitted packages in External assets. Plain files/folder import still works. ZIPs selected inside an existing asset folder remain connected archive files rather than recursively expanding.

The reader handles ZIP64, CRC verification and bounded extraction (5,000 entries / 20 GB per selection, 10 GB per file); links retain their existing per-asset/link quotas. It rejects unsafe paths, duplicate paths, file/folder conflicts, symlinks and encrypted archives. Large entries stream through browser temporary storage and are removed after upload or failure. No extracted files are written to the user's Downloads folder.

Verified in Chrome with two-package ZIP imports through owner/shared pages, stable reimport, traversal rejection, and a 129 MiB ZIP64 entry with temporary-storage cleanup.
