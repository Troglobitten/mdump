# mdump

A self-hosted, web-based markdown note-taking app. Notes are stored as plain `.md` files on disk — no database, no lock-in. Runs as a single Docker container.

## Quick Start

```bash
git clone https://github.com/yourusername/mdump.git
cd mdump

# Start with Docker Compose
SESSION_SECRET=$(openssl rand -base64 32) docker-compose -f docker/docker-compose.yml up -d
```

Open `http://localhost:8080` and create your account on first run.

Your notes live in a Docker volume at `/data/notes` and can be edited with any text editor.

## HTTPS / TLS

mdump supports native HTTPS without a reverse proxy. To enable it, provide paths to your TLS certificate and key via environment variables:

| Variable | Description |
|----------|-------------|
| `TLS_CERT` | Path to the TLS certificate file (inside the container) |
| `TLS_KEY` | Path to the TLS private key file (inside the container) |

When both are set, the server starts in HTTPS mode. When either is missing, it runs plain HTTP (the default).

### Docker Compose example with HTTPS

```yaml
services:
  mdump:
    image: ghcr.io/yourusername/mdump:latest
    ports:
      - "8443:8080"
    volumes:
      - mdump-notes:/data/notes
      - mdump-config:/data/config
      - mdump-cache:/data/.image-cache
      - /path/to/certs:/data/certs:ro
    environment:
      - SESSION_SECRET=your-secret-here
      - TLS_CERT=/data/certs/cert.pem
      - TLS_KEY=/data/certs/key.pem
```

### Startup logs

- **HTTP mode** (default): `Server running on http://localhost:8080`
- **HTTPS mode**: `Server running on https://localhost:8080 (TLS enabled)`
- **Invalid cert/key**: Error logged (e.g. `TLS certificate not found or not readable at: /data/certs/cert.pem`), falls back to HTTP with a warning

### Self-signed certificates

For local testing, you can generate a self-signed certificate:

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
```

Your browser will show a security warning for self-signed certs — this is expected.

## Development

```bash
pnpm install
pnpm dev
```

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: Vue 3, Vite, Tailwind CSS, DaisyUI
- **Editor**: Wysimark (WYSIWYG markdown)
- **Package Manager**: pnpm (monorepo)

## Disclaimer

This project was built with the help of [Claude](https://claude.ai) (Anthropic). Code quality is not guaranteed. Use at your own risk.

## License

MIT
