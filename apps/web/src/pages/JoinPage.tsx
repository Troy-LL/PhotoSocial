import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import {
  getStoredSession,
  newPartyDeviceId,
  saveSession,
} from "../lib/session-storage";
import { Button } from "../components/Button";
import styles from "./JoinPage.module.css";

export function JoinPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [word, setWord] = useState("");
  const [num, setNum] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    const partyCode = `${word.toUpperCase()}-${num}`;
    if (!/^[A-Z]+-\d{4}$/.test(partyCode)) {
      setShake(true);
      setError(t("invalidCode"));
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (!displayName.trim()) {
      setError("Enter your name");
      return;
    }

    setLoading(true);
    setError("");

    const prior = getStoredSession();
    const deviceId =
      prior?.partyCode === partyCode ? prior.deviceId : newPartyDeviceId();

    const res = await api.joinSession({
      partyCode,
      displayName: displayName.trim(),
      deviceId,
    });
    setLoading(false);

    if (!res.success) {
      setShake(true);
      setError(res.error.message);
      setTimeout(() => setShake(false), 500);
      return;
    }

    saveSession({
      sessionId: res.data.sessionId,
      partyCode,
      participantId: res.data.participantId,
      wsToken: res.data.wsToken,
      deviceId,
      isHost: res.data.isHost,
      displayName: displayName.trim(),
    });

    navigate(`/party/${partyCode}/lobby`);
  }

  return (
    <div className={styles.page}>
      <h1>{t("joinParty")}</h1>

      <div className={`${styles.codeInput} ${shake ? styles.shake : ""}`}>
        <input
          aria-label="Party code word"
          value={word}
          onChange={(e) =>
            setWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())
          }
          maxLength={8}
          placeholder="PINE"
          className={styles.word}
        />
        <span className={styles.dash}>–</span>
        <input
          aria-label="Party code number"
          value={num}
          onChange={(e) =>
            setNum(e.target.value.replace(/\D/g, "").slice(0, 4))
          }
          maxLength={4}
          placeholder="7842"
          className={styles.num}
          inputMode="numeric"
        />
      </div>

      <label className={styles.label}>
        {t("yourName")}
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t("displayNamePlaceholder")}
          maxLength={24}
          className={styles.nameInput}
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <Button fullWidth onClick={handleJoin} disabled={loading}>
        {loading ? "…" : t("enterParty")}
      </Button>
    </div>
  );
}
