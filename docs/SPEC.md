# SPEC.md — PassAndPic Photobooth Web App

> *A remote-friendly, pass-and-shoot photobooth collage experience.*

---

## 1. Product Overview

**PassAndPic** is a web-based photobooth application designed for groups of people who are not physically together. Participants join a shared session using a simple **Party Code**, take photos on their own devices, and collaboratively build a photo collage that the host manages and assigns.

**Tagline:** *Everyone's camera. One shared memory.*

---

## 2. Target Users

| User Type | Description |
|---|---|
| **Host** | Creates the session, sets the collage layout, assigns slots to participants, manages themes and stickers, triggers download/share |
| **Participant** | Joins via Party Code, takes their assigned photo(s), adds stickers, views the growing collage |
| **Guest (view-only)** | Optional future role — views the live collage without contributing |

---

## 3. Core User Flows

### 3.1 Host Flow
```
Landing Page
  → [ Create Party ]
  → Choose Collage Layout (2x1, 2x2, 3x2, strip, custom)
  → Choose Theme (Snow, Midnight, Petal, Slate, Citrus, Custom)
  → Party Code is generated (e.g., "PINE-7842")
  → Share Party Code with participants
  → Assign collage slots to participants by name/device
  → Monitor collage as photos come in (live update)
  → Add stickers to the full collage
  → Lock collage & trigger Download / Email sharing
```

### 3.2 Participant Flow
```
Landing Page
  → [ Join Party ]
  → Enter Party Code
  → Enter display name (e.g., "Maya 🌸")
  → Wait for host to assign slot
  → Notification: "You've been assigned Slot 3!"
  → Camera activates — take photo (retake available before submitting)
  → Add personal stickers to own photo tile
  → Submit photo to collage
  → View full collage as it fills
  → Download / Email their individual photo or full collage
```

---

## 4. Feature Requirements

### 4.1 Party Code System

| Requirement | Detail |
|---|---|
| **Format** | Human-readable word + 4-digit number (e.g., `PINE-7842`, `LEAF-3301`) |
| **Generation** | Server-side; guaranteed unique for active sessions |
| **Expiry** | Session expires 24 hours after creation or 2 hours after last activity |
| **Capacity** | Up to 20 participants per session (v1) |
| **Rejoin** | Participants can rejoin with the same code and name within the session window |

### 4.2 Collage Layouts

| Layout Name | Grid | Best For |
|---|---|---|
| **Duo** | 1×2 | Two people |
| **Squad** | 2×2 | Four people |
| **Party** | 2×3 | Six people |
| **Strip** | 1×4 | Classic photobooth strip |
| **Panorama** | 3×1 | Wide scenic feel |
| **Custom** | Up to 4×4 | Host-defined |

- Each slot in the grid = one participant's photo
- Slots can be left empty (displayed as a soft placeholder)
- Host can resize individual slots (e.g., make one slot double-width)

### 4.3 Camera & Photo Capture

- Uses browser `MediaDevices.getUserMedia()` — no app install required
- **Countdown timer** before capture: 3s default, configurable to 5s or 10s
- **Flash effect** on capture (white overlay, `200ms`)
- **Retake** available until photo is submitted to collage
- **Filters** (v1 set): None, B&W, Warm, Cool, Fade
- **Mirror mode** toggle (default: on for selfies)
- **Photo resolution:** Captured at device maximum, stored and served at `1200px` max on longest side

### 4.4 Sticker System

**Placement:**
- Tap/click a sticker from the panel → it appears centered on the photo
- Drag to reposition
- Pinch-to-resize (mobile) / scroll-to-resize (desktop)
- Two-finger rotate (mobile) / rotation handle (desktop)
- Tap outside to deselect; double-tap to delete

**Sticker Scope:**
- Participants can sticker their own assigned tile
- Host can sticker the full collage canvas (global stickers)
- Stickers are layered above photos; host stickers are above participant stickers

**Sticker Packs (v1):**
- Celebration, Love, Nature, Retro, Text Stamps
- Seasonal pack (auto-activated based on current month)

### 4.5 Theme System

- **Selectable by host** at session creation; can be changed mid-session
- Theme change is broadcast live to all participants
- Custom theme: HSL color picker → system generates surface + text tokens
- All themes export cleanly (collage background reflects chosen theme)

### 4.6 Slot Assignment

- Host sees a grid with participant names in a sidebar
- Drag participant name onto a slot to assign
- Participants are notified immediately (push/WebSocket): *"[Host] assigned you Slot 2!"*
- Host can reassign slots before a photo is submitted
- After submission, slot is locked (host can unlock manually)

### 4.7 Download & Sharing

| Method | Detail |
|---|---|
| **Local Download** | One-click download of full collage as `.jpg` or `.png` (host and participants) |
| **Individual Tile Download** | Participant can download their own tile + stickers as image |
| **Email** | User enters email → receives direct image link (no account required) |
| **Link Share** | Host can generate a view-only link to the finished collage |

**Download quality:** 2x pixel density (retina-ready), collage rendered via `html2canvas` or server-side canvas rendering.

---

## 5. Real-Time Architecture Requirements

| Concern | Requirement |
|---|---|
| **Protocol** | WebSockets (preferred) or Server-Sent Events for live updates |
| **Events to sync** | Slot assignments, photo submissions, sticker placements, theme changes, collage lock |
| **Latency target** | Updates visible to all participants within `<500ms` |
| **Reconnect** | Auto-reconnect with exponential backoff on connection drop |
| **Offline handling** | Show "Reconnecting…" banner; queue local actions and replay on reconnect |

---

## 6. Responsive Design Requirements

| Breakpoint | Behavior |
|---|---|
| `< 480px` (Mobile S) | Single column; camera view full-screen; collage preview scrollable |
| `480–768px` (Mobile L / Tablet) | Camera + collage split view |
| `768–1200px` (Tablet / Small Desktop) | Two-column layout; sticker panel as sidebar |
| `> 1200px` (Desktop) | Three-column layout; full collage preview; drag-and-drop slot assignment |

**Touch requirements:**
- All interactive targets minimum `48×48px`
- Swipe gestures for navigating between collage tiles (mobile)
- No hover-only interactions on critical actions

---

## 7. Pages & Screens

### 7.1 Landing Page
- Hero: App name, tagline, illustration of a multi-tile collage
- Two primary CTAs: **[ Create Party ]** and **[ Join Party ]**
- Theme preview carousel (decorative)
- No login required

### 7.2 Create Session Screen
- Collage layout picker (visual grid thumbnails)
- Theme picker (swatch row + color wheel toggle)
- Party Code display (prominent, copyable, shareable via OS share sheet)
- "Wait for participants" state with live count badge

### 7.3 Join Session Screen
- Large Party Code input (styled, character-chunked: `WORD-####`)
- Display name input with optional emoji picker
- CTA: **[ Enter the Party ]**

### 7.4 Lobby / Waiting Screen
- Shows live participant list
- Host sees "Assign Slots" CTA
- Participants see "Waiting for your assignment…" with a gentle animation

### 7.5 Camera Screen
- Full-screen camera view
- Countdown overlay
- Filter row (horizontal scroll)
- Retake / Submit buttons
- Sticker panel accessible via slide-up drawer (mobile) or right sidebar (desktop)

### 7.6 Live Collage Screen
- Fills as photos are submitted
- Empty slots show participant avatar/name placeholder
- Global sticker panel for host
- Download / Share buttons (active once host locks)
- Confetti burst animation on collage completion

### 7.7 Completion / Export Screen
- Final collage preview (full-screen)
- Download as image
- Email entry field
- Copy link
- "Make another!" CTA

---

## 8. Data Model (Simplified)

```
Session
  id: string (UUID)
  partyCode: string (e.g., "PINE-7842")
  hostId: string
  theme: ThemeKey
  layout: CollageLayout
  createdAt: timestamp
  expiresAt: timestamp
  status: "lobby" | "active" | "locked" | "expired"

Participant
  id: string
  sessionId: string
  displayName: string
  assignedSlot: number | null
  photoUrl: string | null
  stickers: Sticker[]
  joinedAt: timestamp

Sticker
  id: string
  packId: string
  stickerKey: string
  x: number (% of tile width)
  y: number (% of tile height)
  scale: number
  rotation: number (degrees)
  scope: "tile" | "global"
  placedBy: participantId | "host"

CollageLayout
  rows: number
  cols: number
  slots: SlotDefinition[]

SlotDefinition
  index: number
  rowSpan: number
  colSpan: number
  assignedTo: participantId | null
```

---

## 9. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | First contentful paint `< 1.5s` on 4G; camera activates `< 800ms` after permission grant |
| **Compatibility** | Latest 2 versions of Chrome, Safari, Firefox, Edge; iOS Safari 15+; Android Chrome 110+ |
| **Security** | No auth required; party codes are rate-limited; image uploads virus-scanned; no PII stored beyond session window |
| **Privacy** | Photos stored temporarily (24h max); email addresses used only for delivery, not stored |
| **Accessibility** | WCAG 2.1 AA compliance across all screens |
| **Localization** | English v1; i18n-ready architecture (all strings externalized) |

---

## 10. Out of Scope (v1)

- Video or GIF capture
- User accounts / login
- Persistent gallery / history
- Social media direct posting
- Audio/music overlays
- Multi-host sessions
- Moderation / reporting tools

---

*This spec governs v1 of PassAndPic. Items marked v2+ are tracked in the product backlog.*
