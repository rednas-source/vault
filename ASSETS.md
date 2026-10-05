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

Extract the source add-on ZIP, choose its folder in Assets > Add assets, and import; matching is automatic. Matching requires exactly one active package with the same sourceAssetId and collection. Existing names, tags, primary GLB and preview are preserved; new source files join the same card. Import the original collection first. Existing paths with a different file size stop the update instead of being overwritten; unchanged existing paths are skipped. A renamed collection or duplicate source entries must be resolved before matching. Successful imports are marked Needs review. Uploading through Add files on an individual card remains available for unrelated sources.


## Package actions, image inspection and import help

Right-click a card, or use its three-dot Actions button on touch/keyboard, for Open, Edit details, Save to favorites, Get asset and Delete. The menu supports arrow keys, Home/End and Escape. Delete is also in the asset detail action row. It requires a confirmation naming the asset, connected-file count and size, then permanently removes the whole package directory, manifest and related files. Stale revisions are rejected. This differs from the existing recoverable bulk Trash action; deleting cannot be undone.

Image previews use a custom thumbnail menu and the same compact Expand/Collapse and Fullscreen icons as 3D inspection. Height sliders and resize handles have been removed. Choose between the package's preview/reference/texture images. Image preview returns from 3D without leaving the asset. Browser fullscreen depends on platform support.

The question-circle next to Add assets, in both the gallery and import form, opens an inline guide. Its collection tree and grouped-result diagram explain one asset.json per asset folder, selecting the outer collection folder, ordinary file selection versus prepared imports, tags and source-ID matching. Download example asset.json provides an editable recipe; change its sample paths and remove entries for files you do not have. All listed files must be present. The guide does not generate models or use paid services.

Account favorite IDs are stored in hidden .asset-favorites.json at the storage root. Back up this file to retain account preferences; it is not part of an exported asset package. Favorites do not change asset metadata or revision. Saved-only filtering is resolved server-side, avoiding large ID lists in URLs.


## Integrated inspection and automatic repeat imports

Exit 3D is pinned at the top-right of the inspection surface, including while loading and in fullscreen. It returns to the asset image without leaving the detail page. The bottom icon toolbar groups Mesh/Animate, textured/solid/wireframe/bones, Choose model file, Reset, Expand and Fullscreen. Mesh is the default and restores the resting pose without displaying the timeline. Animate reveals clip/playback/seek controls only for files with clips; preview ranges sit behind the sliders icon. Static files disable Animate. Controls retain text alternatives, keyboard focus and pointer tooltips.

Repeat imports now match automatically. Prepared packages use sourceAssetId (or their manifest id) plus collection. Ordinary folder imports use the selected folder's name plus collection. Keep these identifiers stable; a changed collection or source ID denotes another asset. Loose file selections without a folder have no stable folder identity. A repeated package retains its existing name, tags, primary model and preview and uploads missing paths. Same-path/same-size files are retained without a content comparison; changed sizes stop with a conflict instead of overwriting. Rename revised content to keep both versions. Multiple matches and matches in Trash require resolution before importing. The create/match operation is serialized to prevent duplicate creation from concurrent matching requests.

The new Amber-Road-Asset-Library-Complete folder/ZIP holds 35 packages and 383 connected files. All original package media are preserved, plus 35 packed editable Blender conversions, 35 source notes and 35 untextured GLBs. The untextured derivatives preserve geometry, skin and animation buffers and remove materials, textures and vertex color display. They are derived from finished models, not recovered original pre-texturing topology/history. Each manifest retains the original sourceAssetId and collection. Extract and choose the whole complete folder to import, or select one asset folder.


## Favorites, drag behavior and asset sharing

The Favorites toggle is visible above the asset results and filters to your account’s saved packages. Dragging an existing preview never starts an upload; dropping external files still opens import.

Share in asset details or the card action menu creates a read-only link to a dedicated asset viewer. Recipients can inspect the self-contained GLBs, play embedded animations, switch surfaces and files, and download individual connected files or the whole package without signing in. Choose an expiry when creating the link; revoke it from Shared links. Every request checks link validity and the owner’s current asset access. Trashed/deleted packages and revoked/expired links are unavailable. The link exposes this package only and grants no upload, editing or deletion permission.

Verification: the asset-share regression test covers package isolation, traversal rejection, ranged model delivery, ZIP download, unsafe inline types, revoked/expired links and owner access. Local Chrome inspection covers actual animated GLBs, desktop/mobile layout, Exit 3D and anonymous read-only access.


The image dock keeps its selected image label visible and hides setup controls until requested. Both viewers use themed select arrows, slim range tracks, visible keyboard focus and accessible icon names. Chrome desktop/mobile verification covers image changes, height adjustment, expand/collapse, fullscreen exit, animation seeking and the return from 3D to images in dark/light themes.


## Custom viewer controls and external submissions

The image preview has no height slider or resize handle. Its image picker opens an in-view menu with thumbnail options; only Expand and Fullscreen sit at the bottom right. The 3D viewer uses the same custom menus for models, clips and speed, a keyboard/pointer-operated animation scrubber and a themed loop switch. Private and shared viewers load the same control module and styles.

Assets > Upload link creates a seven-day upload-only capability. Alternatively, enable **Allow asset submissions to External assets** when sharing an individual asset. Existing shares remain read-only unless explicitly enabled at creation. Visitors cannot browse the library, overwrite existing assets, or delete anything. Each new submission is placed under `assets/External assets/` and assigned the **External assets** collection, keeping its related models, maps and sources together. Prepared folders with an asset.json per package preserve descriptions, style, category and tags; ordinary file/folder selections form one named package. ZIPs must be extracted first.

Upload links are limited to 20 GB and 200 submissions; each asset allows up to 10 GB / 1,000 connected files. Uploads reserve capacity at initialization. Partial chunks are private under `.asset-incoming`; retry with the same selected files in the same browser tab to resume. A completed submission is idempotent. Every upload operation rechecks the link and owner's shelf access. Expiry/revocation stops further requests. Review received assets before trusting or executing their contents, as with any external upload.

Tests cover upload isolation, unsafe paths, chunk offsets, size limits, duplicate completion, grouping, permission removal and revocation. Chrome verification covers the owner share controls, upload-only page, actual anonymous uploads, private/public animated GLBs, custom menus and keyboard scrubbing at desktop and mobile sizes.

The portable `skills/asset-generation` skill is versioned here and installed in the owner's Codex skills directory. It does not launch paid generations until a concrete batch and budget are supplied.


### Upload name collisions

New packages with an existing display name are named `Name (variant)`, `Name (variant 2)`, and so on automatically. Stable source IDs still resume the same package when adding missing files. If a matching package contains a conflicting file size or declared SHA-256, import creates a separate, resumable variant package and preserves its original relative model/texture/preview paths. Existing files are never overwritten. Loose duplicate filenames and same-named ZIP selections are disambiguated automatically. Dragged folder paths are retained. After an interrupted upload, press Import assets again; the current selection and uploaded chunks are retained. Ambiguous duplicate entries inside a single malformed ZIP remain rejected.
