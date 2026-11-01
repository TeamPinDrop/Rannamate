// Installs dependencies automatically the first time `npm run dev` is used.
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (!existsSync(join(root, "node_modules", "next"))) {
  console.log("\n▶ First run — installing frontend dependencies (npm install)…\n");
  execSync("npm install", { cwd: root, stdio: "inherit" });
}
