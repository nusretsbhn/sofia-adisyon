import path from "path";
import { fileURLToPath } from "url";

const prismaDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../prisma");

/**
 * Prisma SQLite DATABASE_URL için dosya yolu (file:./dev.db → prisma/dev.db).
 */
export function getSqliteDatabasePath() {
  const raw = (process.env.DATABASE_URL || "file:./dev.db").trim();
  if (!raw.startsWith("file:")) {
    throw new Error("SQLite DATABASE_URL bekleniyor");
  }
  let rest = raw.slice(5).trim();
  if (rest.startsWith("./")) {
    return path.resolve(prismaDir, rest.slice(2));
  }
  if (rest.startsWith("/") || /^[a-zA-Z]:/.test(rest)) {
    return path.normalize(rest);
  }
  return path.resolve(prismaDir, rest);
}
