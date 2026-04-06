import { useEffect, useMemo, useState, useCallback } from "react";
import { io } from "socket.io-client";
import api, { apiBase } from "../api/client.js";
import { formatTry } from "../lib/format.js";

function ozetFromPayload(a) {
  if (!a) return null;
  const ks =
    a.kalem_sayisi ??
    (Array.isArray(a.kalemler) ? a.kalemler.length : 0);
  return {
    id: a.id,
    numara: a.numara,
    masa_no: a.masa_no,
    musteri_adi: a.musteri_adi,
    toplam_tutar: a.toplam_tutar ?? 0,
    acilis_tarihi: a.acilis_tarihi,
    kapanma_tarihi: a.kapanma_tarihi ?? null,
    durum: a.durum,
    odeme_turu: a.odeme_turu ?? null,
    kalem_sayisi: ks,
  };
}

function yyyyMmDdLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inRange(row, startYmd, endYmd) {
  if (!startYmd || !endYmd) return true;
  const start = new Date(`${startYmd}T00:00:00`);
  const end = new Date(`${endYmd}T23:59:59.999`);
  const t =
    row?.durum === "KAPALI"
      ? (row.kapanma_tarihi ? new Date(row.kapanma_tarihi).getTime() : 0)
      : (row.acilis_tarihi ? new Date(row.acilis_tarihi).getTime() : 0);
  return t >= start.getTime() && t <= end.getTime();
}

export default function CanliAdisyonlar() {
  const [rows, setRows] = useState([]);
  const [connected, setConnected] = useState(false);
  const [err, setErr] = useState("");
  const [baslangic, setBaslangic] = useState(() => yyyyMmDdLocal(new Date()));
  const [bitis, setBitis] = useState(() => yyyyMmDdLocal(new Date()));
  const [detayId, setDetayId] = useState(null);
  const [detay, setDetay] = useState(null);
  const [detayLoading, setDetayLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/api/adisyonlar", {
        params: { baslangic, bitis },
      });
      setRows((data.adisyonlar ?? []).map(ozetFromPayload).filter(Boolean));
      setErr("");
    } catch {
      setErr("Liste alınamadı (oturum / API)");
    }
  }, [baslangic, bitis]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => inRange(r, baslangic, bitis))
      .sort((a, b) => {
        const ta =
          a.durum === "KAPALI"
            ? new Date(a.kapanma_tarihi ?? 0).getTime()
            : new Date(a.acilis_tarihi ?? 0).getTime();
        const tb =
          b.durum === "KAPALI"
            ? new Date(b.kapanma_tarihi ?? 0).getTime()
            : new Date(b.acilis_tarihi ?? 0).getTime();
        return tb - ta;
      });
  }, [rows, baslangic, bitis]);

  useEffect(() => {
    const token = localStorage.getItem("turadisyon_token") || "";
    const socket = io(apiBase || undefined, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: { token },
    });

    socket.on("connect", () => {
      setConnected(true);
      setErr("");
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => {
      setConnected(false);
      setErr("Canlı bağlantı kurulamadı (oturum süresi veya token). Sayfayı yenileyin.");
    });

    function upsert(adisyon) {
      const o = ozetFromPayload(adisyon);
      if (!o) return;
      if (!inRange(o, baslangic, bitis)) return;
      setRows((prev) => {
        const i = prev.findIndex((x) => x.id === o.id);
        if (i < 0) return [o, ...prev];
        const next = [...prev];
        next[i] = { ...next[i], ...o };
        return next;
      });
    }

    socket.on("adisyon:acildi", ({ adisyon }) => upsert(adisyon));
    socket.on("adisyon:guncellendi", ({ adisyon }) => {
      if (!adisyon?.id) return;
      const o = ozetFromPayload(adisyon);
      if (!o) return;
      if (!inRange(o, baslangic, bitis)) {
        setRows((prev) => prev.filter((x) => x.id !== o.id));
        return;
      }
      upsert(adisyon);
    });
    socket.on("adisyon:kapandi", ({ adisyon }) => {
      if (adisyon) upsert(adisyon);
    });
    socket.on("adisyon:iptal", ({ adisyon_id }) => {
      setRows((prev) => prev.filter((x) => x.id !== adisyon_id));
    });

    return () => {
      socket.disconnect();
    };
  }, [baslangic, bitis]);

  useEffect(() => {
    if (!detayId) {
      setDetay(null);
      return;
    }
    let cancelled = false;
    setDetayLoading(true);
    (async () => {
      try {
        const { data } = await api.get(`/api/adisyonlar/${detayId}`);
        if (!cancelled) setDetay(data.adisyon);
      } catch {
        if (!cancelled) setDetay(null);
      } finally {
        if (!cancelled) setDetayLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detayId]);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Canlı adisyonlar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Bugün için açık ve kapalı adisyonlar canlı güncellenir. Satıra tıklayınca detay açılır.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
              connected ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {connected ? "Bağlı" : "Bağlantı yok"}
          </span>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-300 hover:bg-slate-800"
          >
            Yenile
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-slate-700 bg-slate-950/40 p-4">
        <div>
          <label className="block text-xs text-slate-500">Başlangıç</label>
          <input
            type="date"
            className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            value={baslangic}
            onChange={(e) => setBaslangic(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Bitiş</label>
          <input
            type="date"
            className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            value={bitis}
            onChange={(e) => setBitis(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={load}
          className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
        >
          Filtrele
        </button>
        <div className="text-xs text-slate-500 ml-auto">
          {filtered.length} kayıt
        </div>
      </div>

      {err && <p className="mt-4 text-sm text-amber-500">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-950 text-slate-500">
            <tr>
              <th className="px-4 py-3">Masa</th>
              <th className="px-4 py-3 text-xs font-normal text-slate-600">Kayıt</th>
              <th className="px-4 py-3">Müşteri</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">Tutar</th>
              <th className="px-4 py-3 text-right">Kalem</th>
              <th className="px-4 py-3">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  Kayıt yok
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-800 hover:bg-slate-900/50 cursor-pointer"
                  onClick={() => setDetayId(r.id)}
                >
                  <td className="px-4 py-3 font-mono text-xl text-blue-400">
                    {(r.masa_no ?? 0) > 0 ? r.masa_no : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 max-w-[140px] truncate">
                    {r.numara}
                  </td>
                  <td className="px-4 py-3 text-slate-200">{r.musteri_adi || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        r.durum === "ACIK"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : r.durum === "KAPALI"
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {r.durum}
                      {r.durum === "KAPALI" && r.odeme_turu ? ` · ${r.odeme_turu}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatTry(r.toplam_tutar)}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{r.kalem_sayisi ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {(r.durum === "KAPALI" ? r.kapanma_tarihi : r.acilis_tarihi)
                      ? new Date(
                          r.durum === "KAPALI" ? r.kapanma_tarihi : r.acilis_tarihi,
                        ).toLocaleString("tr-TR")
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detayId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetayId(null)}
        >
          <div
            className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Adisyon detayı</h2>
                <p className="text-xs font-mono text-slate-600 mt-1">
                  {detay?.numara || `#${detayId}`}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300"
                onClick={() => setDetayId(null)}
              >
                Kapat
              </button>
            </div>

            {detayLoading ? (
              <p className="mt-6 text-slate-500">Yükleniyor…</p>
            ) : !detay ? (
              <p className="mt-6 text-amber-500">Detay alınamadı</p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <p className="text-xs text-slate-500">Masa</p>
                    <p className="mt-1 font-mono text-2xl text-blue-300">
                      {(detay.masa_no ?? 0) > 0 ? detay.masa_no : "—"}
                    </p>
                    <p className="mt-1 text-sm text-slate-300 truncate">
                      {detay.musteri_adi || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <p className="text-xs text-slate-500">Durum</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {detay.durum}
                      {detay.durum === "KAPALI" && detay.odeme_turu ? ` · ${detay.odeme_turu}` : ""}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Açılış:{" "}
                      <span className="font-mono text-slate-300">
                        {detay.acilis_tarihi ? new Date(detay.acilis_tarihi).toLocaleString("tr-TR") : "—"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Kapanış:{" "}
                      <span className="font-mono text-slate-300">
                        {detay.kapanma_tarihi ? new Date(detay.kapanma_tarihi).toLocaleString("tr-TR") : "—"}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <p className="text-xs text-slate-500">Toplam</p>
                    <p className="mt-1 font-mono text-2xl text-slate-100">
                      {formatTry(detay.toplam_tutar)}
                    </p>
                    {detay.indirim_tutari > 0 && (
                      <p className="mt-1 text-xs text-amber-400">
                        İndirim: −{formatTry(detay.indirim_tutari)}
                      </p>
                    )}
                  </div>
                </div>

                <h3 className="mt-6 text-sm font-semibold text-slate-200">Ürünler</h3>
                <div className="mt-2 overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-800 bg-slate-950 text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Ürün</th>
                        <th className="px-3 py-2 text-right">Adet</th>
                        <th className="px-3 py-2 text-right">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detay.kalemler ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                            Satır yok
                          </td>
                        </tr>
                      ) : (
                        detay.kalemler.map((k) => (
                          <tr key={k.id} className="border-b border-slate-900/60">
                            <td className="px-3 py-2 text-slate-200">
                              {k.urun_adi}
                              {k.ikram && <span className="ml-2 text-[10px] text-amber-400">ikram</span>}
                              {k.fiyat_degistirildi && !k.ikram && <span className="ml-2 text-[10px] text-violet-300">özel fiyat</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-300">{k.adet}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-300">{formatTry(k.toplam_fiyat)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <h3 className="mt-6 text-sm font-semibold text-slate-200">Ödemeler</h3>
                <div className="mt-2 overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-800 bg-slate-950 text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Tür</th>
                        <th className="px-3 py-2 text-right">Tutar</th>
                        <th className="px-3 py-2">Tarih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detay.odemeler ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                            Ödeme kaydı yok
                          </td>
                        </tr>
                      ) : (
                        detay.odemeler.map((o) => (
                          <tr key={o.id} className="border-b border-slate-900/60">
                            <td className="px-3 py-2 text-slate-200">{o.odeme_turu}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-300">
                              {formatTry(o.tutar)}
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {o.tarih ? new Date(o.tarih).toLocaleString("tr-TR") : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
