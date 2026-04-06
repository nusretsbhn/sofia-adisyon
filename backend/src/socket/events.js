import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";

/** @type {import('socket.io').Server | null} */
let ioRef = null;

/**
 * @param {import('socket.io').Server} io
 */
export function setupSocket(io) {
  ioRef = io;

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ??
        (typeof socket.handshake.query?.token === "string"
          ? socket.handshake.query.token
          : null) ??
        (() => {
          const h = socket.handshake.headers?.authorization;
          return typeof h === "string" && h.startsWith("Bearer ") ? h.slice(7) : null;
        })();

      if (!token || typeof token !== "string") {
        return next(new Error("Yetkisiz"));
      }

      const payload = jwt.verify(token, config.jwtSecret);
      const userId = Number(payload.sub);
      const user = await prisma.kullanici.findUnique({
        where: { id: userId },
        select: { id: true, rol: true, aktif: true },
      });
      if (!user?.aktif) {
        return next(new Error("Yetkisiz"));
      }

      socket.data.userId = user.id;
      socket.data.rol = user.rol;
      next();
    } catch {
      next(new Error("Yetkisiz"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("disconnect", () => {});
  });
}

export function getIo() {
  return ioRef;
}

export function emitAdisyonEvent(event, payload) {
  ioRef?.emit(event, payload);
}
