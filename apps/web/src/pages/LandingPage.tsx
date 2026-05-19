import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import {
  THEME_LABELS,
  UI_THEME_PRESETS,
  type ThemeKey,
} from "@photosocial/shared";
import { Button } from "../components/Button";
import {
  applyThemePreference,
  getThemePreference,
  saveThemePreference,
} from "../lib/theme-preference";
import styles from "./LandingPage.module.css";

export function LandingPage() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<ThemeKey>(() => getThemePreference().theme);

  function selectTheme(next: ThemeKey) {
    setTheme(next);
    const pref = { theme: next };
    saveThemePreference(pref);
    applyThemePreference(pref);
  }

  return (
    <div className={styles.page}>
      <motion.header
        className={styles.hero}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.collagePreview} aria-hidden="true">
          <div className={styles.tile} />
          <div className={styles.tile} />
          <div className={styles.tile} />
          <div className={styles.tile} />
        </div>
        <h1>{t("appName")}</h1>
        <p className={styles.tagline}>{t("tagline")}</p>
      </motion.header>

      <div className={styles.ctas}>
        <Link to="/create">
          <Button fullWidth>{t("createParty")}</Button>
        </Link>
        <Link to="/join">
          <Button variant="secondary" fullWidth>
            {t("joinParty")}
          </Button>
        </Link>
        <Link to="/solo">
          <Button variant="ghost" fullWidth>
            {t("soloBooth")}
          </Button>
        </Link>
      </div>

      <div className={styles.themeCarousel} role="radiogroup" aria-label="Theme">
        {UI_THEME_PRESETS.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={theme === key}
            className={`${styles.themeDot} ${styles[key]} ${theme === key ? styles.active : ""}`}
            onClick={() => selectTheme(key)}
            title={THEME_LABELS[key]}
          >
            <span className="sr-only">{THEME_LABELS[key]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
