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
- **Saved** keeps favorites privately on your Vault account, including across browsers/devices. Existing browser-local saves migrate when that browser next opens Assets. Saving does not reset the active preview.
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

Kinds: `model`, `texture`, `material`, `animation`, `audio`, `vfx`, `source`, `scene`, `ui`, `other`.
File roles: `model`, `rig`, `animation`, `vfx`, `texture`, `preview`, `reference`, `source`, `documentation`, `other`.
Review states: `draft` (upload incomplete), `review` (needs review), `ready` (ready to reuse).
Additional fields: `description`, `source`, `sourceAssetId`, `license`, and `provenance` with generator/model/prompt/texturePrompt. Categories, styles and collection names are editable text. The version field is descriptive; this is not automatic version control. Keep alternate versions as explicitly named files or separate packages.

GLB triangle count, bone count, embedded texture count and animation names/durations are inspected from the actual file. Supplied SHA-256 values preserve source provenance; Vault does not currently verify every declared checksum during uploads. Missing declared files keep an import incomplete. Metadata saves reject stale edits from another window.

## Access and scale

Assets is a dedicated shelf governed by Vault's existing server-enforced shelf permissions. Admins and accounts with access to all shelves can access it; restrict the `assets` shelf explicitly for other accounts when needed. Assets are not listed in All files, Movies, Shows or Music. This does not make an existing all-shelves account lose access automatically.

No generated media ships in the application repository. Collections belong on the storage disk and in your backups. Back up entire package directories, including manifests. The assets shelf is reserved for this feature and cannot be deleted through Manage.

The catalog has server-side pagination and bounded indexing (100,000 visited collection directories, nesting depth 8 before packages; up to 5,000 connected files per package). Filtering was tested against a synthetic 12,000-entry cached catalog. This is not a production storage benchmark or a guarantee for millions of assets. A persistent database index would be the next step at substantially larger scale.

## Search, views and bulk actions

Search assets is inside the Assets page. Submit with Enter or Search; it matches names, descriptions, tags, categories, styles and filenames. For example, `tree` finds Highland cedar because its tags include tree. Small/medium/large grid and list preferences are saved per account in this browser. Selection updates the existing cards in place; it does not reload previews or fetch the catalog. Select page affects only the visible page, with up to 200 selected packages per batch.

Type defaults to matching both standalone assets and connected model content. Textures and Animations therefore find model packages that contain those files (or embedded GLB texture/animation data). Relationship = Belongs to model limits results to matching model packages. Standalone assets limits the type to the package's own type. Packages still appear as one card; their related files are not duplicated into loose library entries. VFX and Source files are explicit types; VFX is also a file role. VFX packages can hold engine-specific files and a preview image; Vault does not execute arbitrary engine effects in the browser.

Edit selected changes category, style, collection, review state, or adds/removes tags. Blank fields stay unchanged. It does not edit geometry or rewrite model contents. Revision checks reject stale selections before changing the batch; storage failures report completed and failed items rather than claiming atomic multi-file transactions.

Move to Trash hides complete packages from the active catalog. Use Trash, select packages and Restore selected to recover them. Trash is reversible metadata; it does not erase files, reclaim disk space or revoke an already shared file link. Existing shelf permissions still apply.

## 3D workbench

Controls are inside the viewer panel. Expand uses the full Assets content width; Fullscreen uses the browser Fullscreen API when supported. Surface switches between textured, solid without textures, and wireframe display. Bones shows an overlay for files with an actual skeleton. These are inspection settings and do not rewrite the model.

For animation clips, use the timeline, 1/30-second stepping, speed, loop and In/Out preview range. Play/Pause and scrubbing animate the actual skeleton. Preview ranges are temporary playback controls, not destructive trimming or a saved animation edit. Change file to inspect another GLB in the package. Native Blender files remain downloadable for editing in Blender.

## Add Blender sources to existing cards

The Amber Road game was authored as Meshy GLBs, so it has no original Blender sculpt history to recover. The optional Amber-Road-Blender-Sources collection contains editable Blender conversions of all 35 approved model GLBs. They open in Solid shading and include imported geometry, UVs, materials, packed images, and available rigs/animations. The conversion notes explicitly distinguish them from original pre-texturing authoring projects.

Extract the source add-on ZIP, choose its folder in Assets > Add assets, and enable **Add files to matching assets**. Matching requires exactly one active package with the same sourceAssetId and collection. Existing names, tags, primary GLB and preview are preserved; new source files join the same card. Import the original collection first. Existing paths with a different file size stop the update instead of being overwritten; unchanged existing paths are skipped. A renamed collection or duplicate source entries must be resolved before matching. Successful imports are marked Needs review. Uploading through Add files on an individual card remains available for unrelated sources.


## Package actions, image inspection and import help

Right-click a card, or use its three-dot Actions button on touch/keyboard, for Open, Edit details, Save to favorites, Get asset and Delete. The menu supports arrow keys, Home/End and Escape. Delete is also in the asset detail action row. It requires a confirmation naming the asset, connected-file count and size, then permanently removes the whole package directory, manifest and related files. Stale revisions are rejected. This differs from the existing recoverable bulk Trash action; deleting cannot be undone.

Image previews now have in-panel image selection, Expand/Collapse, Fullscreen and a height slider, plus a desktop resize handle. Choose between the package's preview/reference/texture images. Image preview returns from 3D without leaving the asset. Browser fullscreen depends on platform support.

The question-circle next to Add assets, in both the gallery and import form, opens an inline guide. Its collection tree and grouped-result diagram explain one asset.json per asset folder, selecting the outer collection folder, ordinary file selection versus prepared imports, tags and source-ID matching. Download example asset.json provides an editable recipe; change its sample paths and remove entries for files you do not have. All listed files must be present. The guide does not generate models or use paid services.

Account favorite IDs are stored in hidden .asset-favorites.json at the storage root. Back up this file to retain account preferences; it is not part of an exported asset package. Favorites do not change asset metadata or revision. Saved-only filtering is resolved server-side, avoiding large ID lists in URLs.
