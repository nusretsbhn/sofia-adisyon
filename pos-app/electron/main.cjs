const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn, execFileSync } = require("child_process");
const crypto = require("crypto");

const devUrl = process.env.VITE_DEV_SERVER_URL;
const API_PORT = process.env.TURADISYON_API_PORT || "3000";
const HEALTH_URL = `http://127.0.0.1:${API_PORT}/api/health`;

function toPrismaDatabaseUrl(filePath) {
  const normalized = path.resolve(filePath).replace(/\\/g, "/");
  if (!normalized.startsWith("/")) {
    return `file:${normalized}`;
  }
  return `file:${normalized}`;
}

function getBackendRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "backend");
  }
  return path.join(__dirname, "..", "..", "backend");
}

function ensureSecrets(userData) {
  const p = path.join(userData, "turadisyon-secrets.json");
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  const secrets = {
    jwtSecret: crypto.randomBytes(32).toString("hex"),
    jwtRefreshSecret: crypto.randomBytes(32).toString("hex"),
  };
  fs.writeFileSync(p, JSON.stringify(secrets, null, 2), "utf8");
  return secrets;
}

function readSyncSettings(userData) {
  const p = path.join(userData, "sync-settings.json");
  if (!fs.existsSync(p)) {
    return {
      SYNC_ENABLED: "false",
      SYNC_ROLE: "local",
      SYNC_REMOTE_URL: "",
      SYNC_SHARED_KEY: "",
      SYNC_INTERVAL_MINUTES: "10",
      SYNC_REQUEST_TIMEOUT_MS: "20000",
    };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    return {
      SYNC_ENABLED: String(raw.SYNC_ENABLED ?? "false"),
      SYNC_ROLE: String(raw.SYNC_ROLE ?? "local"),
      SYNC_REMOTE_URL: String(raw.SYNC_REMOTE_URL ?? ""),
      SYNC_SHARED_KEY: String(raw.SYNC_SHARED_KEY ?? ""),
      SYNC_INTERVAL_MINUTES: String(raw.SYNC_INTERVAL_MINUTES ?? "10"),
      SYNC_REQUEST_TIMEOUT_MS: String(raw.SYNC_REQUEST_TIMEOUT_MS ?? "20000"),
    };
  } catch {
    return {
      SYNC_ENABLED: "false",
      SYNC_ROLE: "local",
      SYNC_REMOTE_URL: "",
      SYNC_SHARED_KEY: "",
      SYNC_INTERVAL_MINUTES: "10",
      SYNC_REQUEST_TIMEOUT_MS: "20000",
    };
  }
}

function runBackendStep(executable, args, cwd, env) {
  const opts = { env, cwd, stdio: "pipe" };
  if (process.platform === "win32") opts.windowsHide = true;
  execFileSync(executable, args, opts);
}

function waitForHealth(url, timeoutMs = 90000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    function schedule() {
      if (Date.now() - started > timeoutMs) {
        reject(new Error("API yanıt vermedi (zaman aşımı)"));
        return;
      }
      setTimeout(attempt, 400);
    }
    function attempt() {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
        } else {
          schedule();
        }
      });
      req.on("error", schedule);
    }
    attempt();
  });
}

let backendProcess = null;

async function startBundledBackend() {
  const userData = app.getPath("userData");
  fs.mkdirSync(userData, { recursive: true });

  const dbFile = path.join(userData, "turadisyon.db");
  const databaseUrl = toPrismaDatabaseUrl(dbFile);
  const secrets = ensureSecrets(userData);
  const syncSettings = readSyncSettings(userData);
  const backendRoot = getBackendRoot();

  const prismaCli = path.join(backendRoot, "node_modules", "prisma", "build", "index.js");
  const indexJs = path.join(backendRoot, "src", "index.js");
  const seedJs = path.join(backendRoot, "prisma", "seed.js");

  if (!fs.existsSync(indexJs)) {
    throw new Error("Paketlenmiş backend bulunamadı: " + indexJs);
  }

  const baseEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: API_PORT,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: secrets.jwtSecret,
    JWT_REFRESH_SECRET: secrets.jwtRefreshSecret,
    ...syncSettings,
  };

  try {
    runBackendStep(process.execPath, [prismaCli, "migrate", "deploy"], backendRoot, baseEnv);
  } catch (e) {
    throw new Error("Veritabanı güncellenemedi: " + (e.message || String(e)));
  }

  try {
    runBackendStep(process.execPath, [seedJs], backendRoot, baseEnv);
  } catch (e) {
    console.error("Seed:", e);
  }

  const spawnOpts = {
    env: baseEnv,
    cwd: backendRoot,
    stdio: "ignore",
  };
  if (process.platform === "win32") spawnOpts.windowsHide = true;

  backendProcess = spawn(process.execPath, [indexJs], spawnOpts);
  backendProcess.on("error", (err) => {
    console.error("Backend spawn:", err);
  });
  backendProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error("Backend exit:", code);
    }
  });

  await waitForHealth(HEALTH_URL);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  try {
    if (app.isPackaged) {
      await startBundledBackend();
    }
  } catch (e) {
    dialog.showErrorBox("TurAdisyon", "Sunucu başlatılamadı.\n\n" + (e.message || String(e)));
    app.quit();
    return;
  }

  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
});
