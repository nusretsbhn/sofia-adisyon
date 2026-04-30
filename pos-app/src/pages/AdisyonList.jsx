import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AdisyonKalemList from "../components/AdisyonKalemList.jsx";
import api from "../api/client.js";
import { formatTry } from "../lib/format.js";
import { tryToKurus } from "../lib/parseMoney.js";

const MASA_SAYISI_STORAGE_KEY = "turadisyon_masa_sayisi";
const POS_RESET_AT_STORAGE_KEY = "turadisyon_pos_reset_at";

function ymdLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Seçilen adet için satır tutarı (yuvarlanmış) */
function satirAraTutar(k, bolAdet) {
  if (!k || k.adet < 1) return 0;
  const take = bolAdet ?? k.adet;
  if (k.toplam_fiyat == null) return 0;
  return Math.round((k.toplam_fiyat * take) / k.adet);
}

function posUser() {
  try {
    return JSON.parse(localStorage.getItem("turadisyon_pos_user") || "{}");
  } catch {
    return {};
  }
}

export default function AdisyonList() {
  const nav = useNavigate();
  const location = useLocation();
  const user = posUser();
  const garsonMu = user.rol === "GARSON";

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [yeniModal, setYeniModal] = useState(false);
  const [musteriAd, setMusteriAd] = useState("");
  const [masaNo, setMasaNo] = useState("1");
  const [yeniErr, setYeniErr] = useState("");
  const [masaKilitli, setMasaKilitli] = useState(null);
  const [masaSayisi, setMasaSayisi] = useState(() => {
    const raw = localStorage.getItem(MASA_SAYISI_STORAGE_KEY);
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 24 && n <= 300) return n;
    return 24;
  });

  /** Orta blokta gösterilen adisyon */
  const [aktifId, setAktifId] = useState(null);
  const [detay, setDetay] = useState(null);
  const [detayLoading, setDetayLoading] = useState(false);

  const [seciliKalemIds, setSeciliKalemIds] = useState([]);

  const [modUrunTransfer, setModUrunTransfer] = useState(false);
  const [modMasaTransfer, setModMasaTransfer] = useState(false);

  const [notModal, setNotModal] = useState(false);
  const [notStr, setNotStr] = useState("");
  const [notSaving, setNotSaving] = useState(false);

  const [iadeModal, setIadeModal] = useState(null);
  const [iadeAdet, setIadeAdet] = useState("1");
  const [ikramModal, setIkramModal] = useState(null);
  const [ikramAdet, setIkramAdet] = useState("1");

  const [fiyatModal, setFiyatModal] = useState(null);
  const [fiyatStr, setFiyatStr] = useState("");

  const [odemeModal, setOdemeModal] = useState(false);
  const [odemeErr, setOdemeErr] = useState("");
  const [odemePaying, setOdemePaying] = useState(false);
  /** Böl ödeme akışında ödenen satırları göstermek için */
  const [odenenKalemler, setOdenenKalemler] = useState([]);
  const [nakitTry, setNakitTry] = useState("");
  const [kartTry, setKartTry] = useState("");
  const [havaleTry, setHavaleTry] = useState("");
  const [cariId, setCariId] = useState("");
  const [cariler, setCariler] = useState([]);
  const [cariModal, setCariModal] = useState(false);
  /** Ödeme API çağrısından önce onay: { type, tur? } */
  const [odemeOnay, setOdemeOnay] = useState(null);

  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  /** Hesap böl: satır id -> taşınacak adet */
  const [seciliBolAdet, setSeciliBolAdet] = useState({});
  const [bolAdetModal, setBolAdetModal] = useState(null);
  const [transferAdetModal, setTransferAdetModal] = useState(null);
  const [kasaModal, setKasaModal] = useState(false);
  const [kasaLoading, setKasaLoading] = useState(false);
  const [kasaErr, setKasaErr] = useState("");
  const [kasaCiro, setKasaCiro] = useState(null);
  const [kasaPrinting, setKasaPrinting] = useState(false);
  const [kasaSifreModal, setKasaSifreModal] = useState(false);
  const [kasaSifre, setKasaSifre] = useState("");
  const [kasaSifreErr, setKasaSifreErr] = useState("");
  const [kasaSifreBusy, setKasaSifreBusy] = useState(false);
  const [manuelResetAt, setManuelResetAt] = useState(() => {
    const raw = localStorage.getItem(POS_RESET_AT_STORAGE_KEY);
    if (!raw) return "";
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  });

  const gunRef = useRef(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
  );

  const listMasa = useMemo(() => {
    const resetKesim = manuelResetAt ? new Date(manuelResetAt) : null;
    return list.filter((a) => {
      if (a.durum === "ACIK") {
        const ac = a.acilis_tarihi ? new Date(a.acilis_tarihi) : null;
        if (!ac) return false;
        return resetKesim ? ac >= resetKesim : true;
      }
      if (a.durum === "KAPALI") {
        const k = a.kapanma_tarihi ? new Date(a.kapanma_tarihi) : null;
        if (!k) return false;
        return resetKesim ? k >= resetKesim : true;
      }
      return false;
    });
  }, [list, manuelResetAt]);

  const masaAdisyon = useMemo(() => {
    const m = new Map();
    for (const a of listMasa) {
      const no = a.masa_no;
      const masaNo = Number(no);
      if (!Number.isInteger(masaNo) || masaNo <= 0) continue;
      const prev = m.get(masaNo);
      if (!prev) {
        m.set(masaNo, a);
        continue;
      }
      // Öncelik açık adisyonda; aksi halde daha yeni kayıt.
      if (prev.durum !== "ACIK" && a.durum === "ACIK") {
        m.set(masaNo, a);
        continue;
      }
      if (prev.durum === "ACIK" && a.durum !== "ACIK") continue;
      const prevTime = new Date(prev.acilis_tarihi ?? 0).getTime();
      const curTime = new Date(a.acilis_tarihi ?? 0).getTime();
      if (curTime > prevTime) m.set(masaNo, a);
    }
    return m;
  }, [listMasa]);

  const loadList = useCallback(async () => {
    try {
      const [acikRes, kapaliRes] = await Promise.all([
        api.get("/api/adisyonlar", {
          params: { durum: "ACIK" },
        }),
        api.get("/api/adisyonlar", {
          params: { durum: "KAPALI" },
        }),
      ]);
      const tum = [...(acikRes.data.adisyonlar ?? []), ...(kapaliRes.data.adisyonlar ?? [])];
      tum.sort((a, b) => new Date(b.acilis_tarihi ?? 0) - new Date(a.acilis_tarihi ?? 0));
      setList(tum);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDetay = useCallback(async (id) => {
    if (!id) return;
    setDetayLoading(true);
    try {
      const { data } = await api.get(`/api/adisyonlar/${id}`);
      setDetay(data.adisyon);
    } catch {
      setDetay(null);
    } finally {
      setDetayLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    localStorage.setItem(MASA_SAYISI_STORAGE_KEY, String(masaSayisi));
  }, [masaSayisi]);

  useEffect(() => {
    if (manuelResetAt) {
      localStorage.setItem(POS_RESET_AT_STORAGE_KEY, manuelResetAt);
    } else {
      localStorage.removeItem(POS_RESET_AT_STORAGE_KEY);
    }
  }, [manuelResetAt]);

  /** Ürün ekleme vb. dönüşte bu adisyon seçili kalsın */
  useEffect(() => {
    const raw = location.state?.aktifAdisyonId;
    if (raw == null) return;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) return;
    setAktifId(n);
    nav("/", { replace: true, state: {} });
  }, [location.state, nav]);

  useEffect(() => {
    if (!aktifId) {
      setDetay(null);
      setSeciliKalemIds([]);
      setSeciliBolAdet({});
      return;
    }
    setSeciliKalemIds([]);
    setSeciliBolAdet({});
    refreshDetay(aktifId);
  }, [aktifId, refreshDetay]);

  function logout() {
    localStorage.removeItem("turadisyon_pos_token");
    localStorage.removeItem("turadisyon_pos_user");
    nav("/login", { replace: true });
  }

  function ilkBosMasaNo() {
    for (let m = 1; m <= masaSayisi; m++) {
      const a = masaAdisyon.get(m);
      if (!a || a.durum !== "ACIK") return m;
    }
    return null;
  }

  function yeniModalAc() {
    setYeniErr("");
    setMusteriAd("");
    const bos = ilkBosMasaNo();
    if (bos == null) {
      setToast("Boş masa kalmadı; tüm masalarda açık adisyon var.");
      return;
    }
    setMasaNo(String(bos));
    setMasaKilitli(null);
    setYeniModal(true);
  }

  function bosMasayaTikla(masa) {
    setYeniErr("");
    setMusteriAd("");
    setMasaNo(String(masa));
    setMasaKilitli(masa);
    setYeniModal(true);
  }

  function toggleKalem(id) {
    const k = detay?.kalemler?.find((x) => x.id === id);
    if (!k) return;
    if (seciliKalemIds.includes(id)) {
      setSeciliKalemIds((prev) => prev.filter((x) => x !== id));
      setSeciliBolAdet((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      return;
    }
    // Parçalı adet popup'ı sadece ödeme ekranında (hesap böl) gösterilsin.
    if (odemeModal && k.adet > 1) {
      setBolAdetModal({ kalemId: id, max: k.adet, value: String(k.adet) });
      return;
    }
    setSeciliKalemIds((prev) => [...prev, id]);
    setSeciliBolAdet((prev) => ({ ...prev, [id]: k.adet }));
  }

  function bolAdetModalOnayla() {
    if (!bolAdetModal || !detay) return;
    const n = Number.parseInt(String(bolAdetModal.value), 10);
    if (!Number.isInteger(n) || n < 1 || n > bolAdetModal.max) {
      setToast(`1–${bolAdetModal.max} arası adet girin.`);
      return;
    }
    const kid = bolAdetModal.kalemId;
    setBolAdetModal(null);
    setSeciliKalemIds((prev) => (prev.includes(kid) ? prev : [...prev, kid]));
    setSeciliBolAdet((prev) => ({ ...prev, [kid]: n }));
  }

  function secilenTamMi() {
    if (!detay?.kalemler) return false;
    const set = new Set(seciliKalemIds);
    if (set.size !== detay.kalemler.length) return false;
    for (const k of detay.kalemler) {
      const take = seciliBolAdet[k.id] ?? k.adet;
      if (take !== k.adet) return false;
    }
    return true;
  }

  function bolParcaUygunMu() {
    if (!detay?.kalemler) return false;
    if (seciliKalemIds.length >= 2) return true;
    if (seciliKalemIds.length !== 1) return false;
    const kid = seciliKalemIds[0];
    const k = detay.kalemler.find((x) => x.id === kid);
    if (!k) return false;
    const take = seciliBolAdet[k.id] ?? k.adet;
    return k.adet > 1 && take < k.adet && take > 0;
  }

  function secilenToplam() {
    if (!detay?.kalemler) return 0;
    const set = new Set(seciliKalemIds);
    return detay.kalemler
      .filter((k) => set.has(k.id))
      .reduce((s, k) => s + satirAraTutar(k, seciliBolAdet[k.id]), 0);
  }

  function kalemAdetleriPayload() {
    if (!detay?.kalemler) return [];
    return seciliKalemIds.map((kid) => {
      const k = detay.kalemler.find((x) => x.id === kid);
      return {
        kalem_id: kid,
        adet: seciliBolAdet[kid] ?? k?.adet ?? 1,
      };
    });
  }

  function odenenParcaSatirlari() {
    if (!detay?.kalemler) return [];
    return seciliKalemIds.map((kid) => {
      const k = detay.kalemler.find((x) => x.id === kid);
      const ad = seciliBolAdet[kid] ?? k?.adet ?? 1;
      return {
        id: `paid-${kid}-${Date.now()}`,
        urun_adi: k?.urun_adi ?? "—",
        adet: ad,
        toplam_fiyat: satirAraTutar(k, ad),
      };
    });
  }

  function tekSecilenKalem() {
    if (seciliKalemIds.length !== 1 || !detay?.kalemler) return null;
    return detay.kalemler.find((k) => k.id === seciliKalemIds[0]) ?? null;
  }

  async function yeniAdisyonOlustur(e) {
    e.preventDefault();
    setYeniErr("");
    const ad = musteriAd.trim();
    if (!ad) {
      setYeniErr("Ad ve soyad girin.");
      return;
    }
    const masa = Number.parseInt(String(masaNo), 10);
    if (!Number.isInteger(masa) || masa < 1 || masa > 999) {
      setYeniErr("Masa numarası 1–999 arasında olmalı.");
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post("/api/adisyonlar", {
        musteri_adi: ad,
        masa_no: Number(masa),
      });
      setYeniModal(false);
      setMasaKilitli(null);
      await loadList();
      setAktifId(data.adisyon.id);
    } catch (e) {
      const apiErr = e?.response?.data?.error;
      const status = e?.response?.status;
      if (status === 401) {
        setYeniErr(apiErr || "Oturum süresi dolmuş olabilir.");
      } else if (!e?.response) {
        setYeniErr("Sunucuya ulaşılamadı.");
      } else {
        setYeniErr(apiErr || "Adisyon açılamadı.");
      }
    } finally {
      setCreating(false);
    }
  }

  async function masaHucresiTik(m) {
    const a = masaAdisyon.get(m);
    const dolu = !!a;
    const acik = a?.durum === "ACIK";

    if (modUrunTransfer) {
      if (!aktifId || !detay) {
        setToast("Önce ortada bir adisyon seçin.");
        return;
      }
      const sec = tekSecilenKalem();
      if (!sec) {
        setToast("Ürün transfer için orta blokta tek satır seçin.");
        return;
      }
      if (!acik) {
        setToast("Hedef masada açık adisyon olmalı.");
        return;
      }
      if (a.id === aktifId) {
        setToast("Aynı adisyona taşınamaz.");
        return;
      }
      const adet = seciliBolAdet[sec.id] ?? sec.adet;
      setBusy(true);
      try {
        await api.post(`/api/adisyonlar/${aktifId}/kalemler/${sec.id}/transfer`, {
          hedef_adisyon_id: a.id,
          adet,
        });
        setToast("Ürün transfer edildi.");
        setModUrunTransfer(false);
        setSeciliKalemIds([]);
        setSeciliBolAdet({});
        await loadList();
        await refreshDetay(aktifId);
      } catch (e) {
        setToast(e?.response?.data?.error || "Transfer başarısız.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (modMasaTransfer) {
      if (!aktifId) return;
      if (!acik) {
        setToast("Birleştirme için hedef masada açık adisyon olmalı.");
        return;
      }
      if (a.id === aktifId) {
        setToast("Aynı adisyonla birleştirilemez.");
        return;
      }
      setBusy(true);
      try {
        await api.post(`/api/adisyonlar/${aktifId}/masa-birlestir`, {
          hedef_adisyon_id: a.id,
        });
        setToast("Adisyonlar birleştirildi.");
        setModMasaTransfer(false);
        await loadList();
        setAktifId(a.id);
        await refreshDetay(a.id);
      } catch (e) {
        setToast(e?.response?.data?.error || "Birleştirme başarısız.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (dolu) {
      setAktifId(a.id);
      setSeciliKalemIds([]);
      setModUrunTransfer(false);
      setModMasaTransfer(false);
      return;
    }
    bosMasayaTikla(m);
  }

  function urunTransferBaslat() {
    if (!aktifId || !detay) {
      setToast("Önce bir adisyon seçin.");
      return;
    }
    const sec = tekSecilenKalem();
    if (!sec) {
      setToast("Önce tek bir ürün satırı seçin.");
      return;
    }
    setTransferAdetModal({ kalemId: sec.id, max: sec.adet, value: String(sec.adet) });
  }

  function transferAdetModalOnayla() {
    if (!transferAdetModal || !detay) return;
    const n = Number.parseInt(String(transferAdetModal.value), 10);
    if (!Number.isInteger(n) || n < 1 || n > transferAdetModal.max) {
      setToast(`1–${transferAdetModal.max} arası adet girin.`);
      return;
    }
    const kid = transferAdetModal.kalemId;
    setSeciliKalemIds((prev) => (prev.includes(kid) ? prev : [kid]));
    setSeciliBolAdet((prev) => ({ ...prev, [kid]: n }));
    setModMasaTransfer(false);
    setModUrunTransfer(true);
    setTransferAdetModal(null);
    setToast("Şimdi soldan hedef dolu masayı seçin.");
  }

  async function kaydetNot() {
    if (!aktifId) return;
    setNotSaving(true);
    try {
      await api.patch(`/api/adisyonlar/${aktifId}`, { notlar: notStr || null });
      setNotModal(false);
      await refreshDetay(aktifId);
      setToast("Not kaydedildi.");
    } catch {
      setToast("Not kaydedilemedi.");
    } finally {
      setNotSaving(false);
    }
  }

  async function yazdirAdisyon() {
    if (!aktifId) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/api/adisyonlar/${aktifId}/yazdir`);
      // Electron'da (Windows) termal kütüphane yerine OS yazdırmayı kullan
      if (window.turadisyon?.printReceipt && data?.metin) {
        const printerName = localStorage.getItem("turadisyon_printer_name") || "kasa";
        const r = await window.turadisyon.printReceipt({
          printerName,
          text: data.metin,
        });
        setToast(r?.ok ? "Yazdırıldı." : r?.error || "Yazdırılamadı.");
      } else {
        setToast(data.yazdirildi ? "Yazdırıldı." : data.uyari || "Tamam.");
      }
    } catch (e) {
      setToast(e?.response?.data?.error || "Yazdırılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function ikramYap() {
    const k = tekSecilenKalem();
    if (!k || !aktifId) {
      setToast("Bir satır seçin.");
      return;
    }
    if (garsonMu) {
      setToast("İkram yetkiniz yok.");
      return;
    }
    if (k.iade) {
      setToast("İade satırına ikram uygulanamaz.");
      return;
    }
    if (k.adet > 1) {
      setIkramAdet("1");
      setIkramModal({ id: k.id, max: k.adet });
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/adisyonlar/${aktifId}/kalemler/${k.id}/ikram`, { adet: 1 });
      setToast("İkram olarak işaretlendi.");
      setSeciliKalemIds([]);
      setSeciliBolAdet({});
      await refreshDetay(aktifId);
      await loadList();
    } catch (e) {
      setToast(e?.response?.data?.error || "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  async function ikramUygula() {
    if (!ikramModal || !aktifId) return;
    const { id: kid, max } = ikramModal;
    const n = Number.parseInt(String(ikramAdet), 10);
    if (!Number.isInteger(n) || n < 1 || n > max) {
      setToast(`1–${max} arası adet girin.`);
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/adisyonlar/${aktifId}/kalemler/${kid}/ikram`, { adet: n });
      setIkramModal(null);
      setToast("İkram uygulandı.");
      setSeciliKalemIds([]);
      setSeciliBolAdet({});
      await refreshDetay(aktifId);
      await loadList();
    } catch (e) {
      setToast(e?.response?.data?.error || "İkram yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function fiyatKaydet() {
    const k = tekSecilenKalem();
    if (!k || !aktifId) return;
    const kurus = tryToKurus(fiyatStr);
    if (kurus == null || kurus < 0) {
      setToast("Geçerli fiyat girin.");
      return;
    }
    if (garsonMu) {
      setToast("Fiyat değiştirme yetkiniz yok.");
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/api/adisyonlar/${aktifId}/kalemler/${k.id}`, { birim_fiyat: kurus });
      setFiyatModal(null);
      setToast("Fiyat güncellendi.");
      setSeciliKalemIds([]);
      await refreshDetay(aktifId);
      await loadList();
    } catch (e) {
      setToast(e?.response?.data?.error || "Güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function iadeUygula() {
    if (!iadeModal || !aktifId) return;
    const { id: kid, max } = iadeModal;
    const n = Number.parseInt(String(iadeAdet), 10);
    if (!Number.isInteger(n) || n < 1 || n > max) {
      setToast(`1–${max} arası adet girin.`);
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/adisyonlar/${aktifId}/kalemler/${kid}/iade`, { adet: n });
      setIadeModal(null);
      setToast("İade uygulandı.");
      setSeciliKalemIds([]);
      setSeciliBolAdet({});
      await refreshDetay(aktifId);
      await loadList();
    } catch (e) {
      setToast(e?.response?.data?.error || "İade yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function iadeAc() {
    const k = tekSecilenKalem();
    if (!k || !aktifId) {
      setToast("Bir satır seçin.");
      return;
    }
    if (k.iade) {
      setToast("Bu satır zaten iade.");
      return;
    }
    if (k.adet === 1) {
      setBusy(true);
      try {
        await api.post(`/api/adisyonlar/${aktifId}/kalemler/${k.id}/iade`, { adet: 1 });
        setToast("İade uygulandı.");
        setSeciliKalemIds([]);
        setSeciliBolAdet({});
        await refreshDetay(aktifId);
        await loadList();
      } catch (e) {
        setToast(e?.response?.data?.error || "İade yapılamadı.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setIadeAdet("1");
    setIadeModal({ id: k.id, max: k.adet });
  }

  async function cariYukle() {
    try {
      const { data } = await api.get("/api/cariler");
      setCariler(data.cariler ?? []);
    } catch {
      setCariler([]);
    }
  }

  async function cariOdemeDirect() {
    if (!aktifId || !detay) return;
    const cid = Number(cariId);
    if (!cid) {
      setToast("Cari seçin.");
      return;
    }
    if (detay.toplam_tutar <= 0) {
      setToast("Tutar 0; cari işlem gerekmez.");
      return;
    }
    setOdemePaying(true);
    try {
      await api.post(`/api/adisyonlar/${aktifId}/odeme`, {
        odeme_turu: "CARI",
        cari_id: cid,
      });
      setCariModal(false);
      setToast("Cariye işlendi.");
      await loadList();
      setAktifId(null);
      setDetay(null);
    } catch (e) {
      setToast(e?.response?.data?.error || "İşlem başarısız.");
    } finally {
      setOdemePaying(false);
    }
  }

  function cariOdemeIste() {
    const cid = Number(cariId);
    if (!cid) {
      setToast("Cari seçin.");
      return;
    }
    if (detay && detay.toplam_tutar <= 0) {
      setToast("Tutar 0; cari işlem gerekmez.");
      return;
    }
    setOdemeOnay({ type: "cari" });
  }

  async function tamOdemeDirect(tur) {
    if (!aktifId || !detay) return;
    setOdemePaying(true);
    setOdemeErr("");
    try {
      await api.post(`/api/adisyonlar/${aktifId}/odeme`, { odeme_turu: tur });
      setOdemeModal(false);
      setToast("Ödeme alındı.");
      await loadList();
      setAktifId(null);
      setDetay(null);
      setSeciliKalemIds([]);
    } catch (e) {
      setOdemeErr(e?.response?.data?.error || "Ödeme alınamadı.");
    } finally {
      setOdemePaying(false);
    }
  }

  async function karisikTamOdemeDirect() {
    if (!aktifId || !detay) return;
    const n = tryToKurus(nakitTry);
    const k = tryToKurus(kartTry);
    const h = tryToKurus(havaleTry);
    if (n == null || k == null || h == null) {
      setOdemeErr("Nakit, kart ve havale tutarlarını girin.");
      return;
    }
    if (n + k + h !== detay.toplam_tutar) {
      setOdemeErr(`Toplam ${formatTry(detay.toplam_tutar)} olmalı.`);
      return;
    }
    setOdemePaying(true);
    setOdemeErr("");
    try {
      await api.post(`/api/adisyonlar/${aktifId}/odeme`, {
        odeme_turu: "KARISIK",
        odemeler: [
          { odeme_turu: "NAKIT", tutar: n },
          { odeme_turu: "KREDI_KARTI", tutar: k },
          { odeme_turu: "HAVALE", tutar: h },
        ],
      });
      setOdemeModal(false);
      setToast("Ödeme alındı.");
      await loadList();
      setAktifId(null);
      setDetay(null);
    } catch (e) {
      setOdemeErr(e?.response?.data?.error || "Ödeme alınamadı.");
    } finally {
      setOdemePaying(false);
    }
  }

  function karisikTamOdemeIste() {
    if (!aktifId || !detay) return;
    const n = tryToKurus(nakitTry);
    const k = tryToKurus(kartTry);
    const h = tryToKurus(havaleTry);
    if (n == null || k == null || h == null) {
      setOdemeErr("Nakit, kart ve havale tutarlarını girin.");
      return;
    }
    if (n + k + h !== detay.toplam_tutar) {
      setOdemeErr(`Toplam ${formatTry(detay.toplam_tutar)} olmalı.`);
      return;
    }
    setOdemeOnay({ type: "karisik-tam" });
  }

  /** Seçilen satırlar için: önce böl, sonra yeni adisyona tam ödeme */
  async function secilenlereOdemeDirect(tur) {
    if (!aktifId || !detay) return;
    const ara = secilenToplam();
    if (ara <= 0) {
      setOdemeErr("Satır seçin.");
      return;
    }
    if (ara === detay.toplam_tutar) {
      await tamOdemeDirect(tur);
      return;
    }
    const tum = detay.kalemler.length;
    if (!bolParcaUygunMu() && tum < 2) {
      setOdemeErr("Parçalı ödeme için en az iki satır veya tek satırda birden fazla adet gerekir.");
      return;
    }
    if (secilenTamMi()) {
      setOdemeErr("Tüm tutarı seçtiniz; tam ödeme kullanın.");
      return;
    }
    setOdemePaying(true);
    setOdemeErr("");
    try {
      const { data } = await api.post(`/api/adisyonlar/${aktifId}/bol`, {
        kalem_adetleri: kalemAdetleriPayload(),
        yeni_musteri_adi: "",
      });
      const yeniId = data.yeni_adisyon.id;
      await api.post(`/api/adisyonlar/${yeniId}/odeme`, { odeme_turu: tur });
      setOdenenKalemler((prev) => [...prev, ...odenenParcaSatirlari()]);
      setToast("Seçilen kısım ödendi.");
      await loadList();
      setSeciliKalemIds([]);
      setSeciliBolAdet({});
      if (data.adisyon) setDetay(data.adisyon);
    } catch (e) {
      setOdemeErr(e?.response?.data?.error || "Ödeme tamamlanamadı.");
    } finally {
      setOdemePaying(false);
    }
  }

  function secilenlereOdemeIste(tur) {
    if (!aktifId || !detay) return;
    const ara = secilenToplam();
    if (ara <= 0) {
      setOdemeErr("Satır seçin.");
      return;
    }
    if (ara === detay.toplam_tutar) {
      setOdemeOnay({ type: "tam", tur });
      return;
    }
    const tum = detay.kalemler.length;
    if (!bolParcaUygunMu() && tum < 2) {
      setOdemeErr("Parçalı ödeme için en az iki satır veya tek satırda birden fazla adet gerekir.");
      return;
    }
    if (secilenTamMi()) {
      setOdemeErr("Tüm tutarı seçtiniz; tam ödeme kullanın.");
      return;
    }
    setOdemeOnay({ type: "sec", tur });
  }

  async function secilenlereKarisikDirect() {
    if (!aktifId || !detay) return;
    const ara = secilenToplam();
    if (ara <= 0) {
      setOdemeErr("Satır seçin.");
      return;
    }
    const n = tryToKurus(nakitTry);
    const k = tryToKurus(kartTry);
    const h = tryToKurus(havaleTry);
    if (n == null || k == null || h == null) {
      setOdemeErr("Nakit, kart ve havale girin.");
      return;
    }
    if (n + k + h !== ara) {
      setOdemeErr(`Seçilen ara toplam ${formatTry(ara)} olmalı.`);
      return;
    }
    const tum = detay.kalemler.length;
    if (ara === detay.toplam_tutar) {
      await karisikTamOdemeDirect();
      return;
    }
    if (!bolParcaUygunMu() && tum < 2) {
      setOdemeErr("Bölünmüş ödeme için uygun seçim yapın.");
      return;
    }
    if (secilenTamMi()) {
      setOdemeErr("Tüm tutarı seçtiniz; tam ödeme kullanın.");
      return;
    }
    setOdemePaying(true);
    setOdemeErr("");
    try {
      const { data } = await api.post(`/api/adisyonlar/${aktifId}/bol`, {
        kalem_adetleri: kalemAdetleriPayload(),
        yeni_musteri_adi: "",
      });
      const yeniId = data.yeni_adisyon.id;
      await api.post(`/api/adisyonlar/${yeniId}/odeme`, {
        odeme_turu: "KARISIK",
        odemeler: [
          { odeme_turu: "NAKIT", tutar: n },
          { odeme_turu: "KREDI_KARTI", tutar: k },
          { odeme_turu: "HAVALE", tutar: h },
        ],
      });
      setOdenenKalemler((prev) => [...prev, ...odenenParcaSatirlari()]);
      setToast("Seçilen kısım ödendi.");
      await loadList();
      setSeciliKalemIds([]);
      setSeciliBolAdet({});
      if (data.adisyon) setDetay(data.adisyon);
    } catch (e) {
      setOdemeErr(e?.response?.data?.error || "Ödeme tamamlanamadı.");
    } finally {
      setOdemePaying(false);
    }
  }

  function secilenlereKarisikIste() {
    if (!aktifId || !detay) return;
    const ara = secilenToplam();
    if (ara <= 0) {
      setOdemeErr("Satır seçin.");
      return;
    }
    const n = tryToKurus(nakitTry);
    const k = tryToKurus(kartTry);
    const h = tryToKurus(havaleTry);
    if (n == null || k == null || h == null) {
      setOdemeErr("Nakit, kart ve havale girin.");
      return;
    }
    if (n + k + h !== ara) {
      setOdemeErr(`Seçilen ara toplam ${formatTry(ara)} olmalı.`);
      return;
    }
    const tum = detay.kalemler.length;
    if (ara === detay.toplam_tutar) {
      setOdemeOnay({ type: "karisik-tam" });
      return;
    }
    if (!bolParcaUygunMu() && tum < 2) {
      setOdemeErr("Bölünmüş ödeme için uygun seçim yapın.");
      return;
    }
    if (secilenTamMi()) {
      setOdemeErr("Tüm tutarı seçtiniz; tam ödeme kullanın.");
      return;
    }
    setOdemeOnay({ type: "sec-karisik" });
  }

  async function adisyonBosKapat() {
    if (!aktifId || !detay) return;
    if ((detay.kalemler?.length ?? 0) > 0) return;
    setBusy(true);
    try {
      await api.post(`/api/adisyonlar/${aktifId}/kapat-bos`);
      setToast("Boş adisyon kapatıldı.");
      setAktifId(null);
      await loadList();
    } catch (e) {
      setToast(e?.response?.data?.error || "Kapatılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function odemeOnayVer() {
    const p = odemeOnay;
    setOdemeOnay(null);
    if (!p) return;
    if (p.type === "tam") await tamOdemeDirect(p.tur);
    else if (p.type === "karisik-tam") await karisikTamOdemeDirect();
    else if (p.type === "sec") await secilenlereOdemeDirect(p.tur);
    else if (p.type === "sec-karisik") await secilenlereKarisikDirect();
    else if (p.type === "cari") await cariOdemeDirect();
  }

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const nowStr = new Date().toLocaleString("tr-TR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const solBaslik = modUrunTransfer
    ? "Hedef masa (dolu) seçin"
    : modMasaTransfer
      ? "Birleştirilecek açık masa seçin"
      : "Masalar";

  function odemeTurEtiketi(tur) {
    if (tur === "NAKIT") return "Nakit";
    if (tur === "KREDI_KARTI") return "Kredi kartı";
    if (tur === "HAVALE") return "Havale";
    return tur ?? "";
  }
  const aktifAcik = detay?.durum === "ACIK";
  const acikAdisyonSayisi = listMasa.filter((a) => a.durum === "ACIK").length;
  const kapaliAdisyonSayisi = listMasa.filter((a) => a.durum === "KAPALI").length;
  const toplamAdisyonSayisi = acikAdisyonSayisi + kapaliAdisyonSayisi;
  const acikToplamTutar = listMasa
    .filter((a) => a.durum === "ACIK")
    .reduce((s, a) => s + (a.toplam_tutar ?? 0), 0);
  const kapaliToplamTutar = listMasa
    .filter((a) => a.durum === "KAPALI")
    .reduce((s, a) => s + (a.toplam_tutar ?? 0), 0);
  const canliToplamCiro = acikToplamTutar + kapaliToplamTutar;

  async function kasaOzetAc() {
    setKasaModal(true);
    setKasaLoading(true);
    setKasaErr("");
    try {
      const bugun = ymdLocal(new Date());
      const { data } = await api.get("/api/adisyonlar/kasa-ozet", {
        params: { baslangic: bugun, bitis: bugun },
      });
      setKasaCiro(data);
    } catch {
      setKasaErr("Kasa özeti alınamadı.");
      setKasaCiro(null);
    } finally {
      setKasaLoading(false);
    }
  }

  async function adminPanelAc() {
    const hedefUrl = (
      localStorage.getItem("turadisyon_admin_url") ||
      import.meta.env.VITE_ADMIN_PANEL_URL ||
      "https://sofia-adisyon-sofia-acenta-app.tbmxzk.easypanel.host/admin/"
    ).trim();
    if (!hedefUrl) {
      setToast("Admin panel adresi bulunamadı.");
      return;
    }
    try {
      if (window.turadisyon?.openExternal) {
        const r = await window.turadisyon.openExternal(hedefUrl);
        if (!r?.ok) {
          setToast(r?.error || "Admin panel açılamadı.");
        }
        return;
      }
      window.open(hedefUrl, "_blank", "noopener,noreferrer");
    } catch {
      setToast("Admin panel açılamadı.");
    }
  }

  function kasaOzetMetniOlustur() {
    const ayir = "-".repeat(32);
    const ts = new Date().toLocaleString("tr-TR");
    return [
      "TURADISYON",
      "KASA OZETI",
      ayir,
      `Tarih: ${ts}`,
      ayir,
      `Gunluk ciro : ${formatTry(canliToplamCiro)}`,
      `Acik toplam : ${formatTry(acikToplamTutar)}`,
      `Kapali toplam: ${formatTry(kapaliToplamTutar)}`,
      ayir,
      `Toplam adisyon: ${toplamAdisyonSayisi}`,
      `Acik adisyon : ${acikAdisyonSayisi}`,
      `Kapali adisyon: ${kapaliAdisyonSayisi}`,
      ayir,
      "",
    ].join("\n");
  }

  async function kasaOzetYazdir() {
    if (kasaLoading) {
      setToast("Kasa özeti yükleniyor.");
      return;
    }
    if (!window.turadisyon?.printReceipt) {
      setToast("Yazdırma bu cihazda desteklenmiyor.");
      return;
    }
    setKasaPrinting(true);
    try {
      const printerName = localStorage.getItem("turadisyon_printer_name") || "kasa";
      const r = await window.turadisyon.printReceipt({
        printerName,
        text: kasaOzetMetniOlustur(),
      });
      setToast(r?.ok ? "Kasa özeti yazdırıldı." : r?.error || "Kasa özeti yazdırılamadı.");
      return !!r?.ok;
    } catch (e) {
      setToast(e?.message || "Kasa özeti yazdırılamadı.");
      return false;
    } finally {
      setKasaPrinting(false);
    }
  }

  async function kasaYazdirOnayla() {
    const sifre = String(kasaSifre || "").trim();
    if (!sifre) {
      setKasaSifreErr("Şifre girin.");
      return;
    }
    setKasaSifreBusy(true);
    setKasaSifreErr("");
    try {
      await api.post("/api/auth/confirm-password", { sifre });
      const ok = await kasaOzetYazdir();
      if (!ok) return;

      const nowIso = new Date().toISOString();
      setManuelResetAt(nowIso);
      setAktifId(null);
      setDetay(null);
      setSeciliKalemIds([]);
      setSeciliBolAdet({});
      setOdemeModal(false);
      setOdenenKalemler([]);
      setModUrunTransfer(false);
      setModMasaTransfer(false);
      setKasaSifre("");
      setKasaSifreModal(false);
      setKasaModal(false);
      await loadList();
      setToast("Kasa yazdırıldı. Adisyon ekranı sıfırlandı.");
    } catch (e) {
      setKasaSifreErr(e?.response?.data?.error || "Şifre doğrulanamadı.");
    } finally {
      setKasaSifreBusy(false);
    }
  }

  return (
    <div className="h-screen bg-pos-bg flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between border-b border-pos-border p-3 gap-2">
        <div>
          <span className="text-lg font-bold text-blue-400">TurAdisyon</span>
          <p className="text-xs text-slate-500">
            {user.ad} {user.soyad} · {user.rol}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadList()}
            className="min-h-[40px] rounded-lg border border-pos-border px-3 text-sm text-slate-300"
          >
            Yenile
          </button>
          <button
            type="button"
            onClick={adminPanelAc}
            className="min-h-[40px] rounded-lg border border-blue-500/40 bg-blue-950/40 px-3 text-sm text-blue-200"
          >
            Admin
          </button>
          <button
            type="button"
            onClick={logout}
            className="min-h-[40px] rounded-lg px-3 text-sm text-slate-400 hover:bg-slate-800"
          >
            Çıkış
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(220px,280px)_1fr_minmax(240px,320px)] gap-3 p-3">
        {/* Sol: masalar */}
        <section className="flex flex-col min-h-0 border border-pos-border rounded-xl p-3 bg-pos-card/40">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-medium text-slate-300">{solBaslik}</h2>
            {(modUrunTransfer || modMasaTransfer) && (
              <button
                type="button"
                className="text-xs text-amber-400 underline"
                onClick={() => {
                  setModUrunTransfer(false);
                  setModMasaTransfer(false);
                }}
              >
                İptal
              </button>
            )}
          </div>
          {modUrunTransfer && (
            <p className="text-[11px] text-amber-200/80 mb-2">
              Ortada tek ürün seçili olsun. Yeşil (dolu) masaya dokunun.
            </p>
          )}
          {modMasaTransfer && (
            <p className="text-[11px] text-amber-200/80 mb-2">Birleştirilecek yeşil (açık) masaya dokunun.</p>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 content-start">
              {Array.from({ length: masaSayisi }, (_, i) => i + 1).map((m) => {
                const a = masaAdisyon.get(m);
                const dolu = !!a;
                const acik = a?.durum === "ACIK";
                const kapali = a?.durum === "KAPALI";
                const hedefVurgu =
                  (modUrunTransfer && acik) || (modMasaTransfer && acik);
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={busy}
                    onClick={() => masaHucresiTik(m)}
                    className={[
                      "rounded-xl border-2 px-3 py-2 text-left min-h-[92px] flex flex-col justify-between",
                      modMasaTransfer && !acik
                        ? "opacity-40 cursor-not-allowed border-slate-700"
                        : modUrunTransfer && !acik
                          ? "opacity-40 cursor-not-allowed border-slate-700"
                          : hedefVurgu
                            ? "border-amber-400 ring-2 ring-amber-500/50"
                            : acik
                              ? "border-emerald-500/70 bg-emerald-950/50 text-emerald-200"
                              : kapali
                                ? "border-red-500/70 bg-red-950/40 text-red-200"
                                : "border-pos-border bg-pos-bg text-slate-400",
                    ].join(" ")}
                  >
                    <span className="text-2xl font-bold tabular-nums leading-none">{m}</span>
                    <div className="min-h-[30px]">
                      <span className="block text-xs truncate">
                        {a?.musteri_adi?.trim() ||
                          (kapali ? "Ödeme alındı" : "Boş masa")}
                      </span>
                      {(acik || kapali) && (
                        <span className="block mt-0.5 text-[11px] font-mono text-emerald-200/90">
                          {formatTry(a.toplam_tutar ?? 0)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                disabled={busy || masaSayisi >= 300}
                onClick={() => setMasaSayisi((prev) => Math.min(300, prev + 1))}
                className="rounded-xl border-2 border-dashed border-blue-500/50 bg-blue-950/30 text-blue-200 min-h-[92px] flex items-center justify-center text-3xl font-bold disabled:opacity-40"
                title="Masa ekle"
              >
                +
              </button>
            </div>
          </div>
          <button
            type="button"
            disabled={creating}
            onClick={yeniModalAc}
            className="mt-3 min-h-[44px] rounded-lg bg-emerald-700 text-sm font-semibold text-white disabled:opacity-50"
          >
            + Yeni adisyon
          </button>
        </section>

        {/* Orta: liste */}
        <section className="flex flex-col min-h-0 border border-pos-border rounded-xl p-3 bg-pos-card/30">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-xs text-slate-500">{nowStr}</p>
              <h2 className="text-base font-semibold text-slate-200">Adisyon</h2>
            </div>
            {loading && <span className="text-xs text-slate-500">Liste…</span>}
          </div>

          {!aktifId ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm text-center px-4">
              Soldan dolu bir masa seçin; ürünler burada listelenir.
            </div>
          ) : detayLoading ? (
            <p className="text-slate-500">Yükleniyor…</p>
          ) : !detay ? (
            <p className="text-red-400 text-sm">Adisyon yüklenemedi.</p>
          ) : (
            <>
              <div className="text-sm text-slate-400 mb-2">
                Masa{" "}
                <span className="text-blue-400 font-bold text-lg tabular-nums">
                  {(detay.masa_no ?? 0) > 0 ? detay.masa_no : "—"}
                </span>
                <span className="mx-2">·</span>
                {detay.musteri_adi || "Misafir"}
                {detay.durum === "KAPALI" && (
                  <span className="ml-2 rounded bg-red-950/60 px-2 py-0.5 text-[11px] text-red-200">
                    Ödeme alındı
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-600 font-mono mb-2 truncate">{detay.numara}</p>

              <AdisyonKalemList
                kalemler={detay.kalemler}
                seciliKalemIds={seciliKalemIds}
                onToggleKalem={toggleKalem}
                onClearSelection={() => {
                  setSeciliKalemIds([]);
                  setSeciliBolAdet({});
                }}
              />

              <div className="mt-3 flex items-center justify-between border-t border-pos-border pt-3">
                <span className="text-slate-400 font-medium">Toplam</span>
                <span className="font-mono text-xl text-slate-100">{formatTry(detay.toplam_tutar)}</span>
              </div>
              {seciliKalemIds.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Seçilen ara toplam:{" "}
                  <span className="font-mono text-slate-300">{formatTry(secilenToplam())}</span>
                </p>
              )}

              <button
                type="button"
                onClick={() => nav(`/adisyon/${aktifId}/siparis`)}
                disabled={!aktifAcik}
                className="mt-4 w-full min-h-[52px] rounded-xl bg-blue-700 text-base font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ekle
              </button>
              <button
                type="button"
                onClick={adisyonBosKapat}
                disabled={
                  !aktifAcik || busy || (detay?.kalemler?.length ?? 0) > 0
                }
                className="mt-2 w-full min-h-[48px] rounded-xl border border-slate-600 bg-slate-900/60 text-sm font-medium text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed"
              >
                Adisyon kapat (ürün yoksa)
              </button>
              <button
                type="button"
                onClick={kasaOzetAc}
                className="mt-2 w-full min-h-[48px] rounded-xl border border-emerald-600/40 bg-emerald-950/30 text-sm font-semibold text-emerald-200"
              >
                Kasa
              </button>
            </>
          )}
        </section>

        {/* Sağ: eylemler */}
        <section className="min-h-0 border border-pos-border rounded-xl p-3 bg-pos-card/40 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
          <ActionBtn
            label="Ürün transfer"
            sub="Tek satır seç → sonra soldan dolu masa"
            disabled={!aktifId || busy || !aktifAcik}
            active={modUrunTransfer}
            onClick={urunTransferBaslat}
          />
          <ActionBtn
            label="İade"
            sub="Seçilen satırı düşür"
            disabled={
              !aktifId ||
              busy ||
              !aktifAcik ||
              seciliKalemIds.length !== 1 ||
              !!tekSecilenKalem()?.iade
            }
            onClick={iadeAc}
          />
          <ActionBtn
            label="İkram"
            sub="Fiyatı sıfırla"
            disabled={!aktifId || busy || !aktifAcik || garsonMu || seciliKalemIds.length !== 1}
            onClick={ikramYap}
          />
          <ActionBtn
            label="Fiyat değiştir"
            sub="Birim fiyat"
            disabled={!aktifId || busy || !aktifAcik || garsonMu || seciliKalemIds.length !== 1}
            onClick={() => {
              const k = tekSecilenKalem();
              if (!k) {
                setToast("Bir satır seçin.");
                return;
              }
              setFiyatStr((k.birim_fiyat / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 }));
              setFiyatModal(true);
            }}
          />
          <ActionBtn
            label="İlave"
            sub="Ürün giriş ekranı"
            disabled={!aktifId || !aktifAcik}
            onClick={() => aktifId && nav(`/adisyon/${aktifId}/siparis`)}
          />
          <ActionBtn
            label="Not"
            sub="Adisyon notu"
            disabled={!aktifId || busy || !aktifAcik}
            onClick={() => {
              setNotStr(detay?.notlar ?? "");
              setNotModal(true);
            }}
          />
          <ActionBtn label="Adisyon (yazıcı)" sub="Fiş çıktısı" disabled={!aktifId || busy} onClick={yazdirAdisyon} />
          <ActionBtn
            label="Masa birleştir"
            sub="Açık masa seç, tüm ürünleri aktar"
            disabled={!aktifId || busy || !aktifAcik}
            active={modMasaTransfer}
            onClick={() => {
              setModUrunTransfer(false);
              setModMasaTransfer((v) => !v);
            }}
          />
          <ActionBtn
            label="Cari seç"
            sub="Ödeme almadan cariye"
            disabled={!aktifId || busy || !aktifAcik}
            onClick={() => {
              cariYukle();
              setCariModal(true);
            }}
          />
          <ActionBtn
            label="Ödeme al"
            sub="Tam veya seçilenlerle böl"
            disabled={!aktifId || busy || !detay || !aktifAcik || detay.toplam_tutar <= 0}
            primary
            onClick={() => {
              setOdemeErr("");
              setOdenenKalemler([]);
              setSeciliKalemIds([]);
              setSeciliBolAdet({});
              setNakitTry("");
              setKartTry("");
              setHavaleTry("");
              cariYukle();
              setOdemeModal(true);
            }}
          />
          </div>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] rounded-lg bg-slate-900 border border-pos-border px-4 py-2 text-sm text-slate-200 shadow-lg">
          {toast}
        </div>
      )}

      {yeniModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !creating && setYeniModal(false)}
        >
          <form
            className="w-full max-w-md rounded-xl border border-pos-border bg-pos-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={yeniAdisyonOlustur}
          >
            <h2 className="text-xl font-semibold text-slate-100">Yeni adisyon</h2>
            {yeniErr && <p className="mt-2 text-sm text-red-400">{yeniErr}</p>}
            <label className="mt-4 block text-sm text-slate-400">Ad soyad</label>
            <input
              className="mt-2 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3 text-slate-100"
              value={musteriAd}
              onChange={(e) => setMusteriAd(e.target.value)}
              autoFocus
            />
            <label className="mt-3 block text-sm text-slate-400">Masa</label>
            <input
              type="number"
              min={1}
              max={999}
              disabled={masaKilitli != null}
              className="mt-2 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3 text-slate-100 disabled:opacity-70"
              value={masaNo}
              onChange={(e) => setMasaNo(e.target.value)}
            />
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex-1 min-h-[48px] rounded-lg border border-pos-border text-slate-300"
                onClick={() => setYeniModal(false)}
              >
                İptal
              </button>
              <button type="submit" disabled={creating} className="flex-1 min-h-[48px] rounded-lg bg-emerald-600 text-white font-medium">
                {creating ? "…" : "Aç"}
              </button>
            </div>
          </form>
        </div>
      )}

      {notModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => !notSaving && setNotModal(false)}>
          <div className="w-full max-w-lg rounded-xl border border-pos-border bg-pos-card p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Adisyon notu</h3>
            <textarea
              className="mt-3 w-full min-h-[120px] rounded-lg border border-pos-border bg-pos-bg p-3 text-slate-100"
              value={notStr}
              onChange={(e) => setNotStr(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <button type="button" className="flex-1 min-h-[44px] rounded-lg border border-pos-border" onClick={() => setNotModal(false)}>
                İptal
              </button>
              <button
                type="button"
                disabled={notSaving}
                className="flex-1 min-h-[44px] rounded-lg bg-blue-700 text-white font-medium"
                onClick={kaydetNot}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {iadeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setIadeModal(null)}>
          <div className="w-full max-w-sm rounded-xl border border-pos-border bg-pos-card p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">İade adedi</h3>
            <p className="text-sm text-slate-500 mt-1">En fazla {iadeModal.max} adet</p>
            <input
              type="number"
              min={1}
              max={iadeModal.max}
              className="mt-3 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3"
              value={iadeAdet}
              onChange={(e) => setIadeAdet(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <button type="button" className="flex-1 min-h-[44px] rounded-lg border border-pos-border" onClick={() => setIadeModal(null)}>
                İptal
              </button>
              <button type="button" className="flex-1 min-h-[44px] rounded-lg bg-amber-700 text-white" onClick={iadeUygula}>
                Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {ikramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setIkramModal(null)}>
          <div className="w-full max-w-sm rounded-xl border border-pos-border bg-pos-card p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">İkram adedi</h3>
            <p className="text-sm text-slate-500 mt-1">En fazla {ikramModal.max} adet</p>
            <input
              type="number"
              min={1}
              max={ikramModal.max}
              className="mt-3 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3"
              value={ikramAdet}
              onChange={(e) => setIkramAdet(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <button type="button" className="flex-1 min-h-[44px] rounded-lg border border-pos-border" onClick={() => setIkramModal(null)}>
                İptal
              </button>
              <button type="button" className="flex-1 min-h-[44px] rounded-lg bg-amber-700 text-white" onClick={ikramUygula}>
                Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {bolAdetModal && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setBolAdetModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-pos-border bg-pos-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-100">Hesap böl — adet</h3>
            <p className="text-sm text-slate-500 mt-1">
              Bu satırdan yeni adisyona kaç adet taşınacak? (en fazla {bolAdetModal.max})
            </p>
            <input
              type="number"
              min={1}
              max={bolAdetModal.max}
              className="mt-3 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3"
              value={bolAdetModal.value}
              onChange={(e) =>
                setBolAdetModal((m) => (m ? { ...m, value: e.target.value } : m))
              }
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 min-h-[44px] rounded-lg border border-pos-border"
                onClick={() => setBolAdetModal(null)}
              >
                İptal
              </button>
              <button
                type="button"
                className="flex-1 min-h-[44px] rounded-lg bg-emerald-700 text-white"
                onClick={bolAdetModalOnayla}
              >
                Seç
              </button>
            </div>
          </div>
        </div>
      )}

      {transferAdetModal && (
        <div
          className="fixed inset-0 z-[56] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setTransferAdetModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-pos-border bg-pos-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-100">Transfer adedi</h3>
            <p className="text-sm text-slate-500 mt-1">
              Bu satırdan kaç adet taşınacak? (en fazla {transferAdetModal.max})
            </p>
            <input
              type="number"
              min={1}
              max={transferAdetModal.max}
              className="mt-3 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3"
              value={transferAdetModal.value}
              onChange={(e) =>
                setTransferAdetModal((m) => (m ? { ...m, value: e.target.value } : m))
              }
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 min-h-[44px] rounded-lg border border-pos-border"
                onClick={() => setTransferAdetModal(null)}
              >
                İptal
              </button>
              <button
                type="button"
                className="flex-1 min-h-[44px] rounded-lg bg-sky-700 text-white"
                onClick={transferAdetModalOnayla}
              >
                Devam
              </button>
            </div>
          </div>
        </div>
      )}

      {fiyatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setFiyatModal(false)}>
          <div className="w-full max-w-sm rounded-xl border border-pos-border bg-pos-card p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Yeni birim fiyat (₺)</h3>
            <input
              className="mt-3 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3"
              value={fiyatStr}
              onChange={(e) => setFiyatStr(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <button type="button" className="flex-1 rounded-lg border border-pos-border min-h-[44px]" onClick={() => setFiyatModal(false)}>
                İptal
              </button>
              <button type="button" className="flex-1 rounded-lg bg-violet-700 text-white min-h-[44px]" onClick={fiyatKaydet}>
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {cariModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => !odemePaying && setCariModal(false)}>
          <div className="w-full max-w-md rounded-xl border border-pos-border bg-pos-card p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Cariye işle</h3>
            <p className="text-sm text-slate-500 mt-1">Toplam {detay ? formatTry(detay.toplam_tutar) : "—"}</p>
            <select
              className="mt-3 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3 text-slate-100"
              value={cariId}
              onChange={(e) => setCariId(e.target.value)}
            >
              <option value="">Cari seçin…</option>
              {cariler.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ad}
                </option>
              ))}
            </select>
            <div className="mt-4 flex gap-2">
              <button type="button" className="flex-1 min-h-[44px] rounded-lg border border-pos-border" onClick={() => setCariModal(false)}>
                İptal
              </button>
              <button
                type="button"
                disabled={odemePaying}
                className="flex-1 min-h-[44px] rounded-lg bg-amber-700 text-white font-medium"
                onClick={cariOdemeIste}
              >
                {odemePaying ? "…" : "Cariye aktar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {odemeModal && detay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 overflow-y-auto"
          onClick={() => !odemePaying && setOdemeModal(false)}
        >
          <div
            className="w-full max-w-5xl rounded-xl border border-pos-border bg-pos-card shadow-xl my-4 flex flex-col lg:flex-row lg:items-stretch lg:max-h-[min(92vh,900px)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sol: adisyon satırları (popup içinde seçim) */}
            <div className="lg:w-[min(100%,420px)] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-pos-border p-4 flex flex-col min-h-0 min-w-0 bg-slate-950/40">
              <h3 className="text-lg font-semibold text-slate-100">Ödeme</h3>
              <p className="text-sm text-slate-500 mt-1">
                Masa {(detay.masa_no ?? 0) > 0 ? detay.masa_no : "—"} · {detay.musteri_adi || "Misafir"}
              </p>
              <p className="text-[10px] text-slate-600 font-mono truncate mt-0.5">{detay.numara}</p>
              <p className="text-[11px] text-slate-500 mt-2">
                Satıra dokunun: seç / yeşil. Boş alana: seçimi temizle. Birden fazla adetli
                satırda önce taşınacak adedi seçin.
              </p>
              <div className="mt-3 flex-1 min-h-[180px] flex flex-col">
                <AdisyonKalemList
                  kalemler={detay.kalemler ?? []}
                  seciliKalemIds={seciliKalemIds}
                  onToggleKalem={toggleKalem}
                  onClearSelection={() => {
                    setSeciliKalemIds([]);
                    setSeciliBolAdet({});
                  }}
                  minHeight="min-h-[160px]"
                  maxHeightClass="max-h-[min(38vh,340px)] lg:max-h-[calc(92vh-240px)]"
                />
                {odenenKalemler.length > 0 && (
                  <div className="mt-3 rounded-lg border border-pos-border bg-pos-bg/70 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-200">
                        Ödenen satırlar
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {formatTry(
                          odenenKalemler.reduce(
                            (s, k) => s + (k.toplam_fiyat ?? 0),
                            0,
                          ),
                        )}
                      </p>
                    </div>
                    <ul className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
                      {odenenKalemler.map((k, idx) => (
                        <li
                          key={`${k.id}-${idx}`}
                          className="flex justify-between gap-2 text-xs text-slate-200"
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-mono text-slate-400">
                              {k.adet}×
                            </span>{" "}
                            {k.urun_adi}
                          </span>
                          <span className="font-mono shrink-0 tabular-nums">
                            {formatTry(k.toplam_fiyat)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-pos-border pt-3 shrink-0">
                  <span className="text-slate-400 font-medium">Toplam</span>
                  <span className="font-mono text-xl text-slate-100">{formatTry(detay.toplam_tutar)}</span>
                </div>
                {seciliKalemIds.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Seçilen ara toplam:{" "}
                    <span className="font-mono text-emerald-300/90">{formatTry(secilenToplam())}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Sağ: ödeme düğmeleri */}
            <div className="flex-1 min-w-0 overflow-y-auto p-4 flex flex-col">
              <p className="text-slate-500 text-sm lg:hidden">Kalan</p>
              <p className="font-mono text-3xl text-slate-100 lg:mt-1">{formatTry(detay.toplam_tutar)}</p>
              {odemeErr && <p className="mt-2 text-sm text-red-400">{odemeErr}</p>}

              <div className="mt-5 space-y-3 border-t border-pos-border pt-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tam tutar</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={odemePaying}
                    className="min-h-[48px] rounded-lg bg-emerald-600 text-white font-semibold"
                    onClick={() => setOdemeOnay({ type: "tam", tur: "NAKIT" })}
                  >
                    Nakit
                  </button>
                  <button
                    type="button"
                    disabled={odemePaying}
                    className="min-h-[48px] rounded-lg bg-slate-700 text-white font-semibold border border-pos-border"
                    onClick={() => setOdemeOnay({ type: "tam", tur: "KREDI_KARTI" })}
                  >
                    Kredi kartı
                  </button>
                  <button
                    type="button"
                    disabled={odemePaying}
                    className="min-h-[48px] rounded-lg bg-indigo-700/80 text-white font-semibold border border-indigo-500/40"
                    onClick={() => setOdemeOnay({ type: "tam", tur: "HAVALE" })}
                  >
                    Havale
                  </button>
                </div>
              </div>

              <div className="mt-5 border-t border-pos-border pt-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Karışık (nakit + kart + havale = toplam)</p>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  <input
                    placeholder="Nakit"
                    className="min-h-[44px] rounded-lg border border-pos-border bg-pos-bg px-2 text-slate-100"
                    value={nakitTry}
                    onChange={(e) => setNakitTry(e.target.value)}
                  />
                  <input
                    placeholder="Kart"
                    className="min-h-[44px] rounded-lg border border-pos-border bg-pos-bg px-2 text-slate-100"
                    value={kartTry}
                    onChange={(e) => setKartTry(e.target.value)}
                  />
                  <input
                    placeholder="Havale"
                    className="min-h-[44px] rounded-lg border border-pos-border bg-pos-bg px-2 text-slate-100"
                    value={havaleTry}
                    onChange={(e) => setHavaleTry(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  disabled={odemePaying}
                  className="mt-2 w-full min-h-[44px] rounded-lg border border-blue-500/40 bg-blue-950/50 text-blue-200"
                  onClick={karisikTamOdemeIste}
                >
                  Karışık öde (tam tutar)
                </button>
              </div>

              <div className="mt-5 border-t border-pos-border pt-4">
                <p className="text-xs font-medium text-amber-200/90 uppercase tracking-wide">Ödeme böl — seçilen satırlar</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Soldaki listeden satır seçin. Seçilen ara toplam:{" "}
                  <span className="font-mono text-slate-300">{formatTry(secilenToplam())}</span>
                </p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    type="button"
                    disabled={odemePaying || secilenToplam() <= 0}
                    className="min-h-[48px] rounded-lg bg-emerald-800 text-white text-sm font-medium"
                    onClick={() => secilenlereOdemeIste("NAKIT")}
                  >
                    Seçilen → Nakit
                  </button>
                  <button
                    type="button"
                    disabled={odemePaying || secilenToplam() <= 0}
                    className="min-h-[48px] rounded-lg bg-slate-800 text-white text-sm font-medium border border-pos-border"
                    onClick={() => secilenlereOdemeIste("KREDI_KARTI")}
                  >
                    Seçilen → Kart
                  </button>
                  <button
                    type="button"
                    disabled={odemePaying || secilenToplam() <= 0}
                    className="min-h-[48px] rounded-lg bg-indigo-900/70 text-white text-sm font-medium border border-indigo-500/30"
                    onClick={() => secilenlereOdemeIste("HAVALE")}
                  >
                    Seçilen → Havale
                  </button>
                </div>
                <p className="text-[10px] text-slate-600 mt-2">
                  Seçilenler yeni bir adisyona bölünür ve o kısım tahsil edilir; kalan satırlar bu masada kalır.
                </p>
                <button
                  type="button"
                  disabled={odemePaying || secilenToplam() <= 0}
                  className="mt-3 w-full min-h-[44px] rounded-lg border border-amber-500/30 text-amber-100 text-sm"
                  onClick={secilenlereKarisikIste}
                >
                  Seçilen → Karışık (nakit+kart = seçilen ara toplam)
                </button>
              </div>

              <button
                type="button"
                className="mt-auto pt-6 w-full min-h-[44px] rounded-lg border border-pos-border text-slate-400 shrink-0"
                disabled={odemePaying}
                onClick={() => setOdemeModal(false)}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {odemeOnay && detay && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pos-odeme-onay-baslik"
          onClick={() => !odemePaying && setOdemeOnay(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-pos-border bg-pos-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pos-odeme-onay-baslik" className="text-lg font-semibold text-slate-100">
              Ödeme alınıyor
            </h3>
            <p className="mt-1 text-sm font-medium text-emerald-400/90">
              {odemeOnay.type === "tam" &&
                `${odemeTurEtiketi(odemeOnay.tur)} ödemesi`}
              {odemeOnay.type === "karisik-tam" && "Karışık ödeme (nakit + kart + havale)"}
              {odemeOnay.type === "sec" &&
                `Seçilen satırlar → ${odemeTurEtiketi(odemeOnay.tur)}`}
              {odemeOnay.type === "sec-karisik" && "Seçilen satırlar → Karışık ödeme (nakit + kart + havale)"}
              {odemeOnay.type === "cari" && "Cari hesaba işle"}
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed text-sm">
              {odemeOnay.type === "sec" || odemeOnay.type === "sec-karisik"
                ? "Seçilen satırlar ayrı adisyona bölünüp tahsil edilecek. İşlemi onaylıyor musunuz?"
                : odemeOnay.type === "cari"
                  ? "Tutar seçili cari hesabına yazılacak ve adisyon kapatılacak. Onaylıyor musunuz?"
                  : "Ödeme alınacak ve adisyon kapatılacak. İşlemi onaylıyor musunuz?"}
            </p>
            <p className="mt-3 font-mono text-xl text-slate-100">
              {odemeOnay.type === "sec" || odemeOnay.type === "sec-karisik"
                ? formatTry(secilenToplam())
                : formatTry(detay.toplam_tutar)}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={odemePaying}
                onClick={() => setOdemeOnay(null)}
                className="flex-1 min-h-[52px] rounded-lg border border-pos-border text-slate-300 font-medium disabled:opacity-50"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={odemePaying}
                onClick={odemeOnayVer}
                className="flex-1 min-h-[52px] rounded-lg bg-emerald-600 text-lg font-semibold text-white disabled:opacity-50"
              >
                {odemePaying ? "…" : "Evet, onaylıyorum"}
              </button>
            </div>
          </div>
        </div>
      )}

      {kasaModal && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setKasaModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-pos-border bg-pos-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-100">Kasa özeti (bugün)</h3>
              <button
                type="button"
                className="text-sm text-slate-400 hover:text-slate-200"
                onClick={() => setKasaModal(false)}
              >
                Kapat
              </button>
            </div>

            {kasaLoading ? (
              <p className="mt-4 text-slate-500">Yükleniyor…</p>
            ) : (
              <>
                {kasaErr && <p className="mt-3 text-sm text-amber-400">{kasaErr}</p>}
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-pos-border bg-pos-bg/60 p-3">
                    <p className="text-xs text-slate-500">Günlük ciro</p>
                    <p className="mt-1 font-mono text-emerald-300">
                      {formatTry(canliToplamCiro)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-pos-border bg-pos-bg/60 p-3">
                    <p className="text-xs text-slate-500">Açık toplam tutar</p>
                    <p className="mt-1 font-mono text-slate-200">
                      {formatTry(acikToplamTutar)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-pos-border bg-pos-bg/60 p-3">
                    <p className="text-xs text-slate-500">Kapalı toplam tutar</p>
                    <p className="mt-1 font-mono text-slate-200">
                      {formatTry(kapaliToplamTutar)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-pos-border bg-pos-bg/60 p-3">
                    <p className="text-xs text-slate-500">Nakit (ödemesi alınan)</p>
                    <p className="mt-1 font-mono text-slate-200">
                      {formatTry(kasaCiro?.odeme_kurus?.nakit ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-pos-border bg-pos-bg/60 p-3">
                    <p className="text-xs text-slate-500">Kredi kartı (ödemesi alınan)</p>
                    <p className="mt-1 font-mono text-slate-200">
                      {formatTry(kasaCiro?.odeme_kurus?.kredi_karti ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-pos-border bg-pos-bg/60 p-3">
                    <p className="text-xs text-slate-500">Havale (ödemesi alınan)</p>
                    <p className="mt-1 font-mono text-slate-200">
                      {formatTry(kasaCiro?.odeme_kurus?.havale ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-pos-border bg-pos-bg/60 p-3">
                    <p className="text-xs text-slate-500">Toplam adisyon</p>
                    <p className="mt-1 font-mono text-slate-200">
                      {toplamAdisyonSayisi}
                    </p>
                  </div>
                  <div className="rounded-lg border border-pos-border bg-pos-bg/60 p-3">
                    <p className="text-xs text-slate-500">Açık adisyon</p>
                    <p className="mt-1 font-mono text-slate-200">{acikAdisyonSayisi}</p>
                  </div>
                  <div className="rounded-lg border border-pos-border bg-pos-bg/60 p-3">
                    <p className="text-xs text-slate-500">Kapalı adisyon</p>
                    <p className="mt-1 font-mono text-slate-200">{kapaliAdisyonSayisi}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={kasaPrinting || kasaLoading}
                    className="flex-1 min-h-[44px] rounded-lg border border-pos-border text-slate-300 disabled:opacity-50"
                    onClick={() => setKasaModal(false)}
                  >
                    Kapat
                  </button>
                  <button
                    type="button"
                    disabled={kasaPrinting || kasaLoading}
                    className="flex-1 min-h-[44px] rounded-lg bg-emerald-700 text-white disabled:opacity-50"
                    onClick={() => {
                      setKasaSifre("");
                      setKasaSifreErr("");
                      setKasaSifreModal(true);
                    }}
                  >
                    {kasaPrinting ? "Yazdırılıyor..." : "Yazdır"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {kasaSifreModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !kasaSifreBusy && setKasaSifreModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-pos-border bg-pos-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-100">Kasa yazdırma onayı</h3>
            <p className="mt-1 text-sm text-slate-500">
              Devam için aktif kullanıcının şifresini girin.
            </p>
            {kasaSifreErr && <p className="mt-2 text-sm text-red-400">{kasaSifreErr}</p>}
            <input
              type="password"
              className="mt-3 w-full min-h-[48px] rounded-lg border border-pos-border bg-pos-bg px-3 text-slate-100"
              value={kasaSifre}
              onChange={(e) => setKasaSifre(e.target.value)}
              placeholder="Şifre"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={kasaSifreBusy}
                className="flex-1 min-h-[44px] rounded-lg border border-pos-border text-slate-300 disabled:opacity-50"
                onClick={() => setKasaSifreModal(false)}
              >
                İptal
              </button>
              <button
                type="button"
                disabled={kasaSifreBusy}
                className="flex-1 min-h-[44px] rounded-lg bg-emerald-700 text-white disabled:opacity-50"
                onClick={kasaYazdirOnayla}
              >
                {kasaSifreBusy ? "Kontrol..." : "Onayla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, sub, onClick, disabled, active, primary }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "w-full rounded-lg px-2 py-2 border transition-colors min-h-[100px] flex flex-col items-center justify-center text-center",
        primary
          ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-100"
          : active
            ? "border-amber-400 bg-amber-950/30 text-amber-100"
            : "border-pos-border bg-pos-bg/80 text-slate-200 hover:bg-slate-800/80",
        disabled ? "opacity-40 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <span className="text-base font-semibold leading-tight">{label}</span>
      {sub && <span className="mt-1 text-[11px] text-slate-500 leading-tight">{sub}</span>}
    </button>
  );
}
