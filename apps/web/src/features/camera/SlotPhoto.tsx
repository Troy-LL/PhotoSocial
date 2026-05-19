import type { SlotFitAxis, SlotPhotoFit } from "./slot-photo-fit";
import styles from "./SlotPhoto.module.css";

interface SlotPhotoProps {
  src: string;
  alt: string;
  /** Kept for API compatibility; cover-fit uses the slot frame shape. */
  axis: SlotFitAxis;
  fit?: SlotPhotoFit;
  className?: string;
}

/** Cover-fit photo inside a slot frame (no stretch; pans via object-position). */
export function SlotPhoto({
  src,
  alt,
  fit = { x: 50, y: 50, scale: 1 },
  className = "",
}: SlotPhotoProps) {
  const scale = fit.scale > 1 ? fit.scale : 1;

  return (
    <div className={`${styles.frame} ${className}`.trim()}>
      <img
        src={src}
        alt={alt}
        className={styles.photo}
        style={{
          objectPosition: `${fit.x}% ${fit.y}%`,
          transform: scale > 1 ? `scale(${scale})` : undefined,
          transformOrigin: `${fit.x}% ${fit.y}%`,
        }}
        draggable={false}
      />
    </div>
  );
}
