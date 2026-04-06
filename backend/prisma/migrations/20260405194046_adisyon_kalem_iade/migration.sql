-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdisyonKalem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adisyon_id" INTEGER NOT NULL,
    "urun_id" INTEGER NOT NULL,
    "urun_adi" TEXT NOT NULL,
    "birim_fiyat" INTEGER NOT NULL,
    "adet" INTEGER NOT NULL,
    "toplam_fiyat" INTEGER NOT NULL,
    "ikram" BOOLEAN NOT NULL DEFAULT false,
    "iade" BOOLEAN NOT NULL DEFAULT false,
    "ikram_neden" TEXT,
    "fiyat_degistirildi" BOOLEAN NOT NULL DEFAULT false,
    "orijinal_fiyat" INTEGER,
    "ekleme_tarihi" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ekleyen_kullanici_id" INTEGER NOT NULL,
    CONSTRAINT "AdisyonKalem_adisyon_id_fkey" FOREIGN KEY ("adisyon_id") REFERENCES "Adisyon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdisyonKalem_urun_id_fkey" FOREIGN KEY ("urun_id") REFERENCES "Urun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdisyonKalem_ekleyen_kullanici_id_fkey" FOREIGN KEY ("ekleyen_kullanici_id") REFERENCES "Kullanici" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AdisyonKalem" ("adet", "adisyon_id", "birim_fiyat", "ekleme_tarihi", "ekleyen_kullanici_id", "fiyat_degistirildi", "id", "ikram", "ikram_neden", "orijinal_fiyat", "toplam_fiyat", "urun_adi", "urun_id") SELECT "adet", "adisyon_id", "birim_fiyat", "ekleme_tarihi", "ekleyen_kullanici_id", "fiyat_degistirildi", "id", "ikram", "ikram_neden", "orijinal_fiyat", "toplam_fiyat", "urun_adi", "urun_id" FROM "AdisyonKalem";
DROP TABLE "AdisyonKalem";
ALTER TABLE "new_AdisyonKalem" RENAME TO "AdisyonKalem";
CREATE INDEX "AdisyonKalem_adisyon_id_idx" ON "AdisyonKalem"("adisyon_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
