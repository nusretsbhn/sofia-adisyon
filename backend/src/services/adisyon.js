import dayjs from "dayjs";
import { prisma } from "../lib/prisma.js";

/**
 * Arka plan: YYYYMMDD-M{masa}-günlük sıra (aynı gün + aynı masa için artan).
 * Ön yüzde yalnızca masa_no gösterilir.
 */
export async function uretYeniNumara(tx = prisma, masaNo = 1) {
  const masa = Math.min(999, Math.max(1, Number(masaNo) || 1));
  const start = dayjs().startOf("day").toDate();
  const end = dayjs().endOf("day").toDate();
  const gun = dayjs().format("YYYYMMDD");
  const masaStr = `M${String(masa).padStart(2, "0")}`;

  const gunlukSay = await tx.adisyon.count({
    where: {
      acilis_tarihi: { gte: start, lte: end },
      masa_no: masa,
    },
  });
  const sira = gunlukSay + 1;
  return `${gun}-${masaStr}-${String(sira).padStart(3, "0")}`;
}

export async function hesaplaAdisyonToplam(tx, adisyonId) {
  const adisyon = await tx.adisyon.findUnique({
    where: { id: adisyonId },
  });
  if (!adisyon) return null;

  const sum = await tx.adisyonKalem.aggregate({
    where: { adisyon_id: adisyonId },
    _sum: { toplam_fiyat: true },
  });
  const brut = sum._sum.toplam_fiyat ?? 0;
  const indirim = adisyon.indirim_tutari ?? 0;
  const toplam = Math.max(0, brut - indirim);

  await tx.adisyon.update({
    where: { id: adisyonId },
    data: { toplam_tutar: toplam },
  });
  return toplam;
}

const adisyonInclude = {
  olusturan: {
    select: { id: true, ad: true, soyad: true, kullanici_adi: true },
  },
  odemeler: {
    orderBy: { tarih: "asc" },
    include: {
      kullanici: {
        select: { id: true, ad: true, soyad: true, kullanici_adi: true },
      },
    },
  },
  kalemler: {
    orderBy: { ekleme_tarihi: "asc" },
    include: {
      ekleyen: {
        select: { id: true, ad: true, soyad: true, kullanici_adi: true },
      },
      urun: {
        select: {
          id: true,
          ad: true,
          kategori_id: true,
          stok_takibi: true,
        },
      },
    },
  },
};

export async function getAdisyonDetay(id) {
  return prisma.adisyon.findUnique({
    where: { id },
    include: adisyonInclude,
  });
}

export function adisyonOzetPayload(adisyon) {
  if (!adisyon) return null;
  return adisyon;
}
