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
      localStorage.setItem("turadisyon_pos_token", data.accessToken);
      localStorage.setItem("turadisyon_pos_user", JSON.stringify(data.user));
      nav("/", { replace: true });
    } catch {
      setErr("Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pos-bg p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-pos-border bg-pos-card p-8 shadow-lg"
      >
        <h1 className="text-center text-2xl font-bold text-slate-100">TurAdisyon POS</h1>
        {err && <p className="mt-4 text-center text-sm text-red-400">{err}</p>}
        <label className="mt-6 block text-sm text-slate-400">Kullanıcı adı</label>
        <input
          className="mt-2 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-4 text-lg text-slate-100"
          value={kullanici_adi}
          onChange={(e) => setKullanici(e.target.value)}
          autoComplete="username"
        />
        <label className="mt-4 block text-sm text-slate-400">Şifre</label>
        <input
          type="password"
          className="mt-2 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-4 text-lg text-slate-100"
          value={sifre}
          onChange={(e) => setSifre(e.target.value)}
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-8 w-full min-h-[52px] rounded-lg bg-pos-primary text-lg font-semibold text-white disabled:opacity-50"
        >
          {loading ? "…" : "Giriş"}
        </button>
      </form>
    </div>
  );
}
