# Asset library verification — 24 September 2026

Implementation: Assets workspace above Entertainment, connected package import/export, descriptive style/category/collection metadata, bounded paginated catalog, browser-local saved assets, local GLB inspection and animation playback. Existing Library/Watch/Listen surfaces retained.

## Evidence

- Full existing `npm test` suite and the new `tests/assets.test.js` suite passed. The first sandboxed document-worker run was blocked by process spawning; the permitted native rerun passed.
- `npm run check` passed after final code edits (14 script blocks).
- New server tests cover connected metadata, stale-edit rejection, incomplete import/resume identity, file-path and symlink isolation, endpoint authentication/shelf access, and a synthetic 12,000-entry cached catalog. This is not a benchmark of a 12,000-package storage scan.
- Real Chrome integration used the 35-asset Amber Road collection. Verified category/search, metadata persistence, saved filters, package ZIP download, real upload, static Gold ore GLB and four-clip animated Amara Artisan GLB, and transitions back to Library/Watch. No browser errors.
- Prepared two-package import preserved nested paths and roles. An intentional 503 interrupted upload completion; choosing the unchanged selection resumed with exactly two files per package, then an additional import skipped both completed packages. The server refreshes draft file inventory before resuming.
- Mobile emulation at 390 × 844: redundant sidebar hidden, two-column gallery, all detail actions visible from initial scroll position, no horizontal overflow. Closed mobile filters reopen when resized to desktop. Both file/folder chooser buttons activate by keyboard. Light theme through actual applyTheme uses a measured 5.15:1 primary button text contrast.
- No physical phone/tablet or assistive-technology hardware test was performed. Other model formats retain preview/download fallback; browser 3D is self-contained GLB only, up to 256 MB.

Local evidence is ignored under `.qa/` and `.impeccable/review/`: assets-review-final.log, assets-import-check.log, assets-fix-check.log; assets-final and assets-corrections captures. Fixtures are not production content.

## Reusable collection

`RTS/Exports/Amber-Road-Asset-Library` contains 35 active asset packages and 278 related files (~2.9 GB). All 278 declared SHA-256 hashes were checked against exported bytes. Source models are unchanged. The collection includes readable names/tags, previews/references, portable GLBs, extracted texture maps, available rigs/animations, engine-specific optional motion libraries, provenance and import guides. Woodcutting axe naming was corrected against its actual preview and generation prompt.

No new paid generations were requested. Production deployment and copying these packages to the remote storage disk are separate from these local checks.

## Workbench follow-up — 24 September 2026

- Seven asset tests pass, including tag search, standalone/attached type filtering, source/VFX kinds, revision-safe bulk edits, persistent recoverable Trash and shelf protection on the new bulk endpoint.
- Real Chrome confirms checkbox/select-page operations make zero catalog requests and retain the same card/image DOM nodes; small/medium/large/list changes also stay local. Tree search finds Highland cedar, 35 model packages match textures and 12 match animations.
- Bulk edit, tag changes, Trash and restore were exercised on disposable QA packages. No real user assets were deleted.
- Real animated Amara Artisan GLB verified in solid and bone-overlay modes, with seeking, playback speed, In/Out preview range, expansion and actual Fullscreen API entry/exit. Captures include 1440 desktop, 900 user-width, 390 phone, and light theme. No physical device test is claimed.
- A real 3.8 MB tree Blender source add-on was uploaded to its existing QA asset card. ID, main GLB, preview, tags and catalog count stayed unchanged; new roles/labels were preserved.
- Blender 5.2 reopened all 35 converted files, verified nonempty meshes and packed images; 12 contain rigs and animation actions. Source ZIP has 35 packages, 770,710,859 bytes, and passed archive CRC plus every declared SHA-256 check. Original Meshy/game exports were not changed. This is editable GLB conversion, not recovered original sculpt history.
- Existing full npm regression suite, folder-sharing integration, browser syntax and eight Python subtitle recovery tests pass. One initial document worker timed out during concurrent Blender activity; the rerun after conversion completed passed.
- Evidence: .qa/assets-workbench-review.log, .qa/assets-source-import.log, .qa/workbench-tests.log, .qa/workbench-check.log; .impeccable/review/assets-workbench-final. Local fixtures/captures remain ignored.


## Package actions follow-up — 24 September 2026

- Nine asset tests pass, adding whole-package permanent deletion, stale-revision rejection, preservation of other packages, persistent account-private favorites, local-ID migration and deletion cleanup. New routes retain authentication and shelf permissions.
- Actual Chrome verified account favorites from a separate browser context, the Saved filter, bookmark state, and in-place Save toggling while image and 3D canvas remain mounted. Legacy local IDs migrate to the account store.
- Card right-click and three-dot menus, keyboard Escape, Edit details, image height/expansion/native fullscreen, return from 3D, inline import guidance and a real downloaded JSON recipe were exercised.
- Permanent deletion was confirmed only on a newly-created disposable QA package; its nested model and texture paths no longer existed afterward. The real Cedar delete prompt was canceled.
- Captured desktop, phone, dark/light help, model detail, fullscreen image and centered phone confirmation. No browser JS errors or phone horizontal overflow. Physical phone hardware is not claimed.
- Full npm tests, npm run check and eight Python tests passed with native spawning/temp-file access permitted. Sandboxed attempts hit worker/time-limit and temp-path permission errors; the permitted runs passed.
- Evidence remains local/ignored: .qa/assets-actions-review.log, .qa/assets-actions-tests.log, .qa/assets-actions-detector.json, and .impeccable/review/assets-actions/.


## Integrated studio and complete library — 24 September 2026

- Full npm suite passes, including ten asset tests. Stable source-ID/collection matching survives changed file lists and preserves edited metadata; concurrent matching creates one item, different identities stay separate, and trashed matches fail clearly. Final syntax/share integration and eight Python tests pass. A sandboxed attempt hit temporary-path EPERM; the permitted full suite passed.
- Real Chrome verified Exit 3D from loaded mesh, animated preview, browser fullscreen and in-flight GLB loading. The image returns without leaving the asset or retaining a canvas. Mesh mode hides the timeline, Animate reveals actual clip playback, static assets disable Animate, and toolbar icons expose accessible labels. Final phone/900px/desktop/light and actual phone-fullscreen captures are under .impeccable/review/assets-studio. Reviewer disposition: ship, no material fixes.
- Prepared and ordinary folder reimports were exercised with newly-added files. The same ID survived, edited name/tags were preserved, unchanged packages skipped and conflicting file sizes rejected. Evidence: .qa/assets-studio-review.log.
- A real complete Amara Bowguard package uploaded through Choose folder with all 13 connected files, including Blender source and untextured GLB. The derived untextured model rendered and its preserved animations played. Evidence: .qa/complete-import-review.log and untextured-import.png.
- Amber-Road-Asset-Library-Complete contains 35 packages and 383 connected files. The ZIP is 3,712,458,382 bytes. Every manifest checksum was verified and the ZIP passed CRC checks. The untextured GLBs have no images/materials or displayed vertex colors; retained geometry/skin/animation buffer bytes were checked against the originals. Blender files are the previously reopened, packed conversions. Their origin and limitations are stated in package notes and START-HERE.md.
- No new paid generations or live user deletions occurred. All import/deletion fixtures are local QA data. Physical devices and the unknown live host URL are not claimed as directly inspected.
