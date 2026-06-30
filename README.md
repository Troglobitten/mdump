# mdump

A self-hosted, web-based markdown note-taking app. Notes are stored as plain `.md` files on disk — no database, no lock-in. Runs as a single Docker container.

## Features

- **WYSIWYG editor** powered by Milkdown Crepe (ProseMirror + Remark)
- **Flat-file storage** — notes are standard `.md` files, editable by any text editor
- **Multiple tabs** with auto-save and dirty state tracking
- **Full-text search** across all notes
- **Document outline panel** — clickable h1–h6 heading list in the sidebar
- **File attachments** — upload images and files alongside notes
- **Split editing** — WYSIWYG, source, or side-by-side view
- **Customisable toolbar** — reorder, show/hide buttons
- **Theming** — 33 DaisyUI themes, custom editor fonts, font size, spacing
- **HTTPS** — native TLS support without a reverse proxy
- **Single-user auth** with bcrypt-hashed password

## Quick Start

```bash
docker run -d \
  --name mdump \
  -p 8080:8080 \
  -e SESSION_SECRET=$(openssl rand -base64 32) \
  -v mdump-notes:/data/notes \
  -v mdump-config:/data/config \
  ghcr.io/troglobitten/mdump:main
```

Open `http://localhost:8080` and create your account on first run.

### Docker Compose

```yaml
services:
  mdump:
    image: ghcr.io/troglobitten/mdump:main
    ports:
      - "8080:8080"
    volumes:
      - mdump-notes:/data/notes
      - mdump-config:/data/config
    environment:
      # Optional: provide your own secret. If unset, mdump generates a random
      # one and persists it under /data/config on first run.
      - SESSION_SECRET=${SESSION_SECRET:-}
    restart: unless-stopped

volumes:
  mdump-notes:
  mdump-config:
```

## Data

Everything lives under `/data`:

| Path | Persist? | Contents |
|------|----------|----------|
| `/data/notes` | **Yes** | Markdown files and attachments |
| `/data/config` | **Yes** | Settings, sessions, auth, generated session secret |
| `/data/.image-cache` | Optional | Resized-image cache (regenerated on demand; safe to discard) |

Mount volumes for `notes` and `config` (the examples above do). The image cache
is ephemeral — give it a volume only if you want resized thumbnails to survive
restarts. The search index (`/data/.search-index.json`) is also regenerated
automatically.

Attachments live in hidden `.{notename}/` folders alongside each note (e.g. `meeting-notes.md` → `.meeting-notes/`).

## Backup & restore

To back up, stop the container and copy the **`notes`** and **`config`**
volumes (config holds your credentials and session secret). The image cache and
search index can be ignored — they rebuild automatically.

```bash
docker run --rm \
  -v mdump-notes:/notes -v mdump-config:/config \
  -v "$(pwd):/backup" alpine \
  tar czf /backup/mdump-backup.tar.gz -C / notes config
```

Restore by extracting the archive back into the same two volumes.

## HTTPS / TLS

mdump supports native HTTPS without a reverse proxy. Set both variables to enable it:

| Variable | Description |
|----------|-------------|
| `TLS_CERT` | Path to the TLS certificate file (inside the container) |
| `TLS_KEY` | Path to the TLS private key file (inside the container) |

```yaml
    volumes:
      - /path/to/certs:/data/certs:ro
    environment:
      - TLS_CERT=/data/certs/cert.pem
      - TLS_KEY=/data/certs/key.pem
```

For a self-signed cert (local testing):

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
```

### Behind a reverse proxy

If you terminate TLS at a reverse proxy (nginx, Caddy, Traefik, …) instead of
using the built-in TLS, set `TRUST_PROXY=1` so secure cookies and per-client
rate limiting work correctly. Make sure the proxy forwards WebSocket upgrades
for `/ws` (e.g. nginx `proxy_set_header Upgrade $http_upgrade;` and
`proxy_set_header Connection "upgrade";`).

## Development

```bash
pnpm install
pnpm dev        # runs client (port 5173) and server (port 8080) concurrently
```

```bash
pnpm --filter client build   # production client build
pnpm --filter server build   # production server build
```

## Tech Stack

- **Backend**: Node.js 20, Express 4, TypeScript
- **Frontend**: Vue 3 (Composition API), Vite, Tailwind CSS 3, DaisyUI 4
- **Editor**: Milkdown Crepe 7 (ProseMirror + Remark)
- **Package manager**: pnpm (monorepo)

## Disclaimer

Built with the help of [Claude](https://claude.ai) (Anthropic). Use at your own risk.

## License

MIT
