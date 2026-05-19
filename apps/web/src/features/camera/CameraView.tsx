import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createLayout, type FilterKey, type LayoutPreset } from "@photosocial/shared";
import { Button } from "../../components/Button";
import { CameraPermissionPlaceholder } from "./CameraPermissionPlaceholder";
import { useCamera, startCountdown } from "./useCamera";
import styles from "./CameraView.module.css";

const FILTERS: FilterKey[] = ["none", "bw", "warm", "cool", "fade"];
const COUNTDOWNS = [3, 5, 10] as const;

interface CameraViewProps {
  onCapture: (blob: Blob) => void;
  onCancel?: () => void;
  frameOverlay?: {
    preset: LayoutPreset;
    assignedSlot: number;
  };
}

export function CameraView({ onCapture, onCancel, frameOverlay }: CameraViewProps) {
  const { t } = useTranslation();
  const {
    videoRef,
    error,
    mirror,
    setMirror,
    filter,
    setFilter,
    capture,
    filterCss,
    stream,
    init,
  } = useCamera();

  const [preview, setPreview] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [countdownSec, setCountdownSec] = useState<3 | 5 | 10>(3);

  const layout = frameOverlay ? createLayout(frameOverlay.preset) : null;
  const activeSlotDef = layout?.slots.find(
    (s) => s.index === frameOverlay?.assignedSlot
  );
  const cameraDenied = Boolean(error);
  const canUseCamera = Boolean(stream) && !error;
  const inStrip = Boolean(layout && activeSlotDef);

  function doCapture() {
    const blob = capture();
    if (!blob) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    if (navigator.vibrate) navigator.vibrate(50);
    const url = URL.createObjectURL(blob);
    setPreview(url);
    setPreviewBlob(blob);
  }

  function handleShutter() {
    if (preview || !canUseCamera) return;
    setCountdown(countdownSec);
    startCountdown(
      countdownSec,
      (n) => setCountdown(n),
      () => {
        setCountdown(null);
        doCapture();
      }
    );
  }

  function handleRetake() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPreviewBlob(null);
  }

  function handleSubmit() {
    if (previewBlob) onCapture(previewBlob);
  }

  const mediaStyle = {
    transform: mirror ? "scaleX(-1)" : undefined,
    filter: filterCss,
  };

  function renderSlotMedia(compact?: boolean) {
    if (preview) {
      return (
        <img
          src={preview}
          alt="Preview"
          className={styles.slotMedia}
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
    if (!stream) {
      return <div className={styles.slotLoading} aria-hidden="true" />;
    }
    return (
      <video
        ref={videoRef}
        className={styles.slotMedia}
        playsInline
        muted
        style={mediaStyle}
      />
    );
  }

  const controls = (
    <div className={styles.controls}>
      {cameraDenied && !inStrip && (
        <p className={styles.permissionBanner}>{t("cameraPermissionHint")}</p>
      )}

      <div className={styles.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`${styles.filterBtn} ${filter === f ? styles.active : ""}`}
            onClick={() => setFilter(f)}
            disabled={!canUseCamera}
          >
            {f}
          </button>
        ))}
      </div>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={mirror}
          onChange={(e) => setMirror(e.target.checked)}
          disabled={!canUseCamera}
        />
        {t("mirror")}
      </label>

      <label className={styles.toggle}>
        {t("countdown")}{" "}
        <select
          value={countdownSec}
          onChange={(e) =>
            setCountdownSec(Number(e.target.value) as 3 | 5 | 10)
          }
          disabled={!canUseCamera}
        >
          {COUNTDOWNS.map((n) => (
            <option key={n} value={n}>
              {n}s
            </option>
          ))}
        </select>
      </label>

      <div className={styles.actions}>
        {preview ? (
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
        <Button variant="ghost" fullWidth onClick={onCancel}>
          Back
        </Button>
      )}
    </div>
  );

  return (
    <div className={styles.wrap}>
      {flash && <div className={styles.flash} aria-hidden="true" />}
      {countdown !== null && (
        <div className={styles.countdown} aria-live="assertive">
          {countdown}
        </div>
      )}

      {inStrip ? (
        <div className={styles.stripStage}>
          <div
            className={`${styles.strip} ${
              layout!.orientation === "vertical"
                ? styles.stripVertical
                : styles.stripHorizontal
            }`}
            style={{
              gridTemplateColumns: `repeat(${layout!.cols}, 1fr)`,
              gridTemplateRows: `repeat(${layout!.rows}, 1fr)`,
            }}
            role="img"
            aria-label="Collage frame preview"
          >
            {layout!.slots.map((slot) => {
              const cellStyle = {
                gridRow: `${slot.row + 1} / span ${slot.rowSpan}`,
                gridColumn: `${slot.col + 1} / span ${slot.colSpan}`,
              };
              const isActive = slot.index === frameOverlay!.assignedSlot;

              if (isActive) {
                return (
                  <div
                    key={slot.index}
                    className={styles.liveSlot}
                    style={cellStyle}
                  >
                    {renderSlotMedia(true)}
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
        </div>
      ) : (
        <div className={styles.viewer}>
          {preview ? (
            <img src={preview} alt="Preview" className={styles.preview} />
          ) : cameraDenied ? (
            <CameraPermissionPlaceholder
              onRetry={() => void init("user")}
            />
          ) : !stream ? (
            <div className={styles.slotLoading} aria-busy="true" />
          ) : (
            <video
              ref={videoRef}
              className={styles.video}
              playsInline
              muted
              style={mediaStyle}
            />
          )}
        </div>
      )}

      {controls}
    </div>
  );
}
