import { useEffect, useState } from "react";
import api from "../api/client.js";

const fields = [
  { key: "isletme_adi", label: "İşletme adı" },
  { key: "isletme_adres", label: "Adres" },
  { key: "isletme_telefon", label: "Telefon" },
  { key: "para_birimi", label: "Para birimi (örn. TRY)" },
  { key: "kdv_orani", label: "KDV oranı (%)", type: "number" },
  { key: "kdv_dahil", label: "KDV fiyatlara dahil (true/false)" },
  {
    key: "yazici_port",
    label:
      "Termal yazıcı (Windows: COM3 | ağ: tcp://192.168.1.50:9100 | paylaşımlı: printer:YazıcıAdı)",
  },
  { key: "yazici_genislik", label: "Kağıt genişliği mm (58 veya 80)" },
  { key: "tunnel_url", label: "Dış erişim tunnel URL (opsiyonel)" },
  { key: "oturum_dk", label: "Oturum zaman aşımı (dakika)" },
  { key: "adisyon_gunluk_sifir", label: "Adisyon no. günlük sıfırla (true/false)" },
];

export default function Ayarlar() {
  const [ayarlar, setAyarlar] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/api/ayarlar");
        setAyarlar(data.ayarlar ?? {});
      } catch {
        setMsg("Ayarlar yüklenemedi (yalnızca admin).");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function set(key, v) {
    setAyarlar((a) => ({ ...a, [key]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setSaving(true);
    try {
      const { data } = await api.post("/api/ayarlar", { ayarlar });
      setAyarlar(data.ayarlar ?? {});
      setMsg("Kaydedildi.");
    } catch {
      setMsg("Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  }

  async function sqliteYedekIndir() {
    setMsg("");
    try {
      const res = await api.get("/api/yedek/sqlite", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `turadisyon-yedek-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.db`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("SQLite yedeği indirildi.");
    } catch {
      setMsg("Yedek indirilemedi (yalnızca admin).");
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-slate-500">
        <h1 className="text-2xl font-semibold text-slate-100">Ayarlar</h1>
        <p className="mt-4">Yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-100">Program ayarları</h1>
      <p className="mt-1 text-sm text-slate-500">
        Bu sayfa yalnızca <strong className="text-slate-400">Admin</strong> rolü içindir.
      </p>

      {msg && (
        <p
          className={`mt-4 text-sm ${
            msg.includes("başarı") ||
            msg.includes("Kaydedildi") ||
            msg.includes("yedeği indirildi")
              ? "text-emerald-400"
              : "text-amber-500"
          }`}
        >
          {msg}
        </p>
      )}

      <section className="mt-8 rounded-lg border border-slate-700 bg-slate-950/50 p-4">
        <h2 className="text-sm font-medium text-slate-300">Veritabanı yedeği</h2>
        <p className="mt-1 text-xs text-slate-500">
          SQLite dosyasının anlık kopyası. Yoğun kullanımda tam tutarlılık için sunucuda{" "}
          <code className="text-slate-400">sqlite3 .backup</code> tercih edilir.
        </p>
        <button
          type="button"
          onClick={sqliteYedekIndir}
          className="mt-3 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          SQLite yedeğini indir (.db)
        </button>
      </section>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-sm text-slate-400">{f.label}</label>
            <input
              type={f.type === "number" ? "number" : "text"}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={ayarlar[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </form>
    </div>
  );
}
