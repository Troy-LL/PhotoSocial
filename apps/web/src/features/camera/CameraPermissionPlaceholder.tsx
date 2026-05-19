import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button";
import styles from "./CameraPermissionPlaceholder.module.css";

interface CameraPermissionPlaceholderProps {
  onRetry?: () => void;
  compact?: boolean;
}

export function CameraPermissionPlaceholder({
  onRetry,
  compact = false,
}: CameraPermissionPlaceholderProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`${styles.placeholder} ${compact ? styles.compact : ""}`}
      role="status"
    >
      <svg
        className={styles.icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M8 14h6l3-4h14l3 4h6a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="26" r="7" stroke="currentColor" strokeWidth="2" />
        <path
          d="M6 6l36 36"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <p className={styles.title}>{t("cameraNoAccess")}</p>
      {!compact && <p className={styles.hint}>{t("cameraEnable")}</p>}
      {onRetry && (
        <Button
          type="button"
          variant="secondary"
          className={styles.retry}
          onClick={onRetry}
        >
          {t("tryCameraAgain")}
        </Button>
      )}
    </div>
  );
}
