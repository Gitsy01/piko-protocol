import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Syne } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { AppWalletProvider } from "@/providers/wallet-provider";
import { AppShell } from "@/components/app-shell";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://depokemongo.app"),
  applicationName: "DePokemonGo",
  title: "DePokemonGo | Premium Solana Reward Hunts",
  description:
    "A premium cyberpunk PWA for location-based merchant quests on Solana. Discover nearby hotspots, pay with Solana Pay, and earn rewards instantly.",
  keywords: ["Solana", "Solana Pay", "crypto rewards", "merchant quests", "DePokemonGo", "web3", "PWA", "gaming rewards"],
  authors: [{ name: "DePokemonGo Team" }],
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
  openGraph: {
    title: "DePokemonGo | Premium Solana Reward Hunts",
    description: "Walk the map, unlock cyber quests, pay once, and earn instantly on Solana.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DePokemonGo | Premium Solana Reward Hunts",
    description: "Discover nearby merchants, complete quests, and collect rewards in a dark cyberpunk PWA.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
        <AppWalletProvider>
          <AppShell>{children}</AppShell>
        </AppWalletProvider>
      </body>
    </html>
  );
}
