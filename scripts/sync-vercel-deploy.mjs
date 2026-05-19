/**
 * Reads config/deploy.production.json and updates vercel.json API rewrites.
 * Run automatically before Vercel builds — no dashboard env vars needed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const deployPath = join(root, "config", "deploy.production.json");
const deploy = JSON.parse(readFileSync(deployPath, "utf8"));

const apiOrigin = String(deploy.apiOrigin).replace(/\/$/, "");
if (!apiOrigin || apiOrigin.includes("REPLACE_WITH")) {
  console.warn(
    "[sync-vercel-deploy] Set apiOrigin in config/deploy.production.json before deploying."
  );
}

const vercelPath = join(root, "vercel.json");
const vercel = JSON.parse(readFileSync(vercelPath, "utf8"));

vercel.rewrites = [
  { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
  { source: "/(.*)", destination: "/index.html" },
];

writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`);
console.log("[sync-vercel-deploy] API rewrite →", apiOrigin);
