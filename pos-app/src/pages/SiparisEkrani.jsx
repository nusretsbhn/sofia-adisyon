import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import api from "../api/client.js";
import { formatTry } from "../lib/format.js";

let tempKey = 0;
function nextKey() {
  tempKey += 1;
  return tempKey;
}

/** POS sipariş ekranında gösterilmeyecek kategori adları (admin’de durur). */
function kategoriPosVitrin(c) {
  const ad = String(c?.ad ?? "")
    .trim()
    .toLowerCase();
  return ad !== "hammaddeler";
}

/** Boş veya geçersizse 1; önce rakam (örn. 3) sonra ürün = 3 adet */
function adetFromBuffer(buf) {
  const s = String(buf ?? "").trim();
  if (s === "") return 1;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(999, n);
}

function SortableUrunCard({ urun, onEkle }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: urun.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex rounded-lg border border-pos-border bg-pos-card min-h-[64px] sm:min-h-[72px] overflow-hidden ${
        isDragging ? "opacity-90 ring-2 ring-sky-400/70 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        className="shrink-0 w-7 sm:w-8 flex items-center justify-center bg-slate-800/90 text-slate-500 touch-none cursor-grab active:cursor-grabbing"
        {...listeners}
        {...attributes}
        aria-label="Sırayı değiştir"
      >
        <span className="text-sm leading-none select-none">⠿</span>
      </button>
      <button
        type="button"
        onClick={() => onEkle(urun)}
        className="flex flex-1 flex-col items-stretch justify-between p-2 sm:p-2.5 min-w-0 text-left active:scale-[0.98]"
      >
        <span className="text-slate-100 text-xs sm:text-sm font-medium leading-snug line-clamp-2">
          {urun.ad}
        </span>
        <span className="mt-1 sm:mt-1.5 font-mono text-[11px] sm:text-xs text-blue-300 tabular-nums">
          {formatTry(urun.fiyat)}
        </span>
      </button>
    </div>
  );
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

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
      setKategoriler(cats.filter((c) => c.aktif && kategoriPosVitrin(c)));
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
    const fn = () => {
      load();
    };
    window.addEventListener("turadisyon:catalog-refresh", fn);
    return () => window.removeEventListener("turadisyon:catalog-refresh", fn);
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

  /** Hammaddeler filtrelendiyse veya liste değiştiyse geçersiz seçimi sıfırla */
  useEffect(() => {
    if (katId != null && !kategoriler.some((c) => c.id === katId)) {
      setKatId(null);
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
    const list = urunler.filter((u) => {
      if (!u.aktif) return false;
      if (q) {
        const byName = u.ad.toLowerCase().includes(q);
        const byBarkod = u.barkod && u.barkod.toLowerCase().includes(q);
        return byName || byBarkod;
      }
      return u.kategori_id === katId;
    });
    return [...list].sort(
      (a, b) =>
        (a.sira ?? 0) - (b.sira ?? 0) || a.ad.localeCompare(b.ad, "tr"),
    );
  }, [urunler, katId, search]);

  const urunSiraKaydet = useCallback(
    async (event) => {
      const { active, over } = event;
      if (!katId || search.trim() || !over) return;
      const activeId = Number(active.id);
      const overId = Number(over.id);
      if (!Number.isFinite(activeId) || !Number.isFinite(overId) || activeId === overId) {
        return;
      }

      const items = urunler
        .filter((u) => u.aktif && u.kategori_id === katId)
        .sort(
          (a, b) =>
            (a.sira ?? 0) - (b.sira ?? 0) || a.ad.localeCompare(b.ad, "tr"),
        );
      const oldIndex = items.findIndex((u) => u.id === activeId);
      const newIndex = items.findIndex((u) => u.id === overId);
      if (oldIndex < 0 || newIndex < 0) return;

      const newOrder = arrayMove(items, oldIndex, newIndex);
      const urun_idler = newOrder.map((u) => u.id);

      setUrunler((prev) => {
        const others = prev.filter((u) => u.kategori_id !== katId);
        const updated = newOrder.map((u, idx) => ({ ...u, sira: idx }));
        return [...others, ...updated];
      });

      try {
        await api.patch("/api/urunler/sira", { kategori_id: katId, urun_idler });
      } catch {
        setErr("Sıra kaydedilemedi.");
        load();
      }
    },
    [katId, search, urunler, load],
  );

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
      <header className="shrink-0 border-b border-pos-border px-3 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <button
          type="button"
          onClick={geriGit}
          className="text-xs text-blue-400 shrink-0"
        >
          ← Ana sayfa
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-slate-100 leading-tight">
            Ürün ekle · Masa{" "}
            <span className="text-blue-400 tabular-nums">{masa}</span>
          </h1>
          <p className="text-[10px] text-slate-600 font-mono truncate max-w-[min(100%,280px)] leading-tight mt-0.5">
            {adisyon.numara} · {adisyon.musteri_adi || "Misafir"}
          </p>
        </div>
      </header>

      {err && <p className="px-3 py-2 text-sm text-red-400">{err}</p>}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Sol: taslak + numpad */}
        <div className="lg:w-[300px] shrink-0 border-b lg:border-b-0 lg:border-r border-pos-border flex flex-col p-2 gap-2 bg-slate-950/30 min-h-0">
          <div className="shrink-0">
            <p className="text-[10px] text-slate-500 leading-tight">
              Adet (önce rakam, sonra ürün)
            </p>
            <p className="mt-0.5 font-mono text-2xl text-amber-300/90 tabular-nums min-h-[32px]">
              {adetGiris || " "}
            </p>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5 max-w-[210px]">
              {["9", "8", "7", "6", "5", "4", "3", "2", "1"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => rakamEkle(d)}
                  className="min-h-[36px] rounded-md bg-slate-800 text-base font-semibold text-slate-100 active:bg-slate-700"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={adetTemizle}
                className="min-h-[36px] rounded-md bg-amber-950/50 text-amber-200 text-xs font-medium"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => rakamEkle("0")}
                className="min-h-[36px] rounded-md bg-slate-800 text-base font-semibold text-slate-100"
              >
                0
              </button>
              <button
                type="button"
                onClick={rakamSil}
                className="min-h-[36px] rounded-md bg-slate-800 text-xs text-slate-300"
              >
                Sil
              </button>
            </div>
          </div>

          <form onSubmit={barkodEkle} className="flex gap-1.5 shrink-0">
            <input
              className="flex-1 min-h-[38px] rounded-lg border border-pos-border bg-pos-bg px-2 text-sm text-slate-100"
              placeholder="Barkod"
              value={barkod}
              onChange={(e) => setBarkod(e.target.value)}
            />
            <button
              type="submit"
              className="min-h-[38px] px-2.5 rounded-lg bg-slate-700 text-sm text-white"
            >
              OK
            </button>
          </form>

          <div className="flex-1 flex flex-col border border-pos-border rounded-lg overflow-hidden bg-pos-card/50 min-h-0">
            <p className="text-[10px] text-slate-500 px-2 py-0.5 border-b border-pos-border shrink-0">
              Taslak
            </p>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
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
            className="w-full shrink-0 min-h-[48px] rounded-xl bg-emerald-600 text-base font-bold text-white disabled:opacity-40"
          >
            {gonderiyor ? "Gönderiliyor…" : "Gönder (adisyona işle)"}
          </button>
        </div>

        {/* Sağ: kategori + ürün */}
        <div className="flex-1 flex flex-col min-h-0">
          <input
            type="search"
            className="mx-3 mt-2 min-h-[40px] rounded-lg border border-pos-border bg-pos-bg px-3 text-sm text-slate-100 shrink-0"
            placeholder="Ürün veya barkod ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {!search.trim() && (
            <>
              <div className="shrink-0 px-3 pt-2 pb-1 bg-slate-950/50">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">
                  Kategoriler
                </p>
                <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                  {kategoriler.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setKatId(k.id)}
                      className={`min-h-[36px] min-w-0 rounded-md px-1.5 py-1 text-[11px] sm:text-xs font-medium text-center leading-tight line-clamp-2 border transition-colors ${
                        katId === k.id
                          ? "bg-emerald-800 text-white border-emerald-950 shadow-inner"
                          : "bg-sky-500/95 text-white border-sky-600 hover:bg-sky-500"
                      }`}
                    >
                      {k.ad}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="shrink-0 mx-3 flex items-center gap-2 py-1.5"
                role="separator"
                aria-label="Kategoriler ve ürünler"
              >
                <div className="h-[2px] flex-1 rounded-full bg-gradient-to-r from-transparent via-slate-500/70 to-slate-500/40" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap px-1">
                  Ürünler
                </span>
                <div className="h-[2px] flex-1 rounded-full bg-gradient-to-l from-transparent via-slate-500/70 to-slate-500/40" />
              </div>
              <p className="px-3 text-[10px] text-slate-500 pb-1">
                Ürün sırası: sol tutamacı sürükleyin (kayıtlı kalır).
              </p>
            </>
          )}
          {search.trim() ? (
            <div className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-3 pt-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2 content-start">
              {filtreUrun.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => urunTasla(u)}
                  className="flex flex-col items-stretch justify-between rounded-lg border border-pos-border bg-pos-card p-2 sm:p-2.5 min-h-[64px] sm:min-h-[72px] text-left active:scale-[0.98]"
                >
                  <span className="text-slate-100 text-xs sm:text-sm font-medium leading-snug line-clamp-2">
                    {u.ad}
                  </span>
                  <span className="mt-1 sm:mt-1.5 font-mono text-[11px] sm:text-xs text-blue-300 tabular-nums">
                    {formatTry(u.fiyat)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={urunSiraKaydet}
            >
              <SortableContext
                items={filtreUrun.map((u) => u.id)}
                strategy={rectSortingStrategy}
              >
                <div className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-3 pt-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2 content-start">
                  {filtreUrun.map((u) => (
                    <SortableUrunCard key={u.id} urun={u} onEkle={urunTasla} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
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
