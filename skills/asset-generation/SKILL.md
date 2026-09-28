---
name: asset-generation
description: Generate coherent game-asset collections through Meshy's API, review concepts and 3D results, prepare appropriate rigs and animations, and package connected files for Vault. Use for asset batches from design references, item lists or supplied sheets; not for routine Vault UI changes.
---

# Asset generation

Create reusable assets that belong to the user's chosen visual world. Use Meshy API for all generative concept art, models, textures, rigging and animation. Do not substitute another paid provider. Minor local Blender corrections are allowed when they are quicker and cheaper than generation. Creating or installing this skill does not start a paid batch.

## Define the batch

Accept one or several design references, an item list with style assignments, a user-supplied asset sheet, or a written brief. Map each requested item to its style before generating. If no style name is supplied, assign a clear descriptive name and keep it consistent. Record a short style guide: silhouette, proportions, palette, material response, texture detail, edge treatment and intended camera distance. Separate distinct styles into named collections rather than mixing them accidentally.

For a sheet, isolate each intended asset and retain its link to the original. Do not send a crowded sheet to single-object reconstruction and assume it will separate the models. Resolve overlapping/ambiguous items before spending on those items; continue independent items.

Check current official API models, pricing and supported operations using [Meshy notes](references/meshy.md). Select the best suitable image model from the user's GPT Image / Nano Banana preferences, and the best available 3D model for the desired fidelity. Do not equate maximum polygon count with polished game art. Preserve a high-quality master; make optimized derivatives when useful.

Establish the spending authorization from the current task and existing session. A user may explicitly authorize necessary spending with no fixed cap; honor that choice without requesting a numeric cap again. Record the authorization and still avoid waste, purchases, subscription changes and unproductive retries. If neither a cap nor uncapped spending is authorized, give a concrete estimate and ask before paid submissions while preparing prompts and manifests. Do not reset an older project's ledger. Track concepts, meshes, texturing, rigs, animations, remesh/UV and retries in one ledger. Reserve costs for in-flight jobs and enforce a cap when one was specified. Do not buy credits or change the plan.

## Generate and review

1. Create concept images through Meshy Text to Image or Image to Image. Choose GPT Image 2 (or the explicitly accepted current GPT successor) versus the best Nano Banana variant case by case. Keep approved style references and prompt constraints consistent. Make isolated, clearly readable assets; for rigged humanoids use separated limbs and a suitable neutral pose. Use supplied artwork directly when it already provides a good reconstruction input.
2. Generate textured 3D via Meshy’s best suitable current model. Save concepts, exact requests, model/version, task IDs and estimated/actual credits locally. Never print or package credentials. Record submission intent before POST; on an uncertain response reconcile task history rather than creating a duplicate paid job. Persist checkpoints after every completed stage so interruption resumes existing tasks.
3. Download and inspect the actual model from multiple angles against the concept. Check silhouette, proportions, missing/fused parts, unwanted base, holes, UVs, material artifacts and collection consistency. A thumbnail or successful task status is not a 3D quality review. Use a rendered turntable or several real viewport captures, including an untextured view. For larger batches, inspect one representative per category/style before expanding, then inspect every finished asset.
4. If geometry is unacceptable, use a verified free API regeneration allowance while it is available and useful. Never assume a normal POST is a free retry. If the API offers no confirmed free retry, report that limitation; a paid alternative must fit the authorized budget and retry scope. Do not silently switch to a website-only free-retry workflow. Stop unproductive repetition after three failed geometry attempts and flag the asset for manual review unless the user explicitly directs further attempts.
5. Apply only the finishing operations the asset needs. Static rocks/trees/props generally need no humanoid rig. Preserve usable UVs instead of unwrapping again without a reason. Use Meshy rigging and requested animation actions for supported characters, with topology appropriate for deformation. Keep textured originals, rigged outputs and animation clips distinct but connected.
6. Review the actual rig and animated mesh: skeleton placement, joint deformation, foot contact/sliding, clipping, root motion, rest pose, loop seam, scale and orientation. Use a bounded independent agent review of captured evidence when available; consolidate a batch into one review instead of creating an agent per file. Fix the identified cause, then retry rig/animation at most **three total attempts per affected asset/stage**, including the initial attempt, within the credit cap. Preserve the best result, record failed attempts and stop if quality remains inadequate.
7. Make minor Blender fixes only when they are inexpensive and preserve approved appearance. Work on derived copies. Re-export and recheck geometry, materials, skeleton and clips in a real viewer. Do not call an imported GLB conversion the original sculpt or original pre-texturing source.

## Asset-only review and derived edits

When the user is evaluating a library before starting a game, keep review in background Blender renders or the asset viewer. Do not launch Godot, create engine demo projects, or package engine files unless the user asks for that phase. Record whether animation came from Meshy or local Blender work; a playback tool is not its author.

For customizable characters, require visibly open, separated eyes and usable eyelid/iris geometry in the concept and actual-model review. A closed sculpt or painted eyelid cannot provide recolorable open eyes by changing a texture alone. Reject pasted-on eyeball repairs that fail closeup review; preserve the best original and disclose unfinished eye work.

Before delivering derived humanoids, check every shape-key default and exported morph weight. Neutral facial controls must be zero unless a deliberate preset is requested. Preserve approved geometry and original material graphs; do not silently replace them with a provider's simplified rig mesh or unsupported tint nodes. Recheck transferred weights and unchanged body curves.

## Package and deliver

Follow the user's requested target structure. For Vault, use [the package contract](references/vault-package.md): one stable manifest per asset, readable names, style/category/tags, preview and actual model plus all connected files. Save downloadable results promptly before provider URLs expire. Do not include secrets, signed download URLs or caches in archives.

Include genuine pre-texturing output when the provider exposes it. Otherwise label a material-free derivative and Blender conversion honestly. Validate manifest paths and hashes, reopen representative GLBs and every animation family, and check the final archive. Keep unfinished assets marked Needs review; never fabricate missing files or quality evidence.

Finish with artifact links, asset counts, recorded credits (distinguish estimated from observed), and an explicit list of incomplete or unsatisfactory assets and remaining issues. State when all items passed. Keep critique concise enough for the owner to decide what to inspect manually.

## Later capabilities

VFX and finger rigs are separate follow-up experiments, not automatic additions to every batch. Verify current Meshy API support before claiming it can produce engine-ready particle systems. Mesh/texture ingredients are different from a functioning VFX scene. Finger articulation may require Blender bones and skin-weight edits; inspect finger topology first, preserve existing body animation, and prove it with finger curl/spread poses and exported playback. Obtain the user's concrete test asset/effect and generation budget when that work begins.
