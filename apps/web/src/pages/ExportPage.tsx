import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import confetti from "canvas-confetti";
import { useSession } from "../context/SessionContext";
import { CollageGrid } from "../features/collage/CollageGrid";
import { clearSession } from "../lib/session-storage";
import { Button } from "../components/Button";
import styles from "./ExportPage.module.css";

export function ExportPage() {
  const { t } = useTranslation();
  const { stored, state, loading } = useSession();

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
    }
  }, []);

  if (loading || !state || !stored) {
    return <p>Loading…</p>;
  }

  const finalUrl = state.session.finalCollageUrl;

  async function downloadCollage() {
    if (finalUrl) {
      const a = document.createElement("a");
      a.href = finalUrl;
      a.download = `PhotoSocial-${stored!.partyCode}.jpg`;
      a.click();
      return;
    }
    const { default: html2canvas } = await import("html2canvas");
    const el = document.getElementById("collage-export");
    if (!el) return;
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const link = document.createElement("a");
    link.download = `PhotoSocial-${stored!.partyCode}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function handleMakeAnother() {
    clearSession();
    window.location.href = "/";
  }

  return (
    <div className={styles.page}>
      <h1>{t("allPhotosIn")}</h1>

      {finalUrl ? (
        <img
          src={finalUrl}
          alt={t("collageStripPreview")}
          className={styles.finalPreview}
        />
      ) : (
        <div id="collage-export">
          <CollageGrid state={state} />
        </div>
      )}

      {state.session.finalCollageExpiresAt && (
        <p className={styles.hint}>{t("collageDownloadWindow")}</p>
      )}

      <Button fullWidth onClick={downloadCollage}>
        {t("download")}
      </Button>

      <Button variant="ghost" fullWidth onClick={handleMakeAnother}>
        {t("makeAnother")}
      </Button>
    </div>
  );
}
