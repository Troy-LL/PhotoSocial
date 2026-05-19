# PhotoSocial

Remote-friendly photobooth collage app — everyone shoots on their own phone, one shared strip.

**Live app:** [https://photosocially.vercel.app](https://photosocially.vercel.app)

## Stack

| Package | Role |
|---------|------|
| [`apps/web`](apps/web) | React PWA (Vite) |
| [`apps/party`](apps/party) | PartyKit — sessions, photos, realtime |
| [`packages/shared`](packages/shared) | Types, Zod schemas, layouts, themes |

No separate Node API. Party mode talks to PartyKit over HTTPS + WebSocket.

## Quick start

Requires **Node 20+** and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm --filter @photosocial/shared build
pnpm dev
```

| Service | URL |
|---------|-----|
| Web | http://localhost:5173 |
| PartyKit | http://127.0.0.1:1999 |

```bash
cd apps/party
cp .env.example .env   # JWT_SECRET, PARTYKIT_BROADCAST_SECRET
```

## Scripts

```bash
pnpm dev          # Web + PartyKit
pnpm build        # Build all packages
pnpm typecheck    # Typecheck
pnpm test:e2e     # Playwright
```

## Deploy

### 1. PartyKit

```bash
pnpm --filter @photosocial/party deploy
```

Set secrets in the [PartyKit dashboard](https://www.partykit.io/) (same as `apps/party/.env`).

Copy the deploy host (e.g. `photosocial-party.yourname.partykit.dev`).

### 2. Web (Vercel)

Edit [`config/deploy.production.json`](config/deploy.production.json):

```json
{
  "partykitHost": "photosocial-party.yourname.partykit.dev"
}
```

Push to Git — Vercel uses root [`vercel.json`](vercel.json). **No env vars** needed in the Vercel dashboard.

Turn off **Deployment Protection → Require Log In** for public access (or only protect previews).

See [docs/PARTYKIT.md](docs/PARTYKIT.md) for details.

## Privacy

- Party photos live in PartyKit room storage during the session.
- On lock, per-slot images are cleared from room state.
- Export is **download only** (no email).
- Solo mode stays entirely in the browser (`localStorage`).

## Docs

- [docs/PARTYKIT.md](docs/PARTYKIT.md) — deploy & API host
- [docs/SPEC.md](docs/SPEC.md) — product spec
- [docs/FUNCTION.md](docs/FUNCTION.md) — technical reference
- [docs/DESIGN_PHILOSOPHY.md](docs/DESIGN_PHILOSOPHY.md) — UI principles
