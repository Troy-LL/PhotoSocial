import { useMemo, useState } from "react";

import { Navigate, useNavigate } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { motion, AnimatePresence } from "motion/react";

import { createLayout } from "@photosocial/shared";

import { CameraView } from "../../features/camera/CameraView";

import { SlotActionSheet } from "../../features/camera/SlotActionSheet";

import { SlotFramingEditor } from "../../features/camera/SlotFramingEditor";

import {
  slotDisplayAspectRatio,
  slotFitAxis,
} from "../../features/camera/slot-photo-fit";

import { useSolo } from "../../context/SoloContext";

import { Button } from "../../components/Button";

import styles from "../CameraPage.module.css";



function firstEmptySlot(photos: Record<number, string>, slotCount: number): number {

  for (let i = 0; i < slotCount; i++) {

    if (!photos[i]) return i;

  }

  return slotCount - 1;

}



export function SoloCameraPage() {

  const { t } = useTranslation();

  const navigate = useNavigate();

  const { data, slotCount, setPhoto, setPhotoFit, clearPhoto } = useSolo();

  const [currentSlot, setCurrentSlot] = useState(0);

  const [autoResumeKey, setAutoResumeKey] = useState(0);

  const [menuSlot, setMenuSlot] = useState<number | null>(null);

  const [framingSlot, setFramingSlot] = useState<number | null>(null);



  const photos = data?.photos ?? {};

  const photoFits = data?.photoFits ?? {};

  const filledCount = Object.keys(photos).length;

  const allFilled = filledCount >= slotCount;



  const layout = data?.layout ? createLayout(data.layout) : null;



  const activeSlot = useMemo(() => {

    if (!data) return 0;

    if (allFilled) return currentSlot;

    if (photos[currentSlot] === undefined) return currentSlot;

    return firstEmptySlot(photos, slotCount);

  }, [data, photos, currentSlot, slotCount, allFilled]);



  if (!data?.layout || !layout) {

    return <Navigate to="/solo" replace />;

  }



  function handleCapture(blob: Blob): boolean {

    const hadPhoto = Boolean(photos[activeSlot]);

    setPhoto(activeSlot, blob);

    const nextFilled = hadPhoto ? filledCount : filledCount + 1;

    if (nextFilled < slotCount) {

      setCurrentSlot(activeSlot + 1);

      return true;

    }

    return false;

  }



  function handleSlotInteract(slotIndex: number) {

    setMenuSlot(slotIndex);

  }



  function handleRetakeFromMenu() {

    if (menuSlot === null) return;

    clearPhoto(menuSlot);

    setCurrentSlot(menuSlot);

    setAutoResumeKey((k) => k + 1);

    setMenuSlot(null);

  }



  function handleOpenFraming() {

    if (menuSlot === null) return;

    setFramingSlot(menuSlot);

    setMenuSlot(null);

  }



  const framingSlotDef =

    framingSlot !== null

      ? layout.slots.find((s) => s.index === framingSlot)

      : undefined;



  return (

    <div
      className={`${styles.page}${allFilled ? ` ${styles.pageReview}` : ""}`}
    >

      <AnimatePresence mode="wait">

        <motion.div

          key={allFilled ? "done" : `slot-${activeSlot}`}

          className={styles.notice}

          initial={{ opacity: 0, y: -10 }}

          animate={{ opacity: 1, y: 0 }}

          exit={{ opacity: 0, y: -8 }}

          role="status"

          aria-live="polite"

        >

          {allFilled

            ? t("allPhotosInTapToRetake")

            : t("soloPhotoProgress", {

                current: activeSlot + 1,

                total: slotCount,

              })}

        </motion.div>

      </AnimatePresence>



      <CameraView

        onCapture={handleCapture}

        onCancel={() => navigate("/solo")}

        frameOverlay={{

          preset: data.layout,

                activeSlot,

        }}

        slotPhotos={photos}

        slotPhotoFits={photoFits}

        onSlotInteract={handleSlotInteract}

        canRetakeSlot={() => true}

        captureDisabled={allFilled}
        reviewMode={allFilled}
        autoResumeKey={autoResumeKey}

        photoProgress={{ current: activeSlot + 1, total: slotCount }}

        doneAction={

          allFilled ? (

            <Button

              variant="secondary"

              fullWidth

              onClick={() => navigate("/solo/collage")}

            >

              {t("viewCollage")}

            </Button>

          ) : undefined

        }

      />



      {menuSlot !== null && photos[menuSlot] != null && (

        <SlotActionSheet

          slotIndex={menuSlot}

          onAdjustFraming={handleOpenFraming}

          onRetake={handleRetakeFromMenu}

          onClose={() => setMenuSlot(null)}

        />

      )}



      {framingSlot !== null &&

        framingSlotDef &&

        photos[framingSlot] && (

          <SlotFramingEditor

            slotIndex={framingSlot}

            imageUrl={photos[framingSlot]}

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

            initialFit={photoFits[framingSlot]}

            onSave={(fit) => {

              setPhotoFit(framingSlot, fit);

              setFramingSlot(null);

            }}

            onCancel={() => setFramingSlot(null)}

          />

        )}

    </div>

  );

}

