"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AIDecisionPanel } from "@/components/ai-decision-panel";
import { useDemoHref } from "@/hooks/use-demo-mode";
import { demoAiPreview, demoPrimaryMerchant, demoPrimaryQuest } from "@/lib/demo-data";
import { formatDistance, formatReward } from "@/lib/utils";

const DynamicMapView = dynamic(
  () => import("@/components/map-view").then((mod) => mod.MapView),
  {
    ssr: false,
    loading: () => <div className="mapFallback">Loading demo map...</div>,
  }
);

export function DemoKioskHome() {
  const merchant = demoPrimaryMerchant;
  const quest = demoPrimaryQuest;
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const isSelected = selectedMerchantId === merchant.id;
  const flowHref = useDemoHref("/demo-flow");

  const mapCenter = useMemo(
    () => ({ lat: merchant.lat - 0.0012, lng: merchant.lng - 0.001 }),
    [merchant.lat, merchant.lng]
  );

  const heatmapData = useMemo(
    () => [
      {
        lat: merchant.lat,
        lng: merchant.lng,
        weight: Math.min(merchant.rewardMultiplier / 3, 1),
      },
    ],
    [merchant.lat, merchant.lng, merchant.rewardMultiplier]
  );

  return (
    <div className="pageStack demoKioskPage">
      <section className="demoKioskHero">
        <div className="demoKioskCopy">
          <p className="eyebrow">PIKO Protocol</p>
          <h1>Earn rewards for real-world actions instantly on-chain.</h1>
          <p className="heroCopy">
            This is the judge path. Open the map, tap the one merchant pin, confirm the payment,
            and watch a verified 5 PIKO incentive settle with a visible decision receipt.
          </p>
          <div className="demoKioskFlow">
            <div className="demoKioskFlowStep">
              <span>1</span>
              <strong>Open map</strong>
            </div>
            <div className="demoKioskFlowStep">
              <span>2</span>
              <strong>Tap Cafe Bloom</strong>
            </div>
            <div className="demoKioskFlowStep">
              <span>3</span>
              <strong>Confirm payment</strong>
            </div>
            <div className="demoKioskFlowStep">
              <span>4</span>
              <strong>Settle 5 PIKO</strong>
            </div>
          </div>
        </div>

        <div className="demoKioskStats">
          <div className="statChip">
            <span>1</span>
            <p>Merchant pin</p>
          </div>
          <div className="statChip">
            <span>5</span>
            <p>PIKO reward</p>
          </div>
          <div className="statChip">
            <span>1.5x</span>
            <p>AI boost</p>
          </div>
        </div>
      </section>

      <section className="demoKioskLayout">
        <div className="demoKioskMapCard">
          <div className="demoKioskMapHeader">
            <div>
              <p className="eyebrow">Demo map</p>
              <h2>One pin. One deterministic path.</h2>
            </div>
            <span className="supportText">Tap the Cafe Bloom pin to continue.</span>
          </div>

          <div className="demoKioskMapShell">
            <DynamicMapView
              center={mapCenter}
              focusLocation={isSelected ? { lat: merchant.lat, lng: merchant.lng } : mapCenter}
              userAccuracy={12}
              merchants={[merchant]}
              heatmapData={heatmapData}
              selectedMerchantId={isSelected ? merchant.id : null}
              onSelectMerchant={(nextMerchant) => setSelectedMerchantId(nextMerchant.id)}
            />
          </div>
        </div>

        <aside className="demoKioskQuestCard">
          {isSelected ? (
            <>
              <p className="eyebrow">Scripted protocol path</p>
              <h2>{quest.title}</h2>
              <p className="heroCopy">
                {merchant.name} in {merchant.district}
              </p>

              <div className="demoKioskMeta">
                <div className="demoKioskMetaRow">
                  <span className="metricLabel">Distance</span>
                  <strong>{formatDistance(merchant.distance)}</strong>
                </div>
                <div className="demoKioskMetaRow">
                  <span className="metricLabel">Reward</span>
                  <strong>{formatReward(quest.rewardAmount, quest.rewardToken)}</strong>
                </div>
                <div className="demoKioskMetaRow">
                  <span className="metricLabel">Program type</span>
                  <strong>{quest.questType}</strong>
                </div>
              </div>

              <AIDecisionPanel
                fraudScore={demoAiPreview.fraudScore}
                fraudFlags={demoAiPreview.fraudFlags}
                rewardMultiplier={demoAiPreview.rewardMultiplier}
                rewardReasons={demoAiPreview.rewardReasons}
                decision={demoAiPreview.decision}
                worldVerified={demoAiPreview.worldVerified}
                compact
              />

              <p className="supportText demoKioskHint">
                AI is visible now: low fraud risk, reward logic, and the exact reasons for approval.
              </p>

              <Link className="primaryButton demoKioskCta" href={flowHref}>
                Run the 5 PIKO flow
              </Link>
            </>
          ) : (
            <div className="demoKioskEmpty">
              <p className="eyebrow">Step 1</p>
              <h2>Tap the only merchant pin on the map</h2>
              <p className="supportText">
                No exploration, no alternate routes, no playful detours. The demo starts when Cafe Bloom is selected.
              </p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
