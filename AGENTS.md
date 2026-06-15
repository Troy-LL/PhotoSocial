# PhotoSocial

Remote-friendly photobooth collage app. pnpm monorepo (Node 20+, pnpm 9). See `README.md` and `docs/` for product/spec details.

## Cursor Cloud specific instructions

### Services

| Service | Path | Dev URL | Run |
|---------|------|---------|-----|
| Web (React PWA, Vite) | `apps/web` | http://localhost:5173 | `pnpm dev` (root) |
| PartyKit backend (sessions/photos/realtime) | `apps/party` | http://127.0.0.1:1999 | `pnpm dev` (root) |
| Shared types/schemas | `packages/shared` | — | built to `dist` |

`pnpm dev` (root) runs the web and party servers in parallel — that's the normal way to run the app locally. There is no separate Node API; the web app talks to PartyKit over HTTPS + WebSocket.

### Non-obvious notes

- **`packages/shared` must be built (`dist`) for the party server to resolve `@photosocial/shared`.** The web `dev` script rebuilds it automatically, but on a cold checkout build it once (`pnpm --filter @photosocial/shared build`) before relying on `apps/party`. The update script handles this on startup.
- **`apps/party/.env` is required for PartyKit dev** (it loads `JWT_SECRET` / `PARTYKIT_BROADCAST_SECRET`). It is gitignored; the update script creates it from `apps/party/.env.example` if missing. Token signing breaks without it.
- **Lint is not configured.** The root `lint` script (`eslint .`) fails because there is no eslint dependency or config in the repo. Use `pnpm typecheck` for static checks.
- **e2e (`pnpm test:e2e`, Playwright):** requires browsers (`npx playwright install`). The `chromium` and `mobile` projects pick up `e2e/solo-booth.spec.ts`, which needs a fake camera and is intended for the `solo-mobile` (Pixel 7) project — those will fail outside `solo-mobile`. Some `party-flow` tests also have pre-existing strict-mode selector ambiguity (two "Assign Slots" links in the lobby) and fail regardless of environment. `landing page loads` and `invalid party code` pass under `chromium`.
- Verify the backend quickly with: `curl -X POST http://127.0.0.1:1999/parties/registry/main -H 'Content-Type: application/json' -d '{"action":"create","hostDeviceId":"t","hostName":"H","layout":"strip4","theme":"snow"}'` → expects `success: true`.
