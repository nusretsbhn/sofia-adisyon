import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, loadUser } from "../middleware/auth.js";
import {
  getAdisyonDetay,
  hesaplaAdisyonToplam,
  uretYeniNumara,
} from "../services/adisyon.js";
import { tamamlaOdemeVeKapat } from "../services/odeme.js";
import { emitAdisyonEvent } from "../socket/events.js";
import {
  buildAdisyonFisMetni,
  getMergedAyarlar,
  yazdirTermal,
} from "../services/yazici.js";

const router = Router();

router.use(requireAuth, loadUser);

function parseId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function garsonMu(rol) {
  return rol === "GARSON";
}

function parseDateOnly(s) {
  const v = String(s ?? "").trim();
  if (!v) return null;
  // Beklenen: YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function endOfDayUtc(dateOnlyUtc) {
  if (!dateOnlyUtc) return null;
  const dt = new Date(dateOnlyUtc);
  dt.setUTCHours(23, 59, 59, 999);
  return dt;
}

const createAdisyonSchema = z.object({
  musteri_adi: z.string().max(200).optional().default(""),
  notlar: z.string().max(2000).optional().nullable(),
  /** Form/JSON bazen string gönderir; koerce ile kabul et */
  masa_no: z.coerce.number().int().min(1).max(999),
});

const patchAdisyonSchema = z.object({
  musteri_adi: z.string().max(200).optional(),
  notlar: z.string().max(2000).optional().nullable(),
  indirim_tutari: z.number().int().min(0).optional(),
});

const kalemEkleSchema = z.object({
  urun_id: z.number().int().positive(),
  adet: z.number().int().min(1).max(999).optional().default(1),
  ikram: z.boolean().optional().default(false),
});

const kalemPatchSchema = z.object({
  adet: z.number().int().min(1).max(999).optional(),
  ikram: z.boolean().optional(),
  birim_fiyat: z.number().int().min(0).optional(),
  ikram_neden: z.string().max(500).optional().nullable(),
});

const odemeBodySchema = z.discriminatedUnion("odeme_turu", [
  z.object({ odeme_turu: z.literal("NAKIT") }),
  z.object({ odeme_turu: z.literal("KREDI_KARTI") }),
  z.object({
    odeme_turu: z.literal("CARI"),
    cari_id: z.number().int().positive(),
  }),
  z.object({
    odeme_turu: z.literal("KARISIK"),
    odemeler: z
      .array(
        z.object({
          odeme_turu: z.enum(["NAKIT", "KREDI_KARTI"]),
          tutar: z.number().int().min(0),
        }),
      )
      .min(1),
  }),
]);

const iptalSchema = z.object({
  notlar: z.string().max(2000).optional(),
});

const bolSchema = z
  .object({
    /** Tam satır taşıma (eski davranış) */
    kalem_ids: z.array(z.number().int().positive()).min(1).optional(),
    /** Satır başına adet ile parça taşıma (hesap böl) */
    kalem_adetleri: z
      .array(
        z.object({
          kalem_id: z.number().int().positive(),
          adet: z.number().int().positive(),
        }),
      )
      .min(1)
      .optional(),
    yeni_musteri_adi: z.string().max(200).optional().default(""),
  })
  .refine((d) => (d.kalem_ids?.length ?? 0) > 0 || (d.kalem_adetleri?.length ?? 0) > 0, {
    message: "kalem_ids veya kalem_adetleri gerekli",
  });

const iadeKalemSchema = z.object({
  adet: z.number().int().min(1).max(999),
});

const transferKalemSchema = z.object({
  hedef_adisyon_id: z.number().int().positive(),
});

const masaTransferSchema = z.object({
  masa_no: z.coerce.number().int().min(1).max(999),
});

router.get("/", async (req, res, next) => {
  try {
    const durum = req.query.durum;
    const bas = parseDateOnly(req.query.baslangic);
    const bit = parseDateOnly(req.query.bitis);
    const rangeStart = bas;
    const rangeEnd = bit ? endOfDayUtc(bit) : null;

    const durumWhere =
      durum && ["ACIK", "KAPALI", "IPTAL"].includes(String(durum))
        ? { durum: String(durum) }
        : null;

    let where = {};
    if (durumWhere) {
      where = { ...durumWhere };
      // İsteğe bağlı tarih filtresi: tek durum seçildiyse daha basit filtre.
      if (rangeStart && rangeEnd) {
        if (durumWhere.durum === "KAPALI") {
          where.kapanma_tarihi = { gte: rangeStart, lte: rangeEnd };
        } else {
          where.acilis_tarihi = { gte: rangeStart, lte: rangeEnd };
        }
      }
    } else if (rangeStart && rangeEnd) {
      // Varsayılan: açıklar açılış tarihine göre, kapalılar kapanış tarihine göre.
      where = {
        OR: [
          { durum: "ACIK", acilis_tarihi: { gte: rangeStart, lte: rangeEnd } },
          { durum: "KAPALI", kapanma_tarihi: { gte: rangeStart, lte: rangeEnd } },
        ],
      };
    }
    const list = await prisma.adisyon.findMany({
      where,
      orderBy: { acilis_tarihi: "desc" },
      take: 200,
      include: {
        olusturan: {
          select: { id: true, ad: true, soyad: true, kullanici_adi: true },
        },
        _count: { select: { kalemler: true } },
        kalemler: {
          orderBy: { ekleme_tarihi: "asc" },
          select: {
            id: true,
            urun_adi: true,
            adet: true,
            ikram: true,
            iade: true,
            toplam_fiyat: true,
          },
        },
      },
    });
    res.json({
      adisyonlar: list.map(({ _count, ...a }) => ({
        ...a,
        kalem_sayisi: _count.kalemler,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createAdisyonSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const { musteri_adi, notlar, masa_no } = parsed.data;

    const adisyon = await prisma.$transaction(async (tx) => {
      const numara = await uretYeniNumara(tx, masa_no);
      return tx.adisyon.create({
        data: {
          numara,
          masa_no,
          musteri_adi: musteri_adi ?? "",
          notlar: notlar ?? null,
          durum: "ACIK",
          olusturan_kullanici_id: req.user.id,
        },
      });
    });

    const detay = await getAdisyonDetay(adisyon.id);
    emitAdisyonEvent("adisyon:acildi", { adisyon: detay });
    res.status(201).json({ adisyon: detay });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz adisyon no" });
    const detay = await getAdisyonDetay(id);
    if (!detay) return res.status(404).json({ error: "Adisyon bulunamadı" });
    res.json({ adisyon: detay });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz adisyon no" });
    const parsed = patchAdisyonSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }

    const mevcut = await prisma.adisyon.findUnique({ where: { id } });
    if (!mevcut) return res.status(404).json({ error: "Adisyon bulunamadı" });
    if (mevcut.durum !== "ACIK") {
      return res.status(409).json({ error: "Sadece açık adisyon güncellenebilir" });
    }

    const data = {};
    if (parsed.data.musteri_adi !== undefined) data.musteri_adi = parsed.data.musteri_adi;
    if (parsed.data.notlar !== undefined) data.notlar = parsed.data.notlar;
    if (parsed.data.indirim_tutari !== undefined) {
      data.indirim_tutari = parsed.data.indirim_tutari;
    }

    await prisma.$transaction(async (tx) => {
      await tx.adisyon.update({ where: { id }, data });
      await hesaplaAdisyonToplam(tx, id);
    });

    const detay = await getAdisyonDetay(id);
    emitAdisyonEvent("adisyon:guncellendi", { adisyon: detay });
    res.json({ adisyon: detay });
  } catch (e) {
    next(e);
  }
});

/** Tüm adisyonu başka (boş) masaya taşır; yeni günlük numara üretilir. */
router.post("/:id/masa-transfer", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz adisyon no" });
    const parsed = masaTransferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const { masa_no: hedefMasa } = parsed.data;

    const mevcut = await prisma.adisyon.findUnique({ where: { id } });
    if (!mevcut) return res.status(404).json({ error: "Adisyon bulunamadı" });
    if (mevcut.durum !== "ACIK") {
      return res.status(409).json({ error: "Sadece açık adisyon taşınabilir" });
    }
    if (mevcut.masa_no === hedefMasa) {
      return res.status(400).json({ error: "Zaten bu masadasınız" });
    }

    const hedefteBaska = await prisma.adisyon.findFirst({
      where: {
        durum: "ACIK",
        masa_no: hedefMasa,
        id: { not: id },
      },
    });
    if (hedefteBaska) {
      return res.status(409).json({ error: "Hedef masada zaten açık adisyon var" });
    }

    await prisma.$transaction(async (tx) => {
      const numara = await uretYeniNumara(tx, hedefMasa);
      await tx.adisyon.update({
        where: { id },
        data: { masa_no: hedefMasa, numara },
      });
    });

    const detay = await getAdisyonDetay(id);
    emitAdisyonEvent("adisyon:guncellendi", { adisyon: detay });
    res.json({ adisyon: detay });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/odeme", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz adisyon no" });
    const parsed = odemeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz ödeme isteği" });
    }
    const body = parsed.data;

    const mevcut = await prisma.adisyon.findUnique({ where: { id } });
    if (!mevcut) return res.status(404).json({ error: "Adisyon bulunamadı" });
    if (mevcut.durum !== "ACIK") {
      return res.status(409).json({ error: "Adisyon zaten kapatılmış veya iptal" });
    }

    let odemeler;
    let cari_id;
    if (body.odeme_turu === "KARISIK") {
      odemeler = body.odemeler;
    }
    if (body.odeme_turu === "CARI") {
      cari_id = body.cari_id;
    }

    let odemeKayitlari;
    try {
      odemeKayitlari = await prisma.$transaction((tx) =>
        tamamlaOdemeVeKapat(tx, {
          adisyonId: id,
          kullaniciId: req.user.id,
          odeme_turu: body.odeme_turu,
          cari_id,
          odemeler,
        }),
      );
    } catch (err) {
      const code = err.code;
      if (code === "TUTAR_UYUSMUYOR") {
        return res.status(400).json({
          error: "Karışık ödeme tutarları toplamı, adisyon tutarına eşit olmalı",
        });
      }
      if (code === "MIKTAR_INT_DEGIL") {
        return res.status(400).json({
          error: "Reçete miktarları stok giriş/çıkışı ile uyumlu olmalı (tam sayı).",
        });
      }
      if (code === "COKLU_HAMMADDE_AD") {
        return res.status(400).json({
          error: err.message || "Reçete hammadde adı eşleşmesi hatalı.",
        });
      }
      if (code === "HAMMADDE_BULUNAMADI") {
        return res.status(400).json({
          error: err.message || "Reçete hammadde ürünü bulunamadı.",
        });
      }
      if (code === "HAMMADDE_STOK_KAPALI") {
        return res.status(400).json({
          error: err.message || "Reçete hammadde ürününde stok takibi kapalı.",
        });
      }
      if (code === "BIRIM_UYUSMUYOR") {
        return res.status(400).json({
          error: err.message || "Reçete birimi ile stok birimi uyuşmuyor.",
        });
      }
      if (code === "CARI_ID" || code === "CARI_YOK") {
        return res.status(400).json({ error: "Geçerli cari seçiniz" });
      }
      if (code === "ODEMELER_GEREKLI" || code === "KARISIK_TUR" || code === "ODEME_TURU") {
        return res.status(400).json({ error: "Geçersiz ödeme bilgisi" });
      }
      if (code === "ADISYON_KAPALI") {
        return res.status(409).json({ error: "Adisyon kapatılamaz" });
      }
      throw err;
    }

    const detay = await getAdisyonDetay(id);
    emitAdisyonEvent("adisyon:kapandi", {
      adisyon_id: id,
      odeme: { odemeler: odemeKayitlari },
      adisyon: detay,
    });
    res.json({ adisyon: detay, odemeler: odemeKayitlari });
  } catch (e) {
    next(e);
  }
});

/** Seçilen satırları yeni açık adisyona taşır (hesap bölme). Parça adet destekler. */
router.post("/:id/bol", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz adisyon no" });
    const parsed = bolSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }

    const mevcut = await prisma.adisyon.findUnique({ where: { id } });
    if (!mevcut) return res.status(404).json({ error: "Adisyon bulunamadı" });
    if (mevcut.durum !== "ACIK") {
      return res.status(409).json({ error: "Sadece açık adisyon bölünebilir" });
    }

    const kalemler = await prisma.adisyonKalem.findMany({
      where: { adisyon_id: id },
    });
    const byId = new Map(kalemler.map((k) => [k.id, k]));

    /** @type {Map<number, number>} kalem_id -> taşınacak adet */
    const tasima = new Map();
    if (parsed.data.kalem_adetleri?.length) {
      for (const row of parsed.data.kalem_adetleri) {
        const prev = tasima.get(row.kalem_id) ?? 0;
        tasima.set(row.kalem_id, prev + row.adet);
      }
    } else if (parsed.data.kalem_ids?.length) {
      for (const kid of parsed.data.kalem_ids) {
        const k = byId.get(kid);
        if (!k) {
          return res.status(400).json({ error: "Geçersiz kalem seçimi" });
        }
        tasima.set(kid, k.adet);
      }
    }

    for (const [kid, adet] of tasima) {
      const k = byId.get(kid);
      if (!k) return res.status(400).json({ error: "Geçersiz kalem seçimi" });
      if (adet < 1 || adet > k.adet) {
        return res.status(400).json({ error: `Satır #${kid} için geçersiz adet` });
      }
    }

    let kalanAdetKaynak = 0;
    for (const k of kalemler) {
      const moved = tasima.get(k.id) ?? 0;
      kalanAdetKaynak += k.adet - moved;
    }
    if (kalanAdetKaynak <= 0) {
      return res.status(400).json({
        error: "Kaynak adisyonda en az bir ürün adedi kalmalı",
      });
    }

    const masaKaynak = mevcut.masa_no > 0 ? mevcut.masa_no : 1;
    let yeniId;
    const uid = req.user.id;

    await prisma.$transaction(async (tx) => {
      const numara = await uretYeniNumara(tx, masaKaynak);
      const yeni = await tx.adisyon.create({
        data: {
          numara,
          masa_no: masaKaynak,
          musteri_adi: parsed.data.yeni_musteri_adi ?? "",
          durum: "ACIK",
          olusturan_kullanici_id: uid,
          indirim_tutari: 0,
        },
      });
      yeniId = yeni.id;

      for (const [kid, moveAdet] of tasima) {
        const k = byId.get(kid);
        if (!k || moveAdet <= 0) continue;

        if (moveAdet >= k.adet) {
          await tx.adisyonKalem.update({
            where: { id: kid },
            data: { adisyon_id: yeni.id },
          });
          continue;
        }

        const kalan = k.adet - moveAdet;
        const birim = k.birim_fiyat;
        const ikram = k.ikram;
        const iade = k.iade;
        const toplamKaynak = iade || ikram ? 0 : birim * kalan;
        const toplamHedef = iade || ikram ? 0 : birim * moveAdet;

        await tx.adisyonKalem.update({
          where: { id: kid },
          data: {
            adet: kalan,
            toplam_fiyat: toplamKaynak,
          },
        });
        await tx.adisyonKalem.create({
          data: {
            adisyon_id: yeni.id,
            urun_id: k.urun_id,
            urun_adi: k.urun_adi,
            birim_fiyat: iade ? 0 : birim,
            adet: moveAdet,
            toplam_fiyat: toplamHedef,
            ikram,
            ikram_neden: k.ikram_neden,
            fiyat_degistirildi: k.fiyat_degistirildi,
            orijinal_fiyat: k.orijinal_fiyat,
            iade,
            ekleyen_kullanici_id: uid,
          },
        });
      }

      await hesaplaAdisyonToplam(tx, id);
      await hesaplaAdisyonToplam(tx, yeni.id);
    });

    const eskiDetay = await getAdisyonDetay(id);
    const yeniDetay = await getAdisyonDetay(yeniId);
    emitAdisyonEvent("adisyon:guncellendi", { adisyon: eskiDetay });
    emitAdisyonEvent("adisyon:acildi", { adisyon: yeniDetay });
    res.json({ adisyon: eskiDetay, yeni_adisyon: yeniDetay });
  } catch (e) {
    next(e);
  }
});

/** Tek satırı başka açık adisyona taşır */
router.post("/:id/kalemler/:kid/transfer", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const kid = parseId(req.params.kid);
    if (!id || !kid) return res.status(400).json({ error: "Geçersiz parametre" });
    const parsed = transferKalemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const hedefId = parsed.data.hedef_adisyon_id;
    if (hedefId === id) {
      return res.status(400).json({ error: "Hedef farklı bir adisyon olmalı" });
    }

    const [kaynak, hedef, kalem] = await Promise.all([
      prisma.adisyon.findUnique({ where: { id } }),
      prisma.adisyon.findUnique({ where: { id: hedefId } }),
      prisma.adisyonKalem.findFirst({ where: { id: kid, adisyon_id: id } }),
    ]);
    if (!kaynak || !hedef) {
      return res.status(404).json({ error: "Adisyon bulunamadı" });
    }
    if (kaynak.durum !== "ACIK" || hedef.durum !== "ACIK") {
      return res.status(409).json({ error: "Yalnızca açık adisyonlar arasında transfer" });
    }
    if (!kalem) {
      return res.status(404).json({ error: "Satır bulunamadı" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.adisyonKalem.update({
        where: { id: kid },
        data: { adisyon_id: hedefId },
      });
      await hesaplaAdisyonToplam(tx, id);
      await hesaplaAdisyonToplam(tx, hedefId);
    });

    const kaynakDetay = await getAdisyonDetay(id);
    const hedefDetay = await getAdisyonDetay(hedefId);
    emitAdisyonEvent("adisyon:guncellendi", { adisyon: kaynakDetay });
    emitAdisyonEvent("adisyon:guncellendi", { adisyon: hedefDetay });
    res.json({ kaynak_adisyon: kaynakDetay, hedef_adisyon: hedefDetay });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/iptal", async (req, res, next) => {
  try {
    if (garsonMu(req.user.rol)) {
      return res.status(403).json({ error: "Adisyon iptal yetkiniz yok" });
    }
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz adisyon no" });
    const parsed = iptalSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }

    const mevcut = await prisma.adisyon.findUnique({ where: { id } });
    if (!mevcut) return res.status(404).json({ error: "Adisyon bulunamadı" });
    if (mevcut.durum !== "ACIK") {
      return res.status(409).json({ error: "Sadece açık adisyon iptal edilebilir" });
    }

    const data = {
      durum: "IPTAL",
      kapanma_tarihi: new Date(),
    };
    if (parsed.data.notlar) {
      data.notlar = mevcut.notlar
        ? `${mevcut.notlar}\n[İptal] ${parsed.data.notlar}`
        : `[İptal] ${parsed.data.notlar}`;
    }

    await prisma.adisyon.update({
      where: { id },
      data,
    });

    const detay = await getAdisyonDetay(id);
    emitAdisyonEvent("adisyon:iptal", { adisyon_id: id, adisyon: detay });
    res.json({ adisyon: detay });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/yazdir", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz adisyon no" });
    const adisyon = await getAdisyonDetay(id);
    if (!adisyon) return res.status(404).json({ error: "Adisyon bulunamadı" });
    if (adisyon.durum === "IPTAL") {
      return res.status(409).json({ error: "İptal edilen adisyon yazdırılamaz" });
    }

    const ayarlar = await getMergedAyarlar();
    const metin = buildAdisyonFisMetni(adisyon, ayarlar);
    const sonuc = await yazdirTermal(metin, ayarlar);

    res.json({
      metin,
      yazdirildi: sonuc.yazdirildi,
      uyari: sonuc.hata || null,
    });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/kalemler", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz adisyon no" });
    const parsed = kalemEkleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }

    if (parsed.data.ikram && garsonMu(req.user.rol)) {
      return res.status(403).json({ error: "İkram yetkiniz yok" });
    }

    const adisyon = await prisma.adisyon.findUnique({ where: { id } });
    if (!adisyon) return res.status(404).json({ error: "Adisyon bulunamadı" });
    if (adisyon.durum !== "ACIK") {
      return res.status(409).json({ error: "Kapalı adisyona ürün eklenemez" });
    }

    const urun = await prisma.urun.findUnique({
      where: { id: parsed.data.urun_id },
    });
    if (!urun || !urun.aktif) {
      return res.status(400).json({ error: "Ürün bulunamadı veya pasif" });
    }

    const adet = parsed.data.adet;
    const ikram = parsed.data.ikram;
    const birim_fiyat = urun.fiyat;
    const toplam_fiyat = ikram ? 0 : birim_fiyat * adet;

    await prisma.$transaction(async (tx) => {
      await tx.adisyonKalem.create({
        data: {
          adisyon_id: id,
          urun_id: urun.id,
          urun_adi: urun.ad,
          birim_fiyat,
          adet,
          toplam_fiyat,
          ikram,
          ikram_neden: ikram ? "İkram" : null,
          fiyat_degistirildi: false,
          orijinal_fiyat: birim_fiyat,
          iade: false,
          ekleyen_kullanici_id: req.user.id,
        },
      });
      await hesaplaAdisyonToplam(tx, id);
    });

    const detay = await getAdisyonDetay(id);
    emitAdisyonEvent("adisyon:guncellendi", { adisyon: detay });
    res.status(201).json({ adisyon: detay });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/kalemler/:kid", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const kid = parseId(req.params.kid);
    if (!id || !kid) return res.status(400).json({ error: "Geçersiz parametre" });

    const parsed = kalemPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }

    const kalem = await prisma.adisyonKalem.findFirst({
      where: { id: kid, adisyon_id: id },
    });
    if (!kalem) return res.status(404).json({ error: "Kalem bulunamadı" });

    const adisyon = await prisma.adisyon.findUnique({ where: { id } });
    if (!adisyon || adisyon.durum !== "ACIK") {
      return res.status(409).json({ error: "Adisyon güncellenemez" });
    }

    if (parsed.data.birim_fiyat !== undefined && garsonMu(req.user.rol)) {
      return res.status(403).json({ error: "Fiyat değiştirme yetkiniz yok" });
    }
    if (parsed.data.ikram === true && garsonMu(req.user.rol)) {
      return res.status(403).json({ error: "İkram yetkiniz yok" });
    }

    let birim_fiyat = kalem.birim_fiyat;
    let ikram = kalem.ikram;
    let adet = kalem.adet;
    let fiyat_degistirildi = kalem.fiyat_degistirildi;
    let orijinal_fiyat = kalem.orijinal_fiyat ?? kalem.birim_fiyat;

    if (parsed.data.adet !== undefined) adet = parsed.data.adet;
    if (parsed.data.ikram !== undefined) ikram = parsed.data.ikram;
    if (parsed.data.birim_fiyat !== undefined) {
      birim_fiyat = parsed.data.birim_fiyat;
      fiyat_degistirildi = true;
      if (orijinal_fiyat == null) orijinal_fiyat = kalem.birim_fiyat;
    }

    const toplam_fiyat = ikram || kalem.iade ? 0 : birim_fiyat * adet;

    await prisma.$transaction(async (tx) => {
      await tx.adisyonKalem.update({
        where: { id: kid },
        data: {
          adet,
          birim_fiyat,
          toplam_fiyat,
          ikram,
          ikram_neden: ikram ? parsed.data.ikram_neden ?? kalem.ikram_neden : null,
          fiyat_degistirildi,
          orijinal_fiyat: fiyat_degistirildi ? orijinal_fiyat : kalem.orijinal_fiyat,
        },
      });
      await hesaplaAdisyonToplam(tx, id);
    });

    const detay = await getAdisyonDetay(id);
    emitAdisyonEvent("adisyon:guncellendi", { adisyon: detay });
    res.json({ adisyon: detay });
  } catch (e) {
    next(e);
  }
});

/** İade: satırda kalır, tutar 0, etiket iade */
router.post("/:id/kalemler/:kid/iade", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const kid = parseId(req.params.kid);
    if (!id || !kid) return res.status(400).json({ error: "Geçersiz parametre" });
    const parsed = iadeKalemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const adetIade = parsed.data.adet;

    const kalem = await prisma.adisyonKalem.findFirst({
      where: { id: kid, adisyon_id: id },
    });
    if (!kalem) return res.status(404).json({ error: "Kalem bulunamadı" });
    if (kalem.iade) {
      return res.status(400).json({ error: "Bu satır zaten iade olarak işaretli" });
    }
    if (adetIade < 1 || adetIade > kalem.adet) {
      return res.status(400).json({ error: "Geçersiz iade adedi" });
    }

    const adisyon = await prisma.adisyon.findUnique({ where: { id } });
    if (!adisyon || adisyon.durum !== "ACIK") {
      return res.status(409).json({ error: "Adisyon güncellenemez" });
    }

    await prisma.$transaction(async (tx) => {
      if (adetIade >= kalem.adet) {
        await tx.adisyonKalem.update({
          where: { id: kid },
          data: {
            iade: true,
            ikram: false,
            ikram_neden: null,
            birim_fiyat: 0,
            toplam_fiyat: 0,
            fiyat_degistirildi: false,
            orijinal_fiyat: null,
          },
        });
      } else {
        const kalan = kalem.adet - adetIade;
        const birim = kalem.birim_fiyat;
        const ikram = kalem.ikram;
        const toplamKaynak = ikram ? 0 : birim * kalan;
        await tx.adisyonKalem.update({
          where: { id: kid },
          data: {
            adet: kalan,
            toplam_fiyat: toplamKaynak,
          },
        });
        await tx.adisyonKalem.create({
          data: {
            adisyon_id: id,
            urun_id: kalem.urun_id,
            urun_adi: kalem.urun_adi,
            birim_fiyat: 0,
            adet: adetIade,
            toplam_fiyat: 0,
            ikram: false,
            iade: true,
            fiyat_degistirildi: false,
            orijinal_fiyat: null,
            ekleyen_kullanici_id: req.user.id,
          },
        });
      }
      await hesaplaAdisyonToplam(tx, id);
    });

    const detay = await getAdisyonDetay(id);
    emitAdisyonEvent("adisyon:guncellendi", { adisyon: detay });
    res.json({ adisyon: detay });
  } catch (e) {
    next(e);
  }
});

/** Ürün satırı olmayan açık adisyonu kapatır (iptal). */
router.post("/:id/kapat-bos", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz adisyon no" });

    const mevcut = await prisma.adisyon.findUnique({ where: { id } });
    if (!mevcut) return res.status(404).json({ error: "Adisyon bulunamadı" });
    if (mevcut.durum !== "ACIK") {
      return res.status(409).json({ error: "Sadece açık adisyon kapatılabilir" });
    }

    const satir = await prisma.adisyonKalem.count({ where: { adisyon_id: id } });
    if (satir > 0) {
      return res.status(400).json({
        error: "Ürün eklendiyse boş adisyon kapatılamaz; önce ürünleri kaldırın veya ödeme alın.",
      });
    }

    await prisma.adisyon.update({
      where: { id },
      data: {
        durum: "IPTAL",
        kapanma_tarihi: new Date(),
      },
    });

    const detay = await getAdisyonDetay(id);
    emitAdisyonEvent("adisyon:iptal", { adisyon_id: id, adisyon: detay });
    res.json({ adisyon: detay });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id/kalemler/:kid", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const kid = parseId(req.params.kid);
    if (!id || !kid) return res.status(400).json({ error: "Geçersiz parametre" });

    const kalem = await prisma.adisyonKalem.findFirst({
      where: { id: kid, adisyon_id: id },
    });
    if (!kalem) return res.status(404).json({ error: "Kalem bulunamadı" });

    const adisyon = await prisma.adisyon.findUnique({ where: { id } });
    if (!adisyon || adisyon.durum !== "ACIK") {
      return res.status(409).json({ error: "Adisyon güncellenemez" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.adisyonKalem.delete({ where: { id: kid } });
      await hesaplaAdisyonToplam(tx, id);
    });

    const detay = await getAdisyonDetay(id);
    emitAdisyonEvent("adisyon:guncellendi", { adisyon: detay });
    res.json({ adisyon: detay });
  } catch (e) {
    next(e);
  }
});

export default router;
