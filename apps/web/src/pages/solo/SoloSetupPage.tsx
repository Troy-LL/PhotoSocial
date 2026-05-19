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
import { LayoutThumbnail } from "../../features/collage/LayoutThumbnail";
import { ThemePicker } from "../../features/themes/ThemePicker";
import { useSolo } from "../../context/SoloContext";
import {
  applyThemePreference,
  getThemePreference,
  saveThemePreference,
} from "../../lib/theme-preference";
import { Button } from "../../components/Button";
import styles from "../CreatePage.module.css";

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

export function SoloSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { startSession } = useSolo();
  const [layout, setLayout] = useState<LayoutPreset>("strip4");
  const [theme, setTheme] = useState<ThemeKey>(() => getThemePreference().theme);
  const [customHue, setCustomHue] = useState(
    () => getThemePreference().customHue ?? 200
  );

  useEffect(() => {
    applyThemePreference({
      theme,
      customHue: theme === "custom" ? customHue : undefined,
    });
  }, [theme, customHue]);

  function handleStart() {
    const pref = {
      theme,
      customHue: theme === "custom" ? customHue : undefined,
    };
    saveThemePreference(pref);
    applyThemePreference(pref);
    startSession(layout, theme, theme === "custom" ? customHue : undefined);
    navigate("/solo/camera");
  }

  return (
    <div className={styles.page}>
      <h1>{t("soloBooth")}</h1>
      <p className={styles.layoutGroupLabel}>{t("soloBoothHint")}</p>

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

      <Button fullWidth onClick={handleStart}>
        {t("soloStart")}
      </Button>
    </div>
  );
}
