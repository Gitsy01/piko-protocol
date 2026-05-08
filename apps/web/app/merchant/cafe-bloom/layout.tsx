import type { Metadata } from "next";
import "./merchant.css";

export const metadata: Metadata = {
  title: "Cafe Bloom — PIKO Protocol Merchant",
  description:
    "Realistic merchant simulation for Cafe Bloom — a third-wave coffee shop on the PIKO Protocol incentive network. View menu, transactions, and reward economics.",
};

export default function CafeBloomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
