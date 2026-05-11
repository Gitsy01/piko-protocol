"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDemoContext } from "@/providers/demo-context";
import { DemoStepper } from "@/components/demo-stepper";
import { DemoQuestCard } from "@/components/demo-quest-card";
import { DemoPayPanel } from "@/components/demo-pay-panel";
import { AIEvaluationScreen } from "@/components/ai-evaluation-screen";
import { DemoReward } from "@/components/demo-reward";
import { DemoWalletGate } from "@/components/demo-wallet-gate";

const DynamicMapView = dynamic(
  () => import("@/components/map-view").then((module) => module.MapView),
  { ssr: false, loading: () => <div className="demoMapFallback demoMapSkeleton" aria-hidden="true" /> }
);

export function DemoPageInner() {
  const { state } = useDemoContext();
  const { publicKey, connected } = useWallet();
  const { merchant } = state;

  const location = { lat: merchant.lat - 0.0012, lng: merchant.lng - 0.001 };
  const heatmapData = [
    {
      lat: merchant.lat,
      lng: merchant.lng,
      weight: Math.min(merchant.rewardMultiplier / 3, 1),
    },
  ];

  return (
    <div className="demoFlowPage" id="demo-flow-page">
      <div className="demoMapBg" aria-hidden="true">
        <DynamicMapView
          center={location}
          focusLocation={{ lat: merchant.lat, lng: merchant.lng }}
          userAccuracy={12}
          merchants={[merchant]}
          heatmapData={heatmapData}
          selectedMerchantId={merchant.id}
          onSelectMerchant={() => undefined}
        />
        <div className="demoMapGradient" />
      </div>

      <header className="demoTopbar">
        <Link href="/" className="demoTopbarBrand">
          <span className="brandBeacon" aria-hidden="true" />
          <span className="brandMark">PIKO Protocol</span>
        </Link>
        <div className="demoTopbarRight">
          <span className={`demoConnectedWallet ${connected ? "connected" : ""}`}>
            {publicKey ? `${publicKey.toBase58().slice(0, 6)}...${publicKey.toBase58().slice(-4)}` : "Wallet required"}
          </span>
          <Link href="/" className="demoExitLink" aria-label="Exit demo">
            Back to full app
          </Link>
        </div>
      </header>

      {!connected ? <DemoWalletGate /> : null}

      <DemoStepper />

      <main className="demoContentArea">
        {state.step === "discover" ? <DemoQuestCard /> : null}
        {state.step === "pay" ? <DemoPayPanel /> : null}
        {state.step === "evaluating" ? <AIEvaluationScreen /> : null}
        {state.step === "reward" ? <DemoReward /> : null}
      </main>
    </div>
  );
}
