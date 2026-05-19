export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  dataDir: process.env.DATA_DIR || "./data/sessions",
  sessionMaxAgeMs: 24 * 60 * 60 * 1000,
  sessionIdleMs: 2 * 60 * 60 * 1000,
  finalCollageTtlMs: Number(process.env.FINAL_COLLAGE_TTL_MS) || 60 * 60 * 1000,
  partykitHost: process.env.PARTYKIT_HOST || "",
  partykitBroadcastSecret:
    process.env.PARTYKIT_BROADCAST_SECRET || "dev-party-broadcast-secret",
  maxParticipants: 20,
};
