import { useEffect, useState, useCallback } from "react";
import api from "../api/client.js";
import { formatTry } from "../lib/format.js";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

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

  const b = data?.bugun;
  const a = data?.anlik;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-100">Dashboard</h1>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Yenile
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Tarih: {data?.tarih ?? "—"} (yerel gün)
      </p>

      {err && <p className="mt-4 text-sm text-amber-500">{err}</p>}

      {loading ? (
        <p className="mt-8 text-slate-500">Yükleniyor…</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
            <p className="text-sm text-slate-500">Bugün ciro (kapanan)</p>
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
            <p className="text-sm text-slate-500">Bugün cari (ödeme kayıtları)</p>
            <p className="mt-2 font-mono text-xl text-amber-400/90">
              {formatTry(b?.cari_kurus ?? 0)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
