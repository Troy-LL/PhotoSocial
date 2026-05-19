import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import {
  formatSlotNumbers,
  participantPhotoProgress,
  slotsForParticipant,
  type ThemeKey,
} from "@photosocial/shared";
import { useMyPhotoProgress, useSession } from "../context/SessionContext";
import { ThemePicker } from "../features/themes/ThemePicker";
import { api } from "../lib/api";
import { Button } from "../components/Button";
import styles from "./LobbyPage.module.css";

export function LobbyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { stored, state, loading, assignedSlots, sessionError, refresh } =
    useSession();

  const isHost = stored?.isHost ?? false;
  const code = stored?.partyCode ?? "";
  const progress = useMyPhotoProgress(state, stored?.participantId);

  useEffect(() => {
    if (progress.hasAnySlot && !progress.allFilled && !isHost) {
      navigate(`/party/${code}/camera`, { replace: true });
    }
  }, [progress.hasAnySlot, progress.allFilled, isHost, code, navigate]);

  async function handleThemeChange(theme: ThemeKey, customHue?: number) {
    if (!stored) return;
    await api.setTheme(stored.sessionId, stored.wsToken, {
      theme,
      customHue,
    });
  }

  async function assignHostToFirstSlot() {
    if (!stored || !state) return;
    const free = state.session.layout.slots.find((s) => !s.assignedTo);
    if (free === undefined) return;
    await api.assignSlot(stored.sessionId, stored.wsToken, {
      participantId: stored.participantId,
      slotIndex: free.index,
    });
    await refresh();
    navigate(`/party/${code}/camera`);
  }

  if (sessionError) {
    return (
      <motion.div className={styles.loading}>
        <p>{sessionError}</p>
        <Link to="/join">
          <Button variant="secondary">Join a party</Button>
        </Link>
      </motion.div>
    );
  }

  if (loading || !state) {
    return <p className={styles.loading}>Loading…</p>;
  }

  const slotsFull = state.session.layout.slots.every((s) => s.assignedTo);

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className={styles.codeCard}
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <p className={styles.codeLabel}>{t("partyCode")}</p>
        <p className={styles.code} aria-live="polite">
          {code}
        </p>
        <Button
          variant="ghost"
          onClick={() => navigator.clipboard.writeText(code)}
        >
          {t("copyCode")}
        </Button>
        {navigator.share && (
          <Button
            variant="secondary"
            onClick={() =>
              navigator.share({
                title: "PhotoSocial",
                text: `Join my party: ${code}`,
              })
            }
          >
            {t("shareCode")}
          </Button>
        )}
        <span className={styles.badge}>
          {state.participants.length} {t("participants")}
        </span>
      </motion.div>

      {isHost && (
        <section className={styles.hostSection}>
          <h2>{t("chooseTheme")}</h2>
          <ThemePicker
            value={state.session.theme}
            customHue={state.session.customHue}
            onChange={handleThemeChange}
          />
          <Link
            to={`/party/${code}/assign`}
            className={styles.hostAssignLink}
          >
            <Button variant="secondary" fullWidth>
              {t("assignSlots")}
            </Button>
          </Link>
        </section>
      )}

      {isHost && (
        <section className={styles.hostJoin}>
          <p className={styles.hostHint}>{t("hostCollageHint")}</p>
          {assignedSlots.length === 0 ? (
            slotsFull ? (
              <p className={styles.hostHint}>{t("allSlotsTaken")}</p>
            ) : (
              <>
                <Button fullWidth onClick={() => void assignHostToFirstSlot()}>
                  {t("addYourselfToCollage")}
                </Button>
                <Link to={`/party/${code}/assign`} className={styles.linkBtn}>
                  <Button variant="ghost" fullWidth>
                    {t("assignSlots")}
                  </Button>
                </Link>
              </>
            )
          ) : (
            <Link to={`/party/${code}/camera`}>
              <Button fullWidth>
                {progress.allFilled ? t("retakeMyPhoto") : t("takeMyPhoto")}
              </Button>
            </Link>
          )}
        </section>
      )}

      <section>
        <h2>{t("participants")}</h2>
        <ul className={styles.list}>
          {state.participants.map((p) => {
            const slots = slotsForParticipant(state.session.layout, p.id);
            const { filled, total } = participantPhotoProgress(
              state.session.layout,
              state.collage.slots,
              p.id
            );
            return (
              <li key={p.id}>
                {p.displayName}
                {p.id === state.session.hostId && " (host)"}
                {slots.length > 0 &&
                  ` · ${t("participantSlots", { slots: formatSlotNumbers(slots) })}`}
                {total > 0 && filled >= total && " · Photo in"}
              </li>
            );
          })}
        </ul>
      </section>

      {!isHost && assignedSlots.length === 0 && (
        <motion.div
          className={styles.waiting}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          {t("waitingForAssignment")}
        </motion.div>
      )}

      <Link to={`/party/${code}/collage`}>
        <Button variant="secondary" fullWidth>
          {t("viewCollage")}
        </Button>
      </Link>
    </motion.div>
  );
}
