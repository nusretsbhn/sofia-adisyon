import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, loadUser, requireKasiyerUstu } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

const createSchema = z.object({
  ad: z.string().min(1).max(200),
  telefon: z.string().max(50).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  notlar: z.string().max(5000).optional().nullable(),
});

const updateSchema = z.object({
  ad: z.string().min(1).max(200).optional(),
  telefon: z.string().max(50).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  notlar: z.string().max(5000).optional().nullable(),
});

const tahsilatSchema = z.object({
  tutar: z.number().int().positive(),
  aciklama: z.string().max(500).optional().nullable(),
});

function parseId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

router.get("/", async (req, res, next) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : "";
    const where = q
      ? {
          OR: [
            { ad: { contains: q } },
            { telefon: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {};
    const cariler = await prisma.cari.findMany({
      where,
      orderBy: { olusturma_tarihi: "desc" },
      take: 500,
    });
    res.json({ cariler });
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
    const { ad, telefon, email, notlar } = parsed.data;
    const cari = await prisma.cari.create({
      data: {
        ad,
        telefon: telefon || null,
        email: email || null,
        notlar: notlar || null,
      },
    });
    res.status(201).json({ cari });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const cari = await prisma.cari.findUnique({
      where: { id },
      include: {
        hareketler: {
          orderBy: { tarih: "desc" },
          take: 50,
          include: {
            kullanici: {
              select: { id: true, ad: true, soyad: true, kullanici_adi: true },
            },
            adisyon: {
              select: { id: true, numara: true, durum: true, toplam_tutar: true },
            },
          },
        },
      },
    });
    if (!cari) return res.status(404).json({ error: "Cari bulunamadı" });
    res.json({ cari });
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
    const mevcut = await prisma.cari.findUnique({ where: { id } });
    if (!mevcut) return res.status(404).json({ error: "Cari bulunamadı" });

    const data = {};
    if (parsed.data.ad !== undefined) data.ad = parsed.data.ad;
    if (parsed.data.telefon !== undefined) data.telefon = parsed.data.telefon;
    if (parsed.data.email !== undefined) data.email = parsed.data.email || null;
    if (parsed.data.notlar !== undefined) data.notlar = parsed.data.notlar;

    const cari = await prisma.cari.update({
      where: { id },
      data,
    });
    res.json({ cari });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireKasiyerUstu, loadUser, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const mevcut = await prisma.cari.findUnique({ where: { id } });
    if (!mevcut) return res.status(404).json({ error: "Cari bulunamadı" });
    if (mevcut.toplam_borc !== 0) {
      return res.status(409).json({ error: "Bakiye sıfır olmadan cari silinemez" });
    }
    const hSay = await prisma.cariHareket.count({ where: { cari_id: id } });
    if (hSay > 0) {
      return res.status(409).json({ error: "Hareket kaydı varken cari silinemez" });
    }
    await prisma.cari.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

router.get("/:id/hareketler", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const cari = await prisma.cari.findUnique({ where: { id } });
    if (!cari) return res.status(404).json({ error: "Cari bulunamadı" });

    const take = Math.min(Number(req.query.limit) || 200, 500);
    const hareketler = await prisma.cariHareket.findMany({
      where: { cari_id: id },
      orderBy: { tarih: "desc" },
      take,
      include: {
        kullanici: {
          select: { id: true, ad: true, soyad: true, kullanici_adi: true },
        },
        adisyon: {
          select: { id: true, numara: true, durum: true, toplam_tutar: true },
        },
      },
    });
    res.json({ hareketler });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/odeme", requireKasiyerUstu, loadUser, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const parsed = tahsilatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const { tutar, aciklama } = parsed.data;

    const cari = await prisma.cari.findUnique({ where: { id } });
    if (!cari) return res.status(404).json({ error: "Cari bulunamadı" });
    if (tutar > cari.toplam_borc) {
      return res.status(400).json({ error: "Tutar bakiyeden büyük olamaz" });
    }

    const guncel = await prisma.$transaction(async (tx) => {
      await tx.cari.update({
        where: { id },
        data: { toplam_borc: { decrement: tutar } },
      });
      await tx.cariHareket.create({
        data: {
          cari_id: id,
          adisyon_id: null,
          tutar: -tutar,
          aciklama: aciklama?.trim() || "Tahsilat",
          kullanici_id: req.user.id,
        },
      });
      return tx.cari.findUnique({ where: { id } });
    });

    res.json({ cari: guncel });
  } catch (e) {
    next(e);
  }
});

export default router;
