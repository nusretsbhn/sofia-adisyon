import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, loadUser } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  kullanici_adi: z.string().min(1),
  sifre: z.string().min(1),
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Geçersiz istek" });
    }
    const { kullanici_adi, sifre } = parsed.data;
    const user = await prisma.kullanici.findUnique({
      where: { kullanici_adi },
    });
    if (!user || !user.aktif) {
      return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı" });
    }
    const ok = await bcrypt.compare(sifre, user.sifre_hash);
    if (!ok) {
      return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı" });
    }
    const accessToken = jwt.sign(
      { sub: user.id, rol: user.rol },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn },
    );
    return res.json({
      accessToken,
      user: {
        id: user.id,
        ad: user.ad,
        soyad: user.soyad,
        kullanici_adi: user.kullanici_adi,
        rol: user.rol,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/logout", (_req, res) => {
  res.status(204).send();
});

router.get("/me", requireAuth, loadUser, (req, res) => {
  res.json({ user: req.user });
});

export default router;
