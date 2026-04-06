import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, loadUser, requireAdmin } from "../middleware/auth.js";
import { AYAR_DEFAULTS } from "../services/ayarDefaults.js";

const router = Router();

router.use(requireAuth, loadUser, requireAdmin);

router.get("/", async (_req, res, next) => {
  try {
    const rows = await prisma.programAyar.findMany();
    const kayitli = Object.fromEntries(rows.map((r) => [r.anahtar, r.deger]));
    res.json({
      ayarlar: { ...AYAR_DEFAULTS, ...kayitli },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const raw = req.body?.ayarlar ?? req.body;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const entries = Object.entries(raw).filter(
      ([k]) => typeof k === "string" && k.length > 0 && k.length < 200,
    );
    await prisma.$transaction(
      entries.map(([anahtar, deger]) =>
        prisma.programAyar.upsert({
          where: { anahtar },
          create: { anahtar, deger: String(deger ?? "") },
          update: { deger: String(deger ?? "") },
        }),
      ),
    );
    const rows = await prisma.programAyar.findMany();
    const kayitli = Object.fromEntries(rows.map((r) => [r.anahtar, r.deger]));
    res.json({ ayarlar: { ...AYAR_DEFAULTS, ...kayitli } });
  } catch (e) {
    next(e);
  }
});

export default router;
