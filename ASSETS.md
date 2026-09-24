# Vault game asset library

**Assets** sits above Entertainment in the Library sidebar. Each entry represents one reusable asset, rather than a row for every texture or animation. Its main model, previews, concept references, source files, textures, rigs, animations and import notes stay connected.

## Bring in an asset

1. Open **Assets → Add assets**.
2. Choose files for one asset, or choose a folder to preserve its subfolders. Dragging files/folders onto Assets also opens this importer.
3. Give the asset a readable name, category, art style, collection and a few useful tags. A style describes appearance; it does not imply a polygon budget.
4. Import, inspect the preview, then use **Edit details** to choose the main file/preview, refine file roles and mark the package **Ready to reuse**.

For an ordinary asset, include a `preview.png` or `cover.jpg` with the model. Without one, Vault shows an explicit No preview yet state; it does not generate artwork or spend credits. A file named `reference…` or `concept…` is labeled as a concept reference when used as the preview.

For a prepared collection, choose the collection's entire folder. Each `asset.json` becomes one independent library entry, using the supplied name, style, tags, notes and file roles. Large files upload in resumable 8 MB chunks. If interrupted, choose the **same unchanged files/folder** again: completed files and chunks are reused. Reimporting an unchanged completed selection is skipped. Keep the tab open during transfer; this is not a background desktop uploader.

You can also copy complete packages beneath the server's configured `storagePath/assets` directory and click **Refresh**. The directory may contain collection folders, with one `asset.json` inside each asset package. Files without a package manifest are not cataloged. Originals remain ordinary portable files on disk; the catalog is not a proprietary container.

## Find and reuse

- Search names, tags, descriptions, categories, styles and filenames. Combine category, collection, art-style, format, review-state and rig/animation filters.
- **Saved** keeps favorites per account in the current browser. They do not currently sync between devices.
- Results are paginated, 48 at a time; model files are fetched only when **Inspect in 3D** is selected. The server caches the catalog, refreshes it after five minutes on the next request, and offers explicit Refresh for disk changes.
- Open an asset to see related files, generation recipe, version, source/license notes and practical import instructions. Editing metadata does not rewrite the model.
- **Get asset** downloads the entire package as a ZIP, including its manifest. **Get selected** bundles selected packages. Individual files and the main GLB can also be downloaded directly.

The viewer supports self-contained GLB files up to 256 MB with embedded textures. Orbit, zoom, pan, reset the camera, toggle wireframe and play embedded animation clips. Choose another GLB in the package to inspect a rig or separate motion. Other formats—including FBX, OBJ, Blender files, textures, materials, audio, VFX, scenes and UI assets—are stored and downloaded with their related files; this first release does not interpret every proprietary format. Unsupported or damaged previews show a download fallback. The viewer does not fetch third-party model resources or use a hosted rendering service. Three.js 0.186.0 is bundled locally with its MIT license.

## Packages and metadata

```text
Gold ore deposit/
  asset.json
  preview.png
  reference.png             optional concept art
  models/gold-ore.glb       mesh + embedded materials/textures
  textures/…               optional separate maps
  rig/…                    only when the asset has a skeleton
  animations/…             portable GLB clips or engine-specific libraries
  source/…                 editable/source versions
  README.md                import instructions
```

Minimum useful `asset.json`:

```json
{
  "schemaVersion": 1,
  "name": "Gold ore deposit",
  "kind": "model",
  "category": "Resources",
  "style": "Stylized Strategy",
  "collection": "Amber Road",
  "tags": ["gold", "ore", "rock", "mining"],
  "primary": "models/gold-ore.glb",
  "preview": "preview.png",
  "version": "1.0",
  "status": "review",
  "notes": "Import the GLB to keep materials connected.",
  "files": [
    {"path": "models/gold-ore.glb", "role": "model"},
    {"path": "preview.png", "role": "preview"}
  ]
}
```

Kinds: `model`, `texture`, `material`, `animation`, `audio`, `vfx`, `scene`, `ui`, `other`.
File roles: `model`, `rig`, `animation`, `texture`, `preview`, `reference`, `source`, `documentation`, `other`.
Review states: `draft` (upload incomplete), `review` (needs review), `ready` (ready to reuse).
Additional fields: `description`, `source`, `sourceAssetId`, `license`, and `provenance` with generator/model/prompt/texturePrompt. Categories, styles and collection names are editable text. The version field is descriptive; this is not automatic version control. Keep alternate versions as explicitly named files or separate packages.

GLB triangle count, bone count, embedded texture count and animation names/durations are inspected from the actual file. Supplied SHA-256 values preserve source provenance; Vault does not currently verify every declared checksum during uploads. Missing declared files keep an import incomplete. Metadata saves reject stale edits from another window.

## Access and scale

Assets is a dedicated shelf governed by Vault's existing server-enforced shelf permissions. Admins and accounts with access to all shelves can access it; restrict the `assets` shelf explicitly for other accounts when needed. Assets are not listed in All files, Movies, Shows or Music. This does not make an existing all-shelves account lose access automatically.

No generated media ships in the application repository. Collections belong on the storage disk and in your backups. Back up entire package directories, including manifests. The assets shelf is reserved for this feature and cannot be deleted through Manage.

The catalog has server-side pagination and bounded indexing (100,000 visited collection directories, nesting depth 8 before packages; up to 5,000 connected files per package). Filtering was tested against a synthetic 12,000-entry cached catalog. This is not a production storage benchmark or a guarantee for millions of assets. A persistent database index would be the next step at substantially larger scale.
