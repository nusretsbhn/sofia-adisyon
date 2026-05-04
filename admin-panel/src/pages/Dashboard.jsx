import { useEffect, useState, useCallback } from "react";
import api from "../api/client.js";
import { formatTry } from "../lib/format.js";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [pubMsg, setPubMsg] = useState("");
  const [pubBusy, setPubBusy] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const { data: d } = await api.get("/api/raporlar/dashboard");
      setData(d);
    } catch {
      setErr("Özet yüklenemedi.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function posKatalogGonder() {
    setPubMsg("");
    setPubBusy(true);
    try {
      const { data: d } = await api.post("/api/sync/admin/publish-catalog");
      setPubMsg(d.message || "Bağlı POS oturumlarına bildirildi.");
    } catch (e) {
      setPubMsg(
        e?.response?.data?.error || e?.message || "Gönderilemedi.",
      );
    } finally {
      setPubBusy(false);
    }
  }

  const b = data?.bugun;
  const a = data?.anlik;
  const tumCiro = data?.tum_zamanlar_ciro_kurus;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-100">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={posKatalogGonder}
            disabled={pubBusy}
            className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-950/70 disabled:opacity-50"
          >
            {pubBusy ? "Gönderiliyor…" : "POS katalog güncelle"}
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Yenile
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Tarih: {data?.tarih ?? "—"} (yerel gün)
      </p>
      {pubMsg && (
        <p className="mt-2 text-sm text-slate-400">{pubMsg}</p>
      )}

      {err && <p className="mt-4 text-sm text-amber-500">{err}</p>}

      {loading ? (
        <p className="mt-8 text-slate-500">Yükleniyor…</p>
      ) : (
        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-emerald-900/50 bg-slate-950 p-6 shadow-lg shadow-emerald-950/20">
            <p className="text-sm text-slate-500">Tüm zamanlar toplam ciro</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-emerald-400">
              {formatTry(tumCiro ?? 0)}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Kapalı (cari hariç) + şu an açık adisyon tutarları
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
            <p className="text-sm text-slate-500">Bugün ciro (açık + kapalı)</p>
            <p className="mt-2 font-mono text-2xl text-emerald-400">
              {formatTry(b?.ciro_kurus ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
            <p className="text-sm text-slate-500">Açık adisyon</p>
            <p className="mt-2 font-mono text-2xl text-blue-400">
              {a?.acik_adisyon_sayisi ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
            <p className="text-sm text-slate-500">Bugün kapanan adisyon</p>
            <p className="mt-2 font-mono text-2xl text-slate-200">
              {b?.kapali_adisyon_sayisi ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
            <p className="text-sm text-slate-500">Açık adisyon toplam tutar</p>
            <p className="mt-2 font-mono text-xl text-blue-300">
              {formatTry(b?.acik_toplam_kurus ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
            <p className="text-sm text-slate-500">Kapalı adisyon toplam tutar</p>
            <p className="mt-2 font-mono text-xl text-slate-200">
              {formatTry(b?.kapali_toplam_kurus ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
            <p className="text-sm text-slate-500">Bugün nakit tahsilat</p>
            <p className="mt-2 font-mono text-xl text-slate-200">
              {formatTry(b?.nakit_kurus ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
            <p className="text-sm text-slate-500">Bugün kredi kartı</p>
            <p className="mt-2 font-mono text-xl text-slate-200">
              {formatTry(b?.kredi_karti_kurus ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
            <p className="text-sm text-slate-500">Bugün havale</p>
            <p className="mt-2 font-mono text-xl text-slate-200">
              {formatTry(b?.havale_kurus ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
            <p className="text-sm text-slate-500">Bugün cari (ödeme kayıtları)</p>
            <p className="mt-2 font-mono text-xl text-amber-400/90">
              {formatTry(b?.cari_kurus ?? 0)}
            </p>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
