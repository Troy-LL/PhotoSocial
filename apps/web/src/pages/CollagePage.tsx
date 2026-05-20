import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { slotHasPhoto } from "@photosocial/shared";
import { useSession } from "../context/SessionContext";
import { CollageGrid } from "../features/collage/CollageGrid";
import { api } from "../lib/api";
import { Button } from "../components/Button";
import styles from "./CollagePage.module.css";

export function CollagePage() {
  const { t } = useTranslation();
  const { code } = useParams();
  const navigate = useNavigate();
  const { stored, state, loading, isHost, refresh } = useSession();

  if (loading || !state || !stored) {
    return <p>Loading…</p>;
  }

  const filled = state.collage.slots.filter((s) => slotHasPhoto(s)).length;
  const total = state.collage.slots.length;
  const allIn = filled === total;
  const isLocked = state.session.status === "locked";

  async function handleLock() {
    if (!stored) return;
    const res = await api.lockSession(stored.sessionId, stored.wsToken);
    if (res.success) {
      await refresh();
      navigate(`/party/${code}/export`);
    }
  }

  return (
    <div className={styles.page}>
      <h1>{t("viewCollage")}</h1>
      <p className={styles.progress}>
        {filled} / {total}
        {allIn && ` — ${t("allPhotosIn")}`}
      </p>

      <CollageGrid state={state} />

      {isHost && !isLocked && (
        <Button fullWidth onClick={handleLock}>
          {t("lockCollage")}
        </Button>
      )}

      {isLocked && (
        <Link to={`/party/${code}/export`}>
          <Button fullWidth>{t("download")}</Button>
        </Link>
      )}

      <Link to={`/party/${code}/lobby`}>
        <Button variant="ghost" fullWidth>
          Lobby
        </Button>
      </Link>
    </div>
  );
}
