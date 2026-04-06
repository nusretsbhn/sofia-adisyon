import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client.js";
import { formatTry } from "../lib/format.js";

export default function Cariler() {
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [ad, setAd] = useState("");
  const [telefon, setTelefon] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const { data } = await api.get("/api/cariler", { params: q ? { q } : {} });
      setList(data.cariler ?? []);
    } catch {
      setErr("Liste yüklenemedi. Oturum açtınız mı?");
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post("/api/cariler", { ad, telefon: telefon || null });
      setAd("");
      setTelefon("");
      setShowForm(false);
      load();
    } catch {
      setErr("Kayıt oluşturulamadı (yetki veya doğrulama).");
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-100">Cariler</h1>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Yeni cari
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-6 flex max-w-xl flex-wrap items-end gap-3 rounded-lg border border-slate-700 bg-slate-950 p-4"
        >
          <div>
            <label className="text-xs text-slate-500">Ad *</label>
            <input
              className="mt-1 block rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Telefon</label>
            <input
              className="mt-1 block rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
            />
          </div>
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white">
            Kaydet
          </button>
        </form>
      )}

      <div className="mt-6 flex gap-2">
        <input
          placeholder="Ara (ad, telefon)…"
          className="max-w-xs flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Ara
        </button>
      </div>

      {err && <p className="mt-4 text-sm text-amber-500">{err}</p>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-slate-700 bg-slate-950 text-slate-400">
            <tr>
              <th className="px-4 py-3">Ad</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3 text-right">Bakiye</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Yükleniyor…
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Kayıt yok
                </td>
              </tr>
            ) : (
              list.map((c) => (
                <tr key={c.id} className="border-b border-slate-800 hover:bg-slate-900/80">
                  <td className="px-4 py-3 text-slate-100">{c.ad}</td>
                  <td className="px-4 py-3">{c.telefon ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatTry(c.toplam_borc)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/cariler/${c.id}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Detay
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
