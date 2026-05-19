import productionDeploy from "../../../../config/deploy.production.json";

function normalizeHost(host: string): string {
  return host.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** PartyKit host (edit config/deploy.production.json for production). */
export function partykitHost(): string {
  const envOverride = import.meta.env.VITE_PARTYKIT_HOST as string | undefined;
  if (envOverride) {
    return normalizeHost(envOverride);
  }
  if (import.meta.env.DEV) {
    return `${window.location.hostname}:1999`;
  }
  return normalizeHost(productionDeploy.partykitHost);
}

/** HTTP origin for PartyKit API (sessions + realtime). */
export function partykitHttpOrigin(): string {
  const host = partykitHost();
  const protocol =
    import.meta.env.DEV && !host.includes("partykit.dev") ? "http" : "https";
  return `${protocol}://${host}`;
}
