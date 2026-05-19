import type { ReactNode } from "react";
import { ReconnectBanner } from "./ReconnectBanner";
import styles from "./Layout.module.css";

export function Layout({
  children,
  reconnecting = false,
}: {
  children: ReactNode;
  reconnecting?: boolean;
}) {
  return (
    <div className={styles.layout}>
      <ReconnectBanner show={reconnecting} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
