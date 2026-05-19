import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FilterKey } from "@passandpic/shared";
import { Button } from "../../components/Button";
import { useCamera, startCountdown } from "./useCamera";
import styles from "./CameraView.module.css";

const FILTERS: FilterKey[] = ["none", "bw", "warm", "cool", "fade"];
const COUNTDOWNS = [3, 5, 10] as const;

interface CameraViewProps {
  onCapture: (blob: Blob) => void;
  onCancel?: () => void;
}

export function CameraView({ onCapture, onCancel }: CameraViewProps) {
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
  } = useCamera();

  const [preview, setPreview] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [countdownSec, setCountdownSec] = useState<3 | 5 | 10>(3);

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
    if (preview) return;
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

  if (error) {
    return (
      <div className={styles.permission}>
        <h2>{t("cameraPermission")}</h2>
        <p>{t("cameraPermissionHint")}</p>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Back
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {flash && <div className={styles.flash} aria-hidden="true" />}
      {countdown !== null && (
        <div className={styles.countdown} aria-live="assertive">
          {countdown}
        </div>
      )}

      {preview ? (
        <img src={preview} alt="Preview" className={styles.preview} />
      ) : (
        <video
          ref={videoRef}
          className={styles.video}
          playsInline
          muted
          style={{
            transform: mirror ? "scaleX(-1)" : undefined,
            filter: filterCss,
          }}
        />
      )}

      <div className={styles.controls}>
        <div className={styles.filterRow}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`${styles.filterBtn} ${filter === f ? styles.active : ""}`}
              onClick={() => setFilter(f)}
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
            <Button onClick={handleShutter} fullWidth>
              {t("takePhoto")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
