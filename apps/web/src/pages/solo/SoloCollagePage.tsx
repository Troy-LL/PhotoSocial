import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import confetti from "canvas-confetti";
import { getLayoutPresetMeta } from "@photosocial/shared";
import { CollageGrid } from "../../features/collage/CollageGrid";
import { useSolo } from "../../context/SoloContext";
import { applyThemePreference } from "../../lib/theme-preference";
import {
  downloadResultHint,
  exportCollageFromElement,
  isShareCancelled,
} from "../../lib/collage-export";
import { Button } from "../../components/Button";
import styles from "../ExportPage.module.css";

export function SoloCollagePage() {
  const { t } = useTranslation();
  const { data, sessionState, slotCount, reset } = useSolo();
  const [downloading, setDownloading] = useState(false);
  const [downloadHint, setDownloadHint] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    applyThemePreference({
      theme: data.theme,
      customHue: data.customHue,
    });
  }, [data]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
    }
  }, []);

  if (!data?.layout || !sessionState) {
    return <Navigate to="/solo" replace />;
  }

  const photoCount = Object.keys(data.photos).length;
  if (photoCount < slotCount) {
    return <Navigate to="/solo/camera" replace />;
  }

  const layoutMeta = getLayoutPresetMeta(data.layout);

  async function downloadCollage() {
    const el = document.getElementById("collage-export");
    if (!el) {
      setDownloadHint(t("collageDownloadFailed"));
      return;
    }
    setDownloading(true);
    setDownloadHint(null);
    try {
      const result = await exportCollageFromElement(
        el,
        layoutMeta.orientation,
        "PhotoSocial-solo.png"
      );
      const hint = downloadResultHint(result, t);
      if (hint) setDownloadHint(hint);
    } catch (err) {
      if (isShareCancelled(err)) return;
      setDownloadHint(t("collageDownloadFailed"));
    } finally {
      setDownloading(false);
    }
  }

  function handleMakeAnother() {
    reset();
    window.location.href = "/solo";
  }

  return (
    <div className={styles.page}>
      <h1>{t("soloDone")}</h1>

      <CollageGrid state={sessionState} slotPhotoFits={data.photoFits} />

      {downloadHint && <p className={styles.hint}>{downloadHint}</p>}

      <Button
        fullWidth
        className={styles.download}
        onClick={downloadCollage}
        disabled={downloading}
      >
        {downloading ? t("preparingDownload") : t("download")}
      </Button>

      <Button variant="ghost" fullWidth onClick={handleMakeAnother}>
        {t("makeAnother")}
      </Button>
    </div>
  );
}
