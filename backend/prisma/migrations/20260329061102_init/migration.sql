-- CreateTable
CREATE TABLE "Kullanici" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ad" TEXT NOT NULL,
    "soyad" TEXT NOT NULL,
    "kullanici_adi" TEXT NOT NULL,
    "sifre_hash" TEXT NOT NULL,
    "pin_hash" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'GARSON',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturma_tarihi" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Kategori" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ad" TEXT NOT NULL,
    "renk" TEXT,
    "ikon" TEXT,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Urun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kategori_id" INTEGER NOT NULL,
    "ad" TEXT NOT NULL,
    "fiyat" INTEGER NOT NULL,
    "barkod" TEXT,
    "stok_takibi" BOOLEAN NOT NULL DEFAULT false,
    "min_stok" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturma_tarihi" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Urun_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "Kategori" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recete" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "urun_id" INTEGER NOT NULL,
    "hammadde_ad" TEXT NOT NULL,
    "miktar" REAL NOT NULL,
    "birim" TEXT NOT NULL,
    CONSTRAINT "Recete_urun_id_fkey" FOREIGN KEY ("urun_id") REFERENCES "Urun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Adisyon" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numara" TEXT NOT NULL,
    "musteri_adi" TEXT NOT NULL DEFAULT '',
    "acilis_tarihi" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kapanma_tarihi" DATETIME,
    "durum" TEXT NOT NULL DEFAULT 'ACIK',
    "odeme_turu" TEXT,
    "toplam_tutar" INTEGER NOT NULL DEFAULT 0,
    "indirim_tutari" INTEGER NOT NULL DEFAULT 0,
    "notlar" TEXT,
    "olusturan_kullanici_id" INTEGER NOT NULL,
    CONSTRAINT "Adisyon_olusturan_kullanici_id_fkey" FOREIGN KEY ("olusturan_kullanici_id") REFERENCES "Kullanici" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdisyonKalem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adisyon_id" INTEGER NOT NULL,
    "urun_id" INTEGER NOT NULL,
    "urun_adi" TEXT NOT NULL,
    "birim_fiyat" INTEGER NOT NULL,
    "adet" INTEGER NOT NULL,
    "toplam_fiyat" INTEGER NOT NULL,
    "ikram" BOOLEAN NOT NULL DEFAULT false,
    "ikram_neden" TEXT,
    "fiyat_degistirildi" BOOLEAN NOT NULL DEFAULT false,
    "orijinal_fiyat" INTEGER,
    "ekleme_tarihi" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ekleyen_kullanici_id" INTEGER NOT NULL,
    CONSTRAINT "AdisyonKalem_adisyon_id_fkey" FOREIGN KEY ("adisyon_id") REFERENCES "Adisyon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdisyonKalem_urun_id_fkey" FOREIGN KEY ("urun_id") REFERENCES "Urun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdisyonKalem_ekleyen_kullanici_id_fkey" FOREIGN KEY ("ekleyen_kullanici_id") REFERENCES "Kullanici" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Odeme" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adisyon_id" INTEGER NOT NULL,
    "tutar" INTEGER NOT NULL,
    "odeme_turu" TEXT NOT NULL,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kullanici_id" INTEGER NOT NULL,
    CONSTRAINT "Odeme_adisyon_id_fkey" FOREIGN KEY ("adisyon_id") REFERENCES "Adisyon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Odeme_kullanici_id_fkey" FOREIGN KEY ("kullanici_id") REFERENCES "Kullanici" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cari" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ad" TEXT NOT NULL,
    "telefon" TEXT,
    "email" TEXT,
    "notlar" TEXT,
    "toplam_borc" INTEGER NOT NULL DEFAULT 0,
    "olusturma_tarihi" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CariHareket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cari_id" INTEGER NOT NULL,
    "adisyon_id" INTEGER,
    "tutar" INTEGER NOT NULL,
    "aciklama" TEXT,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kullanici_id" INTEGER NOT NULL,
    CONSTRAINT "CariHareket_cari_id_fkey" FOREIGN KEY ("cari_id") REFERENCES "Cari" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CariHareket_adisyon_id_fkey" FOREIGN KEY ("adisyon_id") REFERENCES "Adisyon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CariHareket_kullanici_id_fkey" FOREIGN KEY ("kullanici_id") REFERENCES "Kullanici" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnvanterGiris" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "urun_id" INTEGER NOT NULL,
    "miktar" INTEGER NOT NULL,
    "birim_maliyet" INTEGER,
    "toplam_maliyet" INTEGER,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aciklama" TEXT,
    "kullanici_id" INTEGER NOT NULL,
    CONSTRAINT "EnvanterGiris_urun_id_fkey" FOREIGN KEY ("urun_id") REFERENCES "Urun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EnvanterGiris_kullanici_id_fkey" FOREIGN KEY ("kullanici_id") REFERENCES "Kullanici" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnvanterCikis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "urun_id" INTEGER NOT NULL,
    "adisyon_kalem_id" INTEGER,
    "miktar" INTEGER NOT NULL,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnvanterCikis_urun_id_fkey" FOREIGN KEY ("urun_id") REFERENCES "Urun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EnvanterCikis_adisyon_kalem_id_fkey" FOREIGN KEY ("adisyon_kalem_id") REFERENCES "AdisyonKalem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramAyar" (
    "anahtar" TEXT NOT NULL PRIMARY KEY,
    "deger" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Kullanici_kullanici_adi_key" ON "Kullanici"("kullanici_adi");

-- CreateIndex
CREATE INDEX "Recete_urun_id_idx" ON "Recete"("urun_id");

-- CreateIndex
CREATE INDEX "Adisyon_durum_idx" ON "Adisyon"("durum");

-- CreateIndex
CREATE INDEX "Adisyon_acilis_tarihi_idx" ON "Adisyon"("acilis_tarihi");

-- CreateIndex
CREATE INDEX "AdisyonKalem_adisyon_id_idx" ON "AdisyonKalem"("adisyon_id");

-- CreateIndex
CREATE INDEX "Odeme_adisyon_id_idx" ON "Odeme"("adisyon_id");

-- CreateIndex
CREATE INDEX "CariHareket_cari_id_idx" ON "CariHareket"("cari_id");

-- CreateIndex
CREATE INDEX "EnvanterGiris_urun_id_idx" ON "EnvanterGiris"("urun_id");

-- CreateIndex
CREATE INDEX "EnvanterCikis_urun_id_idx" ON "EnvanterCikis"("urun_id");
