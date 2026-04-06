import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Yetkisiz" });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.userId = Number(payload.sub);
    req.userRol = payload.rol;
    next();
  } catch {
    return res.status(401).json({ error: "Geçersiz veya süresi dolmuş oturum" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.userRol !== "ADMIN") {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }
  next();
}

/** Admin paneli yazma / rapor vb. (garson ve personel hariç — yalnızca POS) */
export function requireKasiyerUstu(req, res, next) {
  if (req.userRol === "GARSON" || req.userRol === "PERSONEL") {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }
  next();
}

/** Veritabanından güncel kullanıcıyı yükler (requireAuth sonrası) */
export async function loadUser(req, res, next) {
  try {
    const user = await prisma.kullanici.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        ad: true,
        soyad: true,
        kullanici_adi: true,
        rol: true,
        aktif: true,
      },
    });
    if (!user || !user.aktif) {
      return res.status(401).json({ error: "Kullanıcı bulunamadı veya pasif" });
    }
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}
