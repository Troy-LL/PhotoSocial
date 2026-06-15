# Implementation Plan — PhotoSocial bug-hunt fixes

Authored by the planning agent (Claude 4.6 Sonnet) from `docs/BUGHUNT.md`.
Scope is limited to three changes; do not expand it.

## Files
| File | Change |
|---|---|
| `apps/web/src/lib/collage-export.ts` | `saveCollageBlob`: on non-cancel share failure, fall back to anchor download instead of throwing |
| `apps/web/src/features/camera/useCamera.ts` | Additive camera readiness + track-end recovery hardening |
| `apps/web/src/pages/ExportPage.tsx` | No changes (caller) |
| `apps/web/src/pages/solo/SoloCollagePage.tsx` | No changes (caller) |

## CHANGE 1 — Download fallback (`collage-export.ts` → `saveCollageBlob`)
In the share `catch` block, keep `if (isShareCancelled(err)) return "cancelled";`
but REMOVE `throw err;` so execution falls through to the existing anchor
`<a download>` path (which returns `"downloaded"` and already revokes the object
URL in `finally`). No signature/return-type change. Callers unchanged.

Rationale: `navigator.share()` needs transient user activation; after the async
`html2canvas`/`fetch` it can reject with `NotAllowedError` on slow phones. The
fallback guarantees a saved file on every device.

## CHANGE 2 — `videoReady` robustness (`useCamera.ts`), purely additive
- Add `pollRef = useRef<ReturnType<typeof window.setInterval> | null>(null)`.
- Add stable `startReadyPoll(video)` (`useCallback` dep `[markVideoReady]`): clears
  any prior poll, then `setInterval(250ms)`; when `video.videoWidth > 0` call
  `markVideoReady(video)` and clear; stop after 8 ticks (~2s) regardless.
- In `setVideoRef`, also listen to `canplay`, `playing`, `timeupdate` (same
  `onReady`), remove them all in cleanup, and cancel `pollRef` in cleanup. Call
  `startReadyPoll(node)` after attaching the stream. Update deps to
  `[markVideoReady, startReadyPoll]`.
- In `init`, after each `attachStreamToVideo(...)` call `startReadyPoll(videoRef.current)`.
  Update `init` deps to `[startReadyPoll]` (stable → effect won't re-run).
- In the unmount `useEffect` cleanup, clear `pollRef`.

This can only flip `videoReady` false→true; it never disables the camera.

## CHANGE 3 — Re-acquire camera when the track ends (`useCamera.ts`)
- Add `mountedRef = useRef(true)` and `trackEndedCleanupRef = useRef<(()=>void)|null>(null)`.
- Add `initRef = useRef(init)` synced via `useEffect(() => { initRef.current = init; }, [init])`
  to avoid a circular `useCallback` dependency.
- In `init`, after each successful attach+poll (primary and fallback paths), register
  an `ended` listener on the video tracks; handler: `if (mountedRef.current) void initRef.current(facing);`.
  Before registering, call `trackEndedCleanupRef.current?.()` to remove any prior
  listener; store the new remover in `trackEndedCleanupRef`.
- In the unmount cleanup: set `mountedRef.current = false`, call
  `trackEndedCleanupRef.current?.()` then null it (in addition to the Change 2 poll
  clear and existing track stop). At the top of the effect body set
  `mountedRef.current = true` (StrictMode reset).

Loop-safety: a permanently revoked permission makes the re-init hit the inner
`catch` (sets `error: "denied"`), so no `ended` listener is re-registered → no loop.

## Verification
1. `pnpm --filter @photosocial/web typecheck` — zero errors.
2. `pnpm --filter @photosocial/web build` — clean.
3. Re-run `playwright.repro.config.ts` / `e2e-repro/responsive-bughunt.spec.ts`:
   expect DOWNLOAD `downloaded=true` on desktop/tablet/phone; TAKE PICTURES `ok`
   and EDIT FRAME `changed=true` unchanged.
4. Existing Playwright suite — no regressions.
5. Manual solo-flow smoke test on desktop.
6. Remove harness files before finishing.
