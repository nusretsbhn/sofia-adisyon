import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  let admin = await prisma.kullanici.findUnique({
    where: { kullanici_adi: "admin" },
  });
  if (!admin) {
    admin = await prisma.kullanici.create({
      data: {
        ad: "Admin",
        soyad: "User",
        kullanici_adi: "admin",
        sifre_hash: await bcrypt.hash("admin123", 12),
        rol: "ADMIN",
        aktif: true,
      },
    });
    console.log("Seed: admin oluşturuldu — kullanici_adi: admin, şifre: admin123");
  }

  const urunSayisi = await prisma.urun.count();
  if (urunSayisi === 0) {
    const icecek = await prisma.kategori.create({
      data: { ad: "İçecek", renk: "#3B82F6", sira: 0, aktif: true },
    });
    const yiyecek = await prisma.kategori.create({
      data: { ad: "Yiyecek", renk: "#22C55E", sira: 1, aktif: true },
    });
    await prisma.urun.createMany({
      data: [
        {
          kategori_id: icecek.id,
          ad: "Cola",
          fiyat: 5000,
          stok_takibi: false,
          aktif: true,
        },
        {
          kategori_id: icecek.id,
          ad: "Efes",
          fiyat: 8500,
          stok_takibi: false,
          aktif: true,
        },
        {
          kategori_id: yiyecek.id,
          ad: "Kuruyemiş",
          fiyat: 12000,
          stok_takibi: true,
          min_stok: 5,
          aktif: true,
        },
      ],
    });
    console.log("Seed: örnek kategoriler ve ürünler eklendi.");
  }

  const cariSayisi = await prisma.cari.count();
  if (cariSayisi === 0) {
    await prisma.cari.create({
      data: { ad: "Örnek Cari Müşteri", telefon: "05001234567", toplam_borc: 0 },
    });
    console.log("Seed: örnek cari eklendi.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
