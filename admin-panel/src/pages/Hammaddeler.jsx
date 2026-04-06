import { useEffect, useState } from "react";
import api from "../api/client.js";

export default function Hammaddeler() {
  const [urunler, setUrunler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    ad: "",
    stok_birim: "cl",
    stok_takibi: true,
    aciklama: "",
    aktif: true,
  });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const uRes = await api.get("/api/urunler", { params: { aktif: "false" } });
      const all = uRes.data.urunler ?? [];
      setUrunler(all.filter((u) => u.tur === "HAMMADDE"));
    } catch {
      setErr("Veri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setErr("");
    if (!form.ad.trim()) {
      setErr("Hammadde adı gerekli");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/urunler", {
        ad: form.ad.trim(),
        fiyat: 0,
        tur: "HAMMADDE",
        stok_takibi: !!form.stok_takibi,
        stok_birim: form.stok_birim,
        aciklama: form.aciklama.trim() || null,
        min_stok: 0,
        aktif: form.aktif,
      });
      setForm((f) => ({ ...f, ad: "", aciklama: "" }));
      await load();
    } catch (e2) {
      setErr(e2?.response?.data?.error || "Hammadde eklenemedi");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(u) {
    setEditing({
      id: u.id,
      ad: u.ad,
      stok_birim: u.stok_birim || "adet",
      stok_takibi: !!u.stok_takibi,
      aciklama: u.aciklama || "",
      aktif: !!u.aktif,
    });
    setErr("");
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.ad.trim()) {
      setErr("Hammadde adı gerekli");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.put(`/api/urunler/${editing.id}`, {
        ad: editing.ad.trim(),
        fiyat: 0,
        tur: "HAMMADDE",
        stok_takibi: !!editing.stok_takibi,
        stok_birim: editing.stok_birim,
        aciklama: editing.aciklama.trim() || null,
        aktif: editing.aktif,
      });
      setEditing(null);
      await load();
    } catch (e2) {
      setErr(e2?.response?.data?.error || "Güncellenemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Hammadde</h1>
      <p className="mt-1 text-sm text-slate-500">
        Reçetelerde kullanılacak stok kalemleri. Stok takibi açıksa envanterde görünür ve satışlarda
        reçeteye göre düşer.
      </p>

      <form
        onSubmit={handleCreate}
        className="mt-6 grid max-w-5xl grid-cols-1 gap-3 rounded-lg border border-slate-700 bg-slate-950 p-4 md:grid-cols-2 lg:grid-cols-5"
      >
        <div>
          <label className="text-xs text-slate-500">Hammadde adı</label>
          <input
            className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            value={form.ad}
            onChange={(e) => setForm({ ...form, ad: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Birim</label>
          <select
            className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            value={form.stok_birim}
            onChange={(e) => setForm({ ...form, stok_birim: e.target.value })}
          >
            <option value="adet">adet</option>
            <option value="cl">cl</option>
            <option value="gr">gr</option>
          </select>
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={form.stok_takibi}
              onChange={(e) => setForm({ ...form, stok_takibi: e.target.checked })}
            />
            Stok takip
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={form.aktif}
              onChange={(e) => setForm({ ...form, aktif: e.target.checked })}
            />
            Aktif
          </label>
        </div>
        <div className="md:col-span-2 lg:col-span-5">
          <label className="text-xs text-slate-500">Açıklama</label>
          <input
            className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            value={form.aciklama}
            onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
            placeholder="Opsiyonel"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="lg:col-span-5 rounded-lg bg-blue-600 py-2 text-sm text-white disabled:opacity-50"
        >
          Hammadde ekle
        </button>
      </form>

      {err && <p className="mt-4 text-sm text-amber-500">{err}</p>}

      <div className="mt-8 overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-950 text-slate-500">
            <tr>
              <th className="px-3 py-2">Hammadde</th>
              <th className="px-3 py-2">Birim</th>
              <th className="px-3 py-2">Stok</th>
              <th className="px-3 py-2">Açıklama</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Yükleniyor…
                </td>
              </tr>
            ) : (
              urunler.map((u) => (
                <tr key={u.id} className="border-b border-slate-800">
                  {editing?.id === u.id ? (
                    <td className="px-3 py-2" colSpan={5}>
                      <div className="flex flex-wrap items-end gap-2">
                        <input
                          className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                          value={editing.ad}
                          onChange={(e) => setEditing({ ...editing, ad: e.target.value })}
                        />
                        <select
                          className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                          value={editing.stok_birim}
                          onChange={(e) => setEditing({ ...editing, stok_birim: e.target.value })}
                        >
                          <option value="adet">adet</option>
                          <option value="cl">cl</option>
                          <option value="gr">gr</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={editing.stok_takibi}
                            onChange={(e) => setEditing({ ...editing, stok_takibi: e.target.checked })}
                          />
                          Stok
                        </label>
                        <label className="flex items-center gap-1 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={editing.aktif}
                            onChange={(e) => setEditing({ ...editing, aktif: e.target.checked })}
                          />
                          Aktif
                        </label>
                        <input
                          className="min-w-[240px] flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                          value={editing.aciklama}
                          onChange={(e) => setEditing({ ...editing, aciklama: e.target.value })}
                          placeholder="Açıklama"
                        />
                        <button type="button" className="text-emerald-400 text-sm" onClick={saveEdit}>
                          Kaydet
                        </button>
                        <button type="button" className="text-slate-500 text-sm" onClick={() => setEditing(null)}>
                          İptal
                        </button>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-slate-100">{u.ad}</td>
                      <td className="px-3 py-2 text-slate-400">{u.stok_birim || "adet"}</td>
                      <td className="px-3 py-2 text-slate-500">{u.stok_takibi ? "Açık" : "Kapalı"}</td>
                      <td className="px-3 py-2 text-slate-400 truncate max-w-[420px]">{u.aciklama || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" className="text-blue-400 text-sm" onClick={() => startEdit(u)}>
                          Düzenle
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

