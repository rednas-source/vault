---
name: Vault — Chromatic Archive
description: A near-black private archive with a premium, warm-signal entertainment layer.
colors:
  signal-orange: "#ff6b3c"
  archive-black: "#070909"
  deep-surface: "#0c0f0f"
  raised-surface: "#111514"
  raised-surface-strong: "#171b19"
  warm-white: "#f3f0e8"
  quiet-text: "#aab0aa"
  faint-text: "#747d78"
  paper-ground: "#eeeae1"
  paper-ink: "#171a18"
  signal-rust: "#c94723"
typography:
  display:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(58px, 7.4vw, 96px)"
    fontWeight: 610
    lineHeight: 0.83
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 570
    lineHeight: 1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.005em"
  label:
    fontFamily: "Vault Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "9px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.04em"
rounded:
  compact: "5px"
  control: "7px"
  media: "14px"
  feature: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "26px"
components:
  button-primary:
    backgroundColor: "{colors.warm-white}"
    textColor: "{colors.archive-black}"
    rounded: "{rounded.pill}"
    padding: "0 17px"
    height: "41px"
  button-secondary:
    backgroundColor: "rgba(7, 9, 9, 0.4)"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.pill}"
    padding: "0 17px"
    height: "41px"
  search-field:
    backgroundColor: "rgba(255, 255, 255, 0.025)"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.control}"
    padding: "0 13px"
    height: "38px"
  media-card:
    backgroundColor: "{colors.raised-surface}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.media}"
---

# Design System: Vault — Chromatic Archive

## Overview

**Creative North Star: "The Chromatic Archive"**

Vault feels like a serious private archive whose entertainment layer comes alive when media is present. Its working surfaces are dense, calm, and exact; Watch, Listen, and playback concentrate scale, imagery, motion, and depth without turning the file system into a streaming-site imitation.

The visual voice is mineral black, warm paper white, and one orange signal. Self-hosted sans lettering gives titles editorial impact while a restrained mono face handles measurements, paths, formats, times, and system state. Missing artwork must remain graceful rather than making the application feel incomplete.

**Key Characteristics:**

- Near-black tonal layering instead of decorative panels.
- Warm orange used as a signal, never as a wash across the whole screen.
- Large, tightly set media titles paired with precise mono metadata.
- Dense file tools and spacious entertainment surfaces in one coherent shell.
- Motion that reveals state, metadata, or the next feature and respects reduced motion.

## Colors

The palette is almost monochrome until state or media calls for the warm signal color.

### Primary

- **Signal Orange:** Marks active navigation, progress, focus, hover energy, and buffering state.

### Neutral

- **Archive Black:** Primary dark ground.
- **Deep Surface:** Header, drawer, dock, and quiet container ground.
- **Raised Surface:** Media fallbacks and elevated working surfaces.
- **Warm White:** Primary text and decisive controls.
- **Quiet Text:** Supporting prose and secondary labels.
- **Faint Text:** Timestamps, counts, and de-emphasized metadata.
- **Paper Ground / Paper Ink:** Intentional light-theme inversion rather than a white recolor.

**The Signal Rarity Rule.** Orange identifies interaction, progress, or current state; it does not become a decorative second background.

**The Local Contrast Rule.** Secondary text is tinted from its surrounding ground and remains legible; neutral gray is not dropped indiscriminately onto colored media.

## Typography

**Display Font:** Vault Sans (self-hosted Geist, with a platform sans fallback)

**Body Font:** Vault Sans (self-hosted Geist, with a platform sans fallback)

**Label/Mono Font:** Vault Mono (self-hosted IBM Plex Mono, with a platform mono fallback)

**Character:** The sans is calm and contemporary rather than futuristic. The mono face is operational: it appears for paths, measurements, formats, time, and system state—not as technical decoration.

### Hierarchy

- **Display:** Large, weight 610, tightly tracked and balanced; reserved for feature, album, and major administration titles.
- **Headline:** Compact, weight 570; section and rail headings.
- **Title:** Weight 600–650 at 14–16px; filenames, media names, and account identities.
- **Body:** Regular 13px with generous line height; descriptions stay near 52–54 characters per line inside cinematic fields.
- **Label:** Mono at 8–10px; uppercase only for measurements, state, or compact navigation data.

**The Two-Voice Rule.** Sans carries meaning and hierarchy; mono carries data and measurement.

## Layout

Desktop uses a 68px command bar, a 230px shelf rail, a flexible content field, and a 32px status rail. File rows are intentionally dense; Watch and Listen expand into large feature fields with horizontal rails below.

At 940px the shelf rail narrows and secondary owner actions reduce. At 700px the layout becomes one vertical flow: shelves become horizontal bands, the command bar wraps into three rows, media rails become touch-friendly horizontal scrollers, file columns reduce, and the player occupies the full dynamic viewport. Primary navigation, Upload, and Accounts remain directly reachable.

Spacing follows a compact 4/8/12 rhythm inside controls and an 18/26 rhythm between surfaces. Headings receive more space above than below.

## Elevation & Depth

The system combines tonal layers with soft ambient depth. Working rows and navigation stay flat; media cards, the music dock, and the player earn broad shadows because they float over active content. Borders and shadows are not doubled merely to simulate substance.

### Shadow Vocabulary

- **Media Lift** (`0 26px 70px rgba(0,0,0,.32)`): Artwork cards on hoverable media rails.
- **Floating Surface** (`0 30px 90px rgba(0,0,0,.52)`): Music dock and album artwork on the dark ground.
- **Paper Lift** (`0 28px 70px rgba(40,34,26,.17)`): Equivalent depth in light mode.

**The Flat-Until-Useful Rule.** File management is tonal and flat; depth appears where playback, hover, or protected focus makes it meaningful.

## Shapes

Compact work controls use 5–7px corners. Media and owner surfaces use 12–16px corners. Pills are reserved for small controls, current-state selectors, and direct actions. Artwork keeps its own rectangular silhouette; circles belong to transport and icon-only controls.

## Components

### Buttons

- **Shape:** Decisive actions are compact pills; icon-only transport controls are circles.
- **Primary:** Warm-white fill on the dark ground; orange appears on hover.
- **Hover / Focus:** Short color change with a 2px orange focus ring and 3px offset.
- **Secondary / Ghost:** Transparent or deep-surface fill with a single quiet border.

### Cards / Containers

- **Corner Style:** 14px for media and album cards; 16px for feature fields.
- **Background:** Tonal dark surfaces with real artwork when available and restrained mineral fallbacks when absent.
- **Shadow Strategy:** Flat at rest for files; media cards lift and scale slightly on hover or keyboard focus.
- **Border:** One quiet divider or one ambient shadow, except protected player/admin layers where both encode separation and focus.

### Inputs / Fields

- **Style:** 38px height, 7px corner, translucent near-black fill, and one quiet border.
- **Focus:** Orange outline outside the control; never a colored glow replacing contrast.
- **Error / Disabled:** Copy names the failure or unavailable capability; disabled actions remain visibly inactive.

### Navigation

The three primary spaces live in a segmented pill. The active space inverts to warm white. Shelf navigation uses compact rows with orange state marks. On phones both shelf groups scroll horizontally while the primary segmented navigation stays fully visible.

### Media Card

The image dominates. Hover or focus adds a shallow scale, darkens the lower image field, and reveals year, progress or rating, a two-line overview, genres, and a circular action. The same information remains available in detail views for non-hover input.

### Player

Controls float over the video rather than occupying a permanent panel. Transport is icon-led; episode context sits in the top strip on wide screens, buffering uses the orange orbital signal, and advanced utilities recede before core playback controls.

## Do's and Don'ts

### Do:

- **Do** keep filenames, permissions, folders, and primary actions legible before adding spectacle.
- **Do** concentrate artwork and motion in Watch, Listen, playback, and meaningful previews.
- **Do** provide a graceful local fallback when thumbnails or remote metadata are unavailable.
- **Do** mirror hover disclosure with keyboard focus and persistent detail views.
- **Do** pause feature rotation during interaction, at reduced-motion preference, or away from the top of the view.

### Don't:

- **Don't** turn Vault into a Netflix clone or a cyan terminal costume.
- **Don't** use orange as a decorative page wash or distribute many competing accent colors.
- **Don't** hide archive navigation or owner access to make a media screen look cleaner.
- **Don't** use mono for body copy, large headings, or atmosphere.
- **Don't** make metadata, artwork, transcoding, or network access prerequisites for reaching the original file.
