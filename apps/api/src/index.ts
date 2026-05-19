import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { mkdir } from "node:fs/promises";
import { config } from "./config.js";
import { sessionsRoutes } from "./routes/sessions.js";
import { broadcast } from "./lib/party-broadcast.js";
import { runExpiryScheduler } from "./services/session-service.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

app.get("/health", (c) => c.json({ ok: true, service: "PhotoSocial-api" }));

app.route("/api/sessions", sessionsRoutes);

await mkdir(config.dataDir, { recursive: true });

serve({
  fetch: app.fetch,
  port: config.port,
});

runExpiryScheduler((sessionId) => {
  void broadcast(sessionId, "SESSION_EXPIRED", {});
});

console.log(`PhotoSocial API listening on http://localhost:${config.port}`);
