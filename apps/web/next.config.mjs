import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import("next").NextConfig} */
const nextConfig = {
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@depokemongo/common"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
