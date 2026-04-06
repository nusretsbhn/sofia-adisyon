import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../api/client.js";
import { formatTry } from "../lib/format.js";

let tempKey = 0;
function nextKey() {
  tempKey += 1;
  return tempKey;
}

/** Boş veya geçersizse 1; önce rakam (örn. 3) sonra ürün = 3 adet */
function adetFromBuffer(buf) {
  const s = String(buf ?? "").trim();
  if (s === "") return 1;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(999, n);
}

export default function SiparisEkrani() {
  const { id } = useParams();
  const nav = useNavigate();
  const [adisyon, setAdisyon] = useState(null);
  const [kategoriler, setKategoriler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [katId, setKatId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [adetGiris, setAdetGiris] = useState("");
  const [draft, setDraft] = useState([]);
  const [gonderiyor, setGonderiyor] = useState(false);
  const [barkod, setBarkod] = useState("");
  const [geriUyari, setGeriUyari] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const [aRes, kRes, uRes] = await Promise.all([
        api.get(`/api/adisyonlar/${id}`),
        api.get("/api/kategoriler"),
        api.get("/api/urunler"),
      ]);
      const a = aRes.data.adisyon;
      if (a.durum !== "ACIK") {
        setErr("Adisyon kapalı");
        setAdisyon(null);
        return;
      }
      setAdisyon(a);
      const cats = kRes.data.kategoriler ?? [];
      setKategoriler(cats.filter((c) => c.aktif));
      setUrunler(uRes.data.urunler ?? []);
    } catch {
      setErr("Yüklenemedi");
      setAdisyon(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setKatId(null);
    setSearch("");
    setAdetGiris("");
    setDraft([]);
    setBarkod("");
  }, [id]);

  useEffect(() => {
    if (katId == null && kategoriler.length) {
      const first = kategoriler.find((c) => c.aktif);
      if (first) setKatId(first.id);
    }
  }, [kategoriler, katId]);

  function rakamEkle(d) {
    setAdetGiris((prev) => {
      const next = `${prev}${d}`.replace(/^0+/, "") || d;
      if (next.length > 3) return prev;
      return next;
    });
  }

  function rakamSil() {
    setAdetGiris((prev) => prev.slice(0, -1));
  }

  function adetTemizle() {
    setAdetGiris("");
  }

  function urunTasla(urun) {
    if (!urun?.aktif) return;
    const adet = adetFromBuffer(adetGiris);
    setAdetGiris("");
    setErr("");
    setDraft((prev) => {
      const i = prev.findIndex((x) => x.urun_id === urun.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = {
          ...next[i],
          adet: Math.min(999, next[i].adet + adet),
        };
        return next;
      }
      return [
        ...prev,
        {
          key: nextKey(),
          urun_id: urun.id,
          urun_adi: urun.ad,
          fiyat: urun.fiyat,
          adet,
        },
      ];
    });
  }

  function satirSil(key) {
    setDraft((prev) => prev.filter((x) => x.key !== key));
  }

  const taslakToplam = useMemo(() => {
    return draft.reduce((s, x) => s + x.fiyat * x.adet, 0);
  }, [draft]);

  const filtreUrun = useMemo(() => {
    const q = search.trim().toLowerCase();
    return urunler.filter((u) => {
      if (!u.aktif) return false;
      if (q) {
        const byName = u.ad.toLowerCase().includes(q);
        const byBarkod = u.barkod && u.barkod.toLowerCase().includes(q);
        return byName || byBarkod;
      }
      return u.kategori_id === katId;
    });
  }, [urunler, katId, search]);

  function barkodEkle(e) {
    e.preventDefault();
    const b = barkod.trim();
    if (!b) return;
    const u = urunler.find((x) => x.aktif && x.barkod && String(x.barkod).trim() === b);
    setBarkod("");
    if (u) urunTasla(u);
    else setErr("Barkod bulunamadı");
  }

  async function gonder() {
    if (draft.length === 0) return;
    setGonderiyor(true);
    setErr("");
    try {
      for (const satir of draft) {
        await api.post(`/api/adisyonlar/${id}/kalemler`, {
          urun_id: satir.urun_id,
          adet: satir.adet,
        });
      }
      nav("/", { replace: true, state: { aktifAdisyonId: Number(id) } });
    } catch (e) {
      setErr(e?.response?.data?.error || "Gönderilemedi");
    } finally {
      setGonderiyor(false);
    }
  }

  function geriGit() {
    if (draft.length > 0) {
      setGeriUyari(true);
      return;
    }
    nav("/", { state: { aktifAdisyonId: Number(id) } });
  }

  function geriOnayla() {
    setGeriUyari(false);
    nav("/", { state: { aktifAdisyonId: Number(id) } });
  }

  if (loading && !adisyon) {
    return (
      <div className="min-h-screen bg-pos-bg p-4 text-slate-500">
        <p>Yükleniyor…</p>
      </div>
    );
  }

  if (!adisyon || adisyon.durum !== "ACIK") {
    return (
      <div className="min-h-screen bg-pos-bg p-4">
        <p className="text-slate-400">{err || "Adisyon kullanılamaz"}</p>
        <Link to="/" className="mt-4 inline-block text-blue-400">
          Ana sayfa
        </Link>
      </div>
    );
  }

  const masa = (adisyon.masa_no ?? 0) > 0 ? adisyon.masa_no : "—";

  return (
    <div className="min-h-screen bg-pos-bg flex flex-col">
      <header className="shrink-0 border-b border-pos-border p-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <button
            type="button"
            onClick={geriGit}
            className="text-sm text-blue-400"
          >
            ← Ana sayfa
          </button>
          <h1 className="text-lg font-semibold text-slate-100 mt-1">
            Ürün ekle · Masa <span className="text-blue-400 tabular-nums">{masa}</span>
          </h1>
          <p className="text-xs text-slate-600 font-mono truncate max-w-[280px]">
            {adisyon.numara} · {adisyon.musteri_adi || "Misafir"}
          </p>
        </div>
      </header>

      {err && <p className="px-3 py-2 text-sm text-red-400">{err}</p>}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Sol: taslak + numpad */}
        <div className="lg:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-pos-border flex flex-col p-3 gap-3 bg-slate-950/30">
          <div>
            <p className="text-xs text-slate-500">Adet (önce rakam, sonra ürün)</p>
            <p className="mt-1 font-mono text-3xl text-amber-300/90 tabular-nums min-h-[40px]">
              {adetGiris || " "}
            </p>
            <div className="grid grid-cols-3 gap-2 mt-2 max-w-[240px]">
              {["9", "8", "7", "6", "5", "4", "3", "2", "1"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => rakamEkle(d)}
                  className="min-h-[48px] rounded-lg bg-slate-800 text-xl font-semibold text-slate-100 active:bg-slate-700"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={adetTemizle}
                className="min-h-[48px] rounded-lg bg-amber-950/50 text-amber-200 text-sm font-medium"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => rakamEkle("0")}
                className="min-h-[48px] rounded-lg bg-slate-800 text-xl font-semibold text-slate-100"
              >
                0
              </button>
              <button
                type="button"
                onClick={rakamSil}
                className="min-h-[48px] rounded-lg bg-slate-800 text-sm text-slate-300"
              >
                Sil
              </button>
            </div>
          </div>

          <form onSubmit={barkodEkle} className="flex gap-2">
            <input
              className="flex-1 min-h-[44px] rounded-lg border border-pos-border bg-pos-bg px-3 text-sm text-slate-100"
              placeholder="Barkod"
              value={barkod}
              onChange={(e) => setBarkod(e.target.value)}
            />
            <button
              type="submit"
              className="min-h-[44px] px-3 rounded-lg bg-slate-700 text-sm text-white"
            >
              OK
            </button>
          </form>

          <div className="flex-1 min-h-[120px] flex flex-col border border-pos-border rounded-lg overflow-hidden bg-pos-card/50">
            <p className="text-xs text-slate-500 px-2 py-1 border-b border-pos-border">Taslak</p>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[40vh] lg:max-h-none">
              {draft.length === 0 ? (
                <p className="text-sm text-slate-600 py-4 text-center">Henüz satır yok</p>
              ) : (
                draft.map((s) => (
                  <div
                    key={s.key}
                    className="flex justify-between items-center gap-2 text-sm py-1 border-b border-pos-border/50"
                  >
                    <span className="text-slate-200 truncate">
                      {s.adet}× {s.urun_adi}
                    </span>
                    <span className="font-mono text-slate-400 shrink-0">
                      {formatTry(s.fiyat * s.adet)}
                    </span>
                    <button
                      type="button"
                      className="text-red-400 text-xs px-1"
                      onClick={() => satirSil(s.key)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
            {draft.length > 0 && (
              <div className="px-2 py-2 border-t border-pos-border flex justify-between text-slate-200">
                <span className="text-xs">Ara toplam</span>
                <span className="font-mono">{formatTry(taslakToplam)}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={draft.length === 0 || gonderiyor}
            onClick={gonder}
            className="w-full min-h-[56px] rounded-xl bg-emerald-600 text-lg font-bold text-white disabled:opacity-40"
          >
            {gonderiyor ? "Gönderiliyor…" : "Gönder (adisyona işle)"}
          </button>
        </div>

        {/* Sağ: kategori + ürün */}
        <div className="flex-1 flex flex-col min-h-0">
          <input
            type="search"
            className="mx-3 mt-3 min-h-[44px] rounded-lg border border-pos-border bg-pos-bg px-3 text-slate-100"
            placeholder="Ürün veya barkod ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {!search.trim() && (
            <div className="flex gap-2 overflow-x-auto p-3 bg-slate-950/50">
              {kategoriler.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKatId(k.id)}
                  className={`shrink-0 min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium ${
                    katId === k.id
                      ? "bg-pos-primary text-white"
                      : "bg-pos-card text-slate-300 border border-pos-border"
                  }`}
                  style={
                    katId === k.id && k.renk ? { backgroundColor: k.renk } : undefined
                  }
                >
                  {k.ad}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 content-start">
            {filtreUrun.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => urunTasla(u)}
                className="flex flex-col items-stretch justify-between rounded-xl border border-pos-border bg-pos-card p-3 min-h-[88px] text-left active:scale-[0.98]"
              >
                <span className="text-slate-100 font-medium leading-tight">{u.ad}</span>
                <span className="mt-2 font-mono text-blue-300">{formatTry(u.fiyat)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {geriUyari && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setGeriUyari(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-pos-border bg-pos-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-slate-200">
              Taslak satırlar silinecek. Çıkmak istiyor musunuz?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 min-h-[48px] rounded-lg border border-pos-border text-slate-300"
                onClick={() => setGeriUyari(false)}
              >
                Hayır
              </button>
              <button
                type="button"
                className="flex-1 min-h-[48px] rounded-lg bg-amber-700 text-white font-medium"
                onClick={geriOnayla}
              >
                Evet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
