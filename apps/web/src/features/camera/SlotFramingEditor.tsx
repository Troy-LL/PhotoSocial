import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button";
import {
  clampFit,
  DEFAULT_SLOT_PHOTO_FIT,
  type SlotFitAxis,
  type SlotPhotoFit,
} from "./slot-photo-fit";
import styles from "./SlotFramingEditor.module.css";
import slotPhotoStyles from "./SlotPhoto.module.css";

interface SlotFramingEditorProps {
  slotIndex: number;
  imageUrl: string;
  axis: SlotFitAxis;
  aspectRatio: string;
  initialFit?: SlotPhotoFit;
  onSave: (fit: SlotPhotoFit) => void;
  onCancel: () => void;
}

export function SlotFramingEditor({
  slotIndex,
  imageUrl,
  axis,
  aspectRatio,
  initialFit = DEFAULT_SLOT_PHOTO_FIT,
  onSave,
  onCancel,
}: SlotFramingEditorProps) {
  const { t } = useTranslation();
  const [fit, setFit] = useState<SlotPhotoFit>(initialFit);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startFit: SlotPhotoFit;
  } | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startFit: fit,
      };
    },
    [fit]
  );

  const panSensitivity =
    axis === "horizontal" ? { x: 0.2, y: 0.35 } : { x: 0.35, y: 0.2 };

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      setFit(
        clampFit({
          x: drag.startFit.x - dx * panSensitivity.x,
          y: drag.startFit.y - dy * panSensitivity.y,
          scale: drag.startFit.scale,
        })
      );
    },
    [panSensitivity.x, panSensitivity.y]
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }, []);

  const [arW, arH] = aspectRatio.split("/").map((s) => Number(s.trim()) || 1);
  const cropWindowClass =
    arW / arH < 1 ? styles.cropWindowTall : styles.cropWindowWide;
  const scale = fit.scale > 1 ? fit.scale : 1;

  return createPortal(
    <div className={styles.backdrop} role="presentation" onClick={onCancel}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="framing-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="framing-editor-title" className={styles.title}>
          {t("adjustFramingTitle", { slot: slotIndex + 1 })}
        </h2>
        <p className={styles.hint}>{t("adjustFramingHint")}</p>

        {/* Crop canvas — photo fills it, crop window dims what falls outside the slot */}
        <div
          className={styles.preview}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className={styles.photoLayer}>
            <img
              src={imageUrl}
              alt=""
              aria-hidden="true"
              className={slotPhotoStyles.photo}
              style={{
                objectPosition: `${fit.x}% ${fit.y}%`,
                transform: scale > 1 ? `scale(${scale})` : undefined,
                transformOrigin: `${fit.x}% ${fit.y}%`,
              }}
              draggable={false}
            />
          </div>

          {/*
           * Transparent crop window.
           * box-shadow creates the dark mask over what falls outside the slot.
           * The div itself is transparent so the photo shows through at full brightness.
           * overflow:hidden on .preview clips the shadow to the canvas edges.
           */}
          <div
            className={`${styles.cropWindow} ${cropWindowClass}`}
            style={
              {
                aspectRatio,
                "--slot-aspect": aspectRatio,
              } as CSSProperties
            }
            aria-hidden="true"
          />
        </div>

        <label className={styles.zoomLabel}>
          {t("adjustFramingZoom")}
          <input
            type="range"
            min={1}
            max={2.5}
            step={0.05}
            value={fit.scale}
            onChange={(e) =>
              setFit((f) => clampFit({ ...f, scale: Number(e.target.value) }))
            }
          />
        </label>

        <div className={styles.actions}>
          <Button type="button" onClick={() => onSave(clampFit(fit))}>
            {t("save")}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
