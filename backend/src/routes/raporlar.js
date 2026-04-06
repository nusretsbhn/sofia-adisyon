import { Router } from "express";
import dayjs from "dayjs";
import { prisma } from "../lib/prisma.js";
import { requireAuth, loadUser, requireKasiyerUstu } from "../middleware/auth.js";
import {
  parseTarihAraligi,
  csvSatir,
  csvDosya,
} from "../lib/raporUtils.js";

const router = Router();

router.use(requireAuth, loadUser, requireKasiyerUstu);

function tryRange(req, res) {
  try {
    return parseTarihAraligi(req);
  } catch (e) {
    if (e.code === "TARIH") {
      res.status(400).json({ error: "Geçersiz tarih (YYYY-MM-DD)" });
      return null;
    }
    if (e.code === "TARIH_ARALIK") {
      res.status(400).json({ error: "Başlangıç, bitişten sonra olamaz" });
      return null;
    }
    throw e;
  }
}

function kurusToTl(k) {
  return ((k ?? 0) / 100).toFixed(2);
}

router.get("/dashboard", async (_req, res, next) => {
  try {
    const start = dayjs().startOf("day").toDate();
    const end = dayjs().endOf("day").toDate();

    const [acikSayisi, kapaliBugun, odemelerBugun] = await Promise.all([
      prisma.adisyon.count({ where: { durum: "ACIK" } }),
      prisma.adisyon.findMany({
        where: {
          durum: "KAPALI",
          kapanma_tarihi: { gte: start, lte: end },
          NOT: { odeme_turu: "CARI" },
        },
        select: { toplam_tutar: true },
      }),
      prisma.odeme.findMany({
        where: {
          tarih: { gte: start, lte: end },
        },
      }),
    ]);

    const ciroBugun = kapaliBugun.reduce((s, a) => s + a.toplam_tutar, 0);
    const kapaliAdisyonSayisi = kapaliBugun.length;

    let nakit = 0;
    let krediKarti = 0;
    let cari = 0;
    for (const o of odemelerBugun) {
      if (o.odeme_turu === "NAKIT") nakit += o.tutar;
      else if (o.odeme_turu === "KREDI_KARTI") krediKarti += o.tutar;
      else if (o.odeme_turu === "CARI") cari += o.tutar;
    }

    res.json({
      tarih: dayjs().format("YYYY-MM-DD"),
      bugun: {
        ciro_kurus: ciroBugun,
        kapali_adisyon_sayisi: kapaliAdisyonSayisi,
        nakit_kurus: nakit,
        kredi_karti_kurus: krediKarti,
        cari_kurus: cari,
      },
      anlik: {
        acik_adisyon_sayisi: acikSayisi,
      },
    });
  } catch (e) {
    next(e);
  }
});

/** Ciro özeti: kapanan adisyon cirosu + ödeme türü kırılımı (ödeme tarihi) */
router.get("/ciro", async (req, res, next) => {
  try {
    const r = tryRange(req, res);
    if (!r) return;

    const kapali = await prisma.adisyon.findMany({
      where: {
        durum: "KAPALI",
        kapanma_tarihi: { gte: r.start, lte: r.end },
        NOT: { odeme_turu: "CARI" },
      },
      select: { toplam_tutar: true },
    });

    const odemeler = await prisma.odeme.findMany({
      where: { tarih: { gte: r.start, lte: r.end } },
    });

    const ciroToplam = kapali.reduce((s, a) => s + a.toplam_tutar, 0);
    let nakit = 0;
    let kredi = 0;
    let cari = 0;
    for (const o of odemeler) {
      if (o.odeme_turu === "NAKIT") nakit += o.tutar;
      else if (o.odeme_turu === "KREDI_KARTI") kredi += o.tutar;
      else if (o.odeme_turu === "CARI") cari += o.tutar;
    }

    const json = {
      baslangic: r.baslangic,
      bitis: r.bitis,
      kapali_adisyon_sayisi: kapali.length,
      ciro_kurus: ciroToplam,
      odeme_kurus: { nakit, kredi_karti: kredi, cari },
    };

    if (req.query.format === "csv") {
      const satirlar = [
        csvSatir(["Özet", "Değer"]),
        csvSatir(["Dönem başı", r.baslangic]),
        csvSatir(["Dönem sonu", r.bitis]),
        csvSatir(["Kapalı adisyon sayısı", kapali.length]),
        csvSatir(["Ciro (TL)", kurusToTl(ciroToplam)]),
        csvSatir([]),
        csvSatir(["Ödeme kayıtları (tarih aralığında)", ""]),
        csvSatir(["Nakit (TL)", kurusToTl(nakit)]),
        csvSatir(["Kredi kartı (TL)", kurusToTl(kredi)]),
        csvSatir(["Cari (TL)", kurusToTl(cari)]),
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ciro-${r.baslangic}_${r.bitis}.csv"`,
      );
      return res.send(csvDosya(satirlar));
    }

    res.json(json);
  } catch (e) {
    next(e);
  }
});

router.get("/urunler", async (req, res, next) => {
  try {
    const r = tryRange(req, res);
    if (!r) return;

    const kalemler = await prisma.adisyonKalem.findMany({
      where: {
        adisyon: {
          durum: "KAPALI",
          kapanma_tarihi: { gte: r.start, lte: r.end },
        },
      },
      select: {
        urun_id: true,
        urun_adi: true,
        adet: true,
        toplam_fiyat: true,
      },
    });

    const map = new Map();
    for (const k of kalemler) {
      const key = k.urun_id;
      const cur = map.get(key) ?? {
        urun_id: key,
        urun_adi: k.urun_adi,
        adet: 0,
        tutar_kurus: 0,
      };
      cur.adet += k.adet;
      cur.tutar_kurus += k.toplam_fiyat;
      map.set(key, cur);
    }

    const satislar = [...map.values()].sort((a, b) => b.tutar_kurus - a.tutar_kurus);

    if (req.query.format === "csv") {
      const satirlar = [
        csvSatir(["Ürün ID", "Ürün adı", "Adet", "Tutar (TL)"]),
        ...satislar.map((s) =>
          csvSatir([
            s.urun_id,
            s.urun_adi,
            s.adet,
            kurusToTl(s.tutar_kurus),
          ]),
        ),
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="urun-satis-${r.baslangic}_${r.bitis}.csv"`,
      );
      return res.send(csvDosya(satirlar));
    }

    res.json({
      baslangic: r.baslangic,
      bitis: r.bitis,
      satislar,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/kategoriler", async (req, res, next) => {
  try {
    const r = tryRange(req, res);
    if (!r) return;

    const kalemler = await prisma.adisyonKalem.findMany({
      where: {
        adisyon: {
          durum: "KAPALI",
          kapanma_tarihi: { gte: r.start, lte: r.end },
        },
      },
      include: {
        urun: {
          select: {
            kategori_id: true,
            kategori: { select: { id: true, ad: true } },
          },
        },
      },
    });

    const map = new Map();
    for (const k of kalemler) {
      const kid = k.urun?.kategori_id ?? 0;
      const ad = k.urun?.kategori?.ad ?? "—";
      const cur = map.get(kid) ?? {
        kategori_id: kid,
        kategori_adi: ad,
        adet: 0,
        tutar_kurus: 0,
      };
      cur.adet += k.adet;
      cur.tutar_kurus += k.toplam_fiyat;
      map.set(kid, cur);
    }

    const satislar = [...map.values()].sort((a, b) => b.tutar_kurus - a.tutar_kurus);

    if (req.query.format === "csv") {
      const satirlar = [
        csvSatir(["Kategori ID", "Kategori", "Adet", "Tutar (TL)"]),
        ...satislar.map((s) =>
          csvSatir([
            s.kategori_id,
            s.kategori_adi,
            s.adet,
            kurusToTl(s.tutar_kurus),
          ]),
        ),
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="kategori-${r.baslangic}_${r.bitis}.csv"`,
      );
      return res.send(csvDosya(satirlar));
    }

    res.json({
      baslangic: r.baslangic,
      bitis: r.bitis,
      satislar,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/adisyonlar", async (req, res, next) => {
  try {
    const r = tryRange(req, res);
    if (!r) return;

    const list = await prisma.adisyon.findMany({
      where: {
        durum: "KAPALI",
        kapanma_tarihi: { gte: r.start, lte: r.end },
      },
      orderBy: { kapanma_tarihi: "desc" },
      take: 2000,
      select: {
        id: true,
        numara: true,
        musteri_adi: true,
        toplam_tutar: true,
        kapanma_tarihi: true,
        odeme_turu: true,
      },
    });

    if (req.query.format === "csv") {
      const satirlar = [
        csvSatir([
          "ID",
          "No",
          "Müşteri",
          "Tutar (TL)",
          "Kapanış",
          "Ödeme türü",
        ]),
        ...list.map((a) =>
          csvSatir([
            a.id,
            a.numara,
            a.musteri_adi ?? "",
            kurusToTl(a.toplam_tutar),
            a.kapanma_tarihi
              ? dayjs(a.kapanma_tarihi).format("DD.MM.YYYY HH:mm")
              : "",
            a.odeme_turu ?? "",
          ]),
        ),
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="adisyonlar-${r.baslangic}_${r.bitis}.csv"`,
      );
      return res.send(csvDosya(satirlar));
    }

    res.json({
      baslangic: r.baslangic,
      bitis: r.bitis,
      adisyonlar: list,
    });
  } catch (e) {
    next(e);
  }
});

/** İkram satırları (kapalı adisyon, kapanış tarihi aralığı) */
router.get("/ikramlar", async (req, res, next) => {
  try {
    const r = tryRange(req, res);
    if (!r) return;

    const satirlar = await prisma.adisyonKalem.findMany({
      where: {
        ikram: true,
        adisyon: {
          durum: "KAPALI",
          kapanma_tarihi: { gte: r.start, lte: r.end },
        },
      },
      orderBy: { id: "desc" },
      take: 5000,
      include: {
        adisyon: {
          select: {
            id: true,
            numara: true,
            kapanma_tarihi: true,
          },
        },
      },
    });

    let toplam_adet = 0;
    for (const s of satirlar) {
      toplam_adet += s.adet;
    }

    if (req.query.format === "csv") {
      const rows = [
        csvSatir([
          "Adisyon no",
          "Ürün",
          "Adet",
          "Kapanış",
          "İkram tutar (TL)",
        ]),
        ...satirlar.map((s) =>
          csvSatir([
            s.adisyon.numara,
            s.urun_adi,
            s.adet,
            s.adisyon.kapanma_tarihi
              ? dayjs(s.adisyon.kapanma_tarihi).format("DD.MM.YYYY HH:mm")
              : "",
            kurusToTl(s.toplam_fiyat),
          ]),
        ),
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ikramlar-${r.baslangic}_${r.bitis}.csv"`,
      );
      return res.send(csvDosya(rows));
    }

    res.json({
      baslangic: r.baslangic,
      bitis: r.bitis,
      ozet: { satir_sayisi: satirlar.length, toplam_adet },
      satirlar: satirlar.map((s) => ({
        id: s.id,
        adisyon_id: s.adisyon_id,
        adisyon_numara: s.adisyon.numara,
        urun_adi: s.urun_adi,
        adet: s.adet,
        tutar_kurus: s.toplam_fiyat,
        kapanma: s.adisyon.kapanma_tarihi,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/** İptal edilen adisyonlar */
router.get("/iptaller", async (req, res, next) => {
  try {
    const r = tryRange(req, res);
    if (!r) return;

    const list = await prisma.adisyon.findMany({
      where: {
        durum: "IPTAL",
        kapanma_tarihi: { gte: r.start, lte: r.end },
      },
      orderBy: { kapanma_tarihi: "desc" },
      take: 2000,
      select: {
        id: true,
        numara: true,
        musteri_adi: true,
        toplam_tutar: true,
        kapanma_tarihi: true,
        notlar: true,
      },
    });

    if (req.query.format === "csv") {
      const satirlar = [
        csvSatir(["ID", "No", "Müşteri", "Tutar (TL)", "Kapanış", "Not"]),
        ...list.map((a) =>
          csvSatir([
            a.id,
            a.numara,
            a.musteri_adi ?? "",
            kurusToTl(a.toplam_tutar),
            a.kapanma_tarihi
              ? dayjs(a.kapanma_tarihi).format("DD.MM.YYYY HH:mm")
              : "",
            (a.notlar ?? "").replace(/\r?\n/g, " "),
          ]),
        ),
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="iptaller-${r.baslangic}_${r.bitis}.csv"`,
      );
      return res.send(csvDosya(satirlar));
    }

    res.json({
      baslangic: r.baslangic,
      bitis: r.bitis,
      iptaller: list,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
