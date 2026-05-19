/**
 * Ensures vercel.json has SPA rewrites only (no API proxy — PartyKit is the backend).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vercelPath = join(root, "vercel.json");
const vercel = JSON.parse(readFileSync(vercelPath, "utf8"));

vercel.rewrites = [{ source: "/(.*)", destination: "/index.html" }];

writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`);
console.log("[sync-vercel-deploy] SPA rewrites only");
