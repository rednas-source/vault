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
