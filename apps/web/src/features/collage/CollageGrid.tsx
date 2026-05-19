import { useDroppable } from "@dnd-kit/core";
import { getLayoutPresetMeta, type SessionState } from "@photosocial/shared";
import { motion } from "motion/react";
import { PlaceholderTile } from "./PlaceholderTile";
import { StickerLayer } from "../stickers/StickerLayer";
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
  onSlotClick?: (index: number) => void;
  selectedSlot?: number | null;
  droppableSlots?: boolean;
}

export function CollageGrid({
  state,
  id = "collage-export",
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
      className={`${styles.grid} ${meta.orientation === "vertical" ? styles.vertical : styles.horizontal}`}
      style={{
        aspectRatio: meta.aspectRatio,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
      role="img"
      aria-label="Photo collage"
    >
      {slots.map((slotDef) => {
        const slotState = collage.slots.find((s) => s.index === slotDef.index);
        const hasPhoto = Boolean(slotState?.photoUrl);

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
            {hasPhoto ? (
              <motion.img
                src={slotState!.photoUrl!}
                alt={slotState!.displayName ?? `Slot ${slotDef.index + 1}`}
                className={styles.photo}
                initial={{ scale: 1.04 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
            ) : (
              <PlaceholderTile
                name={slotState?.displayName}
                index={slotDef.index}
              />
            )}
            {slotState?.stickers && (
              <StickerLayer stickers={slotState.stickers} readonly />
            )}
          </SlotCell>
        );
      })}
      <StickerLayer stickers={collage.globalStickers} readonly />
    </div>
  );
}
