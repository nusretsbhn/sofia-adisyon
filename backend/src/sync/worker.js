import { config } from "../config.js";
import { buildOpsSnapshot, applyMasterSnapshot } from "../services/syncSnapshot.js";
import { setSyncState } from "../routes/sync.js";

const SYNC_KEY_HEADER = "x-sync-key";

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.sync.requestTimeoutMs,
  );
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        [SYNC_KEY_HEADER]: config.sync.sharedKey,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${res.statusText} (${body.slice(0, 200)})`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function pushOps() {
  const snapshot = await buildOpsSnapshot();
  await fetchJson(`${config.sync.remoteUrl}/api/sync/ops-merge`, {
    method: "POST",
    body: JSON.stringify(snapshot),
  });
  setSyncState({ lastOpsPushAt: new Date().toISOString(), lastError: null });
}

async function pullMaster() {
  const snapshot = await fetchJson(`${config.sync.remoteUrl}/api/sync/master-snapshot`);
  await applyMasterSnapshot(snapshot);
  setSyncState({ lastMasterPullAt: new Date().toISOString(), lastError: null });
}

async function syncOnce() {
  await pushOps();
  await pullMaster();
}

export function startSyncWorker() {
  if (!config.sync.enabled) {
    console.log("[sync] pasif: SYNC_ENABLED=false");
    return;
  }
  if (config.sync.role !== "local") {
    console.log("[sync] worker sadece local rolde çalışır.");
    return;
  }
  if (!config.sync.remoteUrl || !config.sync.sharedKey) {
    console.warn("[sync] remoteUrl/sharedKey eksik, worker başlatılmadı.");
    return;
  }

  const run = async () => {
    try {
      await syncOnce();
      console.log("[sync] başarılı:", new Date().toISOString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncState({ lastError: msg });
      console.error("[sync] hata:", msg);
    }
  };

  run();
  setInterval(run, config.sync.intervalMs);
}
