import type { Metadata } from "next";
import { DemoContextProvider } from "@/providers/demo-context";

export const metadata: Metadata = {
  title: "DePokemonGo | Live Quest Demo",
  description: "Tap one thing, pay, earn PIKO instantly. A focused demo of the DePokemonGo reward flow.",
};

export default function DemoFlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoContextProvider>
      {children}
    </DemoContextProvider>
  );
}
