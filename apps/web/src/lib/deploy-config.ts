import productionDeploy from "../../../../config/deploy.production.json";

function normalizeHost(host: string): string {
  return host.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** PartyKit host for realtime (no Vercel env vars — edit config/deploy.production.json). */
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
