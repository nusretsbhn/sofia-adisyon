import dayjs from "dayjs";

/**
 * baslangic / bitis: YYYY-MM-DD. İkisi de yoksa bugün; biri yoksa tek gün.
 * @returns {{ start: Date, end: Date, baslangic: string, bitis: string }}
 */
export function parseTarihAraligi(req) {
  const qb = req.query.baslangic;
  const qe = req.query.bitis;

  let bas;
  let bit;
  if (qb && qe) {
    bas = dayjs(String(qb), "YYYY-MM-DD", true);
    bit = dayjs(String(qe), "YYYY-MM-DD", true);
  } else if (qb) {
    bas = dayjs(String(qb), "YYYY-MM-DD", true);
    bit = bas;
  } else if (qe) {
    bit = dayjs(String(qe), "YYYY-MM-DD", true);
    bas = bit;
  } else {
    bas = bit = dayjs();
  }

  if (!bas.isValid() || !bit.isValid()) {
    const err = new Error("TARIH");
    err.code = "TARIH";
    throw err;
  }

  const start = bas.startOf("day").toDate();
  const end = bit.endOf("day").toDate();
  if (start > end) {
    const err = new Error("TARIH_ARALIK");
    err.code = "TARIH_ARALIK";
    throw err;
  }

  return {
    start,
    end,
    baslangic: bas.format("YYYY-MM-DD"),
    bitis: bit.format("YYYY-MM-DD"),
  };
}

export function csvSatir(hucreler) {
  return hucreler
    .map((c) => {
      const s = c == null ? "" : String(c);
      if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    })
    .join(";");
}

/** Excel TR: UTF-8 BOM + noktalı virgül ayraç */
export function csvDosya(satirlar) {
  return "\uFEFF" + satirlar.join("\r\n");
}
