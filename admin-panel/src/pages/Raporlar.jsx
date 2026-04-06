import { useEffect, useState, useCallback } from "react";
import api from "../api/client.js";
import { formatTry } from "../lib/format.js";

function yerelGun(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Raporlar() {
  const [baslangic, setBaslangic] = useState(yerelGun());
  const [bitis, setBitis] = useState(yerelGun());
  const [ciro, setCiro] = useState(null);
  const [urunler, setUrunler] = useState(null);
  const [kategoriler, setKategoriler] = useState(null);
  const [adisyonlar, setAdisyonlar] = useState(null);
  const [ikramlar, setIkramlar] = useState(null);
  const [iptaller, setIptaller] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [adisyonDetayId, setAdisyonDetayId] = useState(null);
  const [adisyonDetay, setAdisyonDetay] = useState(null);
  const [adisyonDetayLoading, setAdisyonDetayLoading] = useState(false);

  const params = { baslangic, bitis };

  const yukle = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const [c, u, k, a, i, ip] = await Promise.all([
        api.get("/api/raporlar/ciro", { params }),
        api.get("/api/raporlar/urunler", { params }),
        api.get("/api/raporlar/kategoriler", { params }),
        api.get("/api/raporlar/adisyonlar", { params }),
        api.get("/api/raporlar/ikramlar", { params }),
        api.get("/api/raporlar/iptaller", { params }),
      ]);
      setCiro(c.data);
      setUrunler(u.data);
      setKategoriler(k.data);
      setAdisyonlar(a.data);
      setIkramlar(i.data);
      setIptaller(ip.data);
    } catch {
      setErr("Raporlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [baslangic, bitis]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  useEffect(() => {
    if (!adisyonDetayId) {
      setAdisyonDetay(null);
      return;
    }
    let cancelled = false;
    setAdisyonDetayLoading(true);
    (async () => {
      try {
        const { data } = await api.get(`/api/adisyonlar/${adisyonDetayId}`);
        if (!cancelled) setAdisyonDetay(data.adisyon);
      } catch {
        if (!cancelled) setAdisyonDetay(null);
      } finally {
        if (!cancelled) setAdisyonDetayLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adisyonDetayId]);

  function preset(tip) {
    const b = new Date();
    if (tip === "bugun") {
      const s = yerelGun();
      setBaslangic(s);
      setBitis(s);
    } else if (tip === "dun") {
      b.setDate(b.getDate() - 1);
      const s = yerelGun(b);
      setBaslangic(s);
      setBitis(s);
    } else if (tip === "hafta") {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      setBaslangic(yerelGun(start));
      setBitis(yerelGun(end));
    } else if (tip === "ay") {
      const start = new Date(b.getFullYear(), b.getMonth(), 1);
      const end = new Date(b.getFullYear(), b.getMonth() + 1, 0);
      setBaslangic(yerelGun(start));
      setBitis(yerelGun(end));
    }
  }

  async function csvIndir(yol, dosyaAdi) {
    try {
      const res = await api.get(yol, {
        params: { ...params, format: "csv" },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = dosyaAdi;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErr("CSV indirilemedi.");
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Raporlar</h1>
      <p className="mt-1 text-sm text-slate-500">
        Kapalı adisyonlar (kapanış tarihi) ve ödeme kayıtları seçilen aralıkta filtrelenir.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-slate-500">Başlangıç</label>
          <input
            type="date"
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            value={baslangic}
            onChange={(e) => setBaslangic(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Bitiş</label>
          <input
            type="date"
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            value={bitis}
            onChange={(e) => setBitis(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={yukle}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "…" : "Uygula"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {["bugun", "dun", "hafta", "ay"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => preset(t)}
            className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800"
          >
            {t === "bugun"
              ? "Bugün"
              : t === "dun"
                ? "Dün"
                : t === "hafta"
                  ? "Son 7 gün"
                  : "Bu ay"}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 text-sm text-amber-500">{err}</p>}

      {ciro && (
        <section className="mt-10">
          <p className="text-xs text-slate-500 mb-2">
            Ciro tutarı, cari hesaba kapatılan adisyonları içermez. Cari tahsilat ayrı satırda
            gösterilir.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-slate-200">Ciro özeti</h2>
            <button
              type="button"
              onClick={() => csvIndir("/api/raporlar/ciro", `ciro-${baslangic}_${bitis}.csv`)}
              className="text-sm text-blue-400 hover:underline"
            >
              CSV indir
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
              <p className="text-xs text-slate-500">Ciro</p>
              <p className="font-mono text-xl text-emerald-400">
                {formatTry(ciro.ciro_kurus)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
              <p className="text-xs text-slate-500">Kapalı adisyon</p>
              <p className="font-mono text-xl text-slate-200">
                {ciro.kapali_adisyon_sayisi}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
              <p className="text-xs text-slate-500">Nakit (kayıtlar)</p>
              <p className="font-mono text-lg">{formatTry(ciro.odeme_kurus?.nakit)}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
              <p className="text-xs text-slate-500">Kart / Cari</p>
              <p className="font-mono text-sm text-slate-300">
                K: {formatTry(ciro.odeme_kurus?.kredi_karti)} · C:{" "}
                {formatTry(ciro.odeme_kurus?.cari)}
              </p>
            </div>
          </div>
        </section>
      )}

      {urunler?.satislar && (
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-slate-200">Ürün satışları</h2>
            <button
              type="button"
              onClick={() =>
                csvIndir("/api/raporlar/urunler", `urun-${baslangic}_${bitis}.csv`)
              }
              className="text-sm text-blue-400 hover:underline"
            >
              CSV indir
            </button>
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-950 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Ürün</th>
                  <th className="px-3 py-2 text-right">Adet</th>
                  <th className="px-3 py-2 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {urunler.satislar.map((s) => (
                  <tr key={s.urun_id} className="border-b border-slate-800">
                    <td className="px-3 py-2 text-slate-200">{s.urun_adi}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.adet}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatTry(s.tutar_kurus)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {kategoriler?.satislar && (
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-slate-200">Kategori bazlı</h2>
            <button
              type="button"
              onClick={() =>
                csvIndir(
                  "/api/raporlar/kategoriler",
                  `kategori-${baslangic}_${bitis}.csv`,
                )
              }
              className="text-sm text-blue-400 hover:underline"
            >
              CSV indir
            </button>
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-950 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Kategori</th>
                  <th className="px-3 py-2 text-right">Adet</th>
                  <th className="px-3 py-2 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {kategoriler.satislar.map((s) => (
                  <tr key={s.kategori_id} className="border-b border-slate-800">
                    <td className="px-3 py-2 text-slate-200">{s.kategori_adi}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.adet}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatTry(s.tutar_kurus)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {ikramlar?.satirlar && (
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-slate-200">
              İkram satırları (kapalı adisyon, kapanış tarihi)
            </h2>
            <button
              type="button"
              onClick={() =>
                csvIndir("/api/raporlar/ikramlar", `ikramlar-${baslangic}_${bitis}.csv`)
              }
              className="text-sm text-blue-400 hover:underline"
            >
              CSV indir
            </button>
          </div>
          {ikramlar.ozet && (
            <p className="mt-2 text-sm text-slate-500">
              Satır: {ikramlar.ozet.satir_sayisi} · Toplam ikram adedi:{" "}
              {ikramlar.ozet.toplam_adet}
            </p>
          )}
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-slate-700 bg-slate-950 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Adisyon</th>
                  <th className="px-3 py-2">Ürün</th>
                  <th className="px-3 py-2 text-right">Adet</th>
                  <th className="px-3 py-2 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {ikramlar.satirlar.map((s) => (
                  <tr key={s.id} className="border-b border-slate-800">
                    <td className="px-3 py-2 font-mono text-blue-400">
                      #{s.adisyon_numara}
                    </td>
                    <td className="px-3 py-2 text-slate-200">{s.urun_adi}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.adet}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatTry(s.tutar_kurus)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {iptaller?.iptaller && (
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-slate-200">
              İptal edilen adisyonlar
            </h2>
            <button
              type="button"
              onClick={() =>
                csvIndir("/api/raporlar/iptaller", `iptaller-${baslangic}_${bitis}.csv`)
              }
              className="text-sm text-blue-400 hover:underline"
            >
              CSV indir
            </button>
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-slate-700 bg-slate-950 text-slate-500">
                <tr>
                  <th className="px-3 py-2">No</th>
                  <th className="px-3 py-2">Müşteri</th>
                  <th className="px-3 py-2 text-right">Tutar</th>
                  <th className="px-3 py-2">Kapanış</th>
                </tr>
              </thead>
              <tbody>
                {iptaller.iptaller.map((a) => (
                  <tr key={a.id} className="border-b border-slate-800">
                    <td className="px-3 py-2 font-mono text-amber-400/90">#{a.numara}</td>
                    <td className="px-3 py-2 text-slate-300">{a.musteri_adi || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatTry(a.toplam_tutar)}
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-xs">
                      {a.kapanma_tarihi
                        ? new Date(a.kapanma_tarihi).toLocaleString("tr-TR")
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adisyonlar?.adisyonlar && (
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-slate-200">
              Kapalı adisyonlar (en fazla 2000)
            </h2>
            <button
              type="button"
              onClick={() =>
                csvIndir(
                  "/api/raporlar/adisyonlar",
                  `adisyonlar-${baslangic}_${bitis}.csv`,
                )
              }
              className="text-sm text-blue-400 hover:underline"
            >
              CSV indir
            </button>
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700 max-h-[400px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-slate-700 bg-slate-950 text-slate-500">
                <tr>
                  <th className="px-3 py-2">No</th>
                  <th className="px-3 py-2">Müşteri</th>
                  <th className="px-3 py-2 text-right">Tutar</th>
                  <th className="px-3 py-2">Kapanış</th>
                  <th className="px-3 py-2">Ödeme</th>
                  <th className="px-3 py-2 w-28"> </th>
                </tr>
              </thead>
              <tbody>
                {adisyonlar.adisyonlar.map((a) => (
                  <tr key={a.id} className="border-b border-slate-800">
                    <td className="px-3 py-2 font-mono text-blue-400">#{a.numara}</td>
                    <td className="px-3 py-2 text-slate-300">{a.musteri_adi || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatTry(a.toplam_tutar)}
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-xs">
                      {a.kapanma_tarihi
                        ? new Date(a.kapanma_tarihi).toLocaleString("tr-TR")
                        : ""}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{a.odeme_turu ?? "—"}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-xs text-blue-400 hover:underline"
                        onClick={() => setAdisyonDetayId(a.id)}
                      >
                        Detay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adisyonDetayId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setAdisyonDetayId(null)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-100">Adisyon detayı</h2>
              <button
                type="button"
                className="text-sm text-slate-400 hover:text-slate-200"
                onClick={() => setAdisyonDetayId(null)}
              >
                Kapat
              </button>
            </div>
            {adisyonDetayLoading ? (
              <p className="mt-4 text-slate-500">Yükleniyor…</p>
            ) : !adisyonDetay ? (
              <p className="mt-4 text-amber-500">Detay alınamadı</p>
            ) : (
              <>
                <p className="mt-2 font-mono text-xs text-slate-500">{adisyonDetay.numara}</p>
                <p className="mt-2 text-sm text-slate-300">
                  Masa {(adisyonDetay.masa_no ?? 0) > 0 ? adisyonDetay.masa_no : "—"} ·{" "}
                  {adisyonDetay.musteri_adi || "—"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Durum: {adisyonDetay.durum}
                  {adisyonDetay.odeme_turu ? ` · ${adisyonDetay.odeme_turu}` : ""}
                </p>
                <p className="mt-3 font-mono text-lg text-emerald-400">
                  Toplam {formatTry(adisyonDetay.toplam_tutar)}
                </p>
                <h3 className="mt-4 text-sm font-medium text-slate-300">Satırlar</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {(adisyonDetay.kalemler ?? []).map((k) => (
                    <li
                      key={k.id}
                      className="flex justify-between gap-2 border-b border-slate-800/80 py-1.5 text-slate-200"
                    >
                      <span>
                        <span className="font-mono text-slate-500">{k.adet}×</span> {k.urun_adi}
                        {k.ikram && (
                          <span className="ml-1 text-[10px] text-amber-400">ikram</span>
                        )}
                        {k.iade && (
                          <span className="ml-1 text-[10px] text-rose-400">iade</span>
                        )}
                      </span>
                      <span className="font-mono shrink-0">{formatTry(k.toplam_fiyat)}</span>
                    </li>
                  ))}
                </ul>
                <h3 className="mt-4 text-sm font-medium text-slate-300">Ödemeler</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-400">
                  {(adisyonDetay.odemeler ?? []).length === 0 ? (
                    <li>—</li>
                  ) : (
                    adisyonDetay.odemeler.map((o) => (
                      <li key={o.id} className="flex justify-between gap-2">
                        <span>{o.odeme_turu}</span>
                        <span className="font-mono text-slate-300">{formatTry(o.tutar)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
