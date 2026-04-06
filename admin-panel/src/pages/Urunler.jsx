import { useEffect, useState } from "react";
import api from "../api/client.js";
import { formatTry } from "../lib/format.js";

export default function Urunler() {
  const [katList, setKatList] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    kategori_id: "",
    ad: "",
    fiyatTry: "",
    stok_takibi: false,
    stok_birim: "adet",
    aciklama: "",
    min_stok: "0",
    aktif: true,
  });
  const [editing, setEditing] = useState(null);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const [kRes, uRes] = await Promise.all([
        api.get("/api/kategoriler", { params: { aktif: "false" } }),
        api.get("/api/urunler", { params: { aktif: "false" } }),
      ]);
      setKatList(kRes.data.kategoriler ?? []);
      setUrunler((uRes.data.urunler ?? []).filter((u) => u.tur !== "HAMMADDE"));
      if (!form.kategori_id && kRes.data.kategoriler?.[0]) {
        setForm((f) => ({ ...f, kategori_id: String(kRes.data.kategoriler[0].id) }));
      }
    } catch {
      setErr("Veri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function tryToKurus(s) {
    const n = parseFloat(String(s).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const kurus = tryToKurus(form.fiyatTry);
    if (kurus == null) {
      setErr("Geçerli fiyat girin");
      return;
    }
    try {
      await api.post("/api/urunler", {
        kategori_id: Number(form.kategori_id),
        ad: form.ad.trim(),
        fiyat: kurus,
        tur: "URUN",
        stok_takibi: form.stok_takibi,
        stok_birim: form.stok_takibi ? form.stok_birim : "adet",
        aciklama: form.aciklama.trim() || null,
        min_stok: Number(form.min_stok) || 0,
        aktif: form.aktif,
      });
      setForm((f) => ({
        ...f,
        ad: "",
        fiyatTry: "",
        aciklama: "",
      }));
      load();
    } catch {
      setErr("Ürün eklenemedi");
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const kurus = tryToKurus(editing.fiyatTry);
    if (kurus == null) {
      setErr("Geçerli fiyat girin");
      return;
    }
    try {
      await api.put(`/api/urunler/${editing.id}`, {
        kategori_id: Number(editing.kategori_id),
        ad: editing.ad.trim(),
        fiyat: kurus,
        tur: "URUN",
        stok_takibi: editing.stok_takibi,
        stok_birim: editing.stok_takibi ? editing.stok_birim : "adet",
        aciklama: editing.aciklama?.trim() || null,
        min_stok: Number(editing.min_stok) || 0,
        aktif: editing.aktif,
      });
      setEditing(null);
      load();
    } catch {
      setErr("Güncellenemedi");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Ürünü silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/api/urunler/${id}`);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || "Silinemedi");
    }
  }

  function startEdit(u) {
    setEditing({
      id: u.id,
      kategori_id: String(u.kategori_id),
      ad: u.ad,
      fiyatTry: (u.fiyat / 100).toFixed(2),
      stok_takibi: u.stok_takibi,
      stok_birim: u.stok_birim || "adet",
      aciklama: u.aciklama || "",
      min_stok: String(u.min_stok ?? 0),
      aktif: u.aktif,
    });
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Ürünler</h1>

      <form
        onSubmit={handleCreate}
        className="mt-6 grid max-w-4xl grid-cols-1 gap-3 rounded-lg border border-slate-700 bg-slate-950 p-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <label className="text-xs text-slate-500">Kategori</label>
          <select
            className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            value={form.kategori_id}
            onChange={(e) => setForm({ ...form, kategori_id: e.target.value })}
            required
          >
            {katList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Ürün adı</label>
          <input
            className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            value={form.ad}
            onChange={(e) => setForm({ ...form, ad: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Fiyat (₺)</label>
          <input
            className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            value={form.fiyatTry}
            onChange={(e) => setForm({ ...form, fiyatTry: e.target.value })}
            placeholder="0,00"
            required
          />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={form.stok_takibi}
              onChange={(e) => setForm({ ...form, stok_takibi: e.target.checked })}
            />
            Stok takibi
          </label>
          {form.stok_takibi && (
            <label className="text-xs text-slate-500">
              Stok birimi
              <select
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                value={form.stok_birim}
                onChange={(e) => setForm({ ...form, stok_birim: e.target.value })}
              >
                <option value="adet">adet</option>
                <option value="cl">cl</option>
              </select>
            </label>
          )}
          <button type="submit" className="rounded-lg bg-blue-600 py-2 text-sm text-white">
            Ürün ekle
          </button>
        </div>
      </form>

      {err && <p className="mt-4 text-sm text-amber-500">{err}</p>}

      <div className="mt-8 overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-950 text-slate-500">
            <tr>
              <th className="px-3 py-2">Ürün</th>
              <th className="px-3 py-2">Kategori</th>
              <th className="px-3 py-2 text-right">Fiyat</th>
              <th className="px-3 py-2">Stok</th>
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
              urunler.map((u) => (
                <tr key={u.id} className="border-b border-slate-800">
                  {editing?.id === u.id ? (
                    <>
                      <td className="px-3 py-2" colSpan={6}>
                        <div className="flex flex-wrap items-end gap-2">
                          <select
                            className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                            value={editing.kategori_id}
                            onChange={(e) =>
                              setEditing({ ...editing, kategori_id: e.target.value })
                            }
                          >
                            {katList.map((k) => (
                              <option key={k.id} value={k.id}>
                                {k.ad}
                              </option>
                            ))}
                          </select>
                          <input
                            className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                            value={editing.ad}
                            onChange={(e) => setEditing({ ...editing, ad: e.target.value })}
                          />
                          <input
                            className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                            value={editing.fiyatTry}
                            onChange={(e) =>
                              setEditing({ ...editing, fiyatTry: e.target.value })
                            }
                          />
                          <label className="flex items-center gap-1 text-xs text-slate-500">
                            <input
                              type="checkbox"
                              checked={editing.stok_takibi}
                              onChange={(e) =>
                                setEditing({ ...editing, stok_takibi: e.target.checked })
                              }
                            />
                            Stok
                          </label>
                          {editing.stok_takibi && (
                            <label className="text-xs text-slate-500">
                              Birim
                              <select
                                className="ml-2 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                value={editing.stok_birim || "adet"}
                                onChange={(e) =>
                                  setEditing({ ...editing, stok_birim: e.target.value })
                                }
                              >
                                <option value="adet">adet</option>
                                <option value="cl">cl</option>
                              </select>
                            </label>
                          )}
                          <label className="flex items-center gap-1 text-xs text-slate-500">
                            <input
                              type="checkbox"
                              checked={editing.aktif}
                              onChange={(e) =>
                                setEditing({ ...editing, aktif: e.target.checked })
                              }
                            />
                            Aktif
                          </label>
                          <button
                            type="button"
                            className="text-emerald-400 text-sm"
                            onClick={saveEdit}
                          >
                            Kaydet
                          </button>
                          <button
                            type="button"
                            className="text-slate-500 text-sm"
                            onClick={() => setEditing(null)}
                          >
                            İptal
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-slate-100">{u.ad}</td>
                      <td className="px-3 py-2 text-slate-400">{u.kategori?.ad ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatTry(u.fiyat)}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {u.stok_takibi ? `min ${u.min_stok}` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={u.aktif ? "text-emerald-400" : "text-slate-600"}>
                          {u.aktif ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-blue-400 text-sm"
                          onClick={() => startEdit(u)}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="ml-3 text-red-400/90 text-sm"
                          onClick={() => handleDelete(u.id)}
                        >
                          Sil
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
