import { hesaplaAdisyonToplam } from "./adisyon.js";

/**
 * Açık adisyonu ödeme kayıtlarıyla kapatır; stok takibi olan ürünler için envanter çıkışı yazar.
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 */
export async function tamamlaOdemeVeKapat(tx, { adisyonId, kullaniciId, odeme_turu, cari_id, odemeler }) {
  await hesaplaAdisyonToplam(tx, adisyonId);

  const adisyon = await tx.adisyon.findUnique({
    where: { id: adisyonId },
  });
  if (!adisyon || adisyon.durum !== "ACIK") {
    const err = new Error("ADISYON_KAPALI");
    err.code = "ADISYON_KAPALI";
    throw err;
  }

  const tutarOdenecek = adisyon.toplam_tutar;
  const odemeKayitlari = [];

  if (tutarOdenecek > 0) {
    if (odeme_turu === "NAKIT" || odeme_turu === "KREDI_KARTI") {
      const o = await tx.odeme.create({
        data: {
          adisyon_id: adisyonId,
          tutar: tutarOdenecek,
          odeme_turu,
          kullanici_id: kullaniciId,
        },
      });
      odemeKayitlari.push(o);
    } else if (odeme_turu === "CARI") {
      if (!cari_id) {
        const err = new Error("CARI_ID");
        err.code = "CARI_ID";
        throw err;
      }
      const cari = await tx.cari.findUnique({ where: { id: cari_id } });
      if (!cari) {
        const err = new Error("CARI_YOK");
        err.code = "CARI_YOK";
        throw err;
      }
      const o = await tx.odeme.create({
        data: {
          adisyon_id: adisyonId,
          tutar: tutarOdenecek,
          odeme_turu: "CARI",
          kullanici_id: kullaniciId,
        },
      });
      odemeKayitlari.push(o);
      await tx.cari.update({
        where: { id: cari_id },
        data: { toplam_borc: { increment: tutarOdenecek } },
      });
      await tx.cariHareket.create({
        data: {
          cari_id,
          adisyon_id: adisyonId,
          tutar: tutarOdenecek,
          aciklama: `Adisyon ${adisyon.numara}`,
          kullanici_id: kullaniciId,
        },
      });
    } else if (odeme_turu === "KARISIK") {
      if (!Array.isArray(odemeler) || odemeler.length === 0) {
        const err = new Error("ODEMELER_GEREKLI");
        err.code = "ODEMELER_GEREKLI";
        throw err;
      }
      let sum = 0;
      for (const row of odemeler) {
        if (row.odeme_turu !== "NAKIT" && row.odeme_turu !== "KREDI_KARTI") {
          const err = new Error("KARISIK_TUR");
          err.code = "KARISIK_TUR";
          throw err;
        }
        sum += row.tutar;
      }
      if (sum !== tutarOdenecek) {
        const err = new Error("TUTAR_UYUSMUYOR");
        err.code = "TUTAR_UYUSMUYOR";
        throw err;
      }
      for (const row of odemeler) {
        const o = await tx.odeme.create({
          data: {
            adisyon_id: adisyonId,
            tutar: row.tutar,
            odeme_turu: row.odeme_turu,
            kullanici_id: kullaniciId,
          },
        });
        odemeKayitlari.push(o);
      }
    } else {
      const err = new Error("ODEME_TURU");
      err.code = "ODEME_TURU";
      throw err;
    }
  }

  const kalemler = await tx.adisyonKalem.findMany({
    where: { adisyon_id: adisyonId },
    include: {
      urun: { select: { stok_takibi: true } },
    },
  });

  // 1) Eğer satış kalemi için reçete varsa, stoktan düşüm reçete içeriğine göre yapılır.
  // 2) Reçete yoksa stok düşüm ürünün kendi adetine göre yapılır (eski davranış).
  const satisUrunIds = [...new Set(kalemler.map((k) => k.urun_id))];
  const receteler = await tx.recete.findMany({
    where: { urun_id: { in: satisUrunIds } },
  });

  const receteByUrunId = new Map();
  for (const r of receteler) {
    const arr = receteByUrunId.get(r.urun_id) ?? [];
    arr.push(r);
    receteByUrunId.set(r.urun_id, arr);
  }

  const hammaddeAdlar = [...new Set(receteler.map((r) => r.hammadde_ad).filter(Boolean))];
  let urunByAd = new Map();
  if (hammaddeAdlar.length > 0) {
    const hammaddeUrunler = await tx.urun.findMany({
      where: { ad: { in: hammaddeAdlar } },
      select: { id: true, ad: true, stok_takibi: true, stok_birim: true },
    });
    // Reçete hammadde_ad -> ürün ad eşleştirmesi yapar.
    // Aynı isimle birden fazla ürün varsa (örn. "Vodka" hem içecek hem hammadde olabilir),
    // stok takibi açık olan (stok_takibi=true) ürünü tercih eder.
    // Birden fazla stok_takibi=true ürün varsa hataya düşeriz.
    const groups = new Map();
    for (const u of hammaddeUrunler) {
      const arr = groups.get(u.ad) ?? [];
      arr.push(u);
      groups.set(u.ad, arr);
    }
    for (const ad of hammaddeAdlar) {
      const arr = groups.get(ad) ?? [];
      if (arr.length === 0) continue;

      const stoklu = arr.filter((x) => x.stok_takibi);
      if (stoklu.length === 1) {
        urunByAd.set(ad, stoklu[0]);
        continue;
      }

      if (stoklu.length > 1) {
        const err = new Error(
          `Reçete hammadde adı "${ad}" için birden fazla stok_takibi=true ürün bulundu. Aynı ad yerine farklı ad verin veya stok_takibi ayarını netleştirin.`,
        );
        err.code = "COKLU_HAMMADDE_AD";
        throw err;
      }

      // stoklu yoksa tek ürün varsa onu kullan; stok takibi kapalıysa daha sonra HAMMADDE_STOK_KAPALI ile zaten durur.
      if (arr.length === 1) {
        urunByAd.set(ad, arr[0]);
        continue;
      }

      const err = new Error(
        `Reçete hammadde adı "${ad}" için birden fazla ürün bulundu ve stok_takibi=true tek bir ürün olarak ayarlanmadı.`,
      );
      err.code = "COKLU_HAMMADDE_AD";
      throw err;
    }
  }

  function toIntOrThrow(val, errCode) {
    const rounded = Math.round(val);
    if (Math.abs(val - rounded) > 1e-6) {
      const err = new Error("Reçete/stock miktarları int olmalı (stok giriş/çıkış şu an integer).");
      err.code = errCode;
      throw err;
    }
    return rounded;
  }

  for (const k of kalemler) {
    if (k.ikram || k.iade) continue;

    const recs = receteByUrunId.get(k.urun_id) ?? [];
    if (recs.length > 0) {
      // Reçeteye göre içerik stok düş.
      for (const r of recs) {
        const hammaddeUrun = urunByAd.get(r.hammadde_ad);
        if (!hammaddeUrun) {
          const err = new Error(
            `Reçete hammadde ürünü bulunamadı: "${r.hammadde_ad}"`,
          );
          err.code = "HAMMADDE_BULUNAMADI";
          throw err;
        }
        if (!hammaddeUrun.stok_takibi) {
          const err = new Error(
            `Reçete hammadde ürünü stok takibi kapalı: "${r.hammadde_ad}"`,
          );
          err.code = "HAMMADDE_STOK_KAPALI";
          throw err;
        }
        if (String(r.birim || "").trim() !== String(hammaddeUrun.stok_birim || "").trim()) {
          const err = new Error(
            `Reçete birimi uyuşmuyor: "${r.hammadde_ad}" için reçete birimi "${r.birim}", stok birimi "${hammaddeUrun.stok_birim}"`,
          );
          err.code = "BIRIM_UYUSMUYOR";
          throw err;
        }

        const toplamMiktar = r.miktar * k.adet;
        const miktarInt = toIntOrThrow(toplamMiktar, "MIKTAR_INT_DEGIL");

        await tx.envanterCikis.create({
          data: {
            urun_id: hammaddeUrun.id,
            adisyon_kalem_id: k.id,
            miktar: miktarInt,
          },
        });
      }
      continue;
    }

    // Reçete yok: ürün stok düşümü (mevcut davranış).
    if (!k.urun?.stok_takibi) continue;
    await tx.envanterCikis.create({
      data: {
        urun_id: k.urun_id,
        adisyon_kalem_id: k.id,
        miktar: k.adet,
      },
    });
  }

  await tx.adisyon.update({
    where: { id: adisyonId },
    data: {
      durum: "KAPALI",
      kapanma_tarihi: new Date(),
      odeme_turu,
    },
  });

  return odemeKayitlari;
}
