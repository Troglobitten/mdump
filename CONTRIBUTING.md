# Contributing to mdump

Thanks for your interest in improving mdump!

## Development setup

mdump is a pnpm monorepo (`server`, `client`, `shared`).

```bash
pnpm install
pnpm dev          # runs client (5173) and server (8080) concurrently
```

Other useful commands:

```bash
pnpm build        # build shared + client + server
pnpm lint         # ESLint across the workspace
pnpm test         # Vitest (server unit tests)
pnpm format       # Prettier
```

## Branching & releases

- **`dev`** is the default working branch. All code changes go here; pushing to
  `dev` builds the `:dev` Docker image for testing.
- **`main`** receives merges from `dev` for releases only and is tagged
  `vX.Y.Z`. Never commit directly to `main`.
- The version in the root `package.json` only changes in a dedicated
  `Release vX.Y.Z` commit. See `docs/versioning-protocol.md` for the full
  protocol and how the MAJOR/MINOR/PATCH bump is decided.

## Pull requests

1. Branch from `dev`.
2. Make your change; keep `pnpm build`, `pnpm lint`, and `pnpm test` green.
3. Add or update tests where it makes sense (especially around path handling,
   filename validation, and auth).
4. Open the PR against `dev` with a clear description.

## Editor changes

When adding editor functionality, use Milkdown's plugin system (commands,
plugins, context) rather than DOM manipulation or synthetic events. See
`CLAUDE.md` for details.

**Upgrading Milkdown:** the root `package.json` pins `@milkdown/ctx` via a
`pnpm.overrides` entry. `@milkdown-lab/plugin-split-editing` (which powers the
Source view) declares a loose `@milkdown/ctx ^7.4.0`, and without the override
pnpm keeps an older `ctx` for the plugin while Crepe uses the newer one — two
copies of a class with `#private` fields, which fails type-checking. Bump the
override's version in lockstep with any `@milkdown/*` upgrade so a single `ctx`
resolves for everything.

## Reporting bugs / requesting features

Use the issue templates. For security issues, follow `SECURITY.md` instead of
opening a public issue.
