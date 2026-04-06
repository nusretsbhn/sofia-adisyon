import { useEffect, useState, useCallback } from "react";
import api from "../api/client.js";

export default function Receteler() {
  const [urunler, setUrunler] = useState([]);
  const [kategoriler, setKategoriler] = useState([]);
  const [hammaddeler, setHammaddeler] = useState([]);
  const [urunId, setUrunId] = useState("");
  const [urunAd, setUrunAd] = useState("");
  const [receteler, setReceteler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    hammadde_urun_id: "",
    miktar: "1",
    birim: "cl",
  });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ hammadde_ad: "", miktar: "", birim: "" });
  const [saving, setSaving] = useState(false);
  const satisUrunler = urunler.filter((u) => u.tur !== "HAMMADDE");

  useEffect(() => {
    (async () => {
      try {
        const [uRes, kRes] = await Promise.all([
          api.get("/api/urunler", { params: { aktif: "false" } }),
          api.get("/api/kategoriler", { params: { aktif: "false" } }),
        ]);
        const u = uRes.data.urunler ?? [];
        const k = kRes.data.kategoriler ?? [];
        setUrunler(u);
        setKategoriler(k);
        // Reçetelerde sadece HAMMADDE türündeki stok kalemleri seçilsin
        const h = u.filter((x) => x.tur === "HAMMADDE");
        setHammaddeler(h);
        setForm((f) => {
          if (f.hammadde_urun_id) return f;
          const first = h.find((x) => x.aktif) || h[0];
          return first
            ? { ...f, hammadde_urun_id: String(first.id), birim: first.stok_birim || "adet" }
            : f;
        });
      } catch {
        setErr("Ürün listesi alınamadı.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadRecete = useCallback(async (uid) => {
    if (!uid) {
      setReceteler([]);
      setUrunAd("");
      return;
    }
    setLoadingList(true);
    setErr("");
    try {
      const { data } = await api.get("/api/receteler", { params: { urun_id: uid } });
      setReceteler(data.receteler ?? []);
      setUrunAd(data.urun?.ad ?? "");
    } catch {
      setErr("Reçete yüklenemedi.");
      setReceteler([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadRecete(urunId);
  }, [urunId, loadRecete]);

  function hammaddeFromId() {
    const hid = Number(form.hammadde_urun_id);
    if (!hid) return null;
    return hammaddeler.find((x) => x.id === hid) ?? null;
  }

  async function handleEkle(e) {
    e.preventDefault();
    setMsg("");
    const uid = Number(urunId);
    const miktar = Number.parseFloat(String(form.miktar).replace(",", "."));
    const h = hammaddeFromId();
    if (!uid || !h || !Number.isFinite(miktar) || miktar <= 0) {
      setMsg("Ürün, hammadde ve geçerli miktar girin.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/receteler", {
        urun_id: uid,
        hammadde_ad: h.ad,
        miktar,
        birim: String(form.birim || h.stok_birim || "adet").trim() || "adet",
      });
      setForm((f) => ({ ...f, miktar: "1" }));
      setMsg("Satır eklendi.");
      await loadRecete(String(uid));
    } catch (e) {
      setMsg(e?.response?.data?.error || "Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  }

  // Hammadde ekleme ayrı sayfadan yapılır (Hammadde sekmesi).

  function startEdit(r) {
    setEditId(r.id);
    setEditForm({
      hammadde_ad: r.hammadde_ad,
      miktar: String(r.miktar),
      birim: r.birim,
    });
    setMsg("");
  }

  async function saveEdit() {
    const miktar = Number.parseFloat(String(editForm.miktar).replace(",", "."));
    if (!editId || !editForm.hammadde_ad.trim() || !Number.isFinite(miktar) || miktar <= 0) {
      setMsg("Geçerli değerler girin.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      await api.patch(`/api/receteler/${editId}`, {
        hammadde_ad: editForm.hammadde_ad.trim(),
        miktar,
        birim: editForm.birim.trim() || "adet",
      });
      setEditId(null);
      setMsg("Güncellendi.");
      await loadRecete(urunId);
    } catch {
      setMsg("Güncelleme başarısız.");
    } finally {
      setSaving(false);
    }
  }

  async function sil(id) {
    if (!window.confirm("Bu satırı silinsin mi?")) return;
    setMsg("");
    try {
      await api.delete(`/api/receteler/${id}`);
      setMsg("Silindi.");
      await loadRecete(urunId);
    } catch {
      setMsg("Silinemedi.");
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-slate-500">
        <h1 className="text-2xl font-semibold text-slate-100">Reçeteler</h1>
        <p className="mt-4">Yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-100">Kokteyl / reçete</h1>
      <p className="mt-1 text-sm text-slate-500">
        Satış ürününe bağlı içerik satırları (ör. içecek hacmi, şurup). Stoktan reçeteye
        göre düşüm yapılır.
      </p>

      {err && <p className="mt-4 text-sm text-amber-500">{err}</p>}
      {msg && (
        <p
          className={`mt-2 text-sm ${
            /eklendi|Güncellendi|Silindi/i.test(msg) && !/başarısız/i.test(msg)
              ? "text-emerald-400"
              : "text-amber-500"
          }`}
        >
          {msg}
        </p>
      )}

      <div className="mt-6">
        <label className="text-sm text-slate-400">Ürün seçin</label>
        <select
          className="mt-1 block w-full max-w-md rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
          value={urunId}
          onChange={(e) => {
            setUrunId(e.target.value);
            setEditId(null);
            setMsg("");
          }}
        >
          <option value="">—</option>
          {satisUrunler.map((u) => (
            <option key={u.id} value={u.id}>
              {u.ad}
              {!u.aktif ? " (pasif)" : ""}
            </option>
          ))}
        </select>
      </div>

      {urunId && (
        <>
          <h2 className="mt-8 text-lg font-medium text-slate-200">
            {urunAd ? `«${urunAd}»` : "Reçete"} satırları
          </h2>

          {loadingList ? (
            <p className="mt-4 text-slate-500">Liste yükleniyor…</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-700 bg-slate-950 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Hammadde / içerik</th>
                    <th className="px-3 py-2 text-right">Miktar</th>
                    <th className="px-3 py-2">Birim</th>
                    <th className="px-3 py-2 w-40" />
                  </tr>
                </thead>
                <tbody>
                  {receteler.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                        Bu ürün için reçete satırı yok
                      </td>
                    </tr>
                  ) : (
                    receteler.map((r) =>
                      editId === r.id ? (
                        <tr key={r.id} className="border-b border-slate-800 bg-slate-900/60">
                          <td className="px-3 py-2">
                            <input
                              className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1"
                              value={editForm.hammadde_ad}
                              onChange={(e) =>
                                setEditForm({ ...editForm, hammadde_ad: e.target.value })
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-right"
                              value={editForm.miktar}
                              onChange={(e) =>
                                setEditForm({ ...editForm, miktar: e.target.value })
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1"
                              value={editForm.birim}
                              onChange={(e) =>
                                setEditForm({ ...editForm, birim: e.target.value })
                              }
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={saveEdit}
                              className="text-sm text-blue-400 hover:underline mr-3"
                            >
                              Kaydet
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditId(null)}
                              className="text-sm text-slate-500"
                            >
                              İptal
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr key={r.id} className="border-b border-slate-800">
                          <td className="px-3 py-2 text-slate-200">{r.hammadde_ad}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-300">
                            {r.miktar}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{r.birim}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => startEdit(r)}
                              className="text-sm text-blue-400 hover:underline mr-3"
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              onClick={() => sil(r.id)}
                              className="text-sm text-red-400/90 hover:underline"
                            >
                              Sil
                            </button>
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          <form
            onSubmit={handleEkle}
            className="mt-8 flex flex-wrap items-end gap-3 rounded-lg border border-slate-700 bg-slate-950/40 p-4"
          >
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-slate-500">Hammadde</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                value={form.hammadde_urun_id}
                onChange={(e) => {
                  const hid = e.target.value;
                  const h = hammaddeler.find((x) => String(x.id) === String(hid));
                  setForm({
                    ...form,
                    hammadde_urun_id: hid,
                    birim: h?.stok_birim || form.birim,
                  });
                }}
                required
              >
                <option value="">Seçin…</option>
                {hammaddeler.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.ad} ({h.stok_birim || "adet"})
                    {!h.aktif ? " (pasif)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Miktar</label>
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-24 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                value={form.miktar}
                onChange={(e) => setForm({ ...form, miktar: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Birim</label>
              <input
                className="mt-1 w-24 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 opacity-80"
                value={form.birim}
                readOnly
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "…" : "Ekle"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
