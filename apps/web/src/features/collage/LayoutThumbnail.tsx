import { createLayout, type LayoutPreset } from "@photosocial/shared";
import styles from "./LayoutThumbnail.module.css";

interface LayoutThumbnailProps {
  preset: LayoutPreset;
}

export function LayoutThumbnail({ preset }: LayoutThumbnailProps) {
  const layout = createLayout(preset);

  return (
    <span
      className={styles.thumb}
      style={{
        aspectRatio: layout.aspectRatio,
        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
      }}
      aria-hidden="true"
    >
      {layout.slots.map((slot) => (
        <span
          key={slot.index}
          className={styles.cell}
          style={{
            gridRow: `${slot.row + 1} / span ${slot.rowSpan}`,
            gridColumn: `${slot.col + 1} / span ${slot.colSpan}`,
          }}
        />
      ))}
    </span>
  );
}
