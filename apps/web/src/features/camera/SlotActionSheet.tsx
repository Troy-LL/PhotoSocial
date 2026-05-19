import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button";
import styles from "./SlotActionSheet.module.css";

interface SlotActionSheetProps {
  slotIndex: number;
  onAdjustFraming: () => void;
  onRetake: () => void;
  onClose: () => void;
}

export function SlotActionSheet({
  slotIndex,
  onAdjustFraming,
  onRetake,
  onClose,
}: SlotActionSheetProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-action-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="slot-action-title" className={styles.title}>
          {t("slotActionsTitle", { slot: slotIndex + 1 })}
        </h2>
        <div className={styles.actions}>
          <Button type="button" onClick={onAdjustFraming}>
            {t("adjustFraming")}
          </Button>
          <Button type="button" variant="secondary" onClick={onRetake}>
            {t("retake")}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
