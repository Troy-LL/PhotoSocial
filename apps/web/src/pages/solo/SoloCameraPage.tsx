import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { CameraView } from "../../features/camera/CameraView";
import { useSolo } from "../../context/SoloContext";
import styles from "../CameraPage.module.css";

export function SoloCameraPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, slotCount, setPhoto } = useSolo();
  const [currentSlot, setCurrentSlot] = useState(0);

  if (!data?.layout) {
    return <Navigate to="/solo" replace />;
  }

  const isLastSlot = currentSlot >= slotCount - 1;

  function handleCapture(blob: Blob) {
    setPhoto(currentSlot, blob);
    if (isLastSlot) {
      navigate("/solo/collage");
      return;
    }
    setCurrentSlot((s) => s + 1);
  }

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.notice}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {t("soloPhotoProgress", {
          current: currentSlot + 1,
          total: slotCount,
        })}
      </motion.div>

      <CameraView
        onCapture={handleCapture}
        onCancel={() => navigate("/solo")}
        frameOverlay={{
          preset: data.layout,
          assignedSlot: currentSlot,
        }}
      />
    </div>
  );
}

