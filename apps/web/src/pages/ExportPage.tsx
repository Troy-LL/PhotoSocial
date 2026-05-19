import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import confetti from "canvas-confetti";
import { useSession } from "../context/SessionContext";
import { CollageGrid } from "../features/collage/CollageGrid";
import { api } from "../lib/api";
import { clearSession } from "../lib/session-storage";
import { Button } from "../components/Button";
import styles from "./ExportPage.module.css";

export function ExportPage() {
  const { t } = useTranslation();
  const { stored, state, loading } = useSession();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
    }
  }, []);

  if (loading || !state || !stored) {
    return <p>Loading…</p>;
  }

  const finalUrl = state.session.finalCollageUrl;

  async function downloadCollage() {
    if (finalUrl) {
      const a = document.createElement("a");
      a.href = finalUrl;
      a.download = `PhotoSocial-${stored!.partyCode}.jpg`;
      a.click();
      return;
    }
    const { default: html2canvas } = await import("html2canvas");
    const el = document.getElementById("collage-export");
    if (!el) return;
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const link = document.createElement("a");
    link.download = `PhotoSocial-${stored!.partyCode}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function sendEmail() {
    setEmailError("");
    const res = await api.sendEmail(stored!.sessionId, stored!.wsToken, {
      email,
      scope: "full-collage",
      consentCloudSave: consent,
    });
    if (res.success) {
      setEmailSent(true);
    } else {
      setEmailError(res.error.message);
    }
  }

  function handleMakeAnother() {
    clearSession();
    window.location.href = "/";
  }

  return (
    <div className={styles.page}>
      <h1>{t("allPhotosIn")}</h1>

      {finalUrl ? (
        <img
          src={finalUrl}
          alt={t("collageStripPreview")}
          className={styles.finalPreview}
        />
      ) : (
        <div id="collage-export">
          <CollageGrid state={state} />
        </div>
      )}

      {state.session.finalCollageExpiresAt && (
        <p className={styles.hint}>{t("collageEmailWindow")}</p>
      )}

      <Button fullWidth onClick={downloadCollage}>
        {t("download")}
      </Button>

      <fieldset className={styles.emailField}>
        <legend>{t("email")}</legend>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          className={styles.emailInput}
        />
        <label className={styles.consent}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          {t("consentCloud")}
        </label>
        <Button
          variant="secondary"
          fullWidth
          onClick={sendEmail}
          disabled={!email || emailSent}
        >
          {emailSent ? "Sent!" : t("sendEmail")}
        </Button>
        {emailError && <p className={styles.error}>{emailError}</p>}
      </fieldset>

      <Button variant="ghost" fullWidth onClick={handleMakeAnother}>
        {t("makeAnother")}
      </Button>
    </div>
  );
}
