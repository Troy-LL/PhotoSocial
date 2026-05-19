import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ReconnectBanner } from "./ReconnectBanner";
import styles from "./Layout.module.css";

export function Layout({
  children,
  reconnecting = false,
}: {
  children: ReactNode;
  reconnecting?: boolean;
}) {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const isHome = pathname === "/";

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand} aria-label={t("backToHome")}>
          {t("appName")}
        </Link>
        {!isHome && (
          <Link to="/" className={styles.homeLink}>
            {t("backToHome")}
          </Link>
        )}
      </header>
      <ReconnectBanner show={reconnecting} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
