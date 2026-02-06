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
