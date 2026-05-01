import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { startServer } from "next/dist/server/lib/start-server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appDir = path.join(repoRoot, "apps", "web");
const distDir = path.join(appDir, ".next");
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOST ?? "localhost";

// Clear stale OneDrive-tagged build artifacts before Next tries to recycle them.
await rm(distDir, { recursive: true, force: true });

await startServer({
  dir: appDir,
  isDev: true,
  port,
  hostname,
  allowRetry: false,
});
