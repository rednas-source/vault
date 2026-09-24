# VAULT

A private file vault for you and a handful of friends. Upload, sort, stream, download — from a browser or a terminal.

Runs on your own hardware. No cloud storage, no third party holding your library.

---

## What it does

- **Reusable game assets.** Assets sits above Entertainment in the Library sidebar. Keep a model, preview, textures, rig, animations, sources and import notes in one searchable package; filter by style/category/collection, inspect self-contained GLBs and embedded animation clips in 3D, and download complete packages. File/folder imports preserve related files and support resumable uploads. See [ASSETS.md](ASSETS.md) for package preparation, permissions and viewer limits.
- **Asset workbench.** Search tags in the Assets search field, choose small/medium/large grids or a list, and select packages without reloading their previews. Bulk-edit metadata, move packages to reversible Trash, and restore them. Type and Relationship filters find textures, animations and other connected model content; VFX and Source files have explicit types. The 3D panel expands or enters fullscreen and offers textured/solid/wireframe surfaces, bones, clip seeking, speed, loop and temporary preview ranges. Add files to matching assets joins prepared source add-ons to existing cards by source ID and collection. The optional 35-file Amber Road Blender collection contains editable GLB conversions with packed textures and 12 confirmed rigs/animation sets; it does not recover original sculpt history.
- **Folder-first Library.** All files opens your working shelves as folders. Browse with breadcrumbs and Up (Alt+Up), or search within the current shelf/folder and its descendants. Movies, shows, and music stay out of All files; their lower-left shortcuts open their file folders. The top Watch and Listen tabs open playback libraries.
- **Shelves.** Files are sorted onto shelves by type on upload, or filed by hand. Folder uploads use one chosen shelf so mixed file types stay together. You define the shelves and the rules.
- **Streams video and audio** with range requests, so seeking works and nothing has to download in full before it plays.
- **Video thumbnails** in grid view, including for formats browsers can't play.
- **Chunked, resumable uploads.** Large files go up in slices, so an interrupted transfer continues instead of restarting.
- **Real folders.** Create folders in a shelf, choose a whole folder, or drag one onto the page; nested paths are preserved.
- **Accounts with per-shelf access.** Each member sees only the shelves you give them.
- **API tokens and a CLI**, for moving files in and out from a terminal or a script.
- **Plays MKV in the browser.** Choose 720p, 1080p, 4K, or Original; Vault auto-detects NVENC, Quick Sync, or VAAPI and falls back to CPU when needed.
- **Converts MKV to MP4.** Background jobs report progress, use the same GPU-aware quality profiles, and can safely replace a verified source.
- **Hover a video tile** to scrub through nine frames from across its runtime.
- **Watch: shows → seasons → episodes.** Browse a cinematic Home, Movies, or TV Shows catalog. Open one show, choose a season, then play an episode. Folder names and episode markers determine the hierarchy without moving files on disk; generic episode names are supported inside season folders. Browser Back/Forward remembers each level. Resume progress, watched state, downloads, conversion, and AI subtitles remain available through focused menus. Watch and Listen use dark playback environments; Library retains its light/dark preference.
- **Bulk select and Get.** Select files or folders in list or grid view and download one streamed ZIP with nested paths preserved. Folder downloads include empty directories. Files and folders can both be moved or deleted; shelf roots are protected.
- **Explorer interactions.** Single-click leaves items unselected. Use checkboxes or Ctrl/Cmd-click to toggle items, and Shift-click to select the inclusive range in the current sort order (Ctrl/Cmd+Shift adds that range). Right-click for actions, and double-click to open. Touch devices keep a compact options button. Download returns files directly or folders as ZIPs; Download ZIP also packages an individual file. Drag files or folders onto a folder, shelf, or breadcrumb to move them; dragging a checked item moves the checked selection. Move to… lets you choose a nested destination.
- **Document reading.** Double-click PDFs, Word (`.docx`/`.doc`), Markdown, LaTeX, or plain-text files to read in the site. PDFs use the browser reader; DOCX and Markdown use a simplified reading view, older Word files show extracted text, and LaTeX shows source (no compilation). Unsupported formats still download automatically. Word previews support files up to 20 MB; text previews up to 2 MB. Encrypted, damaged, or overly complex documents keep an explicit Download option. Previews do not modify originals or send documents to an external service.
- **Create ZIP in Vault.** Create a ZIP from a file, folder, or checked selection using the context menu or bulk bar. Choose its name and destination; it appears as a normal file that can be downloaded or shared. ZIP creation runs in the background, preserves nested and empty folders, leaves originals intact, and never overwrites an existing archive. Up to two archive jobs run at once.
- **Shared links overview.** Open Shared links in the Library sidebar to search and filter your links, see the shared path, expiry countdown/date, remaining downloads/opens, and active, expired, exhausted, or missing-file status. Copy or revoke a link from the same view. Admins can manage all links; other accounts see only their own. Counters refresh while the view is open; media opens also consume use limits.
- **Column sorting.** Library defaults to natural name order (A–Z, with folders first). Click Name, Size, Shelf, or Added to toggle ascending/descending; the sort menu provides the same choices in grid and mobile views.
- **Folder history.** Browser/mouse Back and Forward, toolbar arrows, and Alt+Left/Right follow visited folders. Alt+Up goes to the parent.
- **Create from empty space.** Right-click the Library background for New file or New folder. New files start empty; the dialog defaults to `Untitled.txt`. Creation uses the current folder, or a chosen shelf from All files, and never overwrites an existing item.
- **Quiet file rows.** Names, size, shelf, and added date remain visible on hover. Actions live in the context menu, also accessible with Shift+F10 on a focused filename.
- **An activity log**, so "where did that file go" has an answer.
- **A health endpoint** for uptime monitoring, which detects a dropped mount.
- **Share links** — read-only files or editable folders, no account needed.
- **Resume where you left off**, per person, with a Continue watching rail.
- **Subtitles**, embedded or sidecar, converted on the fly.
- **Automatic media metadata.** TV shows fetch artwork, synopsis, cast, genres, and year automatically using TMDB when configured, with a key-free TVmaze fallback. New uploads start enrichment immediately; startup and a five-minute background scan pick up existing shows and files added directly on disk. Metadata is cached per show, with retries after temporary failures. Movies use TMDB when configured; music reads embedded tags first, then fills album, artist, year, and cover art from MusicBrainz and Cover Art Archive.
- **Entertainment libraries.** Movies and Shows get a streaming-service browser; Music gets its own Spotify-inspired library and persistent player.
- **Local AI subtitles.** Generate WebVTT sidecars with faster-whisper, on GPU when CUDA is available or CPU otherwise.
- **Spotify-style Listen.** Grey panels and blue accents, album pages, song search, liked songs, playlists, a queue, shuffle/repeat, and a persistent bottom player. Albums follow existing music folders without moving files. Favorites, playlists, and recent listening are saved per account in this browser.
- **Appearance options.** The top-right sliders icon opens orange, light blue, purple, green, rose, and gold accents; optional icon-only Library/Watch/Listen tabs; and Library light/dark themes. Preferences persist in this browser. Defaults use orange in Library/Watch and blue in Listen. Activity, Manage, and Add to Vault use labeled icon buttons, with a compact centered search field.

---

## Where this should live

Files on a machine you own, domain pointed at it through a Cloudflare Tunnel.

```
  friend's browser
        │  https://vault.example.com
        ▼
  Cloudflare edge  ──── encrypted tunnel ────►  your server
                                                 cloudflared
                                                     │
                                                 localhost:8420
                                                     │
                                                 your disks
```

A tunnel means no open ports on your router, your home IP never appears in public DNS, and you get a valid certificate without configuring one.

**The one limitation to plan around:** Cloudflare's free and Pro plans refuse any single request body over 100 MB, and a tunnel can't be set to bypass the proxy. Chunked uploads work around this by slicing large files, so uploading through the domain works — but if you're on the same network, uploading directly to the server's LAN address is faster and skips the edge entirely. Downloads are not split; converted video uses short HLS requests so the tunnel does not have to buffer one endless response.

---

## Install

Node.js 18 or newer.

```bash
git clone <your-repo> vault
cd vault
npm install
```

Create `config.json`:

```json
{
  "port": 8420,
  "bind": "127.0.0.1",
  "storagePath": "/mnt/vault",
  "sessionSecret": "paste-a-long-random-string-here",
  "sessionDays": 30,
  "maxFileGB": 64,
  "transcodeEncoder": "auto",
  "defaultTranscodeQuality": "1080",
  "remuxStreams": 3,
  "convertJobs": 1,
  "whisperModel": "small",
  "whisperDevice": "auto",
  "subtitleJobs": 1,
  "musicbrainzUserAgent": "Vault/1.0 (https://your-domain.example)",
  "https": true
}
```

| Key | What it does |
|---|---|
| `storagePath` | Where files actually go. Must exist and be writable. |
| `sessionSecret` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. The app refuses to start without one. |
| `bind` | `127.0.0.1` when behind a tunnel on the same machine. `0.0.0.0` to reach it across your LAN. |
| `maxFileGB` | Largest single upload allowed. |
| `https` | `true` adds the `Secure` flag to the session cookie. Set `false` only for plain-HTTP testing on localhost. |
| `thumbJobs` | Optional. Parallel ffmpeg processes, default 2. |
| `partTtlHours` | Optional. How long an abandoned partial upload is kept, default 24. |
| `remuxStreams` | Optional. Simultaneous live video conversions, default 3. |
| `transcodeEncoder` | Optional. `auto` probes NVIDIA NVENC, Intel Quick Sync, VAAPI (Intel/AMD), then CPU. May be pinned to `nvenc`, `qsv`, `vaapi`, or `cpu`. |
| `vaapiDevice` | Optional. VAAPI render device, default `/dev/dri/renderD128`. |
| `defaultTranscodeQuality` | Optional. `720`, `1080`, `2160`, or `original`; default `1080`. |
| `convertJobs` | Optional. Simultaneous background MP4 conversions, default 1. |
| `whisperPython` | Optional override. Vault automatically uses `/root/vault/.venv/bin/python` when installed by the included setup script, then falls back to `python3`. |
| `whisperModel` | Optional. `tiny`, `base`, `small`, `medium`, or `large-v3`; default `small` (the practical CPU balance). |
| `whisperDevice` | Optional. `auto`, `cuda`, or `cpu`; default `auto`. |
| `subtitleJobs` | Optional. Simultaneous AI subtitle jobs, default 1 and capped at 2. |
| `activityMax` | Optional. Activity entries retained, default 4000. |
| `tmdbKey` | Optional TMDB API key for movie metadata. Shows can use TVmaze without a key. Also configurable by admins in Watch. |
| `musicbrainzUserAgent` | Optional but recommended. A meaningful app/version/contact string sent to MusicBrainz, for example `Vault/1.0 (https://vault.example.com)`. |

**Create the first account.** Add a temporary block to `config.json`:

```json
"users": { "yourname": "a-long-passphrase" }
```

Start the app once. It hashes that password into `users.json`, makes the account an admin, and tells you so. Then delete the `users` block — it's never read again, and there's no reason to leave a password sitting in a file.

**For thumbnails and MKV playback**, install ffmpeg and ffprobe. Vault uses a working GPU H.264 encoder when one is available, with `libx264` as the dependable fallback:

```bash
apt install -y ffmpeg
```

On startup, check the `Media transcoder:` line or `/api/health`. It reports `NVIDIA NVENC`, `Intel Quick Sync`, `VAAPI GPU`, or `CPU libx264`. If auto-detection cannot access a GPU, `encoderDiagnostics` contains the failed real-world probe for each attempted encoder. An encoder appearing in `ffmpeg -encoders` only means the FFmpeg binary was compiled with support; it does not prove that a GPU or its driver is available to the container.

For a Proxmox container, first verify the GPU and driver on the **Proxmox host**, then pass its device nodes into the container. Intel/AMD VAAPI normally needs `/dev/dri/renderD128`; NVIDIA needs the `/dev/nvidia*` devices and a compatible driver stack. If none of those devices exist inside the container, Vault correctly falls back to CPU. The exact container mapping depends on the GPU and CT ID, so inspect the host and `pct config <CTID>` before changing the container configuration.

```bash
npm start
```

Open `http://localhost:8420`.

---

## Running it properly

`npm start` dies when you close the terminal. Use a service.

`/etc/systemd/system/vault.service`:

```ini
[Unit]
Description=Vault
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/root/vault
ExecStart=/usr/bin/node /root/vault/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now vault
systemctl status vault --no-pager
```

Startup should log three lines: the address it's listening on, the vault path, and whether thumbnails are available. If it crash-loops, `journalctl -u vault -n 30` will say why — `EADDRINUSE` means something else already holds the port.

---

## Putting it on a domain

Install cloudflared on the same machine, create a tunnel at `one.dash.cloudflare.com` → **Networks → Tunnels**, and run the `service install` command it gives you. Then add a public hostname pointing at `localhost:8420`. Cloudflare creates the DNS record itself.

**Then put Cloudflare Access in front of it.** This matters. Without it, your login page is exposed to the entire internet, and the only thing between a stranger and your files is one password against code that has never had a security review. With Access, visitors authenticate at Cloudflare's edge and bots never reach the app at all.

In Zero Trust: **Access controls → Applications → Add an application → Self-hosted**, point it at the same hostname, and add a policy allowing specific email addresses. Free for up to 50 users.

---

## Shelves

**Shelves** in the header, for admins. Create, rename, reorder, delete.

Each shelf has a **name** you can change freely and an **id** — the folder name on disk, derived from the name when the shelf is created. The id never changes, so renaming a shelf doesn't move a single file.

**File types** drive auto-sort. Assign `mkv mp4 avi` to a shelf and uploads of those types land there. Leave the list empty for a shelf you file by hand — Series works this way, since no extension can tell an episode from a film.

**Order matters.** Auto-sort takes the first shelf whose list contains the extension, so a type repeated further down never fires. The app tells you when that happens rather than leaving you puzzled; use the arrows to reorder.

**Deleting a shelf never deletes files.** If it holds anything, you must nominate another shelf for the contents, and they're moved before the shelf goes. Name collisions get `(1)` appended rather than overwriting. The shelf is also removed from every account's permissions on the way out.

Shelves live in `shelves.json`. If that file is missing or unreadable, the app rebuilds the defaults.

The normal Movies, Series, and Music shelves remain ordinary file views. **Library**, **Watch**, and **Listen** in the command bar open the richer experiences without changing where files live or how permissions work. Watch groups movies, shows, seasons, alternate cuts, episode progress, cast, and related titles; its featured title rotates quietly while the page is idle. Hover or focus a title to reveal its rating, genres, and overview. Every episode keeps quick controls for playback, progress, download, AI subtitles, and MP4 replacement. Listen reads embedded audio tags automatically and uses MusicBrainz plus Cover Art Archive as a cached, rate-limited fallback for albums and artwork. The music player stays docked while browsing.

---

## Accounts

**Accounts** in the header, for admins.

- **Shelves** — pick which shelves an account can reach. Everything else is hidden, and blocked at the server rather than just in the sidebar. Admins always see everything.
- **New password** — signs that person out everywhere within one request.
- **Suspend** — blocks sign-in and kills active sessions without deleting the account. Usually what you want when someone goes quiet.
- **Tokens** — see below.

Two rules the panel won't let you break: you can't delete or suspend your own account, and you can't remove the last admin. Both would lock you out of your own server.

Passwords are scrypt hashes with individual salts. Nothing in `users.json` can be read back into a password, which is why the panel offers "new password" rather than showing the old one.

**If you lock yourself out**, stop the app, delete `users.json`, put a temporary `users` block back in `config.json`, and start it again.

---

## The CLI

`vault` is a shell script for moving files from a terminal.

```bash
sudo install -m755 vault /usr/local/bin/vault
```

Create `~/.vaultrc`:

```
VAULT_URL=https://vault.example.com
VAULT_TOKEN=vlt_xxxxxxxxxxxx_yyyy
```

```bash
chmod 600 ~/.vaultrc
```

Generate the token in **Accounts → Tokens**. It's shown once — only a hash is stored — and it inherits that account's shelves, so a token for a Movies-only member can't reach anything else. Revoking it, suspending the account, or changing its shelves all take effect immediately.

```bash
vault whoami                      # account and its shelves
vault ls                          # everything you can see
vault ls movies                   # one shelf
vault get "Blade Runner 2049.mkv" # download, resumes a partial file
vault put ~/film.mkv movies       # upload, resumes if interrupted
vault mv movies/x.mkv series
vault rm series/x.mkv
```

`put` uses the chunked path, so a large upload that dies partway continues from where it stopped when you run the same command again.

**If Cloudflare Access guards the hostname**, a token alone isn't enough — Access doesn't know about Vault's tokens. Create a service token in **Access controls → Service credentials**, add a **Service Auth** policy to the application, and add both values to `~/.vaultrc`:

```
CF_ACCESS_CLIENT_ID=xxxx.access
CF_ACCESS_CLIENT_SECRET=yyyy
```

Browsers still get the email prompt; scripts skip it.

On a machine inside your network, point `VAULT_URL` at the LAN address instead and skip all of this.

---

## Share links

**Share** works on both files and folders:

- A file link remains read-only. Pick an expiry and an optional maximum number of opens; the recipient can watch or download that one file without an account.
- A folder link is a collaborative workspace. Anyone holding it can browse only that folder, upload files or complete folder trees, create subfolders, rename items, download files, and delete files or folders. Folder links use expiry and explicit revocation rather than an open count.

Folder recipients get a responsive, self-contained file browser with drag-and-drop, folder picking, per-file progress, and resumable chunk uploads. Large files are split below Cloudflare's request-size ceiling. They never see the signed-in Vault interface, other shelves, sibling folders, accounts, or server metadata.

**All links** labels editable folders separately and revokes either kind immediately. Admins see everyone's links. Every folder request and every upload chunk re-checks the token and expiry, so revoking a link also stops an in-progress upload from accepting more data.

The folder boundary is enforced server-side. Paths are parsed as strict relative segments, every existing segment is checked without following symlinks, and create/rename/delete/upload targets must remain below the original shared root. File links retain their original single-file route and open-count behavior.

The permission that created a link is checked at creation, not at use. A link outliving its creator's shelf access is intentional — it is a capability you handed out. Revoke it if that is no longer wanted.

> **If Cloudflare Access guards your hostname, share links will not work.** Recipients hit the email prompt and never reach Vault. To fix it, add a second policy to your Access application with **Action: Bypass**, **Include: Everyone**, and a path of `/s` — then add another for `/api/share`. That exempts only the share routes; everything else still requires sign-in. Do this deliberately: those paths are then genuinely public, which is the point, but it is worth understanding before you enable it.

---

## Watch state

Playback position is remembered per person. Partly-watched files show a progress bar on their tile and appear in a **Continue watching** rail at the top; finished ones are dimmed and marked.

Position is reported every few seconds and once more when the player closes. Duration comes from ffprobe rather than the video element, because a live-remuxed stream reports whatever it has buffered rather than the real length. Anything past 92% counts as finished.

Kept in `progress.json`, capped at 2000 entries per person.

---

## Subtitles

Text tracks embedded in the container and sidecar files beside it (`Film.srt`, `Film.en.srt`) both appear by name in the player's CC menu, converted to WebVTT on demand. Each track has a -10 to +10 second sync control: negative displays captions earlier, positive delays them, and the browser remembers the setting for that file and track. Bitmap-only PGS/VobSub tracks cannot be rendered as WebVTT; use AI CC for those.

Sidecar files are hidden from the file listing when they belong to a video that's also there — they're part of that item, not separate library entries. An orphaned subtitle with no matching video is still listed, since that's a file you might want to find.

The player plus movie and show detail pages can generate local AI subtitles. Install the isolated Python environment with the included setup script:

```bash
cd /root/vault
bash scripts/install-ai-subtitles.sh
sudo systemctl restart vault.service
curl -s http://127.0.0.1:8420/api/health
```

Vault detects that environment automatically. The health response reports `aiSubtitles: true` when it is ready and includes `aiSubtitleDiagnostics` when it is not. Generated tracks are stored next to the video as `Title.ai.vtt` (or `Title.ai.en.vtt` when a language is selected), so they are reusable and move with the library. `whisperDevice: "auto"` tries CUDA first and falls back to CPU; it works on CPU now and can use CUDA later when GPU passthrough is configured.

The first generation with a model downloads that model once. Vault reports the loading and transcription phases in the activity rail, writes cues incrementally instead of holding an episode in memory, and refreshes the open player's CC list as soon as the WebVTT file is ready. CPU jobs default to the `small` model with greedy decoding. If a selected model or CUDA process fails, the same job automatically retries once with the lighter `base` CPU path and surfaces the exact final error if that also fails.

---

## Poster art

TV shows enrich automatically without setup through [TVmaze](https://www.tvmaze.com/api). A show folder such as `Breaking Bad (2008)/Season 1/01 - Pilot.mkv`, or a filename containing `S01E01`, provides the identity. All episodes share one cached show record. New uploads trigger lookup immediately, and startup plus a five-minute scan cover files added outside the website. Successful results refresh after seven days; unmatched titles retry after six hours and network failures after five minutes. Existing artwork remains usable during an outage. Metadata source attribution appears in show details.

In **Watch → Scan metadata → Metadata settings**, an administrator can save a TMDB API key to enable movie artwork and prefer TMDB for shows. The key is validated and stored server-side in `.metadata-settings.json` under the storage path; it is never returned to the browser. Alternatively, set it in `config.json`:

```json
"tmdbKey": "your-key-from-themoviedb.org"
```

With it, grid tiles show real posters instead of frame grabs, and titles are replaced with the matched name and year. The Movies entertainment library groups alternate versions, suppresses samples/trailers/extras, chooses the main feature, and sends movie-shelf lookups only to TMDB's movie search. Nothing is deleted—the complete file shelf still exposes every source file. Movie results and show records are cached under `.meta` in your storage path; **Clear** them by calling `POST /api/meta/clear` as an admin.

Matching uses the show folder or filename and an optional release year, so it can still be wrong. Unrecognizable titles keep their local fallback. `Blade Runner 2049 (2017)` correctly yields the 2017 film rather than reading 2049 as the year, and `Arcane - S01E03` searches for the show rather than a film. But a filename with no useful title in it won't match anything, and a wrong match is possible — anything TMDB doesn't recognise simply keeps its video frame.

Use **Scan metadata** beside Watch’s search button to retry cached misses and refresh artwork. Movies and TV Shows scan their own catalog; Home scans both. One background scan runs per account, respects shelf access, and reports matched counts and titles needing attention. Movie misses expire after six hours; provider failures retry after five minutes. No file paths are changed. The legacy admin-only cache-clear endpoint remains available.

---

## Playing and converting MKV

Browsers never shipped dependable Matroska support. Vault therefore produces two-second HLS segments, which also avoids Cloudflare Tunnel buffering one endless response. The player offers 720p, 1080p, 4K, and Original. Original stream-copies browser-safe H.264/AAC without quality loss; incompatible HEVC, AV1, DTS, TrueHD, and similar tracks are converted to H.264/AAC while preserving source resolution.

Auto mode tests the actual encoder rather than trusting ffmpeg's compiled encoder list. It prefers NVIDIA NVENC, then Intel Quick Sync, then VAAPI for Intel/AMD, and finally `libx264`. `/api/health` exposes both `transcoder` and `gpuTranscode`, so you can prove what the systemd process can access.

Pause preserves the browser's downloaded segments and continues filling that same buffer to a five-minute ceiling. At the ceiling Vault stops HLS downloads and freezes the private ffmpeg process, so the paused encoder consumes no CPU and cannot grow the cache indefinitely. Resume starts immediately from the local buffer while ffmpeg wakes in the background. Seeking, changing quality, closing the player, or leaving an abandoned paused session for 30 minutes releases it.

Choose **MP4** in a file row or player to create a durable copy. Compatible Original jobs are quick remuxes; other quality choices use the selected hardware encoder. Individual conversions can keep the MKV or replace it. Show and season actions use replacement mode: Vault writes the MP4 to scratch space, atomically commits it, verifies that it contains a readable video stream, and only then deletes the MKV. A failed conversion or verification keeps the source. If an MP4 with the same name already exists, replacement is refused instead of creating a duplicate or overwriting anything. One conversion runs at a time by default (`convertJobs`), while `remuxStreams` controls simultaneous viewers. CPU conversion threads are capped at two by default (`convertThreads`). If ffmpeg is killed by the container or an encoder fails, Vault reports the signal and automatically retries once with single-threaded, low-memory x264 instead of surfacing the old meaningless `code null` error.

---

## Seasons

Files like `Arcane - S01E03` collapse into a single row reading "Season 1 · 4 episodes". Click to expand. `S01E03`, `1x03`, and `Season 1 Episode 3` are all recognised, and anything unrecognised stays exactly where it was — a wrong guess that hides files would be worse than a flat list.

Two episodes minimum: a lone file isn't a season. The **SERIES** button in the toolbar turns grouping off entirely.

---

## Activity

**Activity** in the header, for admins. Uploads, deletions, renames, moves, account and shelf changes, and failed sign-ins, newest first.

This exists because of a deliberate gap: anyone with access to a shelf can delete anything on it. That's the right model for a few friends, but without a record there's no way to answer what happened. The log doesn't prevent anything — it just means you can find out.

Kept in `activity.log`, capped at 4000 entries (`activityMax`), written in batches so a busy upload doesn't mean a write per chunk.

---

## Monitoring

`/api/health` needs no authentication and returns nothing sensitive — no paths, no account names, no file counts. Point an uptime monitor at it.

```json
{ "ok": true, "build": "vault-five-minute-pause-buffer-20260826", "storage": "ok", "thumbnails": true, "transcoder": "CPU libx264", "gpuTranscode": false, "aiSubtitles": true }
```

It returns **503** when something is actually wrong. `storage` is the useful field:

| Value | Meaning |
|---|---|
| `ok` | Writable, shelves present. |
| `unwritable` | The storage path rejected a write. |
| `detached` | Writable but every shelf folder is missing — almost certainly a dropped network mount. |
| `incomplete` | Some shelf folders are missing. |

That `detached` case is the one worth having. If an NFS mount drops, the path reverts to an empty local directory that writes perfectly well — a plain liveness check would report healthy while every upload landed on the wrong disk.

---

## Verified automatic deployment

This follows the same release shape as the Padel app, adapted for Vault's existing non-Docker systemd service:

1. A push to `main` runs `npm ci`, server and browser syntax checks, and file-operation/document-preview tests in GitHub Actions.
2. Only a successful workflow promotes that exact commit to the mutable `production` branch.
3. A systemd timer on the server checks `production` every five minutes (plus up to 20 seconds of jitter).
4. A new commit is pulled with `--ff-only`, dependencies are installed, syntax is checked again, and `vault.service` is restarted.
5. `/api/health` must become healthy within 90 seconds. Otherwise the checkout, dependencies, and service are rolled back to the previous commit.

After pushing these files and letting the first GitHub workflow create the `production` branch, install the updater once on the server:

```bash
cd /root/vault
git pull --ff-only
sudo sh deploy/install-auto-update.sh
```

Check it at any time with:

```bash
systemctl status vault-update.timer --no-pager
systemctl status vault-update.service --no-pager
journalctl -u vault-update.service -n 100 --no-pager
```

The defaults match this server: `/root/vault`, `vault.service`, and `http://127.0.0.1:8420/api/health`. They can be overridden with `VAULT_REPO`, `VAULT_SERVICE`, `VAULT_DEPLOY_BRANCH`, and `VAULT_HEALTH_URL` in a systemd override. A private GitHub repository also needs a read-capable deploy key or credential configured for the checkout's `origin`. The updater refuses to touch a checkout with tracked local changes.

If GitHub branch protection blocks the workflow from updating `production`, allow GitHub Actions to write repository contents or exempt that promotion branch. Do not point the timer at `main`: the `production` branch is the gate that ensures a failed check never reaches the server.

---

## Day to day

Drop files or whole folders anywhere on the page, or press **Upload** and choose **files** or **folder**. Folder structure is preserved. Use **New folder** inside a shelf to create an empty folder directly. Files over 80 MB automatically use the chunked path.

Video and audio stream with seeking. Images open inline. Tick the boxes to select several files, then move or delete them together. **Share** creates a read-only file link or an editable folder workspace.

`/` focuses search, `j` and `k` move a row cursor, `Enter` opens, `Backspace` deletes, `?` lists the keys.

**Navigation.** Every panel and dialog is a history entry, so the browser's Back — including a mouse's back button — closes the top layer instead of leaving the site. Clicking the dimmed area outside a dialog or panel does the same, as does Escape. All three go through one path, so they can't fall out of step.

**The player** is built for this rather than being the browser's default. Space or `k` plays and pauses, arrows skip ten seconds, `j` and `l` skip thirty, `m` mutes, `f` is fullscreen, `c` opens the subtitle menu. Volume, subtitle choice, and subtitle timing offset are remembered between files. The cyan bar behind playback shows how far the browser has buffered, while the control row reports the amount of playable time ahead. Converted streams target a three-minute desktop look-ahead (smaller on phones); on a prepared MKV stream, seeking restarts from the chosen second, while a native MP4 seeks normally.

In grid view, hovering a video sweeps through nine frames from across its runtime — useful for telling two rips apart without opening either.

MP4 and WebM play natively. MKV is either repackaged or converted to browser-compatible H.264/AAC on the fly (see above). If ffmpeg is unavailable or a file has no video stream, Vault gives a clear explanation and offers a VLC link.

---

## What's protecting this

- Passwords compared in constant time; five wrong guesses locks an IP out for ten minutes.
- Session cookie is HMAC-signed, `HttpOnly`, and `Secure`. Sessions carry a version, so a password reset or suspension invalidates them immediately.
- API tokens are random 32-byte secrets stored as SHA-256 digests, compared in constant time.
- Every client-supplied path is resolved and checked against the vault root before anything touches disk. Shelf permissions are enforced on listing, streaming, download, thumbnails, upload, rename, move, and delete — and move checks both ends.
- Uploaded filenames and folder segments are stripped of unsafe characters, and traversal paths are rejected. Collisions get `(1)` appended rather than overwriting.
- ffmpeg is invoked with an argument array, never a shell string, so a filename can't inject a command.
- Chunked uploads verify the final byte count before the file is moved into place. A short upload is refused rather than silently saved truncated.
- Bulk actions check every file individually, so a selection spanning shelves can't let a permitted file carry a forbidden one along with it.
- Live ffmpeg jobs are killed when the viewer disconnects, and bounded by a maximum lifetime so a client that vanishes without closing its connection can't leak a process.
- Share links are 24 random bytes. File links resolve to exactly one file. Folder links accept paths only through a strict shared-root jail, reject symlinks, and re-check revocation for every operation and upload chunk. Public playback obeys the same stream cap as signed-in playback, so a link cannot spawn unlimited encoders.
- Collaborative uploads use the same maximum-file-size cap and exact final-byte verification as signed-in chunked uploads.
- Subtitle sidecar names are resolved through the same path check as everything else, so a track id can't reach outside the file's own folder.

What it deliberately doesn't do: virus scanning, read-only permissions, or per-file ownership. Anyone with access to a shelf can delete anything on it. That's the right model for a few friends and the wrong one for anything larger.

Deleting a shelf never deletes files — you nominate somewhere for the contents and they're moved first.

**Files are not backed up.** The vault is a single copy on a single machine. Point a backup tool at `storagePath` if the contents matter — and separately at `users.json`, `config.json`, `shelves.json`, `shares.json`, and `progress.json`, which hold your accounts, session secret, shelf definitions, live share links, and watch history.


## Library verification

Run `npm run check` for server/client syntax and `npm test` for archive regression tests (nested selections, empty folders, path traversal, shelf restrictions, and symlinks). Folder and bulk downloads use streaming ZIP64 archives, retaining shelf paths to avoid duplicate-name collisions across shelves. The archive endpoint rechecks access for every selected shelf and does not follow symbolic links.


## Apps (experimental)

The **Apps** tab to the right of Listen keeps a personal list of projects and software. FlowForge is included using its existing hosted web app, with Visio import and the editor available inside Vault. Add, edit or remove entries; lists are stored per account in `.apps` under the storage path.

Choose **Vault** for an embedded web app, **New browser tab** for sites that block embedding, or **Desktop** for an installed Office application’s document link (for example `ms-excel:ofe|u|https://example.com/workbook.xlsx`). Desktop links open the installed app; they do not run Excel inside the browser. Arbitrary executable commands and file-system URLs are not supported.

Embedded apps keep their own hosting, sign-in and storage. Vault does not copy their source or grant them access to the file library. The sandbox permits app scripts, forms, downloads and new windows, while preventing top-level navigation. A visible **Open in new tab** link handles sites whose sign-in or frame policy prevents embedding. FlowForge’s own browser autosave remains its source of truth; closing its workspace ends that embedded session.


## Video player

Video opens in **Theater** mode within the Vault shell. Use the top-right **Mini player** button to browse while playback continues, or **Fullscreen** at the bottom right. The top-right picture-in-picture button opens the browser’s separate video window when supported. Switching modes keeps the existing video element, buffer and stream.

The bottom bar keeps play/pause, ten-second rewind/forward, mute and a volume slider revealed on hover or keyboard focus. The timeline shows downloaded video and the adjacent readout shows contiguous buffered time ahead. Buffered HLS seeks reuse the session; unbuffered seeks prepare a stream at the requested position.

**Subtitles** always opens, even when no tracks exist. It includes track selection, per-track timing, and an **AI subtitles** switch. With the existing AI engine installed, turning it on generates and selects a reusable subtitle track; turning it off disables the track or cancels an active job. Generation progress and errors appear in the same menu. AI worker installation remains required for generation.

**Settings** contains quality, playback speed, viewing modes, MP4 conversion for MKV files, and stream details. Every new video begins with **Original / direct**, independent of the conversion dialog’s saved quality. Native-compatible files play directly; compatible MKV streams are copied into HLS. Unsupported native playback can fall back to the server encoder. The 4K, 1080p and 720p choices retain the current position and speed and require FFmpeg. Resume progress keeps the full source duration across quality changes.

The episode button opens seasons and episodes inside the player. Keyboard controls include Space/K for play, J/L and arrow keys for seeking, M for mute, F for fullscreen, T for theater/mini, and C for subtitles; focused sliders and menu controls keep their native keyboard behavior. Escape closes an open player menu before closing playback.


### Movable mini-player and theater navigation

Drag the mini-player by its title or picture and resize from any corner. Its size and position are remembered in this browser, with 16:9 sizing and viewport bounds. Focus the title and use arrow keys to move it; focus a corner and use arrows to resize (Shift makes larger steps). Menus reposition to stay on screen. The top-left button in the player's viewing controls toggles the site navigation in theater mode; the preference is remembered, and mini-player/closing playback restores navigation. Episode thumbnails gently zoom and reveal a play target on hover/focus, respecting reduced motion. The volume rail is 6px high inside a 36px pointing target.

### AI subtitle speed and GPU recovery

The subtitle menu offers **Fast** (`base`, quicker but less accurate), **Balanced** (`small`), and **Detailed** (`medium`, slower). Existing server model settings remain the default until a viewer chooses a profile. Generation reports preparation, actual CPU/GPU transcription, approximate time remaining once progress is available, and expandable failure details. First use of a model may require a download; completed subtitle files are reused.

GPU transcription uses supported 8-bit/FP16 computation and batches four chunks by default (`whisperBatchSize`: 1–8; use 1 to disable batching). CPU uses INT8 and serial decoding to limit memory. Both retain greedy decoding and remove silent stretches. Failed CUDA initialization or inference falls back to CPU, and automatic mode avoids another known CUDA failure for 30 minutes within the current server process. A crashed worker gets one lighter CPU/base retry. Duplicate requests for the same subtitle output cannot run concurrently.

A working NVIDIA GPU runtime is required for CUDA acceleration; Intel Quick Sync video acceleration does not provide CUDA speech recognition. Consult the [faster-whisper GPU requirements](https://github.com/SYSTRAN/faster-whisper#gpu) for compatible CUDA/cuDNN libraries and drivers. Read **Technical details** in the subtitle menu for the actual server error; a CPU fallback message is recoverable. These changes do not install drivers on the host. Speed depends on its hardware, chosen model and audio; no fixed speedup is promised.

Run `python3 tests/test_transcribe.py` to verify model selection, batched inference routing, GPU failure recovery and atomic subtitle publication with simulated inference dependencies. These tests need Python but do not download models or require a GPU.


AI subtitle activation is remembered as soon as generation starts, including jobs started from show/movie details. Closing the player or refreshing the page does not discard that choice: the player resumes checking the job and selects the saved AI track when ready. An explicit Off or another track selection is respected. Loading generated captions keeps the switch enabled; unavailable subtitle files show **Retry loading subtitles** without starting transcription again. Empty files show **Generate again**, and new silent/empty transcriptions report no speech rather than publishing an empty success. CPU fallback is independent of caption activation.

Subtitle appearance: the player defaults to plain white captions. The Subtitles menu includes Appearance & position with four font choices, four sizes, an optional black outline, and position reset. Drag captions with a mouse or touch, or focus them and use arrow keys (Shift for larger steps; Home resets). Appearance and position are remembered in this browser. Native video-only PiP/fullscreen caption presentation is controlled by the browser. New AI captions use word timestamps and split at speech gaps; old AI cues longer than 15 seconds are bounded to a 3–12 second reading duration in the player without rewriting the sidecar. External tracks retain their timestamps. Word alignment adds processing work; no transcription speedup is claimed.

On phones and tablets up to 900px wide, Listen provides Home/Search/Your Library bottom navigation, an active-track mini player, horizontal album browsing, and touch-sized song actions. Tap the mini-player artwork or title for full-screen Now playing, with seeking, transport, likes, shuffle/repeat, volume, and queue. Close, swipe down on its header, or use browser Back to return without stopping playback. Vault tools in the compact header retains upload and authorized management actions. Desktop Listen keeps its panels and transport.
