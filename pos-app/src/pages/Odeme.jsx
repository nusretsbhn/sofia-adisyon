import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../api/client.js";
import { formatTry } from "../lib/format.js";
import { tryToKurus } from "../lib/parseMoney.js";
import AdisyonKalemList from "../components/AdisyonKalemList.jsx";

export default function Odeme() {
  const { id } = useParams();
  const nav = useNavigate();
  const adisyonId = Number(id);
  const [adisyon, setAdisyon] = useState(null);
  const [cariler, setCariler] = useState([]);
  const [cariId, setCariId] = useState("");
  const [nakitTry, setNakitTry] = useState("");
  const [kartTry, setKartTry] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState("");
  /** null | 'NAKIT' | 'KREDI_KARTI' | 'KARISIK' | 'CARI' */
  const [onayModal, setOnayModal] = useState(null);
  const [seciliKalemIds, setSeciliKalemIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [aRes, cRes] = await Promise.all([
          api.get(`/api/adisyonlar/${id}`),
          api.get("/api/cariler"),
        ]);
        if (cancelled) return;
        setAdisyon(aRes.data.adisyon);
        if (aRes.data.adisyon?.durum !== "ACIK") {
          nav("/", { replace: true });
          return;
        }
        setCariler(cRes.data.cariler ?? []);
      } catch {
        if (!cancelled) setErr("Veri yüklenemedi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, nav]);

  function toggleKalem(kid) {
    setSeciliKalemIds((prev) =>
      prev.includes(kid) ? prev.filter((x) => x !== kid) : [...prev, kid],
    );
  }

  const secilenAraToplam = useMemo(() => {
    if (!adisyon?.kalemler) return 0;
    const set = new Set(seciliKalemIds);
    return adisyon.kalemler.filter((k) => set.has(k.id)).reduce((s, k) => s + (k.toplam_fiyat ?? 0), 0);
  }, [adisyon, seciliKalemIds]);

  async function odemeAl(tur, extra) {
    setErr("");
    setPaying(true);
    try {
      await api.post(`/api/adisyonlar/${id}/odeme`, { odeme_turu: tur, ...extra });
      nav("/", { replace: true });
    } catch (e) {
      setErr(e.response?.data?.error || "Ödeme tamamlanamadı");
    } finally {
      setPaying(false);
    }
  }

  async function odemeOnayVer() {
    const m = onayModal;
    setOnayModal(null);
    if (!m) return;
    if (m === "NAKIT" || m === "KREDI_KARTI") {
      await odemeAl(m);
      return;
    }
    if (m === "KARISIK") {
      const n = tryToKurus(nakitTry);
      const k = tryToKurus(kartTry);
      if (n == null || k == null || !adisyon) return;
      await odemeAl("KARISIK", {
        odemeler: [
          { odeme_turu: "NAKIT", tutar: n },
          { odeme_turu: "KREDI_KARTI", tutar: k },
        ],
      });
      return;
    }
    if (m === "CARI") {
      const cid = Number(cariId);
      if (!cid) {
        setErr("Cari seçin");
        return;
      }
      await odemeAl("CARI", { cari_id: cid });
    }
  }

  function odemeCariIste() {
    const cid = Number(cariId);
    if (!cid) {
      setErr("Cari seçin");
      return;
    }
    setErr("");
    setOnayModal("CARI");
  }

  function odemeKarisikIste() {
    const n = tryToKurus(nakitTry);
    const k = tryToKurus(kartTry);
    if (n == null || k == null) {
      setErr("Nakit ve kart tutarlarını girin (örn. 10,50)");
      return;
    }
    if (!adisyon) return;
    if (n + k !== adisyon.toplam_tutar) {
      setErr(
        `Toplam ${formatTry(adisyon.toplam_tutar)} olmalı (şu an ${formatTry(n + k)})`,
      );
      return;
    }
    setErr("");
    setOnayModal("KARISIK");
  }

  if (loading || !adisyon) {
    return (
      <div className="min-h-screen bg-pos-bg p-4">
        <Link to="/" state={{ aktifAdisyonId: adisyonId }} className="text-blue-400">
          ← Geri
        </Link>
        <p className="mt-6 text-slate-500">{err || "Yükleniyor…"}</p>
      </div>
    );
  }

  const toplam = adisyon.toplam_tutar;

  return (
    <div className="min-h-screen bg-pos-bg flex flex-col lg:flex-row lg:items-stretch">
      <aside className="shrink-0 w-full lg:w-[min(100%,420px)] lg:max-w-[440px] border-b lg:border-b-0 lg:border-r border-pos-border flex flex-col p-4 min-h-0 lg:h-screen lg:sticky lg:top-0">
        <Link
          to="/"
          state={{ aktifAdisyonId: adisyonId }}
          className="text-sm text-blue-400 shrink-0"
        >
          ← Ana sayfa
        </Link>
        <h2 className="mt-3 text-lg font-semibold text-slate-200">Adisyon</h2>
        <p className="text-sm text-slate-400 mt-1">
          Masa{" "}
          <span className="text-blue-400 font-bold tabular-nums text-lg">
            {(adisyon.masa_no ?? 0) > 0 ? adisyon.masa_no : "—"}
          </span>
          <span className="mx-1">·</span>
          {adisyon.musteri_adi || "Misafir"}
        </p>
        <p className="text-[10px] text-slate-600 font-mono truncate mt-0.5">{adisyon.numara}</p>

        <div className="mt-3 flex-1 min-h-0 flex flex-col">
          <AdisyonKalemList
            kalemler={adisyon.kalemler ?? []}
            seciliKalemIds={seciliKalemIds}
            onToggleKalem={toggleKalem}
            onClearSelection={() => setSeciliKalemIds([])}
            minHeight="min-h-[140px]"
            maxHeightClass="max-h-[min(42vh,360px)] lg:max-h-[calc(100vh-280px)]"
          />
          <div className="mt-3 flex items-center justify-between border-t border-pos-border pt-3 shrink-0">
            <span className="text-slate-400 font-medium">Toplam</span>
            <span className="font-mono text-xl text-slate-100">{formatTry(toplam)}</span>
          </div>
          {seciliKalemIds.length > 0 && (
            <p className="text-xs text-slate-500 mt-2 shrink-0">
              Seçilen ara toplam:{" "}
              <span className="font-mono text-slate-300">{formatTry(secilenAraToplam)}</span>
            </p>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col p-4 pb-10 overflow-y-auto min-h-0">
        <p className="text-slate-500 text-sm lg:hidden">Ödenecek</p>
        <div className="mt-2 lg:mt-0 flex flex-col items-center lg:items-start">
          <p className="text-slate-500 text-sm hidden lg:block">Ödenecek</p>
          <p className="mt-1 text-center lg:text-left font-mono text-4xl text-slate-100">
            {formatTry(toplam)}
          </p>
        </div>

        {err && <p className="mt-4 text-center lg:text-left text-red-400 text-sm">{err}</p>}

        <div className="mt-8 w-full max-w-md mx-auto lg:mx-0 space-y-6">
          <div>
            <p className="text-xs text-slate-500 mb-2">Hızlı ödeme</p>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                disabled={paying || toplam === 0}
                onClick={() => setOnayModal("NAKIT")}
                className="min-h-[56px] rounded-xl bg-emerald-600 text-xl font-semibold text-white disabled:opacity-50"
              >
                Nakit
              </button>
              <button
                type="button"
                disabled={paying || toplam === 0}
                onClick={() => setOnayModal("KREDI_KARTI")}
                className="min-h-[56px] rounded-xl bg-slate-700 text-xl font-semibold text-white border border-pos-border disabled:opacity-50"
              >
                Kredi kartı
              </button>
            </div>
          </div>

          <div className="border-t border-pos-border pt-6">
            <p className="text-xs text-slate-500 mb-2">Cari hesaba yaz</p>
            <select
              className="w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3 text-slate-100 mb-3"
              value={cariId}
              onChange={(e) => setCariId(e.target.value)}
            >
              <option value="">Cari seçin…</option>
              {cariler.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ad}
                  {c.toplam_borc > 0 ? ` (${formatTry(c.toplam_borc)} borç)` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={paying || toplam === 0 || !cariId}
              onClick={odemeCariIste}
              className="w-full min-h-[52px] rounded-xl bg-amber-700/80 text-lg font-semibold text-white disabled:opacity-50"
            >
              Cariye aktar
            </button>
          </div>

          <div className="border-t border-pos-border pt-6">
            <p className="text-xs text-slate-500 mb-2">Karışık (nakit + kart = toplam)</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-600">Nakit (₺)</label>
                <input
                  className="mt-1 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3 text-slate-100"
                  value={nakitTry}
                  onChange={(e) => setNakitTry(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600">Kart (₺)</label>
                <input
                  className="mt-1 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3 text-slate-100"
                  value={kartTry}
                  onChange={(e) => setKartTry(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={paying || toplam === 0}
              onClick={odemeKarisikIste}
              className="w-full min-h-[52px] rounded-xl border border-blue-500/50 bg-blue-950/40 text-lg font-semibold text-blue-200 disabled:opacity-50"
            >
              Karışık ödemeyi tamamla
            </button>
          </div>
        </div>
      </main>

      {onayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="odeme-onay-baslik"
          onClick={() => !paying && setOnayModal(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-pos-border bg-pos-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="odeme-onay-baslik" className="text-lg font-semibold text-slate-100">
              Ödeme alınıyor
            </h2>
            <p className="mt-1 text-sm font-medium text-emerald-400/90">
              {onayModal === "NAKIT" && "Nakit ödeme"}
              {onayModal === "KREDI_KARTI" && "Kredi kartı ödemesi"}
              {onayModal === "KARISIK" && "Karışık ödeme (nakit + kart)"}
              {onayModal === "CARI" && "Cari hesaba işle"}
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed text-sm">
              {onayModal === "CARI"
                ? "Tutar seçili cari hesabına yazılacak ve adisyon kapatılacak. İşlemi onaylıyor musunuz?"
                : "Ödeme alınacak ve adisyon kapatılacak. İşlemi onaylıyor musunuz?"}
            </p>
            <p className="mt-2 font-mono text-xl text-slate-100">{formatTry(toplam)}</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={paying}
                onClick={() => setOnayModal(null)}
                className="flex-1 min-h-[52px] rounded-lg border border-pos-border text-slate-300 font-medium disabled:opacity-50"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={paying}
                onClick={odemeOnayVer}
                className="flex-1 min-h-[52px] rounded-lg bg-emerald-600 text-lg font-semibold text-white disabled:opacity-50"
              >
                {paying ? "…" : "Evet, onaylıyorum"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
