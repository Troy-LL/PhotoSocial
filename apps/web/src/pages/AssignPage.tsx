import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SlotAssignment } from "../features/slots/SlotAssignment";
import { Button } from "../components/Button";
import styles from "./AssignPage.module.css";

export function AssignPage() {
  const { t } = useTranslation();
  const { code } = useParams();

  return (
    <div className={styles.page}>
      <h1>{t("assignSlots")}</h1>
      <SlotAssignment />
      <Link to={`/party/${code}/lobby`} className={styles.back}>
        <Button variant="secondary" fullWidth>
          Back to lobby
        </Button>
      </Link>
    </div>
  );
}
