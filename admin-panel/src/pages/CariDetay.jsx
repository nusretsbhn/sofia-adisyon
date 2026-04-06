import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client.js";
import { formatTry } from "../lib/format.js";

function EyeIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

export default function CariDetay() {
  const { id } = useParams();
  const [cari, setCari] = useState(null);
  const [err, setErr] = useState("");
  const [tahsil, setTahsil] = useState("");
  const [loading, setLoading] = useState(true);
  const [adisyonDetayId, setAdisyonDetayId] = useState(null);
  const [adisyonDetay, setAdisyonDetay] = useState(null);
  const [adisyonDetayLoading, setAdisyonDetayLoading] = useState(false);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const { data } = await api.get(`/api/cariler/${id}`);
      setCari(data.cari);
    } catch {
      setErr("Yüklenemedi");
      setCari(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

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

  async function handleTahsilat(e) {
    e.preventDefault();
    const kurus = Math.round(parseFloat(tahsil.replace(",", ".")) * 100);
    if (!Number.isFinite(kurus) || kurus <= 0) return;
    try {
      await api.post(`/api/cariler/${id}/odeme`, { tutar: kurus });
      setTahsil("");
      load();
    } catch {
      setErr("Tahsilat kaydedilemedi");
    }
  }

  if (loading && !cari) {
    return (
      <div className="p-6 text-slate-500">
        <Link to="/cariler" className="text-blue-400">
          ← Cariler
        </Link>
        <p className="mt-4">Yükleniyor…</p>
      </div>
    );
  }

  if (!cari) {
    return (
      <div className="p-6">
        <Link to="/cariler" className="text-blue-400">
          ← Cariler
        </Link>
        <p className="mt-4 text-red-400">{err || "Bulunamadı"}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link to="/cariler" className="text-sm text-blue-400 hover:text-blue-300">
        ← Cariler
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-100">{cari.ad}</h1>
      <p className="mt-1 text-slate-400">
        {cari.telefon || "—"} · {cari.email || "—"}
      </p>
      <p className="mt-4 text-lg">
        Bakiye: <span className="font-mono text-amber-400">{formatTry(cari.toplam_borc)}</span>
      </p>

      {cari.toplam_borc > 0 && (
        <form onSubmit={handleTahsilat} className="mt-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-slate-500">Tahsilat (₺)</label>
            <input
              className="mt-1 block w-40 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={tahsil}
              onChange={(e) => setTahsil(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            Tahsilat kaydet
          </button>
        </form>
      )}

      {err && <p className="mt-4 text-sm text-amber-500">{err}</p>}

      <h2 className="mt-8 text-lg font-medium text-slate-200">Son hareketler</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-950 text-slate-500">
            <tr>
              <th className="px-3 py-2">Tarih</th>
              <th className="px-3 py-2">Tutar</th>
              <th className="px-3 py-2">Açıklama</th>
              <th className="px-3 py-2 w-14 text-center"> </th>
            </tr>
          </thead>
          <tbody>
            {(cari.hareketler ?? []).map((h) => (
              <tr key={h.id} className="border-b border-slate-800">
                <td className="px-3 py-2 text-slate-400">
                  {new Date(h.tarih).toLocaleString("tr-TR")}
                </td>
                <td
                  className={`px-3 py-2 font-mono ${h.tutar < 0 ? "text-emerald-400" : "text-slate-200"}`}
                >
                  {h.tutar < 0 ? "" : "+"}
                  {formatTry(Math.abs(h.tutar))}
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {h.aciklama}
                  {h.adisyon ? ` · Adisyon ${h.adisyon.numara}` : ""}
                </td>
                <td className="px-3 py-2 text-center">
                  {h.adisyon?.id ? (
                    <button
                      type="button"
                      className="inline-flex rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-sky-400"
                      title="Adisyon detayı"
                      aria-label="Adisyon detayı"
                      onClick={() => setAdisyonDetayId(h.adisyon.id)}
                    >
                      <EyeIcon />
                    </button>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
