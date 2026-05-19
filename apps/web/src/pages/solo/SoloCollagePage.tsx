import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import confetti from "canvas-confetti";
import { CollageGrid } from "../../features/collage/CollageGrid";
import { useSolo } from "../../context/SoloContext";
import { applyThemePreference } from "../../lib/theme-preference";
import { Button } from "../../components/Button";
import styles from "../ExportPage.module.css";

export function SoloCollagePage() {
  const { t } = useTranslation();
  const { data, sessionState, slotCount, reset } = useSolo();

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

  async function downloadCollage() {
    const { default: html2canvas } = await import("html2canvas");
    const el = document.getElementById("collage-export");
    if (!el) return;
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const link = document.createElement("a");
    link.download = "PhotoSocial-solo.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function handleMakeAnother() {
    reset();
    window.location.href = "/solo";
  }

  return (
    <div className={styles.page}>
      <h1>{t("soloDone")}</h1>

      <CollageGrid state={sessionState} slotPhotoFits={data.photoFits} />

      <Button fullWidth onClick={downloadCollage}>
        {t("download")}
      </Button>

      <Button variant="ghost" fullWidth onClick={handleMakeAnother}>
        {t("makeAnother")}
      </Button>
    </div>
  );
}
