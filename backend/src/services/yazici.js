import { createRequire } from "module";
import dayjs from "dayjs";
import { prisma } from "../lib/prisma.js";
import { AYAR_DEFAULTS } from "./ayarDefaults.js";

const require = createRequire(import.meta.url);
const {
  ThermalPrinter,
  PrinterTypes,
  CharacterSet,
  BreakLine,
} = require("node-thermal-printer");

export async function getMergedAyarlar() {
  const rows = await prisma.programAyar.findMany();
  const kayitli = Object.fromEntries(rows.map((r) => [r.anahtar, r.deger]));
  return { ...AYAR_DEFAULTS, ...kayitli };
}

/** Ayarlardaki port/tam yol → node-thermal-printer `interface` */
export function normalizeYaziciInterface(port) {
  const p = (port || "").trim();
  if (!p) return null;
  if (p.startsWith("tcp://") || p.startsWith("printer:")) return p;
  if (p.startsWith("\\\\.\\") || p.startsWith("/dev/")) return p;
  if (/^COM\d+$/i.test(p)) return `\\\\.\\${p.toUpperCase()}`;
  return p;
}

function formatTl(kurus) {
  return `${(kurus / 100).toFixed(2)} TL`;
}

function center(text, width) {
  const t = String(text);
  if (t.length >= width) return t.slice(0, width);
  const pad = Math.max(0, Math.floor((width - t.length) / 2));
  return " ".repeat(pad) + t;
}

const LINE_W = 32;

/**
 * @param {import("@prisma/client").Adisyon & { kalemler: any[], olusturan: any, odemeler: any[] }} adisyon
 * @param {Record<string, string>} ayarlar
 */
export function buildAdisyonFisMetni(adisyon, ayarlar) {
  const lines = [];
  const sep = (ch = "=") => ch.repeat(LINE_W);

  lines.push(sep());
  lines.push(center(ayarlar.isletme_adi || "TurAdisyon", LINE_W));
  const alt = [ayarlar.isletme_adres, ayarlar.isletme_telefon]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" | ");
  if (alt) lines.push(center(alt, LINE_W));
  lines.push(sep("-"));

  lines.push(`Adisyon No : #${adisyon.numara}`);
  lines.push(`Müşteri    : ${(adisyon.musteri_adi || "").trim() || "-"}`);
  lines.push(
    `Tarih      : ${dayjs(adisyon.acilis_tarihi).format("DD.MM.YYYY HH:mm")}`,
  );
  const kasiyer = adisyon.olusturan
    ? `${adisyon.olusturan.ad} ${adisyon.olusturan.soyad}`.trim()
    : "-";
  lines.push(`Kasiyer    : ${kasiyer}`);
  lines.push(sep("-"));
  lines.push("ÜRÜN           ADET    TUTAR");
  lines.push(sep("-"));

  for (const k of adisyon.kalemler ?? []) {
    const ad = (k.urun_adi || "").slice(0, 14).padEnd(14);
    const adetStr = `${k.adet}x`.padStart(4);
    const tut = formatTl(k.toplam_fiyat).padStart(10);
    lines.push(`${ad} ${adetStr} ${tut}`);
  }

  lines.push(sep("-"));
  if ((adisyon.indirim_tutari ?? 0) > 0) {
    lines.push(`İndirim: ${formatTl(adisyon.indirim_tutari)}`);
  }
  lines.push(`TOPLAM: ${formatTl(adisyon.toplam_tutar)}`);

  if (adisyon.durum === "KAPALI") {
    let odemeStr = adisyon.odeme_turu || "-";
    const od = adisyon.odemeler ?? [];
    if (od.length > 1) {
      odemeStr = od.map((o) => `${o.odeme_turu} ${formatTl(o.tutar)}`).join(", ");
    } else if (od.length === 1) {
      odemeStr = `${od[0].odeme_turu} ${formatTl(od[0].tutar)}`;
    }
    lines.push(`ÖDEME: ${odemeStr}`);
  }

  lines.push(sep());
  lines.push(center("Teşekkür ederiz!", LINE_W));
  lines.push(sep());

  return lines.join("\n");
}

/**
 * @returns {Promise<{ yazdirildi: boolean, hata?: string }>}
 */
export async function yazdirTermal(metin, ayarlar) {
  const iface = normalizeYaziciInterface(ayarlar.yazici_port);
  if (!iface) {
    return {
      yazdirildi: false,
      hata: "Yazıcı bağlantısı ayarlı değil (Admin → Ayarlar → Termal yazıcı COM port).",
    };
  }

  try {
    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: iface,
      characterSet: CharacterSet.PC857_TURKISH,
      removeSpecialCharacters: false,
      breakLine: BreakLine.WORD,
    });

    for (const line of metin.split("\n")) {
      printer.println(line);
    }
    printer.cut();
    await printer.execute();
    return { yazdirildi: true };
  } catch (e) {
    return {
      yazdirildi: false,
      hata: e?.message || String(e),
    };
  }
}
