# Security Policy

## Supported versions

mdump is released as rolling Docker images. Security fixes are applied to the
latest release on the `main` branch (and the `:main` / latest version tag).
Please run a current image before reporting an issue.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately via GitHub's
[private vulnerability reporting](https://github.com/Troglobitten/mdump/security/advisories/new)
("Report a vulnerability" under the repository's *Security* tab).

When reporting, please include:

- A description of the vulnerability and its impact
- Steps to reproduce (proof of concept if possible)
- The mdump version / image tag and your deployment setup (HTTPS, reverse proxy, etc.)

You can expect an initial acknowledgement within a few days. Once a fix is
released, we're happy to credit you in the release notes unless you prefer to
remain anonymous.

## Deployment hardening

mdump is intended to be self-hosted. For a secure deployment:

- Always set a strong `SESSION_SECRET` (or let the app generate and persist one).
- Serve over HTTPS — either via the built-in TLS support (`TLS_CERT` / `TLS_KEY`)
  or a reverse proxy (set `TRUST_PROXY=1` when behind one).
- Restrict network exposure to trusted networks where possible.
- Keep the image up to date.
