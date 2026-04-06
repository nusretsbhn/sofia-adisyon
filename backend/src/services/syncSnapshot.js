import { prisma } from "../lib/prisma.js";

function toDate(v) {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

function row(base, keys) {
  const out = {};
  for (const k of keys) out[k] = base[k];
  return out;
}

export async function buildMasterSnapshot() {
  const [kategoriler, urunler, receteler, ayarlar, kullanicilar] =
    await Promise.all([
      prisma.kategori.findMany(),
      prisma.urun.findMany(),
      prisma.recete.findMany(),
      prisma.programAyar.findMany(),
      prisma.kullanici.findMany(),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    kategoriler,
    urunler,
    receteler,
    ayarlar,
    kullanicilar,
  };
}

export async function buildOpsSnapshot() {
  const [adisyonlar, kalemler, odemeler, cariler, cariHareketler, envanterGirisler, envanterCikislar] =
    await Promise.all([
      prisma.adisyon.findMany(),
      prisma.adisyonKalem.findMany(),
      prisma.odeme.findMany(),
      prisma.cari.findMany(),
      prisma.cariHareket.findMany(),
      prisma.envanterGiris.findMany(),
      prisma.envanterCikis.findMany(),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    adisyonlar,
    kalemler,
    odemeler,
    cariler,
    cariHareketler,
    envanterGirisler,
    envanterCikislar,
  };
}

export async function applyMasterSnapshot(snapshot) {
  const data = snapshot || {};
  await prisma.$transaction(async (tx) => {
    for (const item of data.kategoriler || []) {
      await tx.kategori.upsert({
        where: { id: item.id },
        create: row(item, ["id", "ad", "renk", "ikon", "sira", "aktif"]),
        update: row(item, ["ad", "renk", "ikon", "sira", "aktif"]),
      });
    }

    for (const item of data.urunler || []) {
      await tx.urun.upsert({
        where: { id: item.id },
        create: row(item, [
          "id",
          "kategori_id",
          "ad",
          "fiyat",
          "barkod",
          "tur",
          "stok_takibi",
          "stok_birim",
          "aciklama",
          "min_stok",
          "aktif",
          "olusturma_tarihi",
        ]),
        update: row(item, [
          "kategori_id",
          "ad",
          "fiyat",
          "barkod",
          "tur",
          "stok_takibi",
          "stok_birim",
          "aciklama",
          "min_stok",
          "aktif",
        ]),
      });
    }

    for (const item of data.receteler || []) {
      await tx.recete.upsert({
        where: { id: item.id },
        create: row(item, ["id", "urun_id", "hammadde_ad", "miktar", "birim"]),
        update: row(item, ["urun_id", "hammadde_ad", "miktar", "birim"]),
      });
    }

    for (const item of data.ayarlar || []) {
      await tx.programAyar.upsert({
        where: { anahtar: item.anahtar },
        create: { anahtar: item.anahtar, deger: item.deger ?? "" },
        update: { deger: item.deger ?? "" },
      });
    }

    for (const item of data.kullanicilar || []) {
      await tx.kullanici.upsert({
        where: { id: item.id },
        create: row(item, [
          "id",
          "ad",
          "soyad",
          "kullanici_adi",
          "sifre_hash",
          "pin_hash",
          "rol",
          "aktif",
          "olusturma_tarihi",
        ]),
        update: row(item, [
          "ad",
          "soyad",
          "kullanici_adi",
          "sifre_hash",
          "pin_hash",
          "rol",
          "aktif",
        ]),
      });
    }
  });
}

export async function applyOpsSnapshot(snapshot) {
  const data = snapshot || {};
  await prisma.$transaction(async (tx) => {
    for (const item of data.cariler || []) {
      await tx.cari.upsert({
        where: { id: item.id },
        create: row(item, [
          "id",
          "ad",
          "telefon",
          "email",
          "notlar",
          "toplam_borc",
          "olusturma_tarihi",
        ]),
        update: row(item, ["ad", "telefon", "email", "notlar", "toplam_borc"]),
      });
    }

    for (const item of data.adisyonlar || []) {
      await tx.adisyon.upsert({
        where: { id: item.id },
        create: {
          ...row(item, [
            "id",
            "numara",
            "masa_no",
            "musteri_adi",
            "durum",
            "odeme_turu",
            "toplam_tutar",
            "indirim_tutari",
            "notlar",
            "olusturan_kullanici_id",
          ]),
          acilis_tarihi: toDate(item.acilis_tarihi),
          kapanma_tarihi: toDate(item.kapanma_tarihi),
        },
        update: {
          ...row(item, [
            "numara",
            "masa_no",
            "musteri_adi",
            "durum",
            "odeme_turu",
            "toplam_tutar",
            "indirim_tutari",
            "notlar",
            "olusturan_kullanici_id",
          ]),
          acilis_tarihi: toDate(item.acilis_tarihi),
          kapanma_tarihi: toDate(item.kapanma_tarihi),
        },
      });
    }

    for (const item of data.kalemler || []) {
      await tx.adisyonKalem.upsert({
        where: { id: item.id },
        create: {
          ...row(item, [
            "id",
            "adisyon_id",
            "urun_id",
            "urun_adi",
            "birim_fiyat",
            "adet",
            "toplam_fiyat",
            "ikram",
            "iade",
            "ikram_neden",
            "fiyat_degistirildi",
            "orijinal_fiyat",
            "ekleyen_kullanici_id",
          ]),
          ekleme_tarihi: toDate(item.ekleme_tarihi),
        },
        update: {
          ...row(item, [
            "adisyon_id",
            "urun_id",
            "urun_adi",
            "birim_fiyat",
            "adet",
            "toplam_fiyat",
            "ikram",
            "iade",
            "ikram_neden",
            "fiyat_degistirildi",
            "orijinal_fiyat",
            "ekleyen_kullanici_id",
          ]),
          ekleme_tarihi: toDate(item.ekleme_tarihi),
        },
      });
    }

    for (const item of data.odemeler || []) {
      await tx.odeme.upsert({
        where: { id: item.id },
        create: {
          ...row(item, ["id", "adisyon_id", "tutar", "odeme_turu", "kullanici_id"]),
          tarih: toDate(item.tarih),
        },
        update: {
          ...row(item, ["adisyon_id", "tutar", "odeme_turu", "kullanici_id"]),
          tarih: toDate(item.tarih),
        },
      });
    }

    for (const item of data.cariHareketler || []) {
      await tx.cariHareket.upsert({
        where: { id: item.id },
        create: {
          ...row(item, [
            "id",
            "cari_id",
            "adisyon_id",
            "tutar",
            "aciklama",
            "kullanici_id",
          ]),
          tarih: toDate(item.tarih),
        },
        update: {
          ...row(item, ["cari_id", "adisyon_id", "tutar", "aciklama", "kullanici_id"]),
          tarih: toDate(item.tarih),
        },
      });
    }

    for (const item of data.envanterGirisler || []) {
      await tx.envanterGiris.upsert({
        where: { id: item.id },
        create: {
          ...row(item, [
            "id",
            "urun_id",
            "miktar",
            "birim_maliyet",
            "toplam_maliyet",
            "aciklama",
            "kullanici_id",
          ]),
          tarih: toDate(item.tarih),
        },
        update: {
          ...row(item, [
            "urun_id",
            "miktar",
            "birim_maliyet",
            "toplam_maliyet",
            "aciklama",
            "kullanici_id",
          ]),
          tarih: toDate(item.tarih),
        },
      });
    }

    for (const item of data.envanterCikislar || []) {
      await tx.envanterCikis.upsert({
        where: { id: item.id },
        create: {
          ...row(item, ["id", "urun_id", "adisyon_kalem_id", "miktar"]),
          tarih: toDate(item.tarih),
        },
        update: {
          ...row(item, ["urun_id", "adisyon_kalem_id", "miktar"]),
          tarih: toDate(item.tarih),
        },
      });
    }
  });
}
