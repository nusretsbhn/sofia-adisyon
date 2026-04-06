import { useEffect, useState } from "react";
import api from "../api/client.js";

export default function Kategoriler() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ad, setAd] = useState("");
  const [renk, setRenk] = useState("#3B82F6");
  const [editing, setEditing] = useState(null);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const { data } = await api.get("/api/kategoriler", { params: { aktif: "false" } });
      setList(data.kategoriler ?? []);
    } catch {
      setErr("Liste yüklenemedi");
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
      await api.post("/api/kategoriler", { ad, renk });
      setAd("");
      setRenk("#3B82F6");
      load();
    } catch {
      setErr("Kayıt oluşturulamadı");
    }
  }

  async function handleSave(k) {
    try {
      await api.put(`/api/kategoriler/${k.id}`, {
        ad: editing.ad,
        renk: editing.renk,
        aktif: editing.aktif,
      });
      setEditing(null);
      load();
    } catch {
      setErr("Güncellenemedi");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Kategoriyi silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/api/kategoriler/${id}`);
      load();
    } catch {
      setErr("Silinemedi (içinde ürün olabilir)");
    }
  }

  async function move(index, dir) {
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[index], next[j]] = [next[j], next[index]];
    const ids = next.map((k) => k.id);
    try {
      await api.patch("/api/kategoriler/sirala", { ids });
      setList(next);
    } catch {
      setErr("Sıra güncellenemedi");
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Kategoriler</h1>
      <p className="mt-1 text-sm text-slate-500">
        Sırayı yukarı / aşağı ile değiştirin. POS menüsünde aynı sıra kullanılır.
      </p>

      <form
        onSubmit={handleCreate}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-700 bg-slate-950 p-4"
      >
        <div>
          <label className="text-xs text-slate-500">Yeni kategori adı</label>
          <input
            className="mt-1 block rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            value={ad}
            onChange={(e) => setAd(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Renk</label>
          <input
            type="color"
            className="mt-1 block h-10 w-20 cursor-pointer rounded border border-slate-600 bg-slate-900"
            value={renk}
            onChange={(e) => setRenk(e.target.value)}
          />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">
          Ekle
        </button>
      </form>

      {err && <p className="mt-4 text-sm text-amber-500">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-950 text-slate-500">
            <tr>
              <th className="px-3 py-2">Sıra</th>
              <th className="px-3 py-2">Ad</th>
              <th className="px-3 py-2">Renk</th>
              <th className="px-3 py-2">Ürün</th>
              <th className="px-3 py-2">Durum</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  Yükleniyor…
                </td>
              </tr>
            ) : (
              list.map((k, index) => (
                <tr key={k.id} className="border-b border-slate-800">
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-800"
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-800"
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-100">
                    {editing?.id === k.id ? (
                      <input
                        className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1"
                        value={editing.ad}
                        onChange={(e) => setEditing({ ...editing, ad: e.target.value })}
                      />
                    ) : (
                      k.ad
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing?.id === k.id ? (
                      <input
                        type="color"
                        className="h-8 w-16 cursor-pointer rounded border-0"
                        value={editing.renk || "#334155"}
                        onChange={(e) => setEditing({ ...editing, renk: e.target.value })}
                      />
                    ) : (
                      <span
                        className="inline-block h-6 w-12 rounded border border-slate-600"
                        style={{ background: k.renk || "#334155" }}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{k.urun_sayisi ?? 0}</td>
                  <td className="px-3 py-2">
                    {editing?.id === k.id ? (
                      <label className="flex items-center gap-2 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={editing.aktif}
                          onChange={(e) => setEditing({ ...editing, aktif: e.target.checked })}
                        />
                        Aktif
                      </label>
                    ) : (
                      <span className={k.aktif ? "text-emerald-400" : "text-slate-500"}>
                        {k.aktif ? "Aktif" : "Pasif"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {editing?.id === k.id ? (
                      <>
                        <button
                          type="button"
                          className="text-sm text-emerald-400 hover:underline"
                          onClick={() => handleSave(k)}
                        >
                          Kaydet
                        </button>
                        <button
                          type="button"
                          className="ml-3 text-sm text-slate-500 hover:underline"
                          onClick={() => setEditing(null)}
                        >
                          İptal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="text-sm text-blue-400 hover:underline"
                          onClick={() =>
                            setEditing({
                              id: k.id,
                              ad: k.ad,
                              renk: k.renk || "#334155",
                              aktif: k.aktif,
                            })
                          }
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="ml-3 text-sm text-red-400/90 hover:underline"
                          onClick={() => handleDelete(k.id)}
                        >
                          Sil
                        </button>
                      </>
                    )}
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
