import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const posRoot = path.join(__dirname, "..");
const repoRoot = path.join(posRoot, "..");
const backendSrc = path.join(repoRoot, "backend");
const outDir = path.join(posRoot, "bundled-backend");

if (!fs.existsSync(path.join(backendSrc, "src", "index.js"))) {
  console.error("backend klasörü bulunamadı:", backendSrc);
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

fs.cpSync(path.join(backendSrc, "src"), path.join(outDir, "src"), { recursive: true });
fs.cpSync(path.join(backendSrc, "prisma"), path.join(outDir, "prisma"), { recursive: true });
fs.copyFileSync(path.join(backendSrc, "package.json"), path.join(outDir, "package.json"));

console.log("bundled-backend: npm install --omit=dev …");
execSync("npm install --omit=dev", { cwd: outDir, stdio: "inherit" });
console.log("bundled-backend: prisma generate …");
execSync("npx prisma generate", { cwd: outDir, stdio: "inherit" });
console.log("bundled-backend hazır:", outDir);
