import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, loadUser, requireKasiyerUstu } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

const createSchema = z.object({
  ad: z.string().min(1).max(200),
  renk: z.string().max(20).optional().nullable(),
  ikon: z.string().max(100).optional().nullable(),
  sira: z.number().int().optional(),
  aktif: z.boolean().optional(),
});

const updateSchema = z.object({
  ad: z.string().min(1).max(200).optional(),
  renk: z.string().max(20).optional().nullable(),
  ikon: z.string().max(100).optional().nullable(),
  sira: z.number().int().optional(),
  aktif: z.boolean().optional(),
});

const siralaSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

function parseId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

router.get("/", async (req, res, next) => {
  try {
    const aktifOnly = req.query.aktif !== "false";
    const where = aktifOnly ? { aktif: true } : {};
    const kategoriler = await prisma.kategori.findMany({
      where,
      orderBy: { sira: "asc" },
      include: {
        _count: { select: { urunler: true } },
      },
    });
    res.json({
      kategoriler: kategoriler.map(({ _count, ...k }) => ({
        ...k,
        urun_sayisi: _count.urunler,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/", requireKasiyerUstu, loadUser, async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const maxSira = await prisma.kategori.aggregate({ _max: { sira: true } });
    const sira =
      parsed.data.sira ?? (maxSira._max.sira ?? -1) + 1;
    const kat = await prisma.kategori.create({
      data: {
        ad: parsed.data.ad,
        renk: parsed.data.renk ?? null,
        ikon: parsed.data.ikon ?? null,
        sira,
        aktif: parsed.data.aktif ?? true,
      },
    });
    res.status(201).json({ kategori: kat });
  } catch (e) {
    next(e);
  }
});

router.patch("/sirala", requireKasiyerUstu, loadUser, async (req, res, next) => {
  try {
    const parsed = siralaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz sıra listesi" });
    }
    const { ids } = parsed.data;
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < ids.length; index++) {
        await tx.kategori.update({
          where: { id: ids[index] },
          data: { sira: index },
        });
      }
    });
    const kategoriler = await prisma.kategori.findMany({
      orderBy: { sira: "asc" },
      include: { _count: { select: { urunler: true } } },
    });
    res.json({
      kategoriler: kategoriler.map(({ _count, ...k }) => ({
        ...k,
        urun_sayisi: _count.urunler,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", requireKasiyerUstu, loadUser, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const mevcut = await prisma.kategori.findUnique({ where: { id } });
    if (!mevcut) return res.status(404).json({ error: "Kategori bulunamadı" });
    const data = { ...parsed.data };
    const kategori = await prisma.kategori.update({
      where: { id },
      data,
    });
    res.json({ kategori });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireKasiyerUstu, loadUser, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const urunSayisi = await prisma.urun.count({ where: { kategori_id: id } });
    if (urunSayisi > 0) {
      return res.status(409).json({ error: "Bu kategoride ürün varken silinemez" });
    }
    await prisma.kategori.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
