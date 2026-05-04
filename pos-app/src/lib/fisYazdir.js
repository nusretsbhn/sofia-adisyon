import api from "../api/client.js";

/**
 * Sunucudan fiş metnini alır; Electron’da yazıcıya gönderir (tarayıcıda yalnızca API yanıtı).
 * @returns {{ ok: boolean; toast: string }}
 */
export async function fisMetniYazdir(adisyonId) {
  if (!adisyonId) return { ok: false, toast: "Geçersiz adisyon" };
  try {
    const { data } = await api.post(`/api/adisyonlar/${adisyonId}/yazdir`);
    if (typeof window !== "undefined" && window.turadisyon?.printReceipt && data?.metin) {
      const printerName = localStorage.getItem("turadisyon_printer_name") || "kasa";
      const r = await window.turadisyon.printReceipt({
        printerName,
        text: data.metin,
      });
      return {
        ok: !!r?.ok,
        toast: r?.ok ? "Fiş yazdırıldı." : r?.error || "Yazdırılamadı.",
      };
    }
    return {
      ok: true,
      toast: data.yazdirildi ? "Fiş yazdırıldı." : data.uyari || "Tamam.",
    };
  } catch (e) {
    return {
      ok: false,
      toast: e?.response?.data?.error || "Fiş yazdırılamadı.",
    };
  }
}
