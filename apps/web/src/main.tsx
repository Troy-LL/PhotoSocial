import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-serif-display/400.css";
import "./styles/global.css";
import "./lib/i18n";
import { applyThemePreference, getThemePreference } from "./lib/theme-preference";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App";

try {
  applyThemePreference(getThemePreference());
} catch (e) {
  console.error("Failed to apply theme preference on boot:", e);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
