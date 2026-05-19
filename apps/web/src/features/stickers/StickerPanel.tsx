import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { useSession } from "../../context/SessionContext";
import styles from "./StickerPanel.module.css";

interface PackSticker {
  key: string;
  label: string;
  emoji: string;
}

interface Pack {
  label: string;
  stickers: PackSticker[];
}

export function StickerPanel({
  targetScope,
  targetId,
}: {
  targetScope: "tile" | "global";
  targetId: string;
}) {
  const { t } = useTranslation();
  const { stored } = useSession();
  const [packs, setPacks] = useState<Record<string, Pack>>({});

  useEffect(() => {
    fetch("/stickers/packs.json")
      .then((r) => r.json())
      .then(setPacks)
      .catch(() => {});
  }, []);

  const month = new Date().getMonth();
  const seasonalEmoji =
    month === 11 || month === 0
      ? "❄️"
      : month >= 5 && month <= 7
        ? "☀️"
        : "🍂";

  async function place(packId: string, stickerKey: string) {
    if (!stored) return;
    await api.placeSticker(stored.sessionId, stored.wsToken, {
      packId,
      stickerKey,
      targetScope,
      targetId,
      x: 50,
      y: 50,
    });
  }

  return (
    <aside className={styles.panel} aria-label={t("stickers")}>
      <h3 className={styles.title}>{t("stickers")}</h3>
      <button
        type="button"
        className={styles.stickerBtn}
        onClick={() => place("seasonal", "seasonal")}
        title="Seasonal"
      >
        {seasonalEmoji}
      </button>
      {Object.entries(packs).map(([packId, pack]) => (
        <div key={packId}>
          <p className={styles.packLabel}>{pack.label}</p>
          <div className={styles.row}>
            {pack.stickers.map((s) => (
              <button
                key={s.key}
                type="button"
                className={styles.stickerBtn}
                onClick={() => place(packId, s.key)}
                title={s.label}
                aria-label={s.label}
              >
                {s.emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}
