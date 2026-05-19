# PhotoSocial

Remote-friendly, pass-and-shoot photobooth collage web app.

**Tagline:** Everyone's camera. One shared memory.

## Quick start

Requires Node 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm --filter @photosocial/shared build
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3001
- Health: http://localhost:3001/health

Optional: copy `.env.example` to `apps/api/.env` for Supabase (opt-in cloud storage) or Mailpit (local email on port 1025).

## Monorepo

| Package | Description |
|---------|-------------|
| `apps/web` | Vite + React PWA |
| `apps/api` | Hono + Socket.IO, ephemeral session storage |
| `packages/shared` | Types, Zod schemas, themes, layouts |

## Scripts

```bash
pnpm dev          # Run web + API
pnpm build        # Build all packages
pnpm typecheck    # Typecheck all packages
pnpm test:e2e     # Playwright E2E (starts dev servers)
```

## Privacy

Sessions are stored in memory and temp files on the local API server. Data is purged when sessions expire (24h max, 2h idle). Cloud upload (Supabase) only happens when a user explicitly consents on the export screen.

## Docs

See [docs/SPEC.md](docs/SPEC.md), [docs/FUNCTION.md](docs/FUNCTION.md), and [docs/DESIGN_PHILOSOPHY.md](docs/DESIGN_PHILOSOPHY.md).
