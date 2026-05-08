import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PIKO Protocol",
    short_name: "PIKO",
    description: "Real-world programmable incentives with visible verification and on-chain settlement.",
    start_url: "/",
    display: "standalone",
    background_color: "#05050b",
    theme_color: "#0a0a12",
    orientation: "portrait",
    categories: ["finance", "business", "productivity"],
    shortcuts: [
      { name: "Open Map", short_name: "Map", url: "/" },
      { name: "Open Incentives", short_name: "Incentives", url: "/quest/quest-bloom" },
      { name: "Open Wallet", short_name: "Wallet", url: "/wallet" },
    ],
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
