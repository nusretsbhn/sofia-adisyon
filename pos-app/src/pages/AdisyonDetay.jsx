import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../api/client.js";
import { formatTry } from "../lib/format.js";
import { tryToKurus } from "../lib/parseMoney.js";

function posUser() {
  try {
    return JSON.parse(localStorage.getItem("turadisyon_pos_user") || "null");
  } catch {
    return null;
  }
}

export default function AdisyonDetay() {
  const { id } = useParams();
  const nav = useNavigate();
  const [adisyon, setAdisyon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [musteri, setMusteri] = useState("");
  const musteriDirtyRef = useRef(false);
  const [kalemBusy, setKalemBusy] = useState(null);
  const [yazdirMsg, setYazdirMsg] = useState("");
  const [bolSecilen, setBolSecilen] = useState([]);
  const [receteUi, setReceteUi] = useState(null);
  const [notlar, setNotlar] = useState("");
  const [indirimStr, setIndirimStr] = useState("0");
  const [fiyatModal, setFiyatModal] = useState(null);
  const [transferModal, setTransferModal] = useState(null);
  const [acikAdisyonlar, setAcikAdisyonlar] = useState([]);
  const [transferHedefId, setTransferHedefId] = useState("");
  const [ayarModal, setAyarModal] = useState(false);

  const garson = posUser()?.rol === "GARSON";

  const load = useCallback(async () => {
    setErr("");
    try {
      const { data } = await api.get(`/api/adisyonlar/${id}`);
      const a = data.adisyon;
      setAdisyon(a);
      setNotlar(a?.notlar ?? "");
      const ind = a?.indirim_tutari ?? 0;
      setIndirimStr((ind / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      if (!musteriDirtyRef.current) {
        setMusteri(a?.musteri_adi ?? "");
      }
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
    musteriDirtyRef.current = false;
    setMusteri("");
    setBolSecilen([]);
  }, [id]);

  async function kaydetNotVeIndirim() {
    setErr("");
    const raw = String(indirimStr).trim();
    const k = raw === "" ? 0 : tryToKurus(indirimStr);
    if (k == null || k < 0) {
      setErr("Geçerli indirim tutarı girin");
      return;
    }
    try {
      await api.patch(`/api/adisyonlar/${id}`, {
        notlar: notlar.trim() || null,
        indirim_tutari: k,
      });
      const { data } = await api.get(`/api/adisyonlar/${id}`);
      setAdisyon(data.adisyon);
      setAyarModal(false);
    } catch (e) {
      setErr(e?.response?.data?.error || "Kaydedilemedi");
    }
  }

  async function kaydetMusteri() {
    try {
      await api.patch(`/api/adisyonlar/${id}`, { musteri_adi: musteri.trim() });
      musteriDirtyRef.current = false;
      const { data } = await api.get(`/api/adisyonlar/${id}`);
      setAdisyon(data.adisyon);
    } catch {
      setErr("Müşteri adı kaydedilemedi");
    }
  }

  async function kalemAdet(kalemId, yeniAdet) {
    if (yeniAdet < 1) {
      await kalemSil(kalemId);
      return;
    }
    setKalemBusy(kalemId);
    setErr("");
    try {
      await api.patch(`/api/adisyonlar/${id}/kalemler/${kalemId}`, { adet: yeniAdet });
      const { data } = await api.get(`/api/adisyonlar/${id}`);
      setAdisyon(data.adisyon);
    } catch {
      setErr("Adet güncellenemedi");
    } finally {
      setKalemBusy(null);
    }
  }

  async function receteAc(urunId, urunAd) {
    setReceteUi({ urunAd, rows: null, err: "" });
    try {
      const { data } = await api.get(`/api/receteler/urun/${urunId}`);
      setReceteUi({
        urunAd: data.urun?.ad ?? urunAd,
        rows: data.receteler ?? [],
        err: "",
      });
    } catch {
      setReceteUi({ urunAd, rows: [], err: "Reçete alınamadı." });
    }
  }

  function toggleBolSec(kid) {
    setBolSecilen((prev) =>
      prev.includes(kid) ? prev.filter((x) => x !== kid) : [...prev, kid],
    );
  }

  async function hesapBol() {
    const kalemSayisi = (adisyon?.kalemler ?? []).length;
    if (kalemSayisi < 2 || bolSecilen.length < 1 || bolSecilen.length >= kalemSayisi) {
      setErr("Bölme için en az iki satır olmalı; seçim, hepsinden az olmalı.");
      return;
    }
    const ad = window.prompt("Yeni hesap müşteri adı (isteğe bağlı):", "");
    if (ad === null) return;
    setErr("");
    setKalemBusy(-1);
    try {
      const { data } = await api.post(`/api/adisyonlar/${id}/bol`, {
        kalem_ids: bolSecilen,
        yeni_musteri_adi: ad.trim(),
      });
      setBolSecilen([]);
      nav(`/adisyon/${data.yeni_adisyon.id}`);
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        (typeof e?.message === "string" ? e.message : null) ||
        "Hesap bölünemedi";
      setErr(msg);
    } finally {
      setKalemBusy(null);
    }
  }

  async function fisYazdir() {
    setYazdirMsg("");
    try {
      const { data } = await api.post(`/api/adisyonlar/${id}/yazdir`);
      if (window.turadisyon?.printReceipt && data?.metin) {
        const printerName = localStorage.getItem("turadisyon_printer_name") || "kasa";
        const r = await window.turadisyon.printReceipt({
          printerName,
          text: data.metin,
        });
        setYazdirMsg(r?.ok ? "Fiş yazdırıldı." : r?.error || "Yazdırılamadı.");
        return;
      }

      if (data.yazdirildi) {
        setYazdirMsg("Fiş yazıcıya gönderildi.");
      } else {
        if (data.metin && import.meta.env.DEV) {
          console.log("[Fiş önizleme]\n", data.metin);
        }
        setYazdirMsg(
          data.uyari ||
            "Yazıcı gönderilemedi (geliştirme: metin konsolda).",
        );
      }
    } catch {
      setYazdirMsg("Yazdırma isteği başarısız.");
    }
  }

  async function ikramToggle(k) {
    if (garson) return;
    setKalemBusy(k.id);
    setErr("");
    try {
      await api.patch(`/api/adisyonlar/${id}/kalemler/${k.id}`, { ikram: !k.ikram });
      const { data } = await api.get(`/api/adisyonlar/${id}`);
      setAdisyon(data.adisyon);
    } catch (e) {
      setErr(e?.response?.data?.error || "İkram güncellenemedi");
    } finally {
      setKalemBusy(null);
    }
  }

  async function fiyatKaydet() {
    if (!fiyatModal || garson) return;
    const k = tryToKurus(fiyatModal.birimTry);
    if (k == null || k < 0) {
      setErr("Geçerli birim fiyat girin");
      return;
    }
    setKalemBusy(fiyatModal.kalemId);
    setErr("");
    try {
      await api.patch(`/api/adisyonlar/${id}/kalemler/${fiyatModal.kalemId}`, {
        birim_fiyat: k,
      });
      setFiyatModal(null);
      const { data } = await api.get(`/api/adisyonlar/${id}`);
      setAdisyon(data.adisyon);
    } catch (e) {
      setErr(e?.response?.data?.error || "Fiyat güncellenemedi");
    } finally {
      setKalemBusy(null);
    }
  }

  async function acikAdisyonlariYukle() {
    try {
      const { data } = await api.get("/api/adisyonlar", { params: { durum: "ACIK" } });
      setAcikAdisyonlar(data.adisyonlar ?? []);
    } catch {
      setAcikAdisyonlar([]);
    }
  }

  async function transferKalemCalistir() {
    if (!transferModal || !transferHedefId) return;
    const hedef = Number(transferHedefId);
    if (!Number.isInteger(hedef) || hedef === Number(id)) {
      setErr("Geçerli hedef adisyon seçin");
      return;
    }
    setKalemBusy(transferModal.kalemId);
    setErr("");
    try {
      await api.post(`/api/adisyonlar/${id}/kalemler/${transferModal.kalemId}/transfer`, {
        hedef_adisyon_id: hedef,
      });
      setTransferModal(null);
      setTransferHedefId("");
      const { data } = await api.get(`/api/adisyonlar/${id}`);
      setAdisyon(data.adisyon);
    } catch (e) {
      setErr(e?.response?.data?.error || "Transfer başarısız");
    } finally {
      setKalemBusy(null);
    }
  }

  async function kalemSil(kalemId) {
    setKalemBusy(kalemId);
    setErr("");
    try {
      await api.delete(`/api/adisyonlar/${id}/kalemler/${kalemId}`);
      const { data } = await api.get(`/api/adisyonlar/${id}`);
      setAdisyon(data.adisyon);
    } catch {
      setErr("Satır silinemedi");
    } finally {
      setKalemBusy(null);
    }
  }

  if (loading && !adisyon) {
    return (
      <div className="min-h-screen bg-pos-bg p-4 text-slate-500">
        <Link to="/" className="text-blue-400">
          ← Liste
        </Link>
        <p className="mt-6">Yükleniyor…</p>
      </div>
    );
  }

  if (!adisyon || adisyon.durum !== "ACIK") {
    return (
      <div className="min-h-screen bg-pos-bg p-4">
        <Link to="/" className="text-blue-400">
          ← Liste
        </Link>
        <p className="mt-4 text-slate-400">{err || "Adisyon kapalı veya bulunamadı"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pos-bg flex flex-col">
      <header className="shrink-0 border-b border-pos-border p-4">
        <Link to="/" className="text-sm text-blue-400">
          ← Adisyonlar
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Masa</p>
            <p className="text-5xl font-bold tabular-nums text-blue-400 leading-none">
              {(adisyon.masa_no ?? 0) > 0 ? adisyon.masa_no : "—"}
            </p>
            <p className="mt-2 text-[10px] text-slate-600 font-mono break-all max-w-[200px]">
              {adisyon.numara}
            </p>
          </div>
          <div className="text-right text-sm space-y-0.5">
            <p className="text-slate-500">
              Brüt{" "}
              <span className="font-mono text-slate-300">
                {formatTry(
                  (adisyon.toplam_tutar ?? 0) + (adisyon.indirim_tutari ?? 0),
                )}
              </span>
            </p>
            {(adisyon.indirim_tutari ?? 0) > 0 && (
              <p className="text-amber-400/90">
                İndirim{" "}
                <span className="font-mono">−{formatTry(adisyon.indirim_tutari)}</span>
              </p>
            )}
            <p className="text-slate-500 pt-1">Ödenecek</p>
            <p className="font-mono text-2xl text-slate-100">
              {formatTry(adisyon.toplam_tutar)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAyarModal(true)}
          className="mt-3 w-full min-h-[48px] rounded-xl border border-pos-border bg-pos-card text-base font-medium text-slate-100"
        >
          Not ve genel indirim
        </button>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 min-h-[44px] rounded-lg border border-pos-border bg-pos-bg px-3 text-slate-100"
            placeholder="Müşteri adı"
            value={musteri}
            onChange={(e) => {
              setMusteri(e.target.value);
              musteriDirtyRef.current = true;
            }}
          />
          <button
            type="button"
            onClick={kaydetMusteri}
            className="min-h-[44px] shrink-0 rounded-lg bg-slate-700 px-4 text-sm text-white"
          >
            Kaydet
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={fisYazdir}
            className="min-h-[52px] rounded-xl border border-pos-border bg-pos-card text-base font-semibold text-slate-100"
          >
            Fiş yazdır
          </button>
          <button
            type="button"
            onClick={() => nav(`/adisyon/${id}/odeme`)}
            className="min-h-[52px] rounded-xl bg-emerald-600 text-base font-semibold text-white"
          >
            Ödeme al
          </button>
        </div>
        <button
          type="button"
          onClick={() => nav(`/adisyon/${id}/siparis`)}
          className="mt-3 w-full min-h-[52px] rounded-xl border-2 border-blue-500/50 bg-blue-950/40 text-base font-semibold text-blue-200"
        >
          Ürün ekle
        </button>
        {yazdirMsg && (
          <p className="mt-2 text-xs text-amber-400/90">{yazdirMsg}</p>
        )}
      </header>

      {err && <p className="px-4 py-2 text-sm text-red-400">{err}</p>}

      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex-1 flex flex-col min-h-[40vh] lg:min-h-0">
          <h3 className="shrink-0 px-4 py-2 text-sm text-slate-500 border-b border-pos-border">
            Adisyon satırları
          </h3>
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {(adisyon.kalemler ?? []).length === 0 ? (
              <p className="text-slate-500 text-sm">
                Henüz ürün yok. Ürün eklemek için «Ürün ekle» düğmesini kullanın.
              </p>
            ) : (
              <ul className="space-y-2">
                {(adisyon.kalemler ?? []).length >= 2 && (
                  <li className="rounded-lg border border-pos-border bg-slate-950/40 px-3 py-2">
                    <p className="text-xs text-slate-500 mb-2">
                      Hesap böl: taşınacak satırları işaretleyin; en az biri bu adisyonda kalır.
                    </p>
                    <button
                      type="button"
                      disabled={
                        kalemBusy !== null ||
                        bolSecilen.length < 1 ||
                        bolSecilen.length >= (adisyon.kalemler ?? []).length
                      }
                      onClick={hesapBol}
                      className="w-full min-h-[44px] rounded-lg border border-amber-500/40 bg-amber-950/30 text-sm font-medium text-amber-200/90 disabled:opacity-40"
                    >
                      Seçilenleri yeni hesaba taşı
                    </button>
                  </li>
                )}
                {adisyon.kalemler.map((k) => (
                  <li
                    key={k.id}
                    className="rounded-lg bg-pos-card border border-pos-border px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
                      {(adisyon.kalemler ?? []).length >= 2 && (
                        <label className="flex items-center shrink-0 pr-1">
                          <input
                            type="checkbox"
                            className="h-5 w-5 rounded border-pos-border bg-pos-bg"
                            checked={bolSecilen.includes(k.id)}
                            onChange={() => toggleBolSec(k.id)}
                            disabled={kalemBusy !== null}
                            aria-label="Bölme için seç"
                          />
                        </label>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-200">
                          {k.adet}× {k.urun_adi}
                        </span>
                        {k.ikram && (
                          <span className="ml-2 text-xs text-amber-400">İkram</span>
                        )}
                        {k.fiyat_degistirildi && !k.ikram && (
                          <span className="ml-2 text-xs text-violet-400">Özel fiyat</span>
                        )}
                        {k.urun_id != null && (
                          <button
                            type="button"
                            className="ml-2 align-baseline text-xs text-cyan-400/90 underline-offset-2 hover:underline"
                            onClick={() => receteAc(k.urun_id, k.urun_adi)}
                          >
                            Tarif
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-slate-300 w-20 text-right">
                          {formatTry(k.toplam_fiyat)}
                        </span>
                        <button
                          type="button"
                          disabled={kalemBusy === k.id}
                          className="min-w-[44px] min-h-[44px] rounded-lg bg-slate-800 text-xl text-slate-200 disabled:opacity-40"
                          onClick={() => kalemAdet(k.id, k.adet - 1)}
                          aria-label="Azalt"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          disabled={kalemBusy === k.id}
                          className="min-w-[44px] min-h-[44px] rounded-lg bg-slate-800 text-xl text-slate-200 disabled:opacity-40"
                          onClick={() => kalemAdet(k.id, k.adet + 1)}
                          aria-label="Arttır"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          disabled={kalemBusy === k.id}
                          className="min-h-[44px] rounded-lg border border-red-500/50 px-3 text-sm text-red-400 disabled:opacity-40"
                          onClick={() => kalemSil(k.id)}
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 border-t border-pos-border/60 pt-2">
                      {!garson && (
                        <button
                          type="button"
                          disabled={kalemBusy === k.id || k.ikram}
                          title={k.ikram ? "İkram satırında fiyat değişmez" : ""}
                          className="min-h-[40px] rounded-lg border border-violet-500/40 px-3 text-xs font-medium text-violet-200 disabled:opacity-40"
                          onClick={() =>
                            setFiyatModal({
                              kalemId: k.id,
                              urunAd: k.urun_adi,
                              birimTry: (k.birim_fiyat / 100).toLocaleString("tr-TR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }),
                            })
                          }
                        >
                          Birim fiyat
                        </button>
                      )}
                      {!garson && (
                        <button
                          type="button"
                          disabled={kalemBusy === k.id}
                          className="min-h-[40px] rounded-lg border border-amber-500/40 px-3 text-xs font-medium text-amber-200/90 disabled:opacity-40"
                          onClick={() => ikramToggle(k)}
                        >
                          {k.ikram ? "İkramı kaldır" : "İkram"}
                        </button>
                      )}
                      {garson && (
                        <span className="text-[11px] text-slate-600 self-center">
                          İkram / fiyat: kasiyer
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={kalemBusy === k.id}
                        className="min-h-[40px] rounded-lg border border-sky-500/40 px-3 text-xs font-medium text-sky-200/90 disabled:opacity-40"
                        onClick={async () => {
                          setTransferModal({ kalemId: k.id, urunAd: k.urun_adi });
                          setTransferHedefId("");
                          await acikAdisyonlariYukle();
                        }}
                      >
                        Başka hesaba taşı
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {ayarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setAyarModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-pos-border bg-pos-card p-4 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-100">Not ve indirim</h2>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:bg-slate-800"
                onClick={() => setAyarModal(false)}
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>
            <label className="mt-4 block text-xs text-slate-500">Adisyon notu</label>
            <textarea
              className="mt-1 w-full min-h-[88px] rounded-lg border border-pos-border bg-pos-bg px-3 py-2 text-sm text-slate-100"
              placeholder="Mutfak / servis notu…"
              value={notlar}
              onChange={(e) => setNotlar(e.target.value)}
            />
            <label className="mt-4 block text-xs text-slate-500">Genel indirim (₺)</label>
            <input
              type="text"
              inputMode="decimal"
              className="mt-1 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3 text-slate-100"
              value={indirimStr}
              onChange={(e) => setIndirimStr(e.target.value)}
            />
            <button
              type="button"
              onClick={kaydetNotVeIndirim}
              className="mt-4 w-full min-h-[52px] rounded-lg bg-blue-600 text-base font-semibold text-white"
            >
              Kaydet
            </button>
          </div>
        </div>
      )}

      {fiyatModal && !garson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setFiyatModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-pos-border bg-pos-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-slate-400">Birim fiyat (₺)</p>
            <p className="mt-1 font-medium text-slate-100">{fiyatModal.urunAd}</p>
            <input
              type="text"
              inputMode="decimal"
              className="mt-3 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3 text-lg text-slate-100"
              value={fiyatModal.birimTry}
              onChange={(e) =>
                setFiyatModal({ ...fiyatModal, birimTry: e.target.value })
              }
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setFiyatModal(null)}
                className="flex-1 min-h-[48px] rounded-lg border border-pos-border text-slate-300"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={fiyatKaydet}
                disabled={kalemBusy === fiyatModal.kalemId}
                className="flex-1 min-h-[48px] rounded-lg bg-violet-600 text-white font-medium disabled:opacity-50"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {transferModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setTransferModal(null);
            setTransferHedefId("");
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-pos-border bg-pos-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-slate-400">Satırı taşı</p>
            <p className="mt-1 text-slate-100">{transferModal.urunAd}</p>
            <label className="mt-4 block text-xs text-slate-500">Hedef açık adisyon</label>
            <select
              className="mt-1 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3 text-slate-100"
              value={transferHedefId}
              onChange={(e) => setTransferHedefId(e.target.value)}
            >
              <option value="">Seçin</option>
                {acikAdisyonlar
                .filter((a) => a.id !== Number(id))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    Masa {(a.masa_no ?? 0) > 0 ? a.masa_no : "?"}
                    {a.musteri_adi ? ` · ${a.musteri_adi}` : ""}
                  </option>
                ))}
            </select>
            {acikAdisyonlar.filter((a) => a.id !== Number(id)).length === 0 && (
              <p className="mt-2 text-xs text-amber-500/90">
                Başka açık adisyon yok; listeden yeni adisyon açın.
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTransferModal(null);
                  setTransferHedefId("");
                }}
                className="flex-1 min-h-[48px] rounded-lg border border-pos-border text-slate-300"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={transferKalemCalistir}
                disabled={
                  kalemBusy === transferModal.kalemId ||
                  !transferHedefId ||
                  acikAdisyonlar.filter((a) => a.id !== Number(id)).length === 0
                }
                className="flex-1 min-h-[48px] rounded-lg bg-sky-600 text-white font-medium disabled:opacity-50"
              >
                Taşı
              </button>
            </div>
          </div>
        </div>
      )}

      {receteUi && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recete-baslik"
          onClick={() => setReceteUi(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-pos-border bg-pos-card p-4 shadow-xl max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="recete-baslik" className="text-lg font-semibold text-slate-100">
                {receteUi.urunAd}
              </h2>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:bg-slate-800"
                onClick={() => setReceteUi(null)}
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Referans reçete (içerik)</p>
            {receteUi.err ? (
              <p className="mt-4 text-sm text-amber-400">{receteUi.err}</p>
            ) : receteUi.rows === null ? (
              <p className="mt-4 text-sm text-slate-500">Yükleniyor…</p>
            ) : receteUi.rows.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Bu ürün için tarif satırı yok.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {receteUi.rows.map((r) => (
                  <li
                    key={r.id}
                    className="flex justify-between gap-2 border-b border-pos-border pb-2 text-slate-200"
                  >
                    <span>{r.hammadde_ad}</span>
                    <span className="shrink-0 font-mono text-slate-400">
                      {r.miktar} {r.birim}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
