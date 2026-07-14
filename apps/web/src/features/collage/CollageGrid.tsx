import { useDroppable } from "@dnd-kit/core";
import {
  getLayoutPresetMeta,
  slotPhotoDisplayUrl,
  type SessionState,
} from "@photosocial/shared";
import { motion } from "motion/react";
import { PlaceholderTile } from "./PlaceholderTile";
import { SlotPhoto } from "../camera/SlotPhoto";
import {
  DEFAULT_SLOT_PHOTO_FIT,
  slotFitAxis,
  type SlotPhotoFit,
} from "../camera/slot-photo-fit";
import styles from "./CollageGrid.module.css";

function SlotCell({
  slotIndex,
  droppable,
  selected,
  onClick,
  children,
  style,
}: {
  slotIndex: number;
  droppable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  style: React.CSSProperties;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slotIndex}`,
    disabled: !droppable,
  });

  return (
    <motion.div
      ref={droppable ? setNodeRef : undefined}
      className={`${styles.slot} ${selected ? styles.selected : ""} ${isOver ? styles.dropOver : ""}`}
      style={style}
      onClick={onClick}
      layout
    >
      {children}
    </motion.div>
  );
}

interface CollageGridProps {
  state: SessionState;
  id?: string;
  slotPhotoFits?: Record<number, SlotPhotoFit>;
  onSlotClick?: (index: number) => void;
  selectedSlot?: number | null;
  droppableSlots?: boolean;
}

export function CollageGrid({
  state,
  id = "collage-export",
  slotPhotoFits = {},
  onSlotClick,
  selectedSlot,
  droppableSlots = false,
}: CollageGridProps) {
  const { session, collage } = state;
  const { rows, cols, slots, preset } = session.layout;
  const meta = getLayoutPresetMeta(preset);

  return (
    <div
      id={id}
      className={`${styles.frame} ${meta.orientation === "vertical" ? styles.vertical : styles.horizontal}`}
      style={{ aspectRatio: meta.aspectRatio }}
      role="img"
      aria-label="Photo collage"
    >
      <div
        className={styles.grid}
        data-strip-pad=""
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {slots.map((slotDef) => {
          const slotState = collage.slots.find((s) => s.index === slotDef.index);
          const photoSrc = slotPhotoDisplayUrl(slotState);

          return (
            <SlotCell
              key={slotDef.index}
              slotIndex={slotDef.index}
              droppable={droppableSlots}
              selected={selectedSlot === slotDef.index}
              onClick={() => onSlotClick?.(slotDef.index)}
              style={{
                gridRow: `${slotDef.row + 1} / span ${slotDef.rowSpan}`,
                gridColumn: `${slotDef.col + 1} / span ${slotDef.colSpan}`,
              }}
            >
              {photoSrc ? (
                <SlotPhoto
                  src={photoSrc}
                  alt={slotState!.displayName ?? `Slot ${slotDef.index + 1}`}
                  axis={slotFitAxis(
                    slotDef.rowSpan,
                    slotDef.colSpan,
                    meta.orientation
                  )}
                  fit={slotPhotoFits[slotDef.index] ?? DEFAULT_SLOT_PHOTO_FIT}
                  className={styles.slotMedia}
                />
              ) : (
                <PlaceholderTile
                  name={slotState?.displayName}
                  index={slotDef.index}
                />
              )}
            </SlotCell>
          );
        })}
      </div>
    </div>
  );
}
