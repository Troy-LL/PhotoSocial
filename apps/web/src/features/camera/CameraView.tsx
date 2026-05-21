import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { createLayout, type LayoutPreset } from "@photosocial/shared";
import { Button } from "../../components/Button";
import { CameraPermissionPlaceholder } from "./CameraPermissionPlaceholder";
import { useCamera, startCountdown } from "./useCamera";
import {
  getAutoPauseMs,
  getCollageFlashMs,
  loadAutoShootPreference,
  saveAutoShootPreference,
} from "./camera-preferences";
import { useMediaQuery } from "./useMediaQuery";
import { SlotPhoto } from "./SlotPhoto";
import {
  DEFAULT_SLOT_PHOTO_FIT,
  slotFitAxis,
  type SlotPhotoFit,
} from "./slot-photo-fit";
import styles from "./CameraView.module.css";

const COUNTDOWNS = [3, 5, 10] as const;

interface CameraViewProps {
  onCapture: (blob: Blob) => boolean | void | Promise<boolean | void>;
  onCancel?: () => void;
  frameOverlay?: {
    preset: LayoutPreset;
    activeSlot: number;
  };
  slotPhotos?: Record<number, string>;
  slotPhotoFits?: Record<number, SlotPhotoFit>;
  /** Tap a filled slot — parent shows retake / adjust framing */
  onSlotInteract?: (slotIndex: number) => void;
  /** @deprecated Use onSlotInteract; immediate retake without menu */
  onSlotSelect?: (slotIndex: number) => void;
  canRetakeSlot?: (slotIndex: number) => boolean;
  continuous?: boolean;
  captureDisabled?: boolean;
  doneAction?: ReactNode;
  /** Shown during auto-pause between shots */
  photoProgress?: { current: number; total: number };
  /** Bump to schedule auto countdown (e.g. after retaking a slot) */
  autoResumeKey?: number;
  /** Replace camera with full collage; tap slots for retake / framing */
  reviewMode?: boolean;
}

export function CameraView({
  onCapture,
  onCancel,
  frameOverlay,
  slotPhotos = {},
  slotPhotoFits = {},
  onSlotInteract,
  onSlotSelect,
  canRetakeSlot,
  continuous = Boolean(frameOverlay),
  captureDisabled = false,
  doneAction,
  photoProgress,
  autoResumeKey = 0,
  reviewMode = false,
}: CameraViewProps) {
  const { t } = useTranslation();
  const {
    setVideoRef,
    error,
    mirror,
    setMirror,
    capture,
    stream,
    videoReady,
    init,
  } = useCamera();

  const [preview, setPreview] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [countdownSec, setCountdownSec] = useState<3 | 5 | 10>(3);
  const [capturing, setCapturing] = useState(false);
  const [autoShoot, setAutoShoot] = useState(loadAutoShootPreference);
  const [getReadyHint, setGetReadyHint] = useState<string | null>(null);
  const [collageFlash, setCollageFlash] = useState(false);

  const isMobile = useMediaQuery("(max-width: 767px)");
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;
  const collageFlashRef = useRef(collageFlash);
  collageFlashRef.current = collageFlash;

  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collageFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelCountdownRef = useRef<(() => void) | null>(null);
  /** Auto mode only chains shots after the user has pressed Snap / Take photo once */
  const hasStartedRef = useRef(false);

  const layout = frameOverlay ? createLayout(frameOverlay.preset) : null;
  const activeSlotDef = layout?.slots.find(
    (s) => s.index === frameOverlay?.activeSlot
  );
  const cameraDenied = Boolean(error) && !stream;
  const canUseCamera =
    Boolean(stream) && videoReady && !error && !captureDisabled;
  const inStrip = Boolean(layout && activeSlotDef);
  const isHorizontal = layout?.orientation === "horizontal";
  const showCameraStage = inStrip;
  const useContinuous = continuous && inStrip;
  const isCountingDown = countdown !== null;
  const inReview = inStrip && reviewMode;

  const boothStateRef = useRef({
    autoShoot,
    canUseCamera,
    captureDisabled,
    capturing,
    countdown,
    countdownSec,
    photoProgress,
    useContinuous,
    videoReady,
  });
  boothStateRef.current = {
    autoShoot,
    canUseCamera,
    captureDisabled,
    capturing,
    countdown,
    countdownSec,
    photoProgress,
    useContinuous,
    videoReady,
  };

  const clearCollageFlash = useCallback(() => {
    if (collageFlashTimerRef.current) {
      clearTimeout(collageFlashTimerRef.current);
      collageFlashTimerRef.current = null;
    }
    setCollageFlash(false);
  }, []);

  const showCollageFlashRef = useRef<() => Promise<void>>(() => Promise.resolve());

  showCollageFlashRef.current = () => {
    if (!isMobileRef.current || !layout) {
      return Promise.resolve();
    }
    clearCollageFlash();
    setCollageFlash(true);
    return new Promise<void>((resolve) => {
      collageFlashTimerRef.current = setTimeout(() => {
        collageFlashTimerRef.current = null;
        setCollageFlash(false);
        resolve();
      }, getCollageFlashMs());
    });
  };

  const cancelScheduled = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    cancelCountdownRef.current?.();
    cancelCountdownRef.current = null;
    setGetReadyHint(null);
    clearCollageFlash();
  }, [clearCollageFlash]);

  const runCountdownRef = useRef<() => void>(() => {});

  runCountdownRef.current = () => {
    const s = boothStateRef.current;
    if (
      !s.canUseCamera ||
      s.capturing ||
      s.countdown !== null ||
      collageFlashRef.current
    ) {
      return;
    }

    setCountdown(s.countdownSec);
    cancelCountdownRef.current = startCountdown(
      s.countdownSec,
      (n) => setCountdown(n),
      () => {
        setCountdown(null);
        cancelCountdownRef.current = null;
        void doCaptureRef.current();
      }
    );
  };

  const scheduleAutoCaptureRef = useRef<() => void>(() => {});

  scheduleAutoCaptureRef.current = () => {
    const s = boothStateRef.current;
    if (!hasStartedRef.current || !s.autoShoot || !s.canUseCamera || s.captureDisabled) {
      return;
    }
    cancelScheduled();

    const progress = s.photoProgress;
    if (progress && progress.total > 1) {
      setGetReadyHint(
        t("getReadyForPhoto", {
          current: progress.current,
          total: progress.total,
        })
      );
    } else {
      setGetReadyHint(t("getReadyNextShot"));
    }

    autoTimerRef.current = setTimeout(() => {
      autoTimerRef.current = null;
      setGetReadyHint(null);
      runCountdownRef.current();
    }, getAutoPauseMs());
  };

  const doCaptureRef = useRef<() => Promise<void>>(async () => {});

  doCaptureRef.current = async () => {
    const blob = capture();
    if (!blob) {
      if (boothStateRef.current.autoShoot) {
        autoTimerRef.current = setTimeout(() => {
          autoTimerRef.current = null;
          runCountdownRef.current();
        }, boothStateRef.current.videoReady ? 400 : 1200);
      }
      return;
    }
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    if (navigator.vibrate) navigator.vibrate(50);

    if (boothStateRef.current.useContinuous) {
      let continueAuto = true;
      setCapturing(true);
      try {
        const result = await onCapture(blob);
        continueAuto = result !== false;
      } finally {
        setCapturing(false);
      }
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      await showCollageFlashRef.current();
      if (continueAuto && boothStateRef.current.autoShoot) {
        scheduleAutoCaptureRef.current();
      }
      return;
    }

    const url = URL.createObjectURL(blob);
    setPreview(url);
    setPreviewBlob(blob);
  };

  function handleShutter() {
    if (
      (useContinuous ? capturing || isCountingDown || collageFlash : preview) ||
      !canUseCamera
    ) {
      return;
    }
    hasStartedRef.current = true;
    cancelScheduled();
    runCountdownRef.current();
  }

  function handleAutoShootChange(enabled: boolean) {
    setAutoShoot(enabled);
    saveAutoShootPreference(enabled);
    if (!enabled) {
      cancelScheduled();
    } else if (canUseCamera && !captureDisabled && hasStartedRef.current) {
      scheduleAutoCaptureRef.current();
    }
  }

  function handleRetake() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPreviewBlob(null);
  }

  function handleSubmit() {
    if (previewBlob) void onCapture(previewBlob);
  }

  useEffect(() => () => cancelScheduled(), [cancelScheduled]);

  useEffect(() => {
    if (autoResumeKey > 0) {
      cancelScheduled();
    }
  }, [autoResumeKey, cancelScheduled]);

  useEffect(() => {
    if (captureDisabled) cancelScheduled();
  }, [captureDisabled, cancelScheduled]);

  const mediaStyle = {
    transform: mirror ? "scaleX(-1)" : undefined,
  };

  function renderCameraMedia(className: string, compact?: boolean) {
    if (!useContinuous && preview) {
      return (
        <img
          src={preview}
          alt={t("capturePreview")}
          className={className}
          style={mediaStyle}
        />
      );
    }
    if (cameraDenied) {
      return (
        <CameraPermissionPlaceholder
          compact={compact}
          onRetry={() => void init("user")}
        />
      );
    }
    return (
      <>
        {!stream && (
          <div className={styles.slotLoading} aria-busy="true" aria-hidden="true" />
        )}
        <video
          ref={setVideoRef}
          className={className}
          playsInline
          muted
          autoPlay
          style={mediaStyle}
          aria-label={t("liveCameraFeed")}
        />
      </>
    );
  }

  function renderStageOverlays() {
    return (
      <>
        {flash && <div className={styles.flash} aria-hidden="true" />}
        {getReadyHint && !isCountingDown && (
          <div
            className={styles.getReadyOverlay}
            role="status"
            aria-live="polite"
          >
            {getReadyHint}
          </div>
        )}
        {isCountingDown && (
          <div className={styles.countdown} aria-live="assertive">
            {countdown}
          </div>
        )}
      </>
    );
  }

  function handleFilledSlotPress(slotIndex: number) {
    cancelScheduled();
    clearCollageFlash();
    if (onSlotInteract) {
      onSlotInteract(slotIndex);
    } else {
      onSlotSelect?.(slotIndex);
    }
  }

  function renderStripGrid(variant: "aside" | "flash" | "review" = "aside") {
    const stripLabel = photoProgress
      ? t("collageStripProgress", {
          current: photoProgress.current,
          total: photoProgress.total,
        })
      : t("collageStripPreview");

    return (
      <div
        className={`${styles.strip} ${
          variant === "flash" ? styles.collageFlashStrip : ""
        } ${variant === "review" ? styles.collageReviewStrip : ""} ${
          layout!.orientation === "vertical"
            ? styles.stripVertical
            : styles.stripHorizontal
        }`}
        style={{
          gridTemplateColumns: `repeat(${layout!.cols}, 1fr)`,
          gridTemplateRows: `repeat(${layout!.rows}, 1fr)`,
          aspectRatio: layout!.aspectRatio,
        }}
        role="group"
        aria-label={stripLabel}
      >
        {layout!.slots.map((slot) => {
          const cellStyle = {
            gridRow: `${slot.row + 1} / span ${slot.rowSpan}`,
            gridColumn: `${slot.col + 1} / span ${slot.colSpan}`,
          };
          const photoUrl = slotPhotos[slot.index];
          const isActive =
            !inReview && slot.index === frameOverlay!.activeSlot;
          const retakable =
            Boolean(photoUrl) &&
            (canRetakeSlot
              ? canRetakeSlot(slot.index)
              : Boolean(onSlotInteract || onSlotSelect));
          const axis = slotFitAxis(
            slot.rowSpan,
            slot.colSpan,
            layout!.orientation
          );
          const fit = slotPhotoFits[slot.index] ?? DEFAULT_SLOT_PHOTO_FIT;

          if (photoUrl) {
            const cell = (
              <>
                <SlotPhoto
                  src={photoUrl}
                  alt={t("slotPhotoAlt", { slot: slot.index + 1 })}
                  axis={axis}
                  fit={fit}
                  className={styles.slotPhoto}
                />
                {isActive && (
                  <span className={styles.activeBadge} aria-hidden="true" />
                )}
              </>
            );

            if (retakable && (onSlotInteract || onSlotSelect)) {
              return (
                <button
                  key={slot.index}
                  type="button"
                  className={`${styles.filledSlot} ${isActive ? styles.filledSlotActive : ""}`}
                  style={cellStyle}
                  onClick={() => handleFilledSlotPress(slot.index)}
                  aria-label={t("slotPhotoActions", { slot: slot.index + 1 })}
                  aria-current={isActive ? "true" : undefined}
                >
                  {cell}
                </button>
              );
            }

            return (
              <div
                key={slot.index}
                className={`${styles.filledSlot} ${isActive ? styles.filledSlotActive : ""}`}
                style={cellStyle}
                aria-hidden={!isActive}
              >
                {cell}
              </div>
            );
          }

          if (isActive) {
            return (
              <div
                key={slot.index}
                className={styles.liveSlot}
                style={cellStyle}
                aria-current="true"
                aria-label={t("activeSlot", { slot: slot.index + 1 })}
              >
                <div className={styles.liveSlotMarker} aria-hidden="true" />
              </div>
            );
          }

          return (
            <div
              key={slot.index}
              className={styles.emptySlot}
              style={cellStyle}
              aria-hidden="true"
            />
          );
        })}
      </div>
    );
  }

  const shutterLabel = autoShoot ? t("takePhotoNow") : t("takePhoto");

  const controls = (
    <div className={styles.controls}>
      {cameraDenied && !inStrip && (
        <p className={styles.permissionBanner}>{t("cameraPermissionHint")}</p>
      )}

      {!inReview && (
      <div className={styles.settingsRow}>
        <div className={styles.settingGroup}>
          <button
            type="button"
            className={`${styles.optionBtn} ${styles.mirrorBtn} ${mirror ? styles.active : ""}`}
            aria-pressed={mirror}
            onClick={() => setMirror((m) => !m)}
            disabled={!canUseCamera}
          >
            {t("mirror")}
          </button>
        </div>

        <div className={styles.settingGroup}>
          <span className={styles.settingLabel} id="camera-auto-label">
            {t("shootMode")}
          </span>
          <div
            className={styles.segmented}
            role="radiogroup"
            aria-labelledby="camera-auto-label"
          >
            <button
              type="button"
              role="radio"
              aria-checked={autoShoot}
              className={`${styles.optionBtn} ${autoShoot ? styles.active : ""}`}
              onClick={() => handleAutoShootChange(true)}
              disabled={!canUseCamera && !autoShoot}
            >
              {t("shootModeAuto")}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!autoShoot}
              className={`${styles.optionBtn} ${!autoShoot ? styles.active : ""}`}
              onClick={() => handleAutoShootChange(false)}
            >
              {t("shootModeManual")}
            </button>
          </div>
        </div>

        <div className={styles.settingGroup}>
          <span className={styles.settingLabel} id="camera-countdown-label">
            {t("countdown")}
          </span>
          <div
            className={styles.segmented}
            role="radiogroup"
            aria-labelledby="camera-countdown-label"
          >
            {COUNTDOWNS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={countdownSec === n}
                className={`${styles.optionBtn} ${countdownSec === n ? styles.active : ""}`}
                onClick={() => setCountdownSec(n)}
                disabled={!canUseCamera}
              >
                {t("countdownSeconds", { seconds: n })}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      <div className={styles.actions}>
        {inReview ? (
          doneAction
        ) : useContinuous ? (
          <>
            <Button
              onClick={handleShutter}
              fullWidth
              disabled={!canUseCamera || capturing || isCountingDown || collageFlash}
              aria-label={shutterLabel}
            >
              {capturing ? t("savingPhoto") : shutterLabel}
            </Button>
            {doneAction}
          </>
        ) : preview ? (
          <>
            <Button variant="secondary" onClick={handleRetake}>
              {t("retake")}
            </Button>
            <Button onClick={handleSubmit}>{t("submitPhoto")}</Button>
          </>
        ) : (
          <Button
            onClick={handleShutter}
            fullWidth
            disabled={!canUseCamera}
          >
            {t("takePhoto")}
          </Button>
        )}
      </div>

      {onCancel && (
        <div className={styles.controlsBack}>
          <Button variant="ghost" fullWidth onClick={onCancel}>
            {t("back")}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.wrap}>
      {inStrip ? (
        <div
          className={`${styles.stripStage} ${
            isHorizontal ? styles.stripStageHorizontal : styles.stripStageVertical
          }${inReview ? ` ${styles.stripStageReview}` : ""}`}
        >
          {showCameraStage && (
            <div
              className={`${styles.stageMain} ${inReview ? styles.stageMainReview : ""}`}
            >
              {!inReview && renderStageOverlays()}
              {!inReview && collageFlash && isMobile && (
                <div
                  className={styles.collageFlashOverlay}
                  role="status"
                  aria-live="polite"
                  aria-label={t("collageStripPreview")}
                >
                  <div className={styles.collageFlashFrame}>
                    {renderStripGrid("flash")}
                  </div>
                </div>
              )}
              {inReview ? (
                <div className={styles.reviewCollageWrap}>
                  {renderStripGrid("review")}
                </div>
              ) : (
                <div className={styles.mainViewer}>
                  {renderCameraMedia(styles.video)}
                </div>
              )}
            </div>
          )}
          {!isMobile && !inReview && (
            <div className={styles.stripAside}>{renderStripGrid()}</div>
          )}
          {isMobile && !inReview && !collageFlash && (
            <div className={styles.stripMobileProgress}>{renderStripGrid()}</div>
          )}
        </div>
      ) : (
        <div className={styles.viewer}>
          {renderStageOverlays()}
          {renderCameraMedia(styles.video)}
        </div>
      )}

      {controls}
    </div>
  );
}


