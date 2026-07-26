# DARKSTAR

A private file vault for you and a handful of friends. Upload, sort, stream, download.

---

## Where this should live

Short answer: **files on your local server PC, domain pointed at it through a Cloudflare Tunnel.**

Why not Plesk itself? Plesk hosting plans give you somewhere between 10 GB and a few hundred GB, and they charge accordingly. A movie and series library eats that in a weekend. Your local PC already has the disks. Plesk keeps doing what it's good at — owning the domain and its DNS.

Why a tunnel rather than port forwarding? A tunnel means no open ports on your router, your home IP address never appears in DNS, and you get a valid HTTPS certificate without configuring one. It's free and it takes about ten minutes.

```
  friend's browser
        │  https://vault.yourdomain.com
        ▼
  Cloudflare edge  ──── encrypted tunnel ────►  your PC
                                                 cloudflared
                                                     │
                                                 localhost:8420
                                                     │
                                                 your disks
```

---

## 1. Install

You need [Node.js 18 or newer](https://nodejs.org).

```bash
cd darkstar
npm install
```

`config.json` and `users.json` both ship ready to run, so there's nothing to copy or create. `config.example.json` is only a reference for the settings and their defaults — the app never reads it.

Open `config.json` and set four things:

| Key | What to put there |
|---|---|
| `storagePath` | Where files actually go. Windows: `"D:\\\\Vault"`. Linux: `"/srv/vault"`. Make sure the drive has room. |
| `sessionSecret` | A long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `maxFileGB` | Largest single upload you'll allow. Default 64. |
| `https` | `false` while testing on localhost, `true` once you're behind the tunnel. |

```json
{
  "port": 8420,
  "bind": "127.0.0.1",
  "storagePath": "D:\\Vault",
  "sessionSecret": "paste-your-random-hex-here",
  "sessionDays": 30,
  "maxFileGB": 64,
  "https": true
}
```

Accounts don't live here — they're in `users.json`, which the app writes and the admin panel manages.

Set `"bind": "127.0.0.1"` when you're using a tunnel — it makes the app unreachable from anywhere except the tunnel itself. Use `"0.0.0.0"` only if you want other machines on your LAN to reach it directly.

Then:

```bash
npm start
```

Open `http://localhost:8420` and sign in. If it works locally, the hard part is done.

---

## 2. Put it on your domain

### Install the tunnel

Download `cloudflared` from Cloudflare's site, then:

```bash
cloudflared tunnel login
cloudflared tunnel create darkstar
```

Create `config.yml` next to your cloudflared install:

```yaml
tunnel: darkstar
credentials-file: /path/printed/by/the/create/command.json

ingress:
  - hostname: vault.yourdomain.com
    service: http://localhost:8420
  - service: http_status:404
```

Run it:

```bash
cloudflared tunnel run darkstar
```

### Point the domain at it

Your domain has to use Cloudflare's nameservers for this. Add the site to a free Cloudflare account, and it'll give you two nameservers — put those in Plesk under **Domains → yourdomain.com → DNS Settings**, or at your registrar if that's where nameservers are managed. Plesk keeps hosting whatever else you run on the domain; only DNS moves.

Then create the DNS record:

```bash
cloudflared tunnel route dns darkstar vault.yourdomain.com
```

`https://vault.yourdomain.com` is now live, with a certificate, and your home IP is nowhere in public DNS.

### Two Cloudflare settings worth changing

- **Rules → Configuration Rules**, or the dashboard's upload limit: free plans cap uploads through the proxy at **100 MB per request**. That's fine for photos and music, useless for a 9 GB film. Two ways around it: pay for a plan with a higher cap, or upload big files over your LAN by browsing directly to the PC's local address, which skips Cloudflare entirely.
- **Speed → Caching**: turn caching off for this hostname so friends always see current files.

### If you'd rather not use a tunnel

Point an A record in Plesk DNS at your home IP, forward port 443 on your router to the PC, and run something like Caddy in front for the certificate. It works, but you're publishing your home IP, you'll need dynamic DNS unless your IP is static, and your router is now the thing standing between the internet and your file server. The tunnel avoids all three problems. Your call.

---

## 3. Keep it running

**Windows** — easiest is [NSSM](https://nssm.cc): `nssm install Darkstar` and point it at `node.exe` with `server.js` as the argument. Do the same for `cloudflared`.

**Linux** — `/etc/systemd/system/darkstar.service`:

```ini
[Unit]
Description=Darkstar vault
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/darkstar/server.js
WorkingDirectory=/opt/darkstar
Restart=always
User=darkstar

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now darkstar
```

---

## Accounts

Sign in as an admin and an **Accounts** button appears in the header. Members never see it.

From there you can create accounts, reset passwords, promote someone to admin, suspend an account without deleting it, and delete outright. Suspending is usually what you want when a friend goes quiet — it blocks sign-in and kills their active sessions, but keeps the account so you can flip it back.

Passwords are stored as scrypt hashes in `users.json`, each with its own random salt. Nothing in that file can be read back into a password, which is why the panel offers "new password" rather than showing the old one. Sessions carry a version number, so resetting a password or suspending an account signs that person out everywhere within one request — no waiting for a cookie to expire.

Two rules the panel enforces and you can't talk it out of: you can't delete or suspend your own account, and you can't remove the last admin. Promote someone else first.

If you ever lock yourself out completely, stop the app, delete `users.json`, put a temporary `users` block back in `config.json`, and start it again — it'll rebuild the account file from that and hash the password on the way in.

---

## How it works day to day

Drop files anywhere on the page, or hit **Upload**. Darkstar reads the extension and files each one on a shelf — video to Movies, audio to Music, and so on — or you pick a shelf yourself at upload time. Anything already on the wrong shelf can be moved later with **Move**; that's how you separate Series from Movies, since no amount of extension-sniffing can tell an episode from a film.

Video and audio stream with range requests, so seeking works and nothing has to download in full before it plays. Images open inline. `/` jumps to search, `Esc` closes whatever's open.

**On MKV**: browsers won't play it. It's a container Chrome and Safari never shipped support for, and there's no fix on the web side short of transcoding. Darkstar detects it and shows you a direct link you can paste into VLC, which handles it fine. MP4 and WebM play in the browser normally.

---

## What's protecting this

- Passwords compared in constant time; five wrong guesses locks an IP out for ten minutes.
- Sign-in cookie is HMAC-signed, `HttpOnly`, and `Secure`. No server-side session store, so restarting the app doesn't sign anyone out.
- Every path from the browser is resolved and checked against the vault root before anything touches disk — `../` and its encoded variants go nowhere.
- Uploaded filenames are stripped of path separators and control characters; collisions get `(1)` appended rather than overwriting.
- Everything except sign-in requires a valid session, including file streams and downloads.

What it deliberately doesn't do: virus scanning, per-user permissions, or any distinction between who uploaded what. Everyone you give an account to can see and delete everything. That's the right model for a few friends and the wrong one for anything larger.

**Files are not backed up.** The vault folder is a single copy on a single machine. If those disks die, the library is gone. Point a backup tool at `storagePath` if the contents matter.
