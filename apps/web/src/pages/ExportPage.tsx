import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import confetti from "canvas-confetti";
import { slotHasPhoto } from "@photosocial/shared";
import { useSession } from "../context/SessionContext";
import { CollageGrid } from "../features/collage/CollageGrid";
import { mergeCachedPhotosIntoState } from "../lib/collage-photo-cache";
import { clearSession } from "../lib/session-storage";
import { Button } from "../components/Button";
import styles from "./ExportPage.module.css";

async function waitForCollageImages(root: HTMLElement): Promise<void> {
  const imgs = root.querySelectorAll("img");
  await Promise.all(
    Array.from(imgs).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
    )
  );
}

export function ExportPage() {
  const { t } = useTranslation();
  const { stored, state, loading, refresh } = useSession();
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
    }
  }, []);

  const exportState = useMemo(
    () =>
      state && stored
        ? mergeCachedPhotosIntoState(stored.sessionId, state)
        : null,
    [state, stored]
  );

  if (loading || !state || !stored || !exportState) {
    return <p>Loading…</p>;
  }

  const finalUrl = exportState.session.finalCollageUrl;
  const hasPhotos = exportState.collage.slots.some((s) => slotHasPhoto(s));

  async function downloadCollage() {
    if (finalUrl) {
      const a = document.createElement("a");
      a.href = finalUrl;
      a.download = `PhotoSocial-${stored!.partyCode}.jpg`;
      a.click();
      return;
    }
    const el = document.getElementById("collage-export");
    if (!el) return;
    setDownloading(true);
    try {
      await waitForCollageImages(el);
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `PhotoSocial-${stored!.partyCode}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  function handleMakeAnother() {
    clearSession();
    window.location.href = "/";
  }

  return (
    <div className={styles.page}>
      <h1>{hasPhotos ? t("allPhotosIn") : t("collageDownloadMissingPhotos")}</h1>

      {finalUrl ? (
        <img
          src={finalUrl}
          alt={t("collageStripPreview")}
          className={styles.finalPreview}
        />
      ) : (
        <CollageGrid state={exportState} id="collage-export" />
      )}

      <p className={styles.hint}>
        {hasPhotos ? t("collageDownloadHint") : t("collageDownloadMissingPhotos")}
      </p>

      <Button fullWidth onClick={downloadCollage} disabled={downloading || !hasPhotos}>
        {downloading ? t("preparingDownload") : t("download")}
      </Button>

      <Button variant="ghost" fullWidth onClick={handleMakeAnother}>
        {t("makeAnother")}
      </Button>
    </div>
  );
}
