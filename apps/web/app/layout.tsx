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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://piko-protocol.app"),
  applicationName: "PIKO Protocol",
  title: "PIKO Protocol | Verified Rewards and On-Chain Proofs",
  description:
    "PIKO verifies whether a contribution was real before community rewards are issued.",
  keywords: ["Solana", "Solana Pay", "fraud scoring", "on-chain reputation", "community rewards", "PIKO Protocol", "web3", "PWA"],
  authors: [{ name: "PIKO Protocol" }],
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
  openGraph: {
    title: "PIKO Protocol | Verified Rewards and On-Chain Proofs",
    description: "Verify contribution actions with visible risk signals and on-chain proof artifacts.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PIKO Protocol | Verified Rewards and On-Chain Proofs",
    description: "Contribution checks, reward settlement, and proof NFTs for community incentives.",
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
