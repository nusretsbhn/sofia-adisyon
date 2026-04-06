import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { requireAuth, loadUser, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, loadUser, requireAdmin);

const rolEnum = z.enum(["ADMIN", "PERSONEL"]);

const createSchema = z.object({
  ad: z.string().min(1).max(100),
  soyad: z.string().min(1).max(100),
  kullanici_adi: z.string().min(2).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  sifre: z.string().min(4).max(200),
  rol: rolEnum,
});

const updateSchema = z.object({
  ad: z.string().min(1).max(100).optional(),
  soyad: z.string().min(1).max(100).optional(),
  kullanici_adi: z.string().min(2).max(50).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  sifre: z.string().min(4).max(200).optional(),
  rol: rolEnum.optional(),
  aktif: z.boolean().optional(),
});

function parseId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

router.get("/", async (_req, res, next) => {
  try {
    const kullanicilar = await prisma.kullanici.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        ad: true,
        soyad: true,
        kullanici_adi: true,
        rol: true,
        aktif: true,
        olusturma_tarihi: true,
      },
    });
    res.json({ kullanicilar });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const exists = await prisma.kullanici.findUnique({
      where: { kullanici_adi: parsed.data.kullanici_adi },
    });
    if (exists) {
      return res.status(409).json({ error: "Bu kullanıcı adı zaten kullanılıyor" });
    }
    const sifre_hash = await bcrypt.hash(parsed.data.sifre, 12);
    const u = await prisma.kullanici.create({
      data: {
        ad: parsed.data.ad,
        soyad: parsed.data.soyad,
        kullanici_adi: parsed.data.kullanici_adi,
        sifre_hash,
        rol: parsed.data.rol,
      },
      select: {
        id: true,
        ad: true,
        soyad: true,
        kullanici_adi: true,
        rol: true,
        aktif: true,
        olusturma_tarihi: true,
      },
    });
    res.status(201).json({ kullanici: u });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }

    const mevcut = await prisma.kullanici.findUnique({ where: { id } });
    if (!mevcut) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    const b = parsed.data;
    const updateData = {};

    if (b.ad !== undefined) updateData.ad = b.ad;
    if (b.soyad !== undefined) updateData.soyad = b.soyad;
    if (b.kullanici_adi !== undefined && b.kullanici_adi !== mevcut.kullanici_adi) {
      const clash = await prisma.kullanici.findUnique({
        where: { kullanici_adi: b.kullanici_adi },
      });
      if (clash) {
        return res.status(409).json({ error: "Bu kullanıcı adı zaten kullanılıyor" });
      }
      updateData.kullanici_adi = b.kullanici_adi;
    }
    if (b.sifre && String(b.sifre).length > 0) {
      updateData.sifre_hash = await bcrypt.hash(b.sifre, 12);
    }
    if (b.rol !== undefined) updateData.rol = b.rol;
    if (b.aktif !== undefined) updateData.aktif = b.aktif;

    const yeniRol = updateData.rol ?? mevcut.rol;
    const yeniAktif = updateData.aktif !== undefined ? updateData.aktif : mevcut.aktif;

    if (mevcut.rol === "ADMIN" && mevcut.aktif && (yeniRol !== "ADMIN" || !yeniAktif)) {
      const digerAdmin = await prisma.kullanici.count({
        where: {
          rol: "ADMIN",
          aktif: true,
          id: { not: id },
        },
      });
      if (digerAdmin === 0) {
        return res.status(400).json({
          error: "Sistemde en az bir aktif Admin kullanıcı kalmalıdır",
        });
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Güncellenecek alan yok" });
    }

    const u = await prisma.kullanici.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        ad: true,
        soyad: true,
        kullanici_adi: true,
        rol: true,
        aktif: true,
        olusturma_tarihi: true,
      },
    });
    res.json({ kullanici: u });
  } catch (e) {
    next(e);
  }
});

export default router;
