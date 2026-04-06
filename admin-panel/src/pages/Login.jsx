import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client.js";

export default function Login() {
  const nav = useNavigate();
  const [kullanici_adi, setKullanici] = useState("");
  const [sifre, setSifre] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { kullanici_adi, sifre });
      if (data.user?.rol === "PERSONEL") {
        setErr(
          "Bu hesap yalnızca POS için tanımlıdır. Yönetim paneline giriş yapılamaz.",
        );
        return;
      }
      localStorage.setItem("turadisyon_token", data.accessToken);
      if (data.user) {
        localStorage.setItem("turadisyon_user", JSON.stringify(data.user));
      }
      nav("/", { replace: true });
    } catch {
      setErr("Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-950 p-8 shadow-xl"
      >
        <h1 className="text-center text-xl font-semibold text-slate-100">TurAdisyon Admin</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Yönetim paneli</p>
        {err && <p className="mt-4 text-sm text-red-400">{err}</p>}
        <label className="mt-6 block text-sm text-slate-400">Kullanıcı adı</label>
        <input
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
          value={kullanici_adi}
          onChange={(e) => setKullanici(e.target.value)}
          autoComplete="username"
        />
        <label className="mt-4 block text-sm text-slate-400">Şifre</label>
        <input
          type="password"
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
          value={sifre}
          onChange={(e) => setSifre(e.target.value)}
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "…" : "Giriş"}
        </button>
      </form>
    </div>
  );
}
