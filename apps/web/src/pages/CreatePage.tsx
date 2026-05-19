import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  HORIZONTAL_LAYOUT_PRESETS,
  LAYOUT_PRESETS,
  VERTICAL_LAYOUT_PRESETS,
  type LayoutPreset,
  type ThemeKey,
} from "@photosocial/shared";
import { api } from "../lib/api";
import { newPartyDeviceId, saveSession } from "../lib/session-storage";
import { LayoutThumbnail } from "../features/collage/LayoutThumbnail";
import { ThemePicker } from "../features/themes/ThemePicker";
import {
  applyThemePreference,
  getThemePreference,
  saveThemePreference,
} from "../lib/theme-preference";
import { Button } from "../components/Button";
import styles from "./CreatePage.module.css";

function LayoutPicker({
  presets,
  value,
  onChange,
}: {
  presets: readonly LayoutPreset[];
  value: LayoutPreset;
  onChange: (preset: LayoutPreset) => void;
}) {
  return (
    <div className={styles.layoutGrid}>
      {presets.map((key) => {
        const preset = LAYOUT_PRESETS[key];
        return (
          <button
            key={key}
            type="button"
            className={`${styles.layoutCard} ${value === key ? styles.active : ""}`}
            onClick={() => onChange(key)}
            aria-pressed={value === key}
          >
            <LayoutThumbnail preset={key} />
            <span>{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [layout, setLayout] = useState<LayoutPreset>("strip4");
  const [theme, setTheme] = useState<ThemeKey>(() => getThemePreference().theme);
  const [customHue, setCustomHue] = useState(
    () => getThemePreference().customHue ?? 200
  );
  const [hostName, setHostName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    applyThemePreference({
      theme,
      customHue: theme === "custom" ? customHue : undefined,
    });
  }, [theme, customHue]);

  async function handleCreate() {
    if (!hostName.trim()) {
      setError("Enter your name");
      return;
    }
    setLoading(true);
    setError("");

    applyThemePreference({
      theme,
      customHue: theme === "custom" ? customHue : undefined,
    });

    const deviceId = newPartyDeviceId();
    const res = await api.createSession({
      hostDeviceId: deviceId,
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
      deviceId,
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
        <p className={styles.layoutGroupLabel}>Vertical strips</p>
        <LayoutPicker
          presets={VERTICAL_LAYOUT_PRESETS}
          value={layout}
          onChange={setLayout}
        />
        <p className={styles.layoutGroupLabel}>Horizontal strips</p>
        <LayoutPicker
          presets={HORIZONTAL_LAYOUT_PRESETS}
          value={layout}
          onChange={setLayout}
        />
      </section>

      <section>
        <h2>{t("chooseTheme")}</h2>
        <ThemePicker
          value={theme}
          customHue={customHue}
          onChange={(th, hue) => {
            const nextHue = hue ?? customHue;
            setTheme(th);
            if (hue !== undefined) setCustomHue(hue);
            const pref = {
              theme: th,
              customHue: th === "custom" ? nextHue : undefined,
            };
            saveThemePreference(pref);
            applyThemePreference(pref);
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
