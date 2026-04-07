/**
 * Paketlenmiş POS: Prisma CLI (migrate deploy) ağ/ TLS / Program Files yazımı sorunları çıkarabiliyor.
 * Migrasyon SQL dosyalarını doğrudan SQLite üzerinde uygular; tamamen çevrimdışı.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import initSqlJs from "sql.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function parseSqliteFileFromDatabaseUrl(raw) {
  const u = String(raw || "").trim();
  if (!u.startsWith("file:")) {
    throw new Error("DATABASE_URL sqlite file: olmalı, alındı: " + u.slice(0, 80));
  }
  let rest = u.slice("file:".length).trim();
  if (rest.startsWith("//")) rest = rest.slice(2);
  return path.resolve(rest);
}

function sha256Hex(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL tanımlı değil");

  const backendRoot = path.join(__dirname, "..");
  const migrationsDir = path.join(backendRoot, "prisma", "migrations");
  const dbPath = parseSqliteFileFromDatabaseUrl(databaseUrl);

  const wasmDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(wasmDir, f),
  });

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  let db;
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
  `);

  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const appliedStmt = db.prepare(
    'SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL'
  );
  const applied = new Set();
  while (appliedStmt.step()) {
    applied.add(appliedStmt.get()[0]);
  }
  appliedStmt.free();

  for (const name of dirs) {
    if (applied.has(name)) continue;
    const sqlPath = path.join(migrationsDir, name, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;

    const body = fs.readFileSync(sqlPath, "utf8");
    const checksum = sha256Hex(body);
    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    db.run("BEGIN");
    try {
      db.exec(body);
      const finishedAt = new Date().toISOString();
      db.run(
        `INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count")
         VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
        [id, checksum, finishedAt, name, startedAt]
      );
      db.run("COMMIT");
    } catch (e) {
      try {
        db.run("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw new Error(`Migrasyon uygulanamadı (${name}): ${e.message || e}`);
    }
  }

  const data = db.export();
  db.close();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
