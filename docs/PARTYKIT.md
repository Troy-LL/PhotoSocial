# PartyKit setup (PhotoSocial backend)

PhotoSocial party mode uses **only PartyKit** — no separate Hono/API server. The web app talks to your PartyKit project over HTTPS; realtime uses the same host via WebSocket.

## 1. Install PartyKit CLI (once)

```bash
npm install -g partykit
# or: npx partykit@latest login
```

## 2. Log in

```bash
cd apps/party
npx partykit login
```

Opens the browser to link your PartyKit account.

## 3. Set secrets

In the [PartyKit dashboard](https://www.partykit.io/) → your project → **Settings** → **Environment variables**:

| Variable | Value |
|----------|--------|
| `JWT_SECRET` | Long random string (e.g. `openssl rand -hex 32`) |
| `PARTYKIT_BROADCAST_SECRET` | Another random string (internal broadcasts) |

For local dev, copy `apps/party/.env.example` to `apps/party/.env` with the same values.

## 4. Deploy

From the repo root:

```bash
pnpm --filter @photosocial/party deploy
```

Or from `apps/party`:

```bash
npx partykit deploy
```

When it finishes, the CLI prints your host. It looks like:

```text
photosocial-party.<your-username>.partykit.dev
```

That string is your **PartyKit API host**.

## 5. Wire the web app

Edit **[config/deploy.production.json](../config/deploy.production.json)** at the repo root:

```json
{
  "partykitHost": "photosocial-party.yourusername.partykit.dev"
}
```

No `https://`, no trailing slash.

Commit and redeploy Vercel. **No environment variables** are required in the Vercel dashboard.

**CORS:** `https://photosocially.vercel.app` and `*.vercel.app` are allowed automatically. For a custom domain, add `CORS_ORIGIN=https://your-domain.com` in the PartyKit dashboard (Settings → Environment variables).

If the browser shows a CORS error on **photo upload** but other API calls work, the request body was probably too large (edge `400` without CORS headers). Redeploy the latest web + party packages; photos are compressed before upload.

## 6. Local development

```bash
pnpm install
pnpm --filter @photosocial/shared build
pnpm dev
```

This runs:

- Web → http://localhost:5173
- PartyKit → http://127.0.0.1:1999

The web app uses `hostname:1999` for PartyKit automatically in dev.

## How the API maps to PartyKit

| App call | PartyKit URL |
|----------|----------------|
| Create party | `POST /parties/registry/main` `{ action: "create", ... }` |
| Join party | `POST /parties/registry/main` `{ action: "join", ... }` |
| Session state | `GET /parties/main/{sessionId}` + Bearer token |
| Assign slot, theme, lock, photos | `POST /parties/main/{sessionId}` + Bearer token |
| Live updates | WebSocket `parties/main/{sessionId}?token=...` |

## Sanity checks

```bash
# After deploy — replace HOST
curl -X POST "https://HOST/parties/registry/main" \
  -H "Content-Type: application/json" \
  -d '{"action":"create","hostDeviceId":"test","hostName":"Host","layout":"strip4","theme":"snow"}'
```

You should get JSON with `success: true`, `partyCode`, `sessionId`, and `wsToken`.

## Project layout

| File | Role |
|------|------|
| `apps/party/src/registry-party.ts` | Create/join, party code → session id |
| `apps/party/src/session-party.ts` | Per-party room: state, photos, broadcasts |
| `apps/party/partykit.json` | Project name `photosocial-party` |

Photos are stored as compressed JPEG data URLs in the room (download uses client-side collage render after lock).
