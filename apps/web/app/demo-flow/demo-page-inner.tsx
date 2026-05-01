"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useDemoContext } from "@/providers/demo-context";
import { useMerchantMap } from "@/hooks/use-merchant-map";
import { DemoStepper } from "@/components/demo-stepper";
import { DemoQuestCard } from "@/components/demo-quest-card";
import { DemoPayPanel } from "@/components/demo-pay-panel";
import { AIEvaluationScreen } from "@/components/ai-evaluation-screen";
import { DemoReward } from "@/components/demo-reward";
import { DemoWalletGate } from "@/components/demo-wallet-gate";

const DynamicMapView = dynamic(
  () => import("@/components/map-view").then((m) => m.MapView),
  { ssr: false, loading: () => <div className="demoMapFallback">Loading map…</div> }
);

export function DemoPageInner() {
  const { state } = useDemoContext();
  const { connected } = useWallet();
  const { merchants, heatmapData, location, accuracy } = useMerchantMap();
  const { merchant } = state;

  const focusLocation = { lat: merchant.lat, lng: merchant.lng };

  return (
    <div className="demoFlowPage" id="demo-flow-page">
      {/* Full-screen map background */}
      <div className="demoMapBg" aria-hidden="true">
        <DynamicMapView
          center={location}
          focusLocation={focusLocation}
          userAccuracy={accuracy}
          merchants={merchants.length > 0 ? merchants : [merchant]}
          heatmapData={heatmapData}
          selectedMerchantId={merchant.id}
          onSelectMerchant={() => undefined}
        />
        <div className="demoMapGradient" />
      </div>

      {/* Slim topbar */}
      <header className="demoTopbar">
        <Link href="/" className="demoTopbarBrand">
          <span className="brandBeacon" aria-hidden="true" />
          <span className="brandMark">DePokemonGo</span>
        </Link>
        <div className="demoTopbarRight">
          <Link href="/" className="demoExitLink" aria-label="Exit demo">
            ← Full App
          </Link>
          <WalletMultiButton />
        </div>
      </header>

      {/* Progress stepper */}
      <DemoStepper />

      {/* Main content panel */}
      <main className="demoContentArea">
        {state.step === "discover" && <DemoQuestCard />}
        {state.step === "pay" && <DemoPayPanel />}
        {state.step === "evaluating" && <AIEvaluationScreen />}
        {state.step === "reward" && <DemoReward />}
      </main>

      {/* Wallet gate overlay */}
      {!connected && state.step !== "reward" && state.step !== "evaluating" && <DemoWalletGate />}
    </div>
  );
}
