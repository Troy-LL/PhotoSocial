import { useTranslation } from "react-i18next";
import styles from "./ReconnectBanner.module.css";

export function ReconnectBanner({ show }: { show: boolean }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <div className={styles.banner} role="status" aria-live="polite">
      {t("reconnecting")}
    </div>
  );
}
