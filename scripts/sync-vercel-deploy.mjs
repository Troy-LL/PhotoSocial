/**
 * Ensures vercel.json has SPA rewrites + cache headers (no API proxy — PartyKit is the backend).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vercelPath = join(root, "vercel.json");
const vercel = JSON.parse(readFileSync(vercelPath, "utf8"));

vercel.headers = [
  {
    source: "/index.html",
    headers: [
      {
        key: "Cache-Control",
        value: "no-cache, no-store, must-revalidate",
      },
    ],
  },
  {
    source: "/",
    headers: [
      {
        key: "Cache-Control",
        value: "no-cache, no-store, must-revalidate",
      },
    ],
  },
  {
    source: "/assets/(.*)",
    headers: [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ],
  },
];

vercel.rewrites = [
  {
    source:
      "/((?!assets/|favicon\\.svg|manifest\\.webmanifest|sw\\.js|workbox-).*)",
    destination: "/index.html",
  },
];

writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`);
console.log("[sync-vercel-deploy] SPA rewrites + cache headers");
