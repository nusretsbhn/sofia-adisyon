import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, loadUser, requireKasiyerUstu } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, loadUser);

const createSchema = z.object({
  kategori_id: z.number().int().positive().optional(),
  ad: z.string().min(1).max(200),
  fiyat: z.number().int().min(0),
  barkod: z.string().max(80).optional().nullable(),
  stok_takibi: z.boolean().optional(),
  stok_birim: z.enum(["adet", "cl", "gr"]).optional(),
  tur: z.enum(["URUN", "HAMMADDE"]).optional(),
  aciklama: z.string().max(500).optional().nullable(),
  min_stok: z.number().int().min(0).optional(),
  aktif: z.boolean().optional(),
});

const updateSchema = z.object({
  kategori_id: z.number().int().positive().optional(),
  ad: z.string().min(1).max(200).optional(),
  fiyat: z.number().int().min(0).optional(),
  barkod: z.string().max(80).optional().nullable(),
  stok_takibi: z.boolean().optional(),
  stok_birim: z.enum(["adet", "cl", "gr"]).optional(),
  tur: z.enum(["URUN", "HAMMADDE"]).optional(),
  aciklama: z.string().max(500).optional().nullable(),
  min_stok: z.number().int().min(0).optional(),
  aktif: z.boolean().optional(),
});

function parseId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

async function ensureHammaddeKategoriId() {
  const mevcut = await prisma.kategori.findFirst({
    where: { ad: "Hammaddeler" },
    orderBy: { id: "asc" },
  });
  if (mevcut) return mevcut.id;
  const maxSira = await prisma.kategori.aggregate({ _max: { sira: true } });
  const sira = (maxSira._max.sira ?? -1) + 1;
  const kat = await prisma.kategori.create({
    data: { ad: "Hammaddeler", renk: "#64748B", ikon: null, sira, aktif: true },
  });
  return kat.id;
}

const urunInclude = {
  kategori: {
    select: { id: true, ad: true, renk: true, ikon: true, sira: true, aktif: true },
  },
};

router.get("/", async (req, res, next) => {
  try {
    const aktifOnly = req.query.aktif !== "false";
    const where = aktifOnly ? { aktif: true } : {};
    const urunler = await prisma.urun.findMany({
      where,
      orderBy: [{ kategori_id: "asc" }, { ad: "asc" }],
      include: urunInclude,
    });
    res.json({ urunler });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const urun = await prisma.urun.findUnique({
      where: { id },
      include: urunInclude,
    });
    if (!urun) return res.status(404).json({ error: "Ürün bulunamadı" });
    res.json({ urun });
  } catch (e) {
    next(e);
  }
});

router.post("/", requireKasiyerUstu, async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const tur = parsed.data.tur ?? "URUN";
    let kategori_id = parsed.data.kategori_id;
    if (tur === "HAMMADDE") {
      if (!kategori_id) kategori_id = await ensureHammaddeKategoriId();
    } else {
      if (!kategori_id) return res.status(400).json({ error: "Kategori gerekli" });
    }
    const kat = await prisma.kategori.findUnique({ where: { id: kategori_id } });
    if (!kat) return res.status(400).json({ error: "Kategori bulunamadı" });
    const urun = await prisma.urun.create({
      data: {
        kategori_id,
        ad: parsed.data.ad,
        fiyat: parsed.data.fiyat,
        barkod: parsed.data.barkod ?? null,
        tur,
        stok_takibi: parsed.data.stok_takibi ?? false,
        stok_birim: parsed.data.stok_birim ?? "adet",
        aciklama: parsed.data.aciklama ?? null,
        min_stok: parsed.data.min_stok ?? 0,
        aktif: parsed.data.aktif ?? true,
      },
      include: urunInclude,
    });
    res.status(201).json({ urun });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", requireKasiyerUstu, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const mevcut = await prisma.urun.findUnique({ where: { id } });
    if (!mevcut) return res.status(404).json({ error: "Ürün bulunamadı" });
    if (parsed.data.kategori_id != null) {
      const kat = await prisma.kategori.findUnique({
        where: { id: parsed.data.kategori_id },
      });
      if (!kat) return res.status(400).json({ error: "Kategori bulunamadı" });
    }
    const urun = await prisma.urun.update({
      where: { id },
      data: {
        ...parsed.data,
        // stok_takibi açılıp stok_birim gelmediyse default bırak
        stok_birim: parsed.data.stok_birim ?? mevcut.stok_birim ?? "adet",
        tur: parsed.data.tur ?? mevcut.tur ?? "URUN",
        aciklama: parsed.data.aciklama ?? mevcut.aciklama ?? null,
      },
      include: urunInclude,
    });
    res.json({ urun });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireKasiyerUstu, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const kalemSayisi = await prisma.adisyonKalem.count({ where: { urun_id: id } });
    if (kalemSayisi > 0) {
      return res.status(409).json({
        error: "Bu ürün adisyon kalemlerinde geçtiği için silinemez. Pasif yapın.",
      });
    }
    await prisma.urun.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
