import type { Sticker } from "@photosocial/shared";
import styles from "./StickerLayer.module.css";

export function StickerLayer({
  stickers,
  readonly = false,
  onSelect,
  selectedId,
}: {
  stickers: Sticker[];
  readonly?: boolean;
  onSelect?: (id: string) => void;
  selectedId?: string;
}) {
  return (
    <>
      {stickers.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`${styles.sticker} ${selectedId === s.id ? styles.selected : ""}`}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            transform: `translate(-50%, -50%) scale(${s.scale}) rotate(${s.rotation}deg)`,
          }}
          onClick={() => !readonly && onSelect?.(s.id)}
          aria-label={`Sticker ${s.stickerKey}`}
          disabled={readonly}
        >
          <StickerEmoji stickerKey={s.stickerKey} packId={s.packId} />
        </button>
      ))}
    </>
  );
}

function StickerEmoji({
  stickerKey,
  packId,
}: {
  stickerKey: string;
  packId: string;
}) {
  const map: Record<string, string> = {
    confetti: "🎉",
    party: "🎊",
    star: "⭐",
    sparkle: "✨",
    heart: "❤️",
    kiss: "💋",
    ribbon: "🎀",
    flower: "🌸",
    sun: "☀️",
    rainbow: "🌈",
    camera: "📷",
    film: "🎞️",
    bff: "BFF",
    squad: "SQUAD",
  };
  return <span className={styles.emoji}>{map[stickerKey] ?? packId}</span>;
}
