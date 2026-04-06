import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, loadUser, requireKasiyerUstu } from "../middleware/auth.js";

const router = Router();

const createSchema = z.object({
  urun_id: z.number().int().positive(),
  hammadde_ad: z.string().min(1).max(200),
  miktar: z.number().positive(),
  birim: z.string().min(1).max(40),
});

const updateSchema = z.object({
  hammadde_ad: z.string().min(1).max(200).optional(),
  miktar: z.number().positive().optional(),
  birim: z.string().min(1).max(40).optional(),
});

function parseId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

async function getRecetePayload(urun_id) {
  const urun = await prisma.urun.findUnique({ where: { id: urun_id } });
  if (!urun) return null;
  const receteler = await prisma.recete.findMany({
    where: { urun_id },
    orderBy: { id: "asc" },
  });
  return {
    urun: { id: urun.id, ad: urun.ad },
    receteler,
  };
}

/** POS / garson: salt okunur reçete (kasiyer üstü şartı yok) */
router.get("/urun/:urunId", requireAuth, loadUser, async (req, res, next) => {
  try {
    const urun_id = parseId(req.params.urunId);
    if (!urun_id) return res.status(400).json({ error: "Geçersiz ürün" });
    const payload = await getRecetePayload(urun_id);
    if (!payload) return res.status(404).json({ error: "Ürün bulunamadı" });
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

router.use(requireAuth, loadUser, requireKasiyerUstu);

/** ?urun_id= zorunlu: admin panel ile aynı veri */
router.get("/", async (req, res, next) => {
  try {
    const urun_id = parseId(req.query.urun_id);
    if (!urun_id) {
      return res.status(400).json({ error: "urun_id gerekli" });
    }
    const payload = await getRecetePayload(urun_id);
    if (!payload) return res.status(404).json({ error: "Ürün bulunamadı" });
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const urun = await prisma.urun.findUnique({
      where: { id: parsed.data.urun_id },
    });
    if (!urun) return res.status(400).json({ error: "Ürün bulunamadı" });

    const r = await prisma.recete.create({
      data: {
        urun_id: parsed.data.urun_id,
        hammadde_ad: parsed.data.hammadde_ad,
        miktar: parsed.data.miktar,
        birim: parsed.data.birim,
      },
    });
    res.status(201).json({ recete: r });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const mevcut = await prisma.recete.findUnique({ where: { id } });
    if (!mevcut) return res.status(404).json({ error: "Kayıt bulunamadı" });

    const recete = await prisma.recete.update({
      where: { id },
      data: parsed.data,
    });
    res.json({ recete });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    await prisma.recete.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Kayıt bulunamadı" });
    }
    next(e);
  }
});

export default router;
