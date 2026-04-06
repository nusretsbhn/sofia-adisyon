import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";

const ROLLAR = [
  { value: "ADMIN", label: "Admin (tam yetki)" },
  { value: "PERSONEL", label: "Personel (yalnızca POS)" },
];

function rolEtiket(rol) {
  if (rol === "ADMIN") return "Admin";
  if (rol === "PERSONEL") return "Personel";
  return rol;
}

export default function Kullanicilar() {
  const [liste, setListe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [kaydediyor, setKaydediyor] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    ad: "",
    soyad: "",
    kullanici_adi: "",
    sifre: "",
    rol: "PERSONEL",
    aktif: true,
  });

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const { data } = await api.get("/api/kullanicilar");
      setListe(data.kullanicilar ?? []);
    } catch {
      setErr("Liste alınamadı");
      setListe([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function yeniAc() {
    setErr("");
    setForm({
      ad: "",
      soyad: "",
      kullanici_adi: "",
      sifre: "",
      rol: "PERSONEL",
      aktif: true,
    });
    setModal({ tip: "yeni" });
  }

  function duzenleAc(u) {
    setErr("");
    setForm({
      ad: u.ad,
      soyad: u.soyad,
      kullanici_adi: u.kullanici_adi,
      sifre: "",
      rol: u.rol === "ADMIN" || u.rol === "PERSONEL" ? u.rol : "PERSONEL",
      aktif: u.aktif,
    });
    setModal({ tip: "duzenle", id: u.id, orijinalRol: u.rol });
  }

  async function kaydet(e) {
    e.preventDefault();
    setErr("");
    setKaydediyor(true);
    try {
      if (modal.tip === "yeni") {
        await api.post("/api/kullanicilar", {
          ad: form.ad.trim(),
          soyad: form.soyad.trim(),
          kullanici_adi: form.kullanici_adi.trim(),
          sifre: form.sifre,
          rol: form.rol,
        });
      } else {
        const body = {
          ad: form.ad.trim(),
          soyad: form.soyad.trim(),
          kullanici_adi: form.kullanici_adi.trim(),
          rol: form.rol,
          aktif: form.aktif,
        };
        if (form.sifre && form.sifre.length > 0) {
          body.sifre = form.sifre;
        }
        await api.patch(`/api/kullanicilar/${modal.id}`, body);
      }
      setModal(null);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.error || "Kayıt başarısız");
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Kullanıcılar</h1>
          <p className="mt-1 text-sm text-slate-500">
            <strong>Admin</strong> yönetim paneli ve POS; <strong>Personel</strong> yalnızca POS girişi
            (admin paneli kapalı).
          </p>
        </div>
        <button
          type="button"
          onClick={yeniAc}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Yeni kullanıcı
        </button>
      </div>

      {err && !modal && <p className="mt-4 text-sm text-amber-500">{err}</p>}

      {loading ? (
        <p className="mt-6 text-slate-500">Yükleniyor…</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-700 bg-slate-950 text-slate-500">
              <tr>
                <th className="px-3 py-2">Ad Soyad</th>
                <th className="px-3 py-2">Kullanıcı adı</th>
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2 w-28" />
              </tr>
            </thead>
            <tbody>
              {liste.map((u) => (
                <tr key={u.id} className="border-b border-slate-800">
                  <td className="px-3 py-2 text-slate-200">
                    {u.ad} {u.soyad}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-300">{u.kullanici_adi}</td>
                  <td className="px-3 py-2 text-slate-400">{rolEtiket(u.rol)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        u.aktif ? "text-emerald-400 text-xs" : "text-slate-600 text-xs"
                      }
                    >
                      {u.aktif ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-xs text-blue-400 hover:underline"
                      onClick={() => duzenleAc(u)}
                    >
                      Düzenle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => !kaydediyor && setModal(null)}
        >
          <form
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={kaydet}
          >
            <h2 className="text-lg font-semibold text-slate-100">
              {modal.tip === "yeni" ? "Yeni kullanıcı" : "Kullanıcı düzenle"}
            </h2>
            {modal.tip === "duzenle" &&
              modal.orijinalRol &&
              modal.orijinalRol !== "ADMIN" &&
              modal.orijinalRol !== "PERSONEL" && (
                <p className="mt-2 text-xs text-amber-500">
                  Mevcut rol: {modal.orijinalRol}. Kaydettiğinizde Admin veya Personel olarak
                  güncellenir.
                </p>
              )}
            {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
            <label className="mt-4 block text-xs text-slate-500">Ad</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={form.ad}
              onChange={(e) => setForm((f) => ({ ...f, ad: e.target.value }))}
              required
            />
            <label className="mt-3 block text-xs text-slate-500">Soyad</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={form.soyad}
              onChange={(e) => setForm((f) => ({ ...f, soyad: e.target.value }))}
              required
            />
            <label className="mt-3 block text-xs text-slate-500">Kullanıcı adı</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 font-mono"
              value={form.kullanici_adi}
              onChange={(e) => setForm((f) => ({ ...f, kullanici_adi: e.target.value }))}
              required
              autoComplete="username"
            />
            <label className="mt-3 block text-xs text-slate-500">
              Şifre {modal.tip === "duzenle" && "(değiştirmek için doldurun)"}
            </label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={form.sifre}
              onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))}
              required={modal.tip === "yeni"}
              autoComplete="new-password"
            />
            <label className="mt-3 block text-xs text-slate-500">Rol</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={form.rol}
              onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
            >
              {ROLLAR.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {modal.tip === "duzenle" && (
              <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.aktif}
                  onChange={(e) => setForm((f) => ({ ...f, aktif: e.target.checked }))}
                />
                Aktif
              </label>
            )}
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-600 py-2 text-slate-300"
                onClick={() => setModal(null)}
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={kaydediyor}
                className="flex-1 rounded-lg bg-emerald-600 py-2 font-medium text-white disabled:opacity-50"
              >
                {kaydediyor ? "…" : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
