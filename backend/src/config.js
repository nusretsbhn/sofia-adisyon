export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-in-production",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  sync: {
    enabled: process.env.SYNC_ENABLED === "true",
    role: process.env.SYNC_ROLE || "local",
    remoteUrl: (process.env.SYNC_REMOTE_URL || "").replace(/\/+$/, ""),
    sharedKey: process.env.SYNC_SHARED_KEY || "",
    intervalMs: Math.max(
      60_000,
      Number(process.env.SYNC_INTERVAL_MINUTES || 10) * 60_000,
    ),
    requestTimeoutMs: Math.max(
      5_000,
      Number(process.env.SYNC_REQUEST_TIMEOUT_MS || 20_000),
    ),
  },
};
