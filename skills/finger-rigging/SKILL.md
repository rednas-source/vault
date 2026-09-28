---
name: finger-rigging
description: Add calibrated finger bones, skin weights and conservative finger motion to an existing hand or humanoid while preserving body animation. Use for separated-finger meshes and bounded rigging experiments; not a universal automatic hand rig or guaranteed production grip generator.
---

# Finger rigging

Work on a derived copy and retain the unmodified model, body rig and animation baseline. This workflow established useful finger articulation on a Meshy humanoid and isolated hand; closeup thumb opposition still required corrective work. Do not present basic curls as finished card, dice or weapon interactions.

## Calibrate before changing weights

Inspect actual front, rear, side and untextured geometry. Count five separated digits and examine finger webs, knuckles and palm thickness. Fused fingers, major holes or unsuitable topology need modeling first. Use a bounded test and stop when deformation does not improve; do not spend repeatedly on generation merely to force this method to fit.

Place four landmarks per finger: three joint heads and the fingertip. Use the actual mesh, its anatomical palm plane and its current armature coordinate system. Calibrate each side; mirrored landmarks are only appropriate for a genuinely mirrored mesh. Meshy rigs may use centimeter-valued bones beneath a 0.01 armature scale. Transform world landmarks into armature-local coordinates; preserve existing rest transforms and animation.

The helper [scripts/finger_helpers.py](scripts/finger_helpers.py) creates three-bone chains beneath a supplied hand bone, assigns conservative weights and exports GLB. `make_hand_rig` expects `fingers`, `palm_normal`, a scale-appropriate `radius`, and a bounded `region` predicate when editing a body. For a standalone hand also supply a `wrist` head/tail. It is an implementation aid, not automatic anatomical detection.

Classify digits in the palm plane while including their entire thickness. A hard 3D distance cutoff can leave dorsal vertices attached to the wrist, causing spikes. Blend the finger base into the palm. Smooth weights across duplicated UV-seam positions and retain at most four normalized influences. For a body, restrict changes to the inspected hand region and preserve forearm transitions. Explicitly verify zero-weight vertices, seams and wrist continuity.

## Animate and prove the result

Start with small curls and spread, then inspect stronger flexion, thumb opposition and the actual prop from multiple angles. Use local bend axes derived from anatomy. An optimizer reaching a fingertip target does not establish plausible joints, skin deformation or contact. Thumb-base collapse is a reason to revise weights/corrective shapes or flag a failed grip, not claim success from a low distance error.

Preserve body tracks exactly when adding finger curves. Hash their key times, values and interpolation before/after, and compare the original bones' transforms in the exported baseline and enhanced files at matching clip times. Preserve the scene FPS used when importing the original animation. Retain constant reset channels (`export_optimize_animation_size=False` in Blender's glTF exporter): dropping them can make Open retain the preceding grip. Give reusable actions fake users or NLA strips before saving Blender files. Check mirrored rigs' normals, transforms and synchronized animation tracks in the exported model. Use background Blender or the asset viewer during an assets-only phase; engine validation waits for the user's engine-work request.

Reopen exported GLBs in a real viewer/engine. Test switching from a flexed clip back to Open, sample every clip, and inspect closeup playback. Compare before/after images of the same pose and camera. Do not infer smooth transitions, loop seams, foot contact or collision-free interaction from still images alone.

In Godot runtime imports, call `GLTFDocument.generate_scene(state, 30, false, false)` to keep immutable reset tracks; the default fourth argument removes them. For editor imports disable Remove Immutable Tracks in the animation import settings, or explicitly apply a complete reset before switching clips. An Open clip containing constant GLB channels can otherwise import with zero tracks. See the [official GLTFDocument reference](https://docs.godotengine.org/en/stable/classes/class_gltfdocument.html).


The thumb needs its own anatomical hinge orientation; copying the fingers' roll can turn the nail underneath during flexion. Calibrate bone roll before increasing opposition angles, and inspect nail direction and thumb-web deformation independently. A +60-degree roll correction improved the tested standalone hand, but that number is asset-specific and did not eliminate tight-pinch creasing.

Validate both sides of a mirrored pair after export, across every clip and several frames. The tested pair required preserving identical single-hand skin/animation data beneath separate mirrored placement roots; copying and renaming Blender armatures had produced a visibly mismatched left thumb. On Blender reimport, bind each armature to its matching action slot before comparing poses. Keep placement/mirroring outside animated joint channels. Do not claim a fixed pair from checking one hand.

## Deliver honestly

Package the baseline, enhanced GLB, editable Blender conversion, source textures/concept, calibrated landmarks, clip names and evidence under one Vault item where appropriate. Distinguish the provider's original geometry from a material-free derivative. Mark unsuccessful grips and unfinished contact poses as Needs review. Use the existing asset-generation package contract when creating Vault manifests.

Validated example: a 24-bone humanoid became 54 bones, with unchanged source body curves and zero sampled native body-pose difference across five clips. A dedicated hand used 16 bones, its mirrored pair 32. Individual curls improved; severe thumb opposition still pinched the thenar area. This supports calibrated articulation, not a production-ready automatic grasp system.
