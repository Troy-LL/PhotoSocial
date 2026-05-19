import { THEME_LABELS, type ThemeKey } from "@passandpic/shared";
import styles from "./ThemePicker.module.css";

const PRESETS: ThemeKey[] = ["snow", "midnight", "petal", "slate", "citrus"];

interface ThemePickerProps {
  value: ThemeKey;
  customHue?: number;
  onChange: (theme: ThemeKey, customHue?: number) => void;
}

export function ThemePicker({ value, customHue = 200, onChange }: ThemePickerProps) {
  return (
    <div className={styles.row} role="radiogroup" aria-label="Theme">
      {PRESETS.map((theme) => (
        <button
          key={theme}
          type="button"
          role="radio"
          aria-checked={value === theme}
          className={`${styles.swatch} ${styles[theme]} ${value === theme ? styles.active : ""}`}
          onClick={() => onChange(theme)}
          title={THEME_LABELS[theme]}
        >
          <span className="sr-only">{THEME_LABELS[theme]}</span>
        </button>
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={value === "custom"}
        className={`${styles.swatch} ${styles.custom} ${value === "custom" ? styles.active : ""}`}
        onClick={() => onChange("custom", customHue)}
        title="Custom"
      >
        <span className="sr-only">Custom</span>
      </button>
      {value === "custom" && (
        <label className={styles.hueLabel}>
          <span className="sr-only">Hue</span>
          <input
            type="range"
            min={0}
            max={360}
            value={customHue}
            onChange={(e) => onChange("custom", Number(e.target.value))}
            className={styles.hue}
          />
        </label>
      )}
    </div>
  );
}
