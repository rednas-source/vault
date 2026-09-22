---
name: Vault — Archive and Watch
description: A compact private archive with an independent neutral streaming surface for Watch.
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
  watch-ground: "#141414"
  watch-header: "#101010"
  watch-surface: "#1c1c1c"
  watch-panel: "#202020"
  watch-art-fallback: "#252525"
  watch-text: "#f5f5f5"
  watch-muted: "#b6b6b6"
  watch-quiet: "#a3a3a3"
  watch-faint: "#939393"
  watch-line: "#3a3a3a"
  watch-line-soft: "#303030"
  watch-action: "#ffffff"
  watch-progress: "#e8e8e8"
typography:
  watch-display:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(38px, 4.5vw, 68px)"
    fontWeight: 750
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  watch-heading:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  watch-catalog-heading:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  watch-body:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  watch-poster-title:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 550
    lineHeight: 1.4
  watch-meta:
    fontFamily: "Vault Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
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
  watch-nav: "3px"
  watch-control: "4px"
  watch-art: "5px"
  library-toggle: "4px"
  compact: "5px"
  library-toolbar: "6px"
  control: "7px"
  library-bulk: "9px"
  media: "14px"
  feature: "16px"
  pill: "999px"
spacing:
  watch-gutter: "clamp(20px, 4.2vw, 76px)"
  watch-rail-gap: "16px"
  watch-rail-separation: "38px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "26px"
components:
  watch-button-primary:
    backgroundColor: "{colors.watch-action}"
    textColor: "{colors.watch-ground}"
    rounded: "{rounded.watch-control}"
    padding: "12px 24px"
  watch-button-secondary:
    backgroundColor: "rgba(100, 100, 100, 0.55)"
    textColor: "{colors.watch-action}"
    rounded: "{rounded.watch-control}"
    padding: "12px 24px"
  watch-poster:
    backgroundColor: "{colors.watch-art-fallback}"
    textColor: "{colors.watch-text}"
    rounded: "{rounded.watch-art}"
    typography: "{typography.watch-poster-title}"
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

# Design System: Vault — Archive and Watch

## Overview

**Creative North Star: "The Chromatic Archive, with a personal streaming library for Watch"**

Vault combines distinct, scoped surfaces. Library remains a dense, calm private archive; Listen, administration, and playback retain their established Chromatic Archive styling. Watch is the user's explicitly chosen conventional Netflix / HBO / Emby-style streaming library: neutral black, white controls, cinematic backdrops, upright posters, and straightforward title browsing.

Library is a compact Explorer-style operating surface: a small heading, shelf folders at the root, clickable breadcrumbs, and dense file rows. Watch has its own scoped palette and composition; its show → season → episode hierarchy is a presentation of existing files, with browser history and no physical file moves.

The established archive voice uses mineral black, warm paper white, and one orange signal. Watch uses the same self-hosted sans family with a separate, readable streaming type scale and neutral controls. Missing artwork remains graceful in both systems. Watch's scoped rules supersede earlier chromatic storyworlds, orbit/canvas effects, tilted posters, and automatic hero rotation; those earlier directions do not govern this surface.

**Key Characteristics:**

- Near-black tonal layering instead of decorative panels.
- Warm orange remains the archive signal; Watch browsing uses white focus, progress, and active states.
- Sans-led Watch titles and metadata; the existing archive and Listen type roles remain scoped to their surfaces.
- Dense file tools and spacious entertainment surfaces in one coherent shell.
- Restrained interaction feedback that respects reduced motion; Watch's feature stays stable.

## Colors

The archive palette is almost monochrome until state or media calls for the warm signal color. Watch is an independent neutral dark surface, including when the application theme is light; its scoped variables apply while Watch is active.

Library inherits the shared dark/light variables from `public/chromatic.css`: `--night`, `--night-raised`, `--panel`, `--light`, `--muted`, `--accent`, and the existing divider and selection variables. Its toolbar, rows, and tiles use these same theme roles; there is no Library-only palette or new media color system.

### Primary

- **Signal Orange:** Marks established archive/Listen navigation, progress, focus, hover energy, and player buffering state.
- **Watch Action White:** Marks Watch playback actions, focus, the active local tab underline, and neutral interaction emphasis.

### Neutral

- **Archive Black:** Primary dark ground.
- **Deep Surface:** Header, drawer, dock, and quiet container ground.
- **Raised Surface:** Media fallbacks and elevated working surfaces.
- **Warm White:** Primary text and decisive controls.
- **Quiet Text:** Supporting prose and secondary labels.
- **Faint Text:** Timestamps, counts, and de-emphasized metadata.
- **Paper Ground / Paper Ink:** Intentional light-theme inversion rather than a white recolor.
- **Watch Ground / Header / Surface / Panel:** Separate neutral layers for the Watch canvas, shared header while browsing Watch, feature fallback, and supporting surfaces.
- **Watch Text / Muted / Quiet / Faint:** Neutral text roles, with sans metadata and persistent title labels.
- **Watch Line / Line Soft / Artwork Fallback / Progress:** Restrained separators, selected navigation ground, missing-art tiles, and playback progress. Artwork supplies the color; interface decoration does not.

**The Signal Rarity Rule.** In the archive and Listen, orange identifies interaction, progress, or current state; it does not become a decorative second background. Watch browsing uses neutral state treatments and preserves the shared brand and player where applicable.

**The Local Contrast Rule.** Secondary text is tinted from its surrounding ground and remains legible; neutral gray is not dropped indiscriminately onto colored media.

## Typography

**Display Font:** Vault Sans (self-hosted Geist, with a platform sans fallback)

**Body Font:** Vault Sans (self-hosted Geist, with a platform sans fallback)

**Label/Mono Font:** Vault Mono (self-hosted IBM Plex Mono, with a platform mono fallback)

**Character:** The sans is calm and contemporary rather than futuristic. The mono face is operational: it appears for paths, measurements, formats, time, and system state—not as technical decoration.

### Hierarchy

- **Display:** The established weight-610 role remains for Listen feature/album and major administration titles; Watch uses its separate display role.
- **Headline:** Compact, weight 570; section and rail headings.
- **Title:** Weight 600–650 at 14–16px for media and account identities; Library filenames use the smaller operating scale below.
- **Body:** Regular 13px with generous line height; descriptions stay near 52–54 characters per line inside cinematic fields.
- **Label:** Mono at 8–10px; uppercase only for measurements, state, or compact navigation data.

**The Two-Voice Rule.** In the established archive/Listen system, sans carries meaning and hierarchy and mono carries data and measurement. Library's compact data and Watch's content metadata use sans; the shared header retains its existing search typography.

Watch uses the frontmatter's dedicated display, rail heading, catalog heading, synopsis, poster title, and metadata roles. Episode titles are 17px/550 on desktop and 14px on phones. At 1000px and below synopsis text is 14px; at 700px and below the feature title is 39px, catalog titles 28px, rail headings 20px, poster titles 13px, and poster metadata 11px. At 1800px and above the feature title is 76px. Synopsis lines clamp to four on desktop and three on phones. Icon-font sizes are geometry, not text tokens.

Library deliberately uses sans for its compact data as well as names: 25px/600 for the heading (22px at 700px and below), 13px/500 for names and breadcrumbs, 12px for supporting copy and toolbar controls, and 11px for row metadata, counts, table labels, and actions. Mobile filenames reduce to 12px. Numeric metadata uses tabular figures. This 11/12/13/22/25px operating scale is separate from both Listen's established display scale and Watch's dedicated scale.

Icon-font `font-size` values describe glyph geometry, not text roles: shelf icons are 17px, Up is 18px, row folders are 24px, and grid folders are 38px. Do not add these to the typography ramp merely because they are implemented with an icon font.

## Layout

Desktop uses a 68px command bar, a 208px Library shelf rail, and a flexible content field. Library has a small heading with summary, followed by a 58px minimum-height breadcrumb toolbar. The file surface has 18px side padding, a 38px column header, and 49px minimum-height rows. Watch and Listen dismiss the shelf rail; Listen retains its established feature and rails.

Watch retains the shared header and uses an internally scrolling content pane. Its local Home / Movies / TV Shows navigation is 62px high. The home feature has a 570px minimum height and left-aligned copy within the shared Watch gutter; a horizontal/vertical scrim protects the text over the backdrop. Continue watching uses 16:9 cards, followed by upright 2:3 TV Shows and Movies poster rails. Rails overlap the feature's lower fade by 60px, with manual horizontal scrolling and optional arrow controls. Full catalogs use an auto-fill grid with a 170px minimum column, 28px row gaps, and 20px column gaps. Season artwork uses a 2:2.65 frame and 155–190px columns. Episode rows align number, 190px thumbnail, text, and options.

Watch adapts at 1000px to a 510px minimum feature, 145px minimum catalog columns, and 160px episode thumbnails. At 700px and below, the gutter is 20px, local navigation is 56px, artwork sits above the title within a 590px minimum home feature, and home rails overlap by 24px. Catalogs and seasons become two columns; poster rails use 145px cards and resume rails use 280px cards. Detail features have a 540px minimum height. Episode rows use a 110px thumbnail, flexible text, and a 30px options column; the redundant number column disappears. Desktop rail arrows disappear while touch scrolling remains. At 1800px and above, home features reach a 680px minimum and catalog columns a 205px minimum. These changes belong only to Watch.

At 1100px and below, the Library rail becomes 180px and rows reduce to selection, name, and size. Wide desktop rows retain size, shelf, and added metadata on hover and focus; actions live in the context menu rather than replacing those columns. Non-hover input and phone layouts add one persistent Options control beside the size. At 940px the command bar becomes a two-row tablet header. At 700px the layout becomes one vertical flow: shelves and entertainment links become horizontal bands, the toolbar wraps, and file-surface side padding reduces to 12px. Mobile rows have a 48px minimum height. Primary navigation, New folder, and Upload remain directly reachable; protected owner tools stay behind Manage on wider screens. Listen's existing mobile media scrollers and the full-viewport player retain their established styling.

Library grid uses auto-filled columns with a 180px minimum. Each tile keeps its checkbox separate from its open target and uses the same context-menu actions as rows; touch and phone layouts provide the persistent Options control. Selected rows and tiles use the existing orange-tinted selection surface, with an accent border on tiles.

Shared links occupies the same Library workspace and sidebar. Its desktop rows align file identity, status, expiry, remaining downloads, and actions without card decoration. At 1200px and below actions move beneath the data; at 700px and below each entry stacks with full-width identity and status, paired labelled expiry/download values, and reachable Copy link and Revoke controls.

Archive spacing follows a compact 4/8/12 rhythm inside controls and an 18/26 rhythm between surfaces. Headings receive more space above than below. Watch uses its own responsive gutter, rail gap, and rail separation from the frontmatter.

## Elevation & Depth

The archive and Listen combine tonal layers with soft ambient depth. Working rows and navigation stay flat; established media cards, the music dock, and the player use broad shadows over active content. Watch relies on neutral tonal layers and a readability scrim, without ornamental card shadows or glow. Its poster hover/focus moves the art upward by 4px and brightens it slightly over 220ms; play overlays fade over 180ms. Watch never automatically rotates its feature, and reduced motion removes transitions and smooth scrolling.

### Shadow Vocabulary

- **Media Lift** (`0 26px 70px rgba(0,0,0,.32)`): Established media rails outside the new Watch surface.
- **Floating Surface** (`0 30px 90px rgba(0,0,0,.52)`): Music dock and album artwork on the dark ground.
- **Paper Lift** (`0 28px 70px rgba(40,34,26,.17)`): Equivalent depth in light mode.

**The Flat-Until-Useful Rule.** File management is tonal and flat; depth appears where playback, hover, or protected focus makes it meaningful.

## Shapes

Compact work controls use 5–7px corners. Established Listen media and owner surfaces use 12–16px corners. Pills remain part of those surfaces and shared controls. Watch uses its dedicated small radii for shared-space tab selection, rectangular playback controls, and upright artwork; circular outlines are reserved for rail arrows and options. No tilted posters or decorative orbit framing belong to Watch.

Library refines that compact vocabulary: 4px view-toggle buttons, 5px menu and bulk Download actions, 6px toolbar controls, ZIP fields, and mobile shelf bands, 7px grid tiles and context menus, and a 9px bulk-action surface. These are corner sizes, independent of the text and icon scales.

## Components

### Buttons

- **Scope:** These established button rules apply outside Watch's dedicated controls. Watch primary/secondary actions use the frontmatter's rectangular variants, with a 46px minimum height (44px on phones), neutral gray hover, and a 2px white focus outline with 4px offset.
- **Shape:** Decisive actions are compact pills; icon-only transport controls are circles.
- **Primary:** Warm-white fill on the dark ground; orange appears on hover.
- **Hover / Focus:** Short color change with a 2px orange focus ring and 3px offset.
- **Secondary / Ghost:** Transparent or deep-surface fill with a single quiet border.

### Cards / Containers

- **Scope:** The following established card vocabulary belongs to Listen and other existing media surfaces. Watch poster, resume, season, and episode artwork use the smaller Watch artwork radius and the layout ratios above.
- **Corner Style:** 14px for media and album cards; 16px for feature fields.
- **Background:** Tonal dark surfaces with real artwork when available and restrained mineral fallbacks when absent.
- **Shadow Strategy:** Flat at rest for files; media cards lift and scale slightly on hover or keyboard focus.
- **Border:** One quiet divider or one ambient shadow, except protected player/admin layers where both encode separation and focus.

### Inputs / Fields

- **Watch:** The shared search receives a neutral near-black ground and gray border. Local sort and season selects use Watch Surface, a quiet gray border, 4px corners, and 13px sans; keyboard focus remains white.
- **Style:** 38px height, 7px corner, translucent near-black fill, and one quiet border.
- **Focus:** Orange outline outside the control; never a colored glow replacing contrast.
- **Error / Disabled:** Copy names the failure or unavailable capability; disabled actions remain visibly inactive.

### Navigation

Outside Watch, the three primary spaces live in a segmented pill and the active space inverts to warm white. Shelf navigation uses compact rows with orange state marks. On phones both shelf groups scroll horizontally while the primary navigation stays fully visible. In Watch, the shared switcher loses its pill enclosure and the active tab uses a small-radius neutral gray ground; local navigation uses a white underline. Library, Listen, search, and existing owner entry points remain available in the shared shell.

### Library Hierarchy and File Tools

All files presents non-media shelves as folders rather than flattening their contents. Entering a shelf or folder exposes its immediate children; breadcrumbs and Up preserve that hierarchy. Search stays within the active Library scope and searches descendants. Movies, series, and music shelves are excluded from All files and its search. Their lower-left shortcuts open an explicit file-browsing scope with the same folder tools. Only the top Watch and Listen tabs enter the playback surfaces.

Right-clicking empty Library space opens the same compact menu with New file and New folder. Creation uses the current folder; All files offers a shelf picker. New files are empty and default to Untitled.txt. Item context menus retain their existing actions.

Names, selection, and the layout's metadata columns stay visible on hover and keyboard focus. Rows and grid tiles use a compact context menu for file operations, with a persistent Options control on touch and phone layouts. The bulk surface reports selection and exposes applicable actions, including Create ZIP. Keep folder navigation, downloading, sharing, and owner tools practical without introducing a Library hero, decorative metrics, or a new visual world.

### Established Media Card (outside Watch)

The image dominates in a wide cinematic frame. Hover or focus adds a shallow scale, darkens the lower image field, and reveals year, progress or rating, a two-line overview, genres, and a circular action. Poster grids are reserved for full-library browsing. The same information remains available in detail views for non-hover input.

### Watch Titles, Seasons, and Episodes

Home features the most recently resumed title when available, otherwise the first catalog title. It remains stable until navigation or state changes. Continue watching cards play directly and retain a separate title/detail target plus persistent Options. Posters keep title and year/season count below the art, opening movie details or a show's seasons. A season opens its ordered episode rows, with All seasons, a season picker, and Season options. Back and browser history preserve the hierarchy. Specials and unsorted episodes have explicit labels; these groups reflect existing file paths without moving them.

Episode image and title targets play the file; watched text or resume percentage stays visible, with neutral progress bars and persistent Options. Movie details retain playback and optional cast/genres plus Versions & extras. Per-file and season options reuse the established action sheet for applicable download, progress, subtitles, and conversion tools. Artwork enriches the view through existing metadata and thumbnail sources; neutral title/icon fallbacks preserve browsing and playback if it fails. Empty catalogs offer Open Library, and empty search offers Clear search. No new shipping raster assets were added for this Watch surface.

### Player

Controls float over the video rather than occupying a permanent panel. Transport is icon-led; episode context sits in the top strip on wide screens, the close control owns the opposite corner, buffering uses the orange orbital signal, and advanced utilities recede before core playback controls.

### File Selection, Actions, and Navigation

An ordinary click neither selects an item nor opens a menu; it establishes the range anchor. Double-click opens the item. Checkboxes and Ctrl/Cmd-click toggle selection; Shift-click selects the inclusive range in the current visible sort order, while Ctrl/Cmd+Shift-click adds that range to the selection. Right-click, the keyboard context-menu key, or Shift+F10 opens the compact action menu without changing selection. Touch and phone layouts expose the same menu through Options. The body-level menu remains inside the viewport, offers keyboard navigation and Escape, and uses shared panel, divider, accent, and text tokens. Dragging an unchecked item moves that item without selecting it; dragging a checked item moves the checked selection. Download is available in the menu and bulk controls; folders download as ZIP archives. Move and delete support folders as well as files, while shelf roots remain protected.

Folders, shelf shortcuts, and breadcrumbs accept internal drag-and-drop moves with an accent outline. Move to… provides a folder browser with an explicit Move here button. Destructive actions retain confirmation and name that folders include their contents. Back, Forward, and Up remain beside the breadcrumbs; browser/mouse history follows folder and space navigation. The existing dialog history shares the same location state.

### Document Reader

Document previews share the existing full-screen viewer, filename, Download, Close, and browser Back behavior. PDFs use the native browser reader. DOCX and Markdown show a simplified, read-only paper surface with restrained serif prose, clear headings, tables, and a readable line length. Legacy Word shows extracted text; LaTeX and other text formats use wrapped monospace source. The paper surface remains light for document contrast in either application theme and becomes edge-to-edge on phones. Loading and failure states keep the original download available. Uploaded markup is sanitized, runs inside a sandbox without scripts, and cannot fetch remote images.

### ZIP Creation

Create ZIP in Vault uses the existing compact dialog surface, with Archive name and Save in fields, an inline error, and a status line. The fields use shared panel, text, and divider colors with 6px corners and 13px sans text. The job can run in the background; progress names the work, and successful completion states the saved destination before offering Download ZIP. Creating a saved archive remains distinct from the existing direct ZIP download action.

### Shared Links

The Shared links sidebar entry opens a navigable Library view using the existing small heading, sans operating scale, flat dividers, and dark/light theme variables. Global search matches file paths, labels, and owners; the local filter offers All links, Active, and Inactive, alongside Refresh. Each entry shows filename and path, optional label, owner, textual status, relative and absolute expiry, remaining downloads and used count. Unlimited and no-expiry values remain explicit. Supporting copy explains that media opens count against download limits and copying a link does not.

Copy link is disabled for inactive links. Revoke opens the existing confirmation dialog and names the affected file. Loading, refresh errors with retry guidance, no links, and no matching links all remain within the same quiet working surface. Phone rows show their own data labels as the column header disappears. These tools extend the established compact archive vocabulary without adding a palette, media treatment, or new visual identity.

## Do's and Don'ts

### Do:

- **Do** keep filenames, permissions, folders, and primary actions legible before adding spectacle.
- **Do** keep Library's shelf-root hierarchy, breadcrumbs, compact sans scale, stable metadata, and context-menu actions together as one operating surface.
- **Do** use artwork-led, neutral Watch browsing while preserving the established Library, Listen, administration, and playback systems.
- **Do** provide a graceful local fallback when thumbnails or remote metadata are unavailable.
- **Do** mirror media hover disclosure with keyboard focus and persistent detail views.
- **Do** keep Watch's feature stable, respect reduced motion, and preserve show → season → episode navigation and browser history.

### Don't:

- **Don't** apply Watch's explicitly selected Netflix / HBO / Emby conventions to Library or Listen, or revive storyworlds, orbit/canvas effects, tilted posters, or automatic hero rotation in Watch.
- **Don't** use orange as a decorative page wash or distribute many competing accent colors.
- **Don't** hide archive navigation or owner access to make a media screen look cleaner.
- **Don't** use mono for body copy, large headings, or atmosphere.
- **Don't** interpret icon sizes as typography tokens or apply one surface's typography, colors, and corner scale to another.
- **Don't** make metadata, artwork, transcoding, or network access prerequisites for reaching the original file.
