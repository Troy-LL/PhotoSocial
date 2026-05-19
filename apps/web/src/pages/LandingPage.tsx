import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Button } from "../components/Button";
import styles from "./LandingPage.module.css";

export function LandingPage() {
  const { t } = useTranslation();

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
      </div>

      <div className={styles.themeCarousel} aria-hidden="true">
        {["snow", "petal", "midnight", "citrus"].map((theme) => (
          <span key={theme} className={`${styles.themeDot} ${styles[theme]}`} />
        ))}
      </div>
    </div>
  );
}
