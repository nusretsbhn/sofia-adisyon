import { Router } from "express";
import { config } from "../config.js";
import {
  applyMasterSnapshot,
  applyOpsSnapshot,
  buildMasterSnapshot,
  buildOpsSnapshot,
} from "../services/syncSnapshot.js";

const router = Router();

let lastSync = {
  lastMasterPullAt: null,
  lastOpsPushAt: null,
  lastError: null,
};

export function setSyncState(partial) {
  lastSync = { ...lastSync, ...partial };
}

function requireSyncKey(req, res, next) {
  if (!config.sync.sharedKey) {
    return res.status(503).json({ error: "SYNC_SHARED_KEY tanımlı değil." });
  }
  const key = req.headers["x-sync-key"];
  if (key !== config.sync.sharedKey) {
    return res.status(401).json({ error: "Geçersiz sync anahtarı." });
  }
  return next();
}

router.get("/status", (_req, res) => {
  res.json({
    ok: true,
    role: config.sync.role,
    enabled: config.sync.enabled,
    ...lastSync,
  });
});

router.get("/master-snapshot", requireSyncKey, async (_req, res, next) => {
  try {
    const snapshot = await buildMasterSnapshot();
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
});

router.post("/master-apply", requireSyncKey, async (req, res, next) => {
  try {
    await applyMasterSnapshot(req.body ?? {});
    setSyncState({ lastMasterPullAt: new Date().toISOString(), lastError: null });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/ops-snapshot", requireSyncKey, async (_req, res, next) => {
  try {
    const snapshot = await buildOpsSnapshot();
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
});

router.post("/ops-merge", requireSyncKey, async (req, res, next) => {
  try {
    await applyOpsSnapshot(req.body ?? {});
    setSyncState({ lastOpsPushAt: new Date().toISOString(), lastError: null });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
