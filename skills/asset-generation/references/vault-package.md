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

Only create directories and manifest entries for files actually delivered. One `asset.json` sits at the top of each asset folder. Select the collection folder in Vault to import all packages as separate cards. Related files appear under one asset. Vault accepts these ZIPs directly through Choose ZIP or files and unpacks them during upload. Folder import remains available.

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

Mark derivatives clearly: "Untextured derivative of the final mesh" or "Editable Blender conversion" if genuine original authoring history is unavailable. Keep provider provenance and the applicable user/license statement without inventing rights. Keep inspection evidence, detailed quality reports and optional engine demos outside the default Vault import folder/ZIP. Summarize unresolved issues in the one import README and asset notes. Include only useful asset files: models, necessary maps/masks, rigs/clips, editable sources, concept/reference art, previews, provenance and the manifest. Do not add Godot projects/scenes/scripts, QA screenshots, empty files or redundant reports unless requested. Omit retry caches and paid-generation credentials.

## Variant families

Vault also supports one package with a `variants` array (maximum 256). Each entry needs a unique stable lowercase `id`, readable `name`, a `primary` relative file path, optional raster `preview`, and `tags`. All referenced files must exist and remain in the normal `files` list. Example:

```json
"variants": [
  {"id":"spire-gold","name":"Spire · Gold","primary":"models/spire-gold.glb","preview":"previews/spire-gold.png","tags":["spire","gold"]},
  {"id":"spire-iron","name":"Spire · Iron","primary":"models/spire-iron.glb","preview":"previews/spire-iron.png","tags":["spire","iron"]}
]
```

Set the package's main file and preview to a representative variant. Keep generic family tags on the package and distinguishing material/shape tags on each variant. This lets Show variants search select the appropriate members. Shared textures, ore masks, Blender sources remain connected once. Reimport merges variants by ID. Gallery selection, favorites, editing, deletion and full-package download apply to the family; the detail's main-file download follows the selected variant.

## Preview presentation and revisions

Render the actual model with transparent background, correct aspect ratio and tight but uncropped framing, so it sits naturally on Vault’s dark gallery/viewer. Preserve approved colour/material response; do not silently replace source PBR maps with generic values. Keep only useful preview images in the import package.

For revised existing packages, use new filenames for changed content: current Vault imports skip same-path/same-size files. Keep sourceAssetId, collection and variant IDs stable. Explain that reimport adds files and merges variants but does not remove older attachments or overwrite a user’s chosen main file/gallery preview. On an existing card, Edit details selects the revised defaults; fresh imports use the manifest defaults.
