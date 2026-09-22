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
  library-heading:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  library-heading-mobile:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  library-name:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  library-control:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  library-data:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  library-toggle: "4px"
  compact: "5px"
  library-toolbar: "6px"
  control: "7px"
  library-bulk: "9px"
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
    padding: "0 16px"
    height: "39px"
  button-secondary:
    backgroundColor: "rgba(7, 9, 9, 0.4)"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "39px"
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
  library-row:
    typography: "{typography.library-name}"
    height: "49px"
  library-tile:
    rounded: "{rounded.control}"
    typography: "{typography.library-name}"
  library-toolbar-control:
    typography: "{typography.library-control}"
    rounded: "{rounded.library-toolbar}"
    height: "32px"
---

# Design System: Vault — Chromatic Archive

## Overview

**Creative North Star: "The Chromatic Archive"**

Vault feels like a serious private archive whose entertainment layer comes alive when media is present. Its working surfaces are dense, calm, and exact; Watch, Listen, and playback concentrate scale, imagery, motion, and depth without turning the file system into a streaming-site imitation.

Library is a compact Explorer-style operating surface: a small heading, shelf folders at the root, clickable breadcrumbs, and dense file rows. This Library refresh keeps the established Chromatic Archive identity and the Watch, Listen, and playback design unchanged.

The visual voice is mineral black, warm paper white, and one orange signal. Self-hosted sans lettering gives titles editorial impact while a restrained mono face handles measurements, paths, formats, times, and system state. Missing artwork must remain graceful rather than making the application feel incomplete.

**Key Characteristics:**

- Near-black tonal layering instead of decorative panels.
- Warm orange used as a signal, never as a wash across the whole screen.
- Large, tightly set media titles paired with precise mono metadata.
- Dense file tools and spacious entertainment surfaces in one coherent shell.
- Motion that reveals state, metadata, or the next feature and respects reduced motion.

## Colors

The palette is almost monochrome until state or media calls for the warm signal color.

Library inherits the shared dark/light variables from `public/chromatic.css`: `--night`, `--night-raised`, `--panel`, `--light`, `--muted`, `--accent`, and the existing divider and selection variables. Its toolbar, rows, and tiles use these same theme roles; there is no Library-only palette or new media color system.

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
- **Title:** Weight 600–650 at 14–16px for media and account identities; Library filenames use the smaller operating scale below.
- **Body:** Regular 13px with generous line height; descriptions stay near 52–54 characters per line inside cinematic fields.
- **Label:** Mono at 8–10px; uppercase only for measurements, state, or compact navigation data.

**The Two-Voice Rule.** Sans carries meaning and hierarchy; mono carries data and measurement.

Library deliberately uses sans for its compact data as well as names: 25px/600 for the heading (22px at 700px and below), 13px/500 for names and breadcrumbs, 12px for supporting copy and toolbar controls, and 11px for row metadata, counts, table labels, and actions. Mobile filenames reduce to 12px. Numeric metadata uses tabular figures. This 11/12/13/22/25px operating scale is separate from the unchanged entertainment display scale.

Icon-font `font-size` values describe glyph geometry, not text roles: shelf icons are 17px, Up is 18px, row folders are 24px, and grid folders are 38px. Do not add these to the typography ramp merely because they are implemented with an icon font.

## Layout

Desktop uses a 68px command bar, a 208px Library shelf rail, and a flexible content field. Library has a small heading with summary, followed by a 58px minimum-height breadcrumb toolbar. The file surface has 18px side padding, a 38px column header, and 49px minimum-height rows. Watch and Listen dismiss the shelf rail and retain their large feature fields with horizontal rails below.

At 1100px and below, the Library rail becomes 180px and rows reduce to selection, name, and size, with persistent actions on a second line. Above 1100px on hover-capable input, hover or focus reveals row actions in the metadata area; size, shelf, and added metadata temporarily yield that space. Non-hover input at wider widths also gets a persistent action line. At 940px the command bar becomes a two-row tablet header. At 700px the layout becomes one vertical flow: shelves and entertainment links become horizontal bands, the toolbar wraps, and file-surface side padding reduces to 12px. Mobile rows have a 48px minimum height before their action line. Primary navigation, New folder, and Upload remain directly reachable; protected owner tools stay behind Manage on wider screens. The existing mobile media scrollers and full-viewport player remain unchanged.

Library grid uses auto-filled columns with a 180px minimum. Each tile keeps selection separate from its open target and provides a persistent Get action; a file also offers Share. Selected rows and tiles use the existing orange-tinted selection surface, with an accent border on tiles.

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

Library refines that compact vocabulary: 4px view-toggle buttons, 5px row/Get actions, 6px toolbar controls and mobile shelf bands, 7px grid tiles, and a 9px bulk-action surface. These are corner sizes, independent of the text and icon scales.

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

### Library Hierarchy and File Tools

All files presents non-media shelves as folders rather than flattening their contents. Entering a shelf or folder exposes its immediate children; breadcrumbs and Up preserve that hierarchy. Search stays within the active Library scope and searches descendants. Movies, series, and music shelves are excluded from All files and its search. Their lower-left shortcuts open an explicit file-browsing scope with the same folder tools. Only the top Watch and Listen tabs enter the playback surfaces.

Names and selection stay visible while desktop actions appear on hover or keyboard focus. Metadata yields to actions only in the wide desktop row treatment; compact and touch layouts keep actions on their own line. Grid tiles preserve explicit selection and Get/Get folder controls. The bulk surface reports selection and exposes the applicable actions. Keep folder navigation, downloading, sharing, and owner tools practical without introducing a Library hero, decorative metrics, or a new visual world.

### Media Card

The image dominates in a wide cinematic frame. Hover or focus adds a shallow scale, darkens the lower image field, and reveals year, progress or rating, a two-line overview, genres, and a circular action. Poster grids are reserved for full-library browsing. The same information remains available in detail views for non-hover input.

### Player

Controls float over the video rather than occupying a permanent panel. Transport is icon-led; episode context sits in the top strip on wide screens, the close control owns the opposite corner, buffering uses the orange orbital signal, and advanced utilities recede before core playback controls.

## Do's and Don'ts

### Do:

- **Do** keep filenames, permissions, folders, and primary actions legible before adding spectacle.
- **Do** keep Library's shelf-root hierarchy, breadcrumbs, compact sans scale, and responsive action disclosure together as one operating surface.
- **Do** concentrate artwork and motion in Watch, Listen, playback, and meaningful previews.
- **Do** provide a graceful local fallback when thumbnails or remote metadata are unavailable.
- **Do** mirror hover disclosure with keyboard focus and persistent detail views.
- **Do** pause feature rotation during interaction, at reduced-motion preference, or away from the top of the view.

### Don't:

- **Don't** turn Vault into a Netflix clone or a cyan terminal costume.
- **Don't** use orange as a decorative page wash or distribute many competing accent colors.
- **Don't** hide archive navigation or owner access to make a media screen look cleaner.
- **Don't** use mono for body copy, large headings, or atmosphere.
- **Don't** interpret icon sizes as typography tokens or extend this Library refresh into new Watch or Listen styling.
- **Don't** make metadata, artwork, transcoding, or network access prerequisites for reaching the original file.


### File Selection, Actions, and Navigation

Single-clicking a filename selects the item and opens a compact action menu anchored below its row; double-click opens it. The body-level menu remains inside the viewport, offers keyboard navigation and Escape, and uses shared panel, divider, accent, and text tokens. Checkboxes and Ctrl/Cmd-click support multiple selection. Download is explicit in row, menu, grid, and bulk controls; folders download as ZIP archives. Move and delete support folders as well as files, while shelf roots remain protected.

Folders, shelf shortcuts, and breadcrumbs accept internal drag-and-drop moves with an accent outline. Move to… provides a folder browser with an explicit Move here button. Destructive actions retain confirmation and name that folders include their contents. Back, Forward, and Up remain beside the breadcrumbs; browser/mouse history follows folder and space navigation. The existing dialog history shares the same location state.
