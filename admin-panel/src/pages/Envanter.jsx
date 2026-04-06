import { useEffect, useState, useCallback } from "react";
import api from "../api/client.js";

function tryToKurus(s) {
  const n = parseFloat(String(s).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function Envanter() {
  const [satirlar, setSatirlar] = useState([]);
  const [girisler, setGirisler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    urun_id: "",
    miktar: "1",
    birim_maliyetTry: "",
    aciklama: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const [o, g] = await Promise.all([
        api.get("/api/envanter/ozet"),
        api.get("/api/envanter/girisler", { params: { limit: 30 } }),
      ]);
      setSatirlar(o.data.satirlar ?? []);
      setGirisler(g.data.girisler ?? []);
      setForm((f) => {
        if (f.urun_id) return f;
        const first = (o.data.satirlar ?? []).find((x) => x.aktif);
        return { ...f, urun_id: first ? String(first.urun_id) : "" };
      });
    } catch {
      setErr("Envanter verisi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGiris(e) {
    e.preventDefault();
    setMsg("");
    const urun_id = Number(form.urun_id);
    const miktar = Number.parseInt(form.miktar, 10);
    if (!urun_id || !Number.isFinite(miktar) || miktar < 1) {
      setMsg("Ürün ve geçerli miktar seçin.");
      return;
    }
    const malTry = form.birim_maliyetTry.trim();
    let birim_maliyet = null;
    if (malTry) {
      const k = tryToKurus(malTry);
      if (k == null) {
        setMsg("Birim maliyet sayısal olmalı.");
        return;
      }
      birim_maliyet = k;
    }
    setSaving(true);
    try {
      await api.post("/api/envanter/giris", {
        urun_id,
        miktar,
        birim_maliyet,
        aciklama: form.aciklama.trim() || null,
      });
      setForm((f) => ({ ...f, miktar: "1", birim_maliyetTry: "", aciklama: "" }));
      setMsg("Stok girişi kaydedildi.");
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.error || "Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-slate-500">
        <h1 className="text-2xl font-semibold text-slate-100">Envanter</h1>
        <p className="mt-4">Yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-100">Envanter</h1>
      <p className="mt-1 text-sm text-slate-500">
        Stok takibi açık ürünler: satışlardan düşen çıkışlar ve manuel girişlere göre mevcut miktar.
      </p>

      {err && <p className="mt-4 text-sm text-amber-500">{err}</p>}
      {msg && (
        <p
          className={`mt-2 text-sm ${
            msg.includes("kaydedildi") ? "text-emerald-400" : "text-amber-500"
          }`}
        >
          {msg}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium text-slate-200">Mevcut stok</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-700 bg-slate-950 text-slate-500">
              <tr>
                <th className="px-3 py-2">Ürün</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2 text-right">Giriş</th>
                <th className="px-3 py-2 text-right">Çıkış</th>
                <th className="px-3 py-2 text-right">Mevcut</th>
                <th className="px-3 py-2 text-right">Min.</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    Stok takibi açık ürün yok. Ürünler sayfasından ürün için &quot;Stok takibi&quot;
                    işaretleyin.
                  </td>
                </tr>
              ) : (
                satirlar.map((s) => (
                  <tr
                    key={s.urun_id}
                    className={`border-b border-slate-800 ${
                      s.dusuk ? "bg-amber-950/30" : ""
                    } ${!s.aktif ? "opacity-60" : ""}`}
                  >
                    <td className="px-3 py-2 text-slate-200">{s.urun_adi}</td>
                    <td className="px-3 py-2 text-slate-500">{s.kategori_adi || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">
                      {s.giris_toplam}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">
                      {s.cikis_toplam}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono ${
                        s.dusuk ? "text-amber-400 font-semibold" : "text-slate-200"
                      }`}
                    >
                      {s.mevcut} {s.stok_birim || ""}
                      {s.dusuk && (
                        <span className="ml-2 text-xs text-amber-500/90">düşük</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">
                      {s.min_stok}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-slate-200">Stok girişi</h2>
        <form
          onSubmit={handleGiris}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-700 bg-slate-950/40 p-4"
        >
          <div>
            <label className="block text-xs text-slate-500">Ürün</label>
            <select
              className="mt-1 min-w-[200px] rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={form.urun_id}
              onChange={(e) => setForm({ ...form, urun_id: e.target.value })}
              required
            >
              <option value="">Seçin</option>
              {satirlar.map((s) => (
                <option key={s.urun_id} value={s.urun_id}>
                  {s.urun_adi}
                  {!s.aktif ? " (pasif)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">Miktar</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-28 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={form.miktar}
              onChange={(e) => setForm({ ...form, miktar: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Birim maliyet (₺, isteğe bağlı)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              className="mt-1 w-32 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={form.birim_maliyetTry}
              onChange={(e) => setForm({ ...form, birim_maliyetTry: e.target.value })}
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-slate-500">Açıklama</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={form.aciklama}
              onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={saving || satirlar.length === 0}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Kaydediliyor…" : "Giriş kaydet"}
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-slate-200">Son girişler</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-slate-700 bg-slate-950 text-slate-500">
              <tr>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Ürün</th>
                <th className="px-3 py-2 text-right">Miktar</th>
                <th className="px-3 py-2">Kullanıcı</th>
                <th className="px-3 py-2">Not</th>
              </tr>
            </thead>
            <tbody>
              {girisler.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Henüz manuel giriş yok
                  </td>
                </tr>
              ) : (
                girisler.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800">
                    <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">
                      {r.tarih ? new Date(r.tarih).toLocaleString("tr-TR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-200">{r.urun_adi}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.miktar}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs">
                      {r.kullanici?.kullanici_adi ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-xs max-w-[200px] truncate">
                      {r.aciklama || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
