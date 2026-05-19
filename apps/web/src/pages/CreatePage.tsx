import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LAYOUT_PRESETS,
  type LayoutPreset,
  type ThemeKey,
} from "@passandpic/shared";
import { api } from "../lib/api";
import { getDeviceId } from "../lib/device-id";
import { saveSession } from "../lib/session-storage";
import { resolveThemeTokens } from "@passandpic/shared";
import { ThemePicker } from "../features/themes/ThemePicker";
import { Button } from "../components/Button";
import styles from "./CreatePage.module.css";

export function CreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [layout, setLayout] = useState<LayoutPreset>("squad");
  const [theme, setTheme] = useState<ThemeKey>("snow");
  const [customHue, setCustomHue] = useState(200);
  const [hostName, setHostName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!hostName.trim()) {
      setError("Enter your name");
      return;
    }
    setLoading(true);
    setError("");

    const tokens = resolveThemeTokens(theme, customHue);
    Object.entries(tokens).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v)
    );

    const res = await api.createSession({
      hostDeviceId: getDeviceId(),
      hostName: hostName.trim(),
      layout,
      theme,
      customHue: theme === "custom" ? customHue : undefined,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error.message);
      return;
    }

    saveSession({
      sessionId: res.data.sessionId,
      partyCode: res.data.partyCode,
      participantId: res.data.participantId,
      wsToken: res.data.wsToken,
      isHost: true,
      displayName: hostName.trim(),
    });

    navigate(`/party/${res.data.partyCode}/lobby`);
  }

  return (
    <div className={styles.page}>
      <h1>{t("createParty")}</h1>

      <label className={styles.label}>
        {t("yourName")}
        <input
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          placeholder={t("displayNamePlaceholder")}
          maxLength={24}
          className={styles.input}
        />
      </label>

      <section>
        <h2>{t("chooseLayout")}</h2>
        <div className={styles.layoutGrid}>
          {(Object.keys(LAYOUT_PRESETS) as LayoutPreset[]).map((key) => {
            const preset = LAYOUT_PRESETS[key];
            return (
              <button
                key={key}
                type="button"
                className={`${styles.layoutCard} ${layout === key ? styles.active : ""}`}
                onClick={() => setLayout(key)}
                aria-pressed={layout === key}
              >
                <span
                  className={styles.miniGrid}
                  style={{
                    gridTemplateColumns: `repeat(${preset.cols}, 1fr)`,
                    gridTemplateRows: `repeat(${preset.rows}, 1fr)`,
                  }}
                >
                  {Array.from({ length: preset.rows * preset.cols }).map(
                    (_, i) => (
                      <span key={i} className={styles.miniCell} />
                    )
                  )}
                </span>
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2>{t("chooseTheme")}</h2>
        <ThemePicker
          value={theme}
          customHue={customHue}
          onChange={(th, hue) => {
            setTheme(th);
            if (hue !== undefined) setCustomHue(hue);
            const tokens = resolveThemeTokens(th, hue ?? customHue);
            Object.entries(tokens).forEach(([k, v]) =>
              document.documentElement.style.setProperty(k, v)
            );
          }}
        />
      </section>

      {error && <p className={styles.error}>{error}</p>}

      <Button fullWidth onClick={handleCreate} disabled={loading}>
        {loading ? "…" : t("createParty")}
      </Button>
    </div>
  );
}
