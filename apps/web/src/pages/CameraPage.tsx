import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { createLayout, slotHasPhoto, slotPhotoDisplayUrl } from "@photosocial/shared";
import { CameraView } from "../features/camera/CameraView";
import { SlotActionSheet } from "../features/camera/SlotActionSheet";
import { SlotFramingEditor } from "../features/camera/SlotFramingEditor";
import {
  DEFAULT_SLOT_PHOTO_FIT,
  slotDisplayAspectRatio,
  slotFitAxis,
  type SlotPhotoFit,
} from "../features/camera/slot-photo-fit";
import { useMyPhotoProgress, useSession } from "../context/SessionContext";
import { api, photoUrl } from "../lib/api";
import { Button } from "../components/Button";
import styles from "./CameraPage.module.css";

function firstEmptySlot(
  assignedSlots: number[],
  slotPhotos: Record<number, string>
): number {
  for (const idx of assignedSlots) {
    if (!slotPhotos[idx]) return idx;
  }
  return assignedSlots[assignedSlots.length - 1] ?? 0;
}

export function CameraPage() {
  const { t } = useTranslation();
  const { code } = useParams();
  const navigate = useNavigate();
  const { stored, state, isHost, assignedSlots, refresh } = useSession();
  const [uploadError, setUploadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false);
  const [autoResumeKey, setAutoResumeKey] = useState(0);
  const [menuSlot, setMenuSlot] = useState<number | null>(null);
  const [framingSlot, setFramingSlot] = useState<number | null>(null);
  const [photoFits, setPhotoFits] = useState<Record<number, SlotPhotoFit>>({});
  const [focusSlot, setFocusSlot] = useState<number | null>(null);

  const progress = useMyPhotoProgress(state, stored?.participantId);
  const inReview = progress.allFilled && !isRetaking;

  const layout = state?.session.layout.preset
    ? createLayout(state.session.layout.preset)
    : null;

  const slotPhotos = useMemo(() => {
    if (!state) return {};
    const map: Record<number, string> = {};
    for (const slot of state.collage.slots) {
      const src = slotPhotoDisplayUrl(slot);
      if (src) map[slot.index] = photoUrl(src);
    }
    return map;
  }, [state]);

  const mySlotPhotos = useMemo(() => {
    const map: Record<number, string> = {};
    for (const idx of assignedSlots) {
      if (slotPhotos[idx]) map[idx] = slotPhotos[idx];
    }
    return map;
  }, [assignedSlots, slotPhotos]);

  const activeSlot = useMemo(() => {
    if (assignedSlots.length === 0) return null;
    if (progress.allFilled) {
      return focusSlot ?? assignedSlots[0];
    }
    if (focusSlot !== null && !mySlotPhotos[focusSlot]) {
      return focusSlot;
    }
    return firstEmptySlot(assignedSlots, mySlotPhotos);
  }, [assignedSlots, progress.allFilled, focusSlot, mySlotPhotos]);

  async function handleCapture(blob: Blob): Promise<boolean> {
    if (!stored || activeSlot === null) return false;
    setUploadError(false);
    setUploading(true);
    try {
      const res = await api.uploadPhoto(
        stored.sessionId,
        stored.wsToken,
        blob,
        activeSlot
      );
      if (!res.success) {
        setUploadError(true);
        return false;
      }
      await refresh();
      setIsRetaking(false);
      setFocusSlot(null);
      return progress.filled + 1 < progress.total;
    } finally {
      setUploading(false);
    }
  }

  async function handleRetakeFromMenu() {
    if (!stored || menuSlot === null || !canRetakeSlot(menuSlot)) return;
    const res = await api.clearSlotPhoto(stored.sessionId, stored.wsToken, {
      slotIndex: menuSlot,
    });
    if (!res.success) return;
    await refresh();
    const { [menuSlot]: _removed, ...rest } = photoFits;
    setPhotoFits(rest);
    if (assignedSlots.includes(menuSlot)) {
      setIsRetaking(true);
      setFocusSlot(menuSlot);
      setAutoResumeKey((k) => k + 1);
    }
    setMenuSlot(null);
  }

  function handleSlotInteract(slotIndex: number) {
    if (!canRetakeSlot(slotIndex)) return;
    setMenuSlot(slotIndex);
  }

  function canRetakeSlot(slotIndex: number): boolean {
    if (!state || !stored) return false;
    if (!assignedSlots.includes(slotIndex)) return false;
    const slot = state.collage.slots.find((s) => s.index === slotIndex);
    if (!slotHasPhoto(slot)) return false;
    const assigneeId = state.session.layout.slots.find(
      (s) => s.index === slotIndex
    )?.assignedTo;
    if (!assigneeId) return false;
    return isHost || assigneeId === stored.participantId;
  }

  const framingSlotDef =
    framingSlot !== null && layout
      ? layout.slots.find((s) => s.index === framingSlot)
      : undefined;

  const framingImageUrl =
    framingSlot !== null ? slotPhotos[framingSlot] : undefined;

  if (assignedSlots.length === 0) {
    return (
      <p className={styles.waiting}>{t("waitingForAssignment")}</p>
    );
  }

  const canCapture =
    activeSlot !== null &&
    !mySlotPhotos[activeSlot] &&
    (!progress.allFilled || isRetaking);

  const noticeKey = inReview
    ? "allPhotosInTapToRetake"
    : progress.total > 1
      ? "slotsAssignedMulti"
      : "slotAssigned";

  const noticeParams =
    inReview || progress.total > 1
      ? { current: progress.filled + (canCapture ? 1 : 0), total: progress.total, slot: (activeSlot ?? 0) + 1 }
      : { slot: (activeSlot ?? 0) + 1 };

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={inReview ? "done" : `slot-${activeSlot}`}
          className={styles.notice}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          {t(noticeKey, noticeParams)}
        </motion.div>
      </AnimatePresence>

      <CameraView
        onCapture={handleCapture}
        captureDisabled={uploading || !canCapture}
        reviewMode={inReview}
        autoResumeKey={autoResumeKey}
        photoProgress={
          progress.total > 1
            ? {
                current: Math.min(
                  progress.filled + (canCapture ? 1 : progress.filled),
                  progress.total
                ),
                total: progress.total,
              }
            : undefined
        }
        frameOverlay={
          state?.session.layout.preset != null && activeSlot !== null
            ? {
                preset: state.session.layout.preset,
                activeSlot,
              }
            : undefined
        }
        slotPhotos={slotPhotos}
        slotPhotoFits={photoFits}
        onSlotInteract={handleSlotInteract}
        canRetakeSlot={canRetakeSlot}
        doneAction={
          inReview ? (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate(`/party/${code}/collage`)}
            >
              {t("viewCollage")}
            </Button>
          ) : undefined
        }
      />

      {menuSlot !== null && slotPhotos[menuSlot] && (
        <SlotActionSheet
          slotIndex={menuSlot}
          onAdjustFraming={() => {
            setFramingSlot(menuSlot);
            setMenuSlot(null);
          }}
          onRetake={() => void handleRetakeFromMenu()}
          onClose={() => setMenuSlot(null)}
        />
      )}

      {framingSlot !== null &&
        framingSlotDef &&
        framingImageUrl &&
        layout && (
          <SlotFramingEditor
            slotIndex={framingSlot}
            imageUrl={framingImageUrl}
            axis={slotFitAxis(
              framingSlotDef.rowSpan,
              framingSlotDef.colSpan,
              layout.orientation
            )}
            aspectRatio={slotDisplayAspectRatio(
              framingSlotDef.colSpan,
              framingSlotDef.rowSpan,
              layout.cols,
              layout.rows,
              layout.aspectRatio
            )}
            initialFit={photoFits[framingSlot] ?? DEFAULT_SLOT_PHOTO_FIT}
            onSave={(fit) => {
              setPhotoFits((prev) => ({ ...prev, [framingSlot]: fit }));
              setFramingSlot(null);
            }}
            onCancel={() => setFramingSlot(null)}
          />
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
    </motion.div>
  );
}
