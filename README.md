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
- PartyKit: http://127.0.0.1:1999 (party API + realtime)

Copy `apps/party/.env.example` to `apps/party/.env` for `JWT_SECRET` and `PARTYKIT_BROADCAST_SECRET`.

## Monorepo

| Package | Description |
|---------|-------------|
| `apps/web` | Vite + React PWA |
| `apps/party` | PartyKit backend (sessions, photos, live updates) |
| `packages/shared` | Types, Zod schemas, themes, layouts |

## Scripts

```bash
pnpm dev          # Web + PartyKit
pnpm build        # Build all packages
pnpm typecheck    # Typecheck all packages
pnpm test:e2e     # Playwright E2E
```

## Privacy

Party photos live in PartyKit room storage during the session. On lock, slot images are cleared from state; users download the collage on their device. Export is download-only (no email).

## Deploy

| Piece | Where |
|-------|--------|
| **Web** | Vercel — see root `vercel.json`, no dashboard env vars |
| **PartyKit** | `pnpm --filter @photosocial/party deploy` |

**Full PartyKit guide:** [docs/PARTYKIT.md](docs/PARTYKIT.md)

1. Deploy PartyKit → copy host (e.g. `photosocial-party.you.partykit.dev`)
2. Set `partykitHost` in [config/deploy.production.json](config/deploy.production.json)
3. Deploy Vercel

## Docs

See [docs/SPEC.md](docs/SPEC.md), [docs/FUNCTION.md](docs/FUNCTION.md), [docs/PARTYKIT.md](docs/PARTYKIT.md), and [docs/DESIGN_PHILOSOPHY.md](docs/DESIGN_PHILOSOPHY.md).
