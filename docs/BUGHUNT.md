# Cross-breakpoint bug hunt — findings & spec (Desktop / Tablet / Phone)

Author: planning pass (Opus). Scope: audit and fix functional bugs and display
anomalies across the three viewport classes, with emphasis on the three reported
symptom areas — **download final pictures**, **edit frames**, and **take
pictures** — plus proactively hardening other ways the app can break.

## Breakpoint model (how the app defines the three views)

The web app (`apps/web`) is a Vite + React PWA. Responsive behavior is driven by
CSS media queries and one JS media query:

| View | Width | Source of truth |
|------|-------|-----------------|
| Phone | `max-width: 767px` | CSS `@media (max-width: 767px)`; JS `useMediaQuery("(max-width: 767px)")` in `CameraView` |
| Tablet | `768px–1199px` | CSS `@media (min-width: 768px)` (shared with desktop) |
| Desktop | `>= 1200px` | CSS `@media (min-width: 768px)` + `@media (min-width: 1200px)` tweaks |

Implication: **tablet renders with the desktop layout** (camera + side strip,
`stripAside` shown, mobile-only progress hidden). The only JS branch is
phone-vs-not in `CameraView` (`isMobile`). Consistency goal: a behavior that
works on desktop must work identically on tablet, and the phone variant must be
functionally equivalent (same capture, framing, and download capabilities).

## Reproduction harness

A temporary Playwright harness drives the **solo** flow (no PartyKit needed) with
a fake camera at three viewports — desktop `1280×800`, tablet `820×1180`
(touch), phone `390×844` (touch). It exercises: take 3 photos → open the framing
editor and drag to pan → go to collage → download. Files (not committed):
`playwright.repro.config.ts`, `e2e-repro/responsive-bughunt.spec.ts`.

### Evidence (pre-fix)

```
[desktop] TAKE PICTURES: ok (3 photos captured)
[desktop] EDIT FRAME: before="50% 50%" after="99% 78%" changed=true
[desktop] DOWNLOAD (share fails): downloaded=false file=null   ← BUG
[tablet]  TAKE PICTURES: ok (3 photos captured)
[tablet]  EDIT FRAME: before="50% 50%" after="99% 78%" changed=true
[tablet]  DOWNLOAD (share fails): downloaded=false file=null   ← BUG
[phone]   TAKE PICTURES: ok (3 photos captured)
[phone]   EDIT FRAME: before="50% 50%" after="99% 78%" changed=true
[phone]   DOWNLOAD (share fails): downloaded=false file=null   ← BUG
```

## Findings

### BUG-1 — Download fails for some users (CONFIRMED, primary fix)

**Symptom:** "some report that they can download their final pictures" but others
cannot.

**Root cause:** `apps/web/src/lib/collage-export.ts` → `saveCollageBlob()`. When
the Web Share API is available with file support (`navigator.canShare({files})`
is `true` — typical on phones), the code calls `navigator.share(...)`. If
`share()` rejects with anything **other** than user cancellation (`AbortError`),
the function **re-throws** and the page (`ExportPage` / `SoloCollagePage`) shows
`collageDownloadFailed`. There is **no fallback to the anchor `<a download>`
path** in that case.

Why it hits "some users": `navigator.share()` requires *transient user
activation*. The download handlers do heavy async work first
(`exportCollageFromElement` → `html2canvas`, or `saveCollageFromUrl` → `fetch`).
On slower phones this render can exceed the activation window, so `share()`
rejects with `NotAllowedError`. Desktop browsers generally report
`canShare({files}) === false`, so they already take the anchor path and always
succeed — hence "works for me" on desktop, "fails" on mobile.

**Fix:** In `saveCollageBlob`, treat user-cancellation (`AbortError`) as
`"cancelled"`, but for **any other** share failure, **fall back** to the anchor
download (and `URL.revokeObjectURL` cleanup) instead of throwing. Result: a file
is always saved on every device. This single change covers both the
`exportCollageFromElement` and `saveCollageFromUrl` paths because both funnel
through `saveCollageBlob`.

### BUG-2 — "Can't even take a picture" (HARDENING)

Not reproducible with a healthy camera in a clean browser (capture works on all
three breakpoints above), so the real-world reports are device/timing dependent.
Two genuine robustness gaps in `apps/web/src/features/camera/useCamera.ts`:

1. **`videoReady` can get stuck `false`.** The shutter is gated on
   `canUseCamera = stream && videoReady && !error`. `videoReady` is set only from
   `loadeddata` / `loadedmetadata` / `resize`. On some browsers (notably iOS
   Safari, and on stream re-attach) `videoWidth`/`videoHeight` populate without a
   late `resize`, so the flag never flips true and the shutter stays disabled =
   "can't take a picture."
2. **No recovery when the camera track ends.** If the OS/another app revokes the
   camera (tab backgrounded, phone locked), the track ends and the feed freezes;
   there is no `track.onended` re-init, so the user is stuck.

**Fix (additive, never disables the camera):** also mark ready on
`canplay` / `playing` / `timeupdate`, add a short self-clearing poll after stream
attach as a fallback, and re-`init()` when the active track ends.

### BUG-3 — Exported/downloaded collage PNG is completely blank (CONFIRMED, fixed)

**Symptom:** On Windows desktop the OS share sheet opens (Web Share with files is
supported there), and the saved `PhotoSocial-solo.png` is a blank image.

**Root cause:** `collage-export.ts` → `prepareExportClone()` set
`clone.style.visibility = "hidden"` on the off-screen clone before handing it to
`html2canvas`. html2canvas does not paint elements that are not visible, so the
entire collage rendered as fully transparent. The clone is already positioned
off-screen via `left: -10000px`, so `visibility: hidden` was unnecessary and was
the sole cause of the blank output.

**Evidence:** driving the real `captureCollageElement()` and reading the canvas
pixels — before: `nonTransparent: 0 / 1920000` (100% transparent); after removing
the `visibility: hidden` line: `nonTransparent: 1919801 / 1920000` with 50+
distinct colors, and the saved PNG shows the actual three-slot strip.

**Fix:** remove `clone.style.visibility = "hidden"` (keep the off-screen offset).
This affects every html2canvas export path (`exportCollageFromElement`, solo and
party-without-`finalCollageUrl`). Note: this is the primary cause of the
real-world "blank png"; BUG-1's share fallback is complementary (it ensures a
file is always produced when `navigator.share()` itself rejects).

### Frame editing — verified working across breakpoints

The framing editor (`SlotFramingEditor`) pans correctly via Pointer Events on
desktop (mouse) and touch (tablet/phone); `.preview` already sets
`touch-action: none`. Drag changed `objectPosition` identically on all three
viewports (`50% 50%` → `99% 78%`). No functional break found. The camera-
readiness hardening (BUG-2) also de-flakes the capture step that precedes
editing. No risky changes to the editor's zoom/pan math are made.

## Out of scope (explicitly not changed)

- Editor zoom + pan transform-origin math (works; high regression risk).
- PartyKit backend, auth, layouts, themes.
- The non-functional root `lint` script (no eslint config in repo).

## Verification plan

Re-run the harness across all three viewports (expect all green), run the
existing Playwright suite, `pnpm typecheck`, `pnpm build`, and a manual
solo-flow video. The temporary harness files are removed before finishing.
