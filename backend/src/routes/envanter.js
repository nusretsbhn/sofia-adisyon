import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, loadUser, requireKasiyerUstu } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, loadUser, requireKasiyerUstu);

const girisSchema = z.object({
  urun_id: z.number().int().positive(),
  miktar: z.number().int().min(1).max(999_999),
  birim_maliyet: z.number().int().min(0).optional().nullable(),
  aciklama: z.string().max(500).optional().nullable(),
});

/** Stok takibi açık ürünler: giriş/çıkış toplamları ve mevcut miktar */
router.get("/ozet", async (_req, res, next) => {
  try {
    const [girisler, cikislar, urunler] = await Promise.all([
      prisma.envanterGiris.groupBy({
        by: ["urun_id"],
        _sum: { miktar: true },
      }),
      prisma.envanterCikis.groupBy({
        by: ["urun_id"],
        _sum: { miktar: true },
      }),
      prisma.urun.findMany({
        where: { stok_takibi: true },
        orderBy: [{ kategori_id: "asc" }, { ad: "asc" }],
        include: {
          kategori: { select: { id: true, ad: true } },
        },
      }),
    ]);

    const gMap = Object.fromEntries(
      girisler.map((r) => [r.urun_id, r._sum.miktar ?? 0]),
    );
    const cMap = Object.fromEntries(
      cikislar.map((r) => [r.urun_id, r._sum.miktar ?? 0]),
    );

    const satirlar = urunler.map((u) => {
      const g = gMap[u.id] ?? 0;
      const c = cMap[u.id] ?? 0;
      const mevcut = g - c;
      return {
        urun_id: u.id,
        urun_adi: u.ad,
        aktif: u.aktif,
        kategori_adi: u.kategori?.ad ?? "",
        stok_birim: u.stok_birim ?? "adet",
        min_stok: u.min_stok,
        giris_toplam: g,
        cikis_toplam: c,
        mevcut,
        dusuk: mevcut < u.min_stok,
      };
    });

    res.json({ satirlar });
  } catch (e) {
    next(e);
  }
});

/** Son stok girişleri */
router.get("/girisler", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 40, 200);
    const list = await prisma.envanterGiris.findMany({
      orderBy: { tarih: "desc" },
      take: limit,
      include: {
        urun: { select: { id: true, ad: true } },
        kullanici: {
          select: { id: true, ad: true, soyad: true, kullanici_adi: true },
        },
      },
    });
    res.json({
      girisler: list.map((r) => ({
        id: r.id,
        urun_id: r.urun_id,
        urun_adi: r.urun.ad,
        miktar: r.miktar,
        birim_maliyet: r.birim_maliyet,
        toplam_maliyet: r.toplam_maliyet,
        tarih: r.tarih,
        aciklama: r.aciklama,
        kullanici: r.kullanici,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/giris", async (req, res, next) => {
  try {
    const parsed = girisSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const { urun_id, miktar, birim_maliyet, aciklama } = parsed.data;

    const urun = await prisma.urun.findUnique({ where: { id: urun_id } });
    if (!urun) {
      return res.status(400).json({ error: "Ürün bulunamadı" });
    }
    if (!urun.stok_takibi) {
      return res.status(400).json({ error: "Bu üründe stok takibi kapalı" });
    }

    let toplam_maliyet = null;
    if (birim_maliyet != null) {
      toplam_maliyet = birim_maliyet * miktar;
    }

    const kayit = await prisma.envanterGiris.create({
      data: {
        urun_id,
        miktar,
        birim_maliyet: birim_maliyet ?? null,
        toplam_maliyet,
        aciklama: aciklama ?? null,
        kullanici_id: req.user.id,
      },
      include: {
        urun: { select: { id: true, ad: true } },
      },
    });

    res.status(201).json({
      giris: {
        id: kayit.id,
        urun_id: kayit.urun_id,
        urun_adi: kayit.urun.ad,
        miktar: kayit.miktar,
        birim_maliyet: kayit.birim_maliyet,
        toplam_maliyet: kayit.toplam_maliyet,
        tarih: kayit.tarih,
        aciklama: kayit.aciklama,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
