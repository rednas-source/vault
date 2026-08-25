# VAULT

A private file vault for you and a handful of friends. Upload, sort, stream, download — from a browser or a terminal.

Runs on your own hardware. No cloud storage, no third party holding your library.

---

## What it does

- **Shelves.** Files are sorted onto shelves by type on upload, or filed by hand. You define the shelves and the rules.
- **Streams video and audio** with range requests, so seeking works and nothing has to download in full before it plays.
- **Video thumbnails** in grid view, including for formats browsers can't play.
- **Chunked, resumable uploads.** Large files go up in slices, so an interrupted transfer continues instead of restarting.
- **Real folders.** Create folders in a shelf, choose a whole folder, or drag one onto the page; nested paths are preserved.
- **Accounts with per-shelf access.** Each member sees only the shelves you give them.
- **API tokens and a CLI**, for moving files in and out from a terminal or a script.
- **Plays MKV in the browser.** Choose 720p, 1080p, 4K, or Original; Vault auto-detects NVENC, Quick Sync, or VAAPI and falls back to CPU when needed.
- **Converts MKV to MP4.** Background jobs keep the source, report progress, and use the same GPU-aware quality profiles.
- **Hover a video tile** to scrub through nine frames from across its runtime.
- **Episodes collapse into seasons** automatically, from the filename.
- **Bulk select**, move, and delete.
- **An activity log**, so "where did that file go" has an answer.
- **A health endpoint** for uptime monitoring, which detects a dropped mount.
- **Share links** — hand someone a URL for one file, no account needed.
- **Resume where you left off**, per person, with a Continue watching rail.
- **Subtitles**, embedded or sidecar, converted on the fly.
- **Poster art** from TMDB, optional.
- **Light and dark themes.**

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
| `activityMax` | Optional. Activity entries retained, default 4000. |
| `tmdbKey` | Optional. Enables poster art. Leave out to keep it off. |

**Create the first account.** Add a temporary block to `config.json`:

```json
"users": { "yourname": "a-long-passphrase" }
```

Start the app once. It hashes that password into `users.json`, makes the account an admin, and tells you so. Then delete the `users` block — it's never read again, and there's no reason to leave a password sitting in a file.

**For thumbnails and MKV playback**, install ffmpeg and ffprobe. Vault uses a working GPU H.264 encoder when one is available, with `libx264` as the dependable fallback:

```bash
apt install -y ffmpeg
```

On startup, check the `Media transcoder:` line or `/api/health`. It reports `NVIDIA NVENC`, `Intel Quick Sync`, `VAAPI GPU`, or `CPU libx264`. If auto-detection cannot access a GPU, make sure the `vault.service` user can access the GPU device/driver; for VAAPI this commonly means membership in the `render` group.

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

**Share** on any file row. Pick an expiry and a maximum number of opens, and you get a URL anyone can use without an account. Video plays in place — including MKV, which is prepared the same way it is inside the app.

The page a recipient sees is deliberately self-contained: one file, its name and size, a player, a download button. No listing, no navigation, nothing about the rest of the vault.

**All links** shows everything you've shared, with open counts, and revokes instantly. Admins see everyone's.

What a link is scoped to:

- one file, re-resolved on every request — if it's renamed or deleted the link stops working
- read only; there is no path parameter to manipulate
- expiry and open-count limits, both enforced server-side
- range requests don't count as opens, so seeking a video doesn't burn a use-limited link

The permission that created it is checked at creation, not at use. A link outliving its creator's access is intentional — it's the same as handing someone a copy. Revoke it if that isn't what you want.

> **If Cloudflare Access guards your hostname, share links will not work.** Recipients hit the email prompt and never reach Vault. To fix it, add a second policy to your Access application with **Action: Bypass**, **Include: Everyone**, and a path of `/s` — then add another for `/api/share`. That exempts only the share routes; everything else still requires sign-in. Do this deliberately: those paths are then genuinely public, which is the point, but it's worth understanding before you enable it.

---

## Watch state

Playback position is remembered per person. Partly-watched files show a progress bar on their tile and appear in a **Continue watching** rail at the top; finished ones are dimmed and marked.

Position is reported every few seconds and once more when the player closes. Duration comes from ffprobe rather than the video element, because a live-remuxed stream reports whatever it has buffered rather than the real length. Anything past 92% counts as finished.

Kept in `progress.json`, capped at 2000 entries per person.

---

## Subtitles

Tracks embedded in the container and sidecar files beside it (`Film.srt`, `Film.en.srt`) both appear in the player's track menu, converted to WebVTT on demand.

Sidecar files are hidden from the file listing when they belong to a video that's also there — they're part of that item, not separate library entries. An orphaned subtitle with no matching video is still listed, since that's a file you might want to find.

---

## Poster art

Off unless you add a TMDB key:

```json
"tmdbKey": "your-key-from-themoviedb.org"
```

With it, grid tiles show real posters instead of frame grabs, and titles are replaced with the matched name and year. Results are cached under `.meta` in your storage path; **Clear** them by calling `POST /api/meta/clear` as an admin.

Matching works from the filename, so it will sometimes be wrong. `Blade Runner 2049 (2017)` correctly yields the 2017 film rather than reading 2049 as the year, and `Arcane - S01E03` searches for the show rather than a film. But a filename with no useful title in it won't match anything, and a wrong match is possible — anything TMDB doesn't recognise simply keeps its video frame.

This is the one feature I could not test against the live API, since it needs your key. If it misbehaves, `POST /api/meta/clear` and check what `guessed` comes back in `/api/meta/<path>`.

---

## Playing and converting MKV

Browsers never shipped dependable Matroska support. Vault therefore produces two-second HLS segments, which also avoids Cloudflare Tunnel buffering one endless response. The player offers 720p, 1080p, 4K, and Original. Original stream-copies browser-safe H.264/AAC without quality loss; incompatible HEVC, AV1, DTS, TrueHD, and similar tracks are converted to H.264/AAC while preserving source resolution.

Auto mode tests the actual encoder rather than trusting ffmpeg's compiled encoder list. It prefers NVIDIA NVENC, then Intel Quick Sync, then VAAPI for Intel/AMD, and finally `libx264`. `/api/health` exposes both `transcoder` and `gpuTranscode`, so you can prove what the systemd process can access.

Pause terminates the private ffmpeg/HLS session and stores the exact logical timestamp. Play, seek, or a quality change starts a new session at that point. This is intentional: it prevents a paused live playlist from advancing invisibly and frees the GPU immediately.

Choose **MP4** in a file row or player to create a durable copy beside the source. Compatible Original jobs are quick remuxes; other quality choices use the selected hardware encoder. The source is never replaced. One conversion runs at a time by default (`convertJobs`), while `remuxStreams` controls simultaneous viewers.

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
{ "ok": true, "storage": "ok", "freeMB": 246850, "thumbnails": true, "uptimeSec": 8134 }
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

## Day to day

Drop files or whole folders anywhere on the page, or press **Upload** and choose **files** or **folder**. Folder structure is preserved. Use **New folder** inside a shelf to create an empty folder directly. Files over 80 MB automatically use the chunked path.

Video and audio stream with seeking. Images open inline. Tick the boxes to select several files, then move or delete them together. **Share** hands out a link for one file.

`/` focuses search, `j` and `k` move a row cursor, `Enter` opens, `Backspace` deletes, `?` lists the keys.

**Navigation.** Every panel and dialog is a history entry, so the browser's Back — including a mouse's back button — closes the top layer instead of leaving the site. Clicking the dimmed area outside a dialog or panel does the same, as does Escape. All three go through one path, so they can't fall out of step.

**The player** is built for this rather than being the browser's default. Space or `k` plays and pauses, arrows skip ten seconds, `j` and `l` skip thirty, `m` mutes, `f` is fullscreen, `c` opens the subtitle menu. Volume is remembered between files. On a prepared MKV stream, seeking restarts from the chosen second; on a native file it seeks normally. Either way the bar behaves the same.

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
- Share links are 24 random bytes, resolve to exactly one file, and take no path parameter. Public playback obeys the same stream cap as signed-in playback, so a link can't be used to spawn unlimited encoders.
- Subtitle sidecar names are resolved through the same path check as everything else, so a track id can't reach outside the file's own folder.

What it deliberately doesn't do: virus scanning, read-only permissions, or per-file ownership. Anyone with access to a shelf can delete anything on it. That's the right model for a few friends and the wrong one for anything larger.

Deleting a shelf never deletes files — you nominate somewhere for the contents and they're moved first.

**Files are not backed up.** The vault is a single copy on a single machine. Point a backup tool at `storagePath` if the contents matter — and separately at `users.json`, `config.json`, `shelves.json`, `shares.json`, and `progress.json`, which hold your accounts, session secret, shelf definitions, live share links, and watch history.
