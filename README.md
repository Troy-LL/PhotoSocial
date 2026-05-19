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
- PartyKit: http://127.0.0.1:1999 (realtime rooms)
- Health: http://localhost:3001/health

Copy `.env.example` to `apps/api/.env` and set `JWT_SECRET`, `PARTYKIT_HOST`, and `PARTYKIT_BROADCAST_SECRET` (must match `apps/party/.env`). Optional: Supabase (opt-in cloud storage) or Mailpit (local email on port 1025).

For party mode realtime, all three processes must run (`pnpm dev` starts web, API, and PartyKit).

## Monorepo

| Package | Description |
|---------|-------------|
| `apps/web` | Vite + React PWA |
| `apps/api` | Hono REST, ephemeral session storage |
| `apps/party` | PartyKit realtime (one room per session) |
| `packages/shared` | Types, Zod schemas, themes, layouts |

## Scripts

```bash
pnpm dev          # Run web + API
pnpm build        # Build all packages
pnpm typecheck    # Typecheck all packages
pnpm test:e2e     # Playwright E2E (starts dev servers)
```

## Privacy

Sessions are stored in memory and temp files on the API server. Individual slot photos are deleted when the host locks the collage; the server-rendered final collage is kept for about 1 hour for email export, then removed. Full session cleanup happens on expiry (24h max, 2h idle). Cloud upload (Supabase) only happens when a user explicitly consents on the export screen.

## Deploy (Vercel + PartyKit)

- **Web:** root `vercel.json` — set `VITE_API_URL` and `VITE_PARTYKIT_HOST`.
- **PartyKit:** `pnpm --filter @photosocial/party deploy` — set `JWT_SECRET` and `PARTYKIT_BROADCAST_SECRET` in the PartyKit dashboard (same values as the API).
- **API:** host on Railway, Render, or Fly with `DATA_DIR` volume; set `PARTYKIT_HOST` to your PartyKit host.

## Docs

See [docs/SPEC.md](docs/SPEC.md), [docs/FUNCTION.md](docs/FUNCTION.md), and [docs/DESIGN_PHILOSOPHY.md](docs/DESIGN_PHILOSOPHY.md).
