<!-- impeccable:product-schema 1 -->

# Vault product context

## Product

Vault is a self-hosted private library for files and personal media. It combines conventional file storage and sharing with dedicated entertainment experiences for movies, television, and music.

## Platform

web

## Users

- A technically confident owner administering a private server and media collection.
- Trusted household members or friends with shelf-scoped accounts.
- People who expect a polished streaming experience without giving up direct access to their original files.

## Purpose

Make a large mixed collection feel understandable and pleasurable to use: browse folders, find files, share or download them, then move naturally into cinematic watching or focused listening when the file is media.

## Positioning

Vault is a personal archive with a conventional streaming-service layer. The user explicitly chose Spotify’s composition for Listen, with charcoal panels and a light-blue default accent, and Netflix / HBO / Emby conventions for Watch: clean artwork-led browsing, title details, and a show → season → episode hierarchy.

## Operating context

- Self-hosted Express application used primarily on desktop, with responsive support for tablets and phones.
- Collections may contain imperfect filenames, nested folders, alternate cuts, loose tracks, full seasons, and very large files.
- The interface must remain useful when remote metadata, poster artwork, thumbnails, or transcoding are unavailable.
- Dark mode is the primary environment; an intentional light mode remains supported.

## Core capabilities

- Browse, search, sort, upload, move, rename, delete, download, and share files and folders.
- Create and manage shelves with server-enforced account access.
- Browse movies and shows as grouped entertainment libraries with progress, details, cast, recommendations, and episode navigation.
- Browse and play music by albums and tracks, with a persistent player, queue, shuffle/repeat, liked songs, and browser-local playlists per account.
- Customize the shared accent palette and optional icon-only section navigation from Appearance.
- Play browser-native video or prepare MKV/HLS streams with quality selection, subtitles, AI subtitles, theatre mode, picture-in-picture, and progress tracking.
- Convert MKV to MP4, inspect activity, manage accounts and API tokens, and monitor storage.
- Enrich local media automatically while keeping local filenames and files as the source of truth.

## Brand commitments

- Name: Vault.
- Library retains its approved folder workspace. The September 2026 Watch redesign uses a conventional streaming-service interface; Listen replaces the Chromatic prototype with Spotify-style library, album, track, queue, and player composition in grey and blue.
- The product should feel cinematic and editorial, but remain a serious power-user tool.

## Evidence and constraints

- Existing production routes, DOM hooks, permissions, server-side path validation, storage, streaming, and account behavior are working product truth and must be preserved.
- Existing cyan terminal styling is an anti-reference for the redesign, not a requirement.
- The shared top bar uses compact utility icons, optional icon-only section tabs, and centered search. Appearance provides six accent palettes, a default reset, and the Library light/dark preference; choices persist in this browser.
- Default accents are orange in Library/Watch and light blue in Listen. Explicit palette choices apply across the site. Watch and Listen retain dark playback backgrounds.
- Listen organizes existing Music files; it does not access a Spotify catalog. Playlists, favorites, and recent listening stay local to this account in this browser.
- Watch uses stable artwork-led features, poster rows and title grids, with secondary file operations behind menus. Its hierarchy is presentation only: existing file paths remain unchanged.
- The player should be icon-led, restrained, and professional, retain the useful episode top bar, and provide a distinct buffering state.
- Metadata enrichment must fail softly and be cached; the collection must remain usable offline.

## Design principles

1. The archive stays legible: navigation, filenames, permissions, and actions never disappear behind spectacle.
2. Media earns atmosphere: artwork, motion, and depth are concentrated in Watch, Listen, and playback.
3. Progressive disclosure over permanent clutter: show supporting metadata and secondary controls when relevant.
4. Distinct work and entertainment environments, with navigation that keeps file management separate from playback.
5. Motion communicates state or reveals detail; it never delays the primary action.
6. Local truth first: metadata improves presentation but cannot become a dependency for access.

## Accessibility

- Keyboard access, visible focus, descriptive labels, and usable target sizes are required.
- Reduced-motion preferences disable automatic rotation and nonessential transforms.
- Text and essential controls meet strong contrast on both themes.
- Hover-only information is also available through focus and detail views.


## Apps and metadata scanning — September 2026

- Apps is the fourth top-level section, after Listen. It extends the quiet Library visual language with a compact personal tool directory and a full-width embedded workspace. FlowForge’s existing hosted browser app is the initial entry.
- Each account can add, edit and remove web apps, choose embedded or new-tab opening, and save installed Office document launch links. Browser applications and native desktop applications remain distinct; native Excel cannot run inside an iframe.
- Watch’s local navigation exposes Scan metadata beside Search. Scans run in the background for Movies, TV Shows or both on Home, retry cached misses, and report progress and unmatched titles. Movie metadata requires a TMDB API key; administrators can configure it from the scan panel. TVmaze remains available for shows without setup.


## Integrated video player — September 2026

- Playback opens in edge-to-edge theater mode beneath the shared header. Fullscreen and a compact docked mini-player use the same video element and stream. Changing sections docks an open video; the mini-player leaves the library usable.
- Transport keeps play/pause, icon-only ten-second skips, a hover/focus volume slider, buffered progress, and a numeric buffered-ahead readout. Picture-in-picture and the mini-player action sit in the top-right corner.
- A custom animated V mark represents preparation/buffering, with reduced-motion support. Short seeks avoid flashing the buffering overlay; seeks inside downloaded HLS segments keep the current encoder session.
- Subtitles always open a selector, including loading, empty and failed lookup states. AI subtitle generation, enable/disable, cancellation and failure status belong inside this selector; generated tracks and timing offsets remain reusable.
- Bottom-right Settings holds Original/direct, 4K/1080p/720p, speed, viewing modes, MP4 conversion and stream details. New playback always tries Original first. Conversion qualities require the server encoder; the UI explains when unavailable.
- Shows use a bottom-right episode panel with a season selector, thumbnails, titles and watched/current state. Playback surfaces remain dark and use the readable dark variant of the selected accent, including when Library is in light mode.


## Player refinements — September 2026

- Preserve the approved theater aesthetic. Mini-player gains direct dragging, four-corner 16:9 resizing, remembered placement, viewport bounds and keyboard equivalents. Menus stay on screen after moving the player.
- A viewing-control toggle immediately left of picture-in-picture hides or restores navigation in theater; remember the preference and restore navigation in mini mode or on close.
- Episodes gain a restrained thumbnail zoom and play reveal on hover/focus, with reduced-motion support. The volume rail and pointer target become taller without changing transport grouping.
- AI subtitle generation offers explicit Fast/Balanced/Detailed choices, keeps configured defaults, reports actual CPU/GPU progress and approximate remaining time, and retains detailed CUDA diagnostics. GPU batching, CPU fallback and a temporary automatic-mode CUDA cooldown improve speed/recovery without promising a measured server speedup. The user's original CUDA error is not yet available.


## Subtitle activation reliability — September 2026

- Remember AI enablement before transcription completes; preserve it across player closure and page refresh. Resume pending job checks and activate real saved captions. Respect an explicit Off or alternate-track choice made while decoding.
- Keep activation visibly loading until track delivery succeeds; failures expose Retry loading subtitles without rerunning inference. Empty generated tracks expose regeneration, and the worker rejects no-speech output.
- CPU fallback is a recoverable generation state, independent of whether captions are selected. The reported server CUDA cause remains unconfirmed without its GPU/runtime details.
