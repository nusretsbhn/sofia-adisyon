import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requestLogger } from "./middleware/logger.js";
import authRoutes from "./routes/auth.js";
import adisyonRoutes from "./routes/adisyon.js";
import urunRoutes from "./routes/urun.js";
import cariRoutes from "./routes/cari.js";
import kategoriRoutes from "./routes/kategori.js";
import ayarlarRoutes from "./routes/ayarlar.js";
import raporlarRoutes from "./routes/raporlar.js";
import yedekRoutes from "./routes/yedek.js";
import envanterRoutes from "./routes/envanter.js";
import receteRoutes from "./routes/recete.js";
import kullanicilarRoutes from "./routes/kullanicilar.js";
import syncRoutes from "./routes/sync.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(requestLogger);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "turadisyon-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/adisyonlar", adisyonRoutes);
app.use("/api/urunler", urunRoutes);
app.use("/api/cariler", cariRoutes);
app.use("/api/kategoriler", kategoriRoutes);
app.use("/api/ayarlar", ayarlarRoutes);
app.use("/api/raporlar", raporlarRoutes);
app.use("/api/yedek", yedekRoutes);
app.use("/api/envanter", envanterRoutes);
app.use("/api/receteler", receteRoutes);
app.use("/api/kullanicilar", kullanicilarRoutes);
app.use("/api/sync", syncRoutes);

const adminDist = path.join(__dirname, "../../admin-panel/dist");
const adminIndex = path.join(adminDist, "index.html");
if (fs.existsSync(adminIndex)) {
  app.use("/admin", express.static(adminDist));
  app.get("/admin/*", (_req, res) => {
    res.sendFile(adminIndex);
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Sunucu hatası" });
});

export default app;
