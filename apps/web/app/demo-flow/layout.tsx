import type { Metadata } from "next";
import { DemoContextProvider } from "@/providers/demo-context";

export const metadata: Metadata = {
  title: "PIKO Protocol | Live Demo",
  description: "Tap one pin, confirm the payment, and watch AI settle 5 PIKO with a visible receipt.",
};

export default function DemoFlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoContextProvider>
      {children}
    </DemoContextProvider>
  );
}
