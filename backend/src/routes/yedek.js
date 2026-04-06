import { Router } from "express";
import fs from "fs";
import dayjs from "dayjs";
import { requireAuth, loadUser, requireAdmin } from "../middleware/auth.js";
import { getSqliteDatabasePath } from "../lib/sqlitePath.js";

const router = Router();

router.use(requireAuth, loadUser, requireAdmin);

/** SQLite dosyasının anlık kopyasını indirir (servis çalışırken WAL ile tutarlılık için SQLite yedekleme tercih edilir; bu ham kopyadır). */
router.get("/sqlite", (req, res, next) => {
  try {
    const dbPath = getSqliteDatabasePath();
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: "Veritabanı dosyası bulunamadı" });
    }
    const name = `turadisyon-yedek-${dayjs().format("YYYY-MM-DD-HHmmss")}.db`;
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
    const stream = fs.createReadStream(dbPath);
    stream.on("error", next);
    stream.pipe(res);
  } catch (e) {
    next(e);
  }
});

export default router;
