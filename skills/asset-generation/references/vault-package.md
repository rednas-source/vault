# Vault package contract

Use the user-specified layout if provided. The standard import layout is:

```text
Collection/
  asset-slug/
    asset.json
    preview.png
    reference/concept.png
    models/asset.glb
    textures/...
    animations/...
    source/asset.blend
    README.md
```

Only create directories and manifest entries for files actually delivered. One `asset.json` sits at the top of each asset folder. Select the collection folder in Vault to import all packages as separate cards. Related files appear under one asset. Extract ZIPs before importing.

Example (remove absent entries):

```json
{
  "schemaVersion": 1,
  "name": "Highland cedar",
  "sourceAssetId": "highland-cedar-01",
  "kind": "model",
  "category": "Vegetation",
  "style": "Faceted Highland Strategy",
  "collection": "Highland Essentials",
  "tags": ["tree", "cedar", "evergreen", "vegetation"],
  "description": "A cedar for forest environments.",
  "primary": "models/cedar.glb",
  "preview": "preview.png",
  "status": "review",
  "files": [
    {"path": "models/cedar.glb", "role": "model", "label": "Textured cedar"},
    {"path": "reference/concept.png", "role": "reference", "label": "Approved concept"},
    {"path": "preview.png", "role": "preview", "label": "Model preview"}
  ]
}
```

Keep `sourceAssetId` unique and stable within `collection`; those fields let reimports add missing files to the original card. Names are readable labels, not identity. Include searchable generic subjects (tree, rock, ore) as tags as well as specific species/material names. Use separate named styles for distinct visual families. Do not assume the category automatically adds synonyms.

Kinds: model, texture, material, animation, audio, vfx, source, scene, ui, other. File roles: model, rig, animation, vfx, texture, preview, reference, source, documentation, other. Paths are relative, use forward slashes and match case. Include `sha256` per file when packaging for integrity verification. No absolute paths, traversal, symlinks or private credentials.

The browser previews self-contained GLBs with embedded textures, and raster previews. Include standalone texture maps for reuse even when embedded in GLB. Blender files are downloadable sources, not browser-rendered models. Keep rigged models and individual animation GLBs connected to the same package. Document scale, axes, origin, triangle count, skeleton/clip names, map color spaces and engine import notes when relevant.

Mark derivatives clearly: "Untextured derivative of the final mesh" or "Editable Blender conversion" if genuine original authoring history is unavailable. Keep provider provenance and the applicable user/license statement without inventing rights. Package inspection evidence and a quality report with unresolved issues; omit retry caches and paid-generation credentials.
