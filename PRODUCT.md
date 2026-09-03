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

Vault is not a generic cloud drive with a media skin and not a Netflix clone. It is a personal archive with a premium entertainment layer: tactile, private, capable, and visibly its own thing.

## Operating context

- Self-hosted Express application used primarily on desktop, with responsive support for tablets and phones.
- Collections may contain imperfect filenames, nested folders, alternate cuts, loose tracks, full seasons, and very large files.
- The interface must remain useful when remote metadata, poster artwork, thumbnails, or transcoding are unavailable.
- Dark mode is the primary environment; an intentional light mode remains supported.

## Core capabilities

- Browse, search, sort, upload, move, rename, delete, download, and share files and folders.
- Create and manage shelves with server-enforced account access.
- Browse movies and shows as grouped entertainment libraries with progress, details, cast, recommendations, and episode navigation.
- Browse and play music by albums, folders, and tracks.
- Play browser-native video or prepare MKV/HLS streams with quality selection, subtitles, AI subtitles, theatre mode, picture-in-picture, and progress tracking.
- Convert MKV to MP4, inspect activity, manage accounts and API tokens, and monitor storage.
- Enrich local media automatically while keeping local filenames and files as the source of truth.

## Brand commitments

- Name: Vault.
- The user selected the Chromatic Vault prototype as the binding replacement direction for the production interface.
- The product should feel cinematic and editorial, but remain a serious power-user tool.

## Evidence and constraints

- Existing production routes, DOM hooks, permissions, server-side path validation, storage, streaming, and account behavior are working product truth and must be preserved.
- Existing cyan terminal styling is an anti-reference for the redesign, not a requirement.
- The approved prototype combines the Chromatic Cinema top bar and Listen language with the Soft Kinetic file workspace.
- Entertainment cards need richer, smooth hover disclosure and quiet automatic rotation that pauses on user interaction and respects reduced motion.
- The player should be icon-led, restrained, and professional, retain the useful episode top bar, and provide a distinct buffering state.
- Metadata enrichment must fail softly and be cached; the collection must remain usable offline.

## Design principles

1. The archive stays legible: navigation, filenames, permissions, and actions never disappear behind spectacle.
2. Media earns atmosphere: artwork, motion, and depth are concentrated in Watch, Listen, and playback.
3. Progressive disclosure over permanent clutter: show supporting metadata and secondary controls when relevant.
4. One visual language across owner tools and entertainment, with density calibrated per task.
5. Motion communicates state or reveals detail; it never delays the primary action.
6. Local truth first: metadata improves presentation but cannot become a dependency for access.

## Accessibility

- Keyboard access, visible focus, descriptive labels, and usable target sizes are required.
- Reduced-motion preferences disable automatic rotation and nonessential transforms.
- Text and essential controls meet strong contrast on both themes.
- Hover-only information is also available through focus and detail views.
