-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Urun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kategori_id" INTEGER NOT NULL,
    "ad" TEXT NOT NULL,
    "fiyat" INTEGER NOT NULL,
    "barkod" TEXT,
    "tur" TEXT NOT NULL DEFAULT 'URUN',
    "stok_takibi" BOOLEAN NOT NULL DEFAULT false,
    "stok_birim" TEXT NOT NULL DEFAULT 'adet',
    "aciklama" TEXT,
    "min_stok" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturma_tarihi" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Urun_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "Kategori" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Urun" ("ad", "aktif", "barkod", "fiyat", "id", "kategori_id", "min_stok", "olusturma_tarihi", "stok_birim", "stok_takibi") SELECT "ad", "aktif", "barkod", "fiyat", "id", "kategori_id", "min_stok", "olusturma_tarihi", "stok_birim", "stok_takibi" FROM "Urun";
DROP TABLE "Urun";
ALTER TABLE "new_Urun" RENAME TO "Urun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
