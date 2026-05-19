# FUNCTION.md — PassAndPic Technical Function Reference

> *A complete map of system functions, component behaviors, and event contracts.*

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                    │
│  React / Vanilla JS PWA                                 │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐ │
│  │  Camera  │  │  Collage  │  │  Sticker / Theme UI  │ │
│  │  Module  │  │  Renderer │  │  Panel               │ │
│  └────┬─────┘  └─────┬─────┘  └──────────┬───────────┘ │
│       └──────────────┼───────────────────┘             │
│              WebSocket Client                           │
└──────────────────────┬──────────────────────────────────┘
                       │ WSS
┌──────────────────────▼──────────────────────────────────┐
│                  SERVER (Node.js / Bun)                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  Session    │  │  WebSocket   │  │  Image Upload  │ │
│  │  Manager   │  │  Broadcaster │  │  Service       │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
│              ┌──────────────┐                           │
│              │  Email       │                           │
│              │  Service     │                           │
│              └──────────────┘                           │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │  Storage: DB + Object Store │
        │  (e.g. Postgres + S3/R2)    │
        └─────────────────────────────┘
```

---

## 2. Session Functions

### `createSession(options)`
Creates a new photobooth session and returns a Party Code.

**Input:**
```ts
{
  hostDeviceId: string,       // fingerprint or ephemeral UUID
  layout: CollageLayout,      // grid configuration
  theme: ThemeKey,            // starting theme
}
```

**Output:**
```ts
{
  sessionId: string,
  partyCode: string,          // e.g. "PINE-7842"
  wsToken: string,            // auth token for WebSocket connection
  expiresAt: ISO8601string,
}
```

**Behavior:**
- Generates a unique Party Code using a curated word list + 4-digit number
- Retries generation up to 5 times on collision
- Inserts session record into DB with status `"lobby"`
- Returns host a signed WebSocket token scoped to this session

---

### `joinSession(partyCode, displayName)`
Validates a Party Code and registers a participant.

**Input:**
```ts
{
  partyCode: string,
  displayName: string,        // max 24 chars, emoji allowed
  deviceId: string,
}
```

**Output:**
```ts
{
  sessionId: string,
  participantId: string,
  wsToken: string,
  sessionMeta: {
    theme: ThemeKey,
    layout: CollageLayout,
    hostName: string,
    participantCount: number,
  }
}
```

**Errors:**
| Code | Condition |
|---|---|
| `SESSION_NOT_FOUND` | Code does not exist or is expired |
| `SESSION_LOCKED` | Collage has been finalized |
| `SESSION_FULL` | 20-participant cap reached |
| `NAME_TAKEN` | Display name already in use in session |

---

### `getSessionState(sessionId)`
Returns a full snapshot of the session for initial render or reconnect.

**Output:**
```ts
{
  session: Session,
  participants: Participant[],
  collage: {
    slots: SlotState[],       // each slot with photo URL and stickers
    globalStickers: Sticker[],
  }
}
```

---

### `lockSession(sessionId, hostToken)`
Host finalizes the collage. No further photo submissions accepted.

**Behavior:**
- Updates session status to `"locked"`
- Broadcasts `SESSION_LOCKED` event to all participants
- Triggers server-side collage render (composite image generation)
- Returns `finalCollageUrl: string` — a fully rendered image on object storage

---

### `expireSession(sessionId)`
Internal function triggered by scheduler.

**Behavior:**
- Sets status `"expired"`
- Schedules deletion of associated images and sticker data after 24h grace period
- Broadcasts `SESSION_EXPIRED` to any connected clients

---

## 3. Camera Module Functions

### `initCamera(facingMode)`
Initializes the device camera stream.

**Input:**
```ts
facingMode: "user" | "environment"   // front or back camera
```

**Output:**
```ts
{
  stream: MediaStream,
  resolution: { width: number, height: number },
  facingMode: "user" | "environment",
}
```

**Behavior:**
- Calls `navigator.mediaDevices.getUserMedia()`
- Falls back to `"environment"` if `"user"` not available
- Stores stream reference for cleanup on unmount

---

### `capturePhoto(stream, options)`
Captures a single frame from the camera stream.

**Input:**
```ts
{
  stream: MediaStream,
  filter: FilterKey,          // "none" | "bw" | "warm" | "cool" | "fade"
  mirror: boolean,
  canvasRef: HTMLCanvasElement,
}
```

**Output:**
```ts
{
  dataUrl: string,            // base64 PNG
  blob: Blob,                 // for upload
  width: number,
  height: number,
}
```

**Behavior:**
- Draws current video frame to `<canvas>`
- If `mirror: true`, applies horizontal CSS transform before draw
- Applies filter via CSS filter pipeline or canvas pixel manipulation
- Triggers flash overlay animation (dispatches `CAMERA_FLASH` UI event)
- Triggers haptic feedback via `navigator.vibrate(50)` on supported devices

---

### `startCountdown(seconds, onTick, onComplete)`
Manages countdown before photo capture.

**Input:**
```ts
{
  seconds: 3 | 5 | 10,
  onTick: (remaining: number) => void,
  onComplete: () => void,
}
```

**Behavior:**
- Calls `onTick` each second with remaining count
- Calls `onComplete` when timer hits 0
- Cancellable via returned `cancel()` function

---

### `uploadPhoto(blob, sessionId, participantId)`
Uploads the captured photo to the server.

**Input:**
```ts
{
  blob: Blob,
  sessionId: string,
  participantId: string,
  slotIndex: number,
}
```

**Output:**
```ts
{
  photoUrl: string,           // CDN URL of stored image
  thumbnailUrl: string,       // 400px thumbnail URL
}
```

**Behavior:**
- Uploads via `multipart/form-data` POST
- Server validates file type (JPEG/PNG/WEBP only), size (max 10MB)
- Server resizes to max 1200px longest side, generates 400px thumbnail
- On success, server broadcasts `PHOTO_SUBMITTED` WebSocket event to all session participants

---

### `retakePhoto(participantId, sessionId)`
Clears an unsubmitted photo and reactivates camera.

**Behavior:**
- Only callable before `uploadPhoto` completes
- Resets camera module to capture-ready state
- No server call needed if photo not yet uploaded

---

## 4. Collage Renderer Functions

### `renderCollage(session, slots, stickers)`
Builds the visual collage grid in the browser.

**Input:**
```ts
{
  layout: CollageLayout,
  slots: SlotState[],         // photo URLs, placeholder states
  stickers: Sticker[],        // global stickers from host
  theme: ThemeKey,
}
```

**Behavior:**
- Uses CSS Grid to lay out slots per `CollageLayout`
- Empty slots render `PlaceholderTile` component with participant name and avatar
- Filled slots render photo + participant stickers + global stickers in z-order
- Reactively updates when any `SlotState` changes via WebSocket

---

### `exportCollage(collageElement, format)`
Generates a downloadable image from the rendered collage DOM.

**Input:**
```ts
{
  collageElement: HTMLElement,
  format: "png" | "jpg",
  scale: 2,                   // retina export
}
```

**Output:**
```ts
{
  blob: Blob,
  dataUrl: string,
}
```

**Behavior:**
- Uses `html2canvas` (client-side) or fetches pre-rendered image from server (`finalCollageUrl`)
- Prefers server-rendered image if available (higher fidelity, font-safe)
- Triggers browser download via `<a download>` programmatic click

---

### `exportTile(slotIndex, participantId)`
Exports a single collage tile as an image.

**Behavior:**
- Crops and composites only the target slot + its stickers
- Returns `Blob` for download or email attachment

---

## 5. Sticker Functions

### `loadStickerPack(packId)`
Fetches sticker assets for a given pack.

**Input:**
```ts
packId: "celebration" | "love" | "nature" | "retro" | "text" | "seasonal"
```

**Output:**
```ts
{
  packId: string,
  stickers: StickerAsset[],   // { key, svgUrl, label }
}
```

**Behavior:**
- SVGs fetched from CDN with aggressive cache headers
- Seasonal pack auto-loaded based on `Date.now()` month

---

### `placeSticker(stickerKey, targetScope, targetId)`
Places a sticker on a tile or the global canvas.

**Input:**
```ts
{
  stickerKey: string,
  targetScope: "tile" | "global",
  targetId: string,           // participantId for tile, sessionId for global
  initialPosition: { x: number, y: number },  // % of target dimensions
}
```

**Behavior:**
- Creates `Sticker` record with default `scale: 1`, `rotation: 0`
- Persists to server; server broadcasts `STICKER_PLACED` event to session
- Optimistically renders on client before server confirmation

---

### `updateSticker(stickerId, transform)`
Updates position, scale, or rotation of an existing sticker.

**Input:**
```ts
{
  stickerId: string,
  x?: number,
  y?: number,
  scale?: number,
  rotation?: number,
}
```

**Behavior:**
- Throttled to `60fps` during active drag/pinch
- Debounced server sync at `200ms` after gesture ends
- Broadcasts `STICKER_UPDATED` to session on server sync

---

### `deleteSticker(stickerId, requesterId)`
Removes a sticker from a tile or global canvas.

**Authorization:**
- Participant can delete their own tile stickers
- Host can delete any sticker (tile or global)

---

## 6. Slot Assignment Functions

### `assignSlot(sessionId, participantId, slotIndex, hostToken)`
Host assigns a participant to a collage slot.

**Behavior:**
- Validates host token
- Updates `SlotDefinition.assignedTo` in DB
- Broadcasts `SLOT_ASSIGNED` event:
  ```ts
  {
    type: "SLOT_ASSIGNED",
    slotIndex: number,
    participantId: string,
    displayName: string,
  }
  ```
- Receiving participant client activates camera module on event receipt

---

### `reassignSlot(sessionId, slotIndex, newParticipantId, hostToken)`
Host moves an assignment before photo is submitted.

**Behavior:**
- Only allowed if current slot has no submitted photo
- Clears previous assignment, applies new one
- Broadcasts `SLOT_REASSIGNED` to session

---

## 7. Theme Functions

### `setTheme(sessionId, theme, hostToken)`
Host changes the session theme.

**Input:**
```ts
{
  theme: ThemeKey | { custom: HSLColor },
}
```

**Behavior:**
- Updates session record
- Broadcasts `THEME_CHANGED` to all participants
- Client applies new CSS custom properties with `300ms` transition

---

### `resolveThemeTokens(theme)`
Returns a full set of CSS custom property values for a given theme.

**Output:**
```ts
{
  "--color-bg": string,
  "--color-surface": string,
  "--color-surface-raised": string,
  "--color-text-primary": string,
  "--color-text-secondary": string,
  "--color-accent": string,
  "--color-border": string,
  "--shadow-card": string,
}
```

---

## 8. Download & Email Functions

### `downloadImage(source, filename)`
Triggers a local file download.

**Input:**
```ts
{
  source: string | Blob,      // URL or Blob
  filename: string,           // e.g. "passandpic-squad-2025.jpg"
}
```

**Behavior:**
- If `source` is URL: fetches, converts to `Blob`, then downloads
- Creates invisible `<a download>` element, clicks programmatically
- Works on iOS Safari via `window.open(dataUrl)` fallback

---

### `sendCollageByEmail(email, sessionId, scope)`
Emails a download link to the provided address.

**Input:**
```ts
{
  email: string,
  sessionId: string,
  scope: "full-collage" | "my-tile",
  recipientName?: string,
}
```

**Behavior:**
- Validates email format client-side before sending
- Server sends transactional email containing:
  - Hosted image preview (inline)
  - Direct download link (signed, 72h expiry)
  - "Powered by PassAndPic" footer
- Email address is not stored beyond the delivery queue flush

**Rate limiting:** Max 3 email sends per participant per session.

---

## 9. WebSocket Event Reference

All real-time events follow this envelope:

```ts
{
  type: EventType,
  sessionId: string,
  timestamp: ISO8601string,
  payload: object,
}
```

| Event Type | Direction | Triggered By | Payload |
|---|---|---|---|
| `PARTICIPANT_JOINED` | Server → All | `joinSession` | `{ participantId, displayName }` |
| `PARTICIPANT_LEFT` | Server → All | Disconnect | `{ participantId }` |
| `SLOT_ASSIGNED` | Server → All | `assignSlot` | `{ slotIndex, participantId, displayName }` |
| `SLOT_REASSIGNED` | Server → All | `reassignSlot` | `{ slotIndex, participantId }` |
| `PHOTO_SUBMITTED` | Server → All | `uploadPhoto` | `{ slotIndex, participantId, thumbnailUrl }` |
| `STICKER_PLACED` | Server → All | `placeSticker` | `{ sticker: Sticker }` |
| `STICKER_UPDATED` | Server → All | `updateSticker` | `{ stickerId, transform }` |
| `STICKER_DELETED` | Server → All | `deleteSticker` | `{ stickerId }` |
| `THEME_CHANGED` | Server → All | `setTheme` | `{ theme: ThemeKey }` |
| `SESSION_LOCKED` | Server → All | `lockSession` | `{ finalCollageUrl }` |
| `SESSION_EXPIRED` | Server → All | Scheduler | `{}` |
| `PING` | Both | Keep-alive | `{}` |

---

## 10. Error Handling Standards

All API responses follow:

```ts
// Success
{ success: true, data: T }

// Error
{ success: false, error: { code: string, message: string } }
```

**Client-side error behaviors:**

| Scenario | Behavior |
|---|---|
| Camera permission denied | Show permission guide modal with OS-specific instructions |
| Upload fails | Retry up to 3 times with exponential backoff; show "Upload failed — tap to retry" |
| WebSocket disconnects | Show "Reconnecting…" banner; suppress for < 2s (brief drops) |
| Session expired mid-use | Show modal: "This party has ended. Download your photo before it's gone." |
| Invalid Party Code | Inline error with shake animation on input field |
| Email send fails | Show error; offer direct download as fallback |

---

## 11. Performance Budgets

| Metric | Target |
|---|---|
| JS bundle (initial, gzipped) | `< 180KB` |
| Camera init time | `< 800ms` |
| Photo upload round-trip | `< 3s` on 4G |
| Collage re-render on update | `< 100ms` |
| Sticker drag frame rate | `60fps` target, `30fps` minimum |
| WebSocket event → UI update | `< 150ms` |

---

*This document is the source of truth for PassAndPic's functional behavior. All implementation decisions should trace back to entries here.*
