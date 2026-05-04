import { Router } from "express";
import { config } from "../config.js";
import { requireAuth, loadUser, requireKasiyerUstu } from "../middleware/auth.js";
import { getIo } from "../socket/events.js";
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

/** Admin: bağlı tüm POS tarayıcılarına katalog yenile sinyali (Socket.IO). */
router.post(
  "/admin/publish-catalog",
  requireAuth,
  loadUser,
  requireKasiyerUstu,
  (_req, res) => {
    const io = getIo();
    const payload = { at: new Date().toISOString() };
    io?.emit("catalog:refresh", payload);
    res.json({
      ok: true,
      emitted: Boolean(io),
      message:
        "Bağlı POS oturumlarına bildirim gönderildi. Yerel senkron açıksa stok da çekilir.",
    });
  },
);

/**
 * Yerel POS backend (SYNC_ROLE=local): uzaktan master snapshot çekip SQLite günceller.
 * Uzak API kullanan POS’ta atlanır; yine de üstteki socket ile React tarafı yenilenir.
 */
router.post("/pull-master", requireAuth, loadUser, async (_req, res, next) => {
  try {
    const { pullMasterOnce } = await import("../sync/worker.js");
    const r = await pullMasterOnce();
    res.json(r);
  } catch (e) {
    next(e);
  }
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
