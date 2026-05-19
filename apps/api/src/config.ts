export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  dataDir: process.env.DATA_DIR || "./data/sessions",
  sessionMaxAgeMs: 24 * 60 * 60 * 1000,
  sessionIdleMs: 2 * 60 * 60 * 1000,
  maxParticipants: 20,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseBucket: process.env.SUPABASE_BUCKET || "PhotoSocial",
  smtp: {
    host: process.env.SMTP_HOST || "localhost",
    port: Number(process.env.SMTP_PORT) || 1025,
    from: process.env.SMTP_FROM || "noreply@photosocial.local",
  },
};
