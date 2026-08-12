import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import confetti from "canvas-confetti";
import { getLayoutPresetMeta, slotHasPhoto } from "@photosocial/shared";
import { useSession } from "../context/SessionContext";
import { CollageGrid } from "../features/collage/CollageGrid";
import { mergeCachedPhotosIntoState } from "../lib/collage-photo-cache";
import {
  downloadResultHint,
  exportCollageFromElement,
  isShareCancelled,
  saveCollageFromUrl,
} from "../lib/collage-export";
import { clearSession } from "../lib/session-storage";
import { Button } from "../components/Button";
import styles from "./ExportPage.module.css";

export function ExportPage() {
  const { t } = useTranslation();
  const { stored, state, loading, refresh } = useSession();
  const [downloading, setDownloading] = useState(false);
  const [downloadHint, setDownloadHint] = useState<string | null>(null);

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
  const layoutMeta = getLayoutPresetMeta(exportState.session.layout.preset);
  const filename = `PhotoSocial-${stored.partyCode}.png`;

  async function downloadCollage() {
    setDownloading(true);
    setDownloadHint(null);
    try {
      let result;
      if (finalUrl) {
        result = await saveCollageFromUrl(finalUrl, filename);
      } else {
        const el = document.getElementById("collage-export");
        if (!el) {
          setDownloadHint(t("collageDownloadFailed"));
          return;
        }
        result = await exportCollageFromElement(
          el,
          layoutMeta.orientation,
          filename
        );
      }
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
        {downloadHint ??
          (hasPhotos ? t("collageDownloadHint") : t("collageDownloadMissingPhotos"))}
      </p>

      <Button
        fullWidth
        className={styles.download}
        onClick={downloadCollage}
        disabled={downloading || !hasPhotos}
      >
        {downloading ? t("preparingDownload") : t("download")}
      </Button>

      <Button variant="ghost" fullWidth onClick={handleMakeAnother}>
        {t("makeAnother")}
      </Button>
    </div>
  );
}
