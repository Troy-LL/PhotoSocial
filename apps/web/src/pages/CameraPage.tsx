import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { CameraView } from "../features/camera/CameraView";
import { StickerPanel } from "../features/stickers/StickerPanel";
import { useSession } from "../context/SessionContext";
import { api } from "../lib/api";
import styles from "./CameraPage.module.css";

export function CameraPage() {
  const { t } = useTranslation();
  const { code } = useParams();
  const navigate = useNavigate();
  const { stored, state, assignedSlot, refresh } = useSession();
  const [uploadError, setUploadError] = useState(false);
  const [slotNotice, setSlotNotice] = useState<number | null>(null);

  useEffect(() => {
    if (assignedSlot !== null) setSlotNotice(assignedSlot);
  }, [assignedSlot]);

  async function handleCapture(blob: Blob) {
    if (!stored) return;
    setUploadError(false);
    const res = await api.uploadPhoto(stored.sessionId, stored.wsToken, blob);
    if (!res.success) {
      setUploadError(true);
      return;
    }
    await refresh();
    navigate(`/party/${code}/collage`);
  }

  if (assignedSlot === null) {
    return (
      <p className={styles.waiting}>{t("waitingForAssignment")}</p>
    );
  }

  const me = state?.participants.find((p) => p.id === stored?.participantId);

  return (
    <div className={styles.page}>
      {slotNotice !== null && (
        <motion.div
          className={styles.notice}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {t("slotAssigned", { slot: assignedSlot + 1 })}
        </motion.div>
      )}

      <CameraView
        onCapture={handleCapture}
        frameOverlay={
          state?.session.layout.preset != null && assignedSlot !== null
            ? {
                preset: state.session.layout.preset,
                assignedSlot,
              }
            : undefined
        }
      />

      {me && !me.photoUrl && stored && (
        <StickerPanel targetScope="tile" targetId={stored.participantId} />
      )}

      {uploadError && (
        <button
          type="button"
          className={styles.retry}
          onClick={() => setUploadError(false)}
        >
          {t("uploadFailed")}
        </button>
      )}
    </div>
  );
}
