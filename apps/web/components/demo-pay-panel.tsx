"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { VerificationGate } from "@/components/verification-gate";
import { demoAiPreview } from "@/lib/demo-data";
import type { DecisionReceiptData } from "@/lib/decision-receipt";
import { formatReward } from "@/lib/utils";
import { useDemoContext } from "@/providers/demo-context";

type DemoScenario = "clean" | "bad-gps" | "high-fraud" | "budget-low";

type ScenarioConfig = {
  id: DemoScenario;
  label: string;
  helper: string;
};

const SCENARIOS: ScenarioConfig[] = [
  { id: "clean", label: "Clean check", helper: "Approved reward" },
  { id: "bad-gps", label: "Bad GPS", helper: "Rejected for poor location accuracy" },
  { id: "high-fraud", label: "High fraud", helper: "Rejected by fraud model" },
  { id: "budget-low", label: "Budget low", helper: "Approved with reduced reward" },
];

function buildAIEvaluation(rewardToken: string, worldVerified: boolean, scenario: DemoScenario) {
  if (scenario === "bad-gps") {
    return {
      fraudScore: 63,
      fraudFlags: ["gps_drift_detected", "distance_out_of_zone", "location_conflict"],
      rewardMultiplier: 0,
      rewardReasons: ["Location proof failed", "Reward blocked until valid on-site check"],
      decision: "REJECTED" as const,
      worldVerified,
      paymentVerified: true,
      paymentAmountSol: 0.05,
      locationDistanceMeters: 318,
      gpsAccuracyMeters: 124,
      impossibleTravelClear: true,
      aiSummary: "Reward rejected: GPS accuracy and distance checks failed geofence policy.",
      originalReward: 5,
      adjustedReward: 0,
      adjustedRewardDisplay: "0.00",
      rewardToken,
      merchantBudget: 120,
      dailyEmissionRemaining: 8500,
      budgetCapActive: false,
    };
  }

  if (scenario === "high-fraud") {
    return {
      fraudScore: 94,
      fraudFlags: ["wallet_velocity_spike", "device_pattern_mismatch", "impossible_route_risk"],
      rewardMultiplier: 0,
      rewardReasons: ["Fraud risk too high", "Manual review required before any settlement"],
      decision: "REJECTED" as const,
      worldVerified,
      paymentVerified: true,
      paymentAmountSol: 0.05,
      locationDistanceMeters: 38,
      gpsAccuracyMeters: 8,
      impossibleTravelClear: false,
      aiSummary: "Reward rejected: fraud score crossed policy threshold for auto-settlement.",
      originalReward: 5,
      adjustedReward: 0,
      adjustedRewardDisplay: "0.00",
      rewardToken,
      merchantBudget: 120,
      dailyEmissionRemaining: 8500,
      budgetCapActive: false,
    };
  }

  if (scenario === "budget-low") {
    return {
      fraudScore: 11,
      fraudFlags: ["verified_payment", "world_id_verified", "budget_guard_triggered"],
      rewardMultiplier: 0.55,
      rewardReasons: ["Merchant budget low", "Emission guard reduced payout to preserve pool health"],
      decision: "APPROVED" as const,
      worldVerified,
      paymentVerified: true,
      paymentAmountSol: 0.05,
      locationDistanceMeters: 42,
      gpsAccuracyMeters: 9,
      impossibleTravelClear: true,
      aiSummary: "Approved with cap: budget guard reduced reward so emissions stay within limits.",
      originalReward: 5,
      adjustedReward: 2.75,
      adjustedRewardDisplay: "2.75",
      rewardToken,
      merchantBudget: 18,
      dailyEmissionRemaining: 1320,
      budgetCapActive: true,
    };
  }

  return {
    fraudScore: demoAiPreview.fraudScore,
    fraudFlags: demoAiPreview.fraudFlags,
    rewardMultiplier: demoAiPreview.rewardMultiplier,
    rewardReasons: demoAiPreview.rewardReasons,
    decision: demoAiPreview.decision,
    worldVerified,
    paymentVerified: true,
    paymentAmountSol: 0.05,
    locationDistanceMeters: 42,
    gpsAccuracyMeters: 9,
    impossibleTravelClear: true,
    aiSummary: "Verified payment, valid location, and clean travel history cleared the claim for settlement.",
    originalReward: 3.85,
    adjustedReward: 5,
    adjustedRewardDisplay: "5.00",
    rewardToken,
    // Economic visibility — judges see budget-controlled system, not infinite-mint
    merchantBudget: 120,
    dailyEmissionRemaining: 8500,
    budgetCapActive: false,
  };
}

function buildMockReceipt(input: {
  merchantName: string;
  rewardToken: string;
  worldVerified: boolean;
  scenario: DemoScenario;
}): DecisionReceiptData {
  const aiEvaluation = buildAIEvaluation(input.rewardToken, input.worldVerified, input.scenario);
  const isRejected = aiEvaluation.decision === "REJECTED";
  const mint =
    isRejected
      ? null
      : input.scenario === "clean"
        ? "5AbcD1efGhJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmTz8"
        : input.scenario === "budget-low"
          ? "7PnqS2vkLmNoPqRsTuVwXyZaBcDeFgHiJkLmN8Budget"
          : "9QrsTxUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYzProof";
  const multiplierRange =
    aiEvaluation.merchantBudget < 10
      ? "0.1× – 0.75×"
      : aiEvaluation.merchantBudget < 25
        ? "0.1× – 1.2×"
        : "0.1× – 3.0×";

  return {
    worldIdVerified: input.worldVerified,
    txSignature: isRejected ? "8mRejectTxSignal4u7aF3gH6jK9LmN2pQrStUvWxYz" : "5wRkZPmNx9LqaB3cDeFgHiJkLmNoPqRsTuVwXyZaTz8",
    distanceMeters: aiEvaluation.locationDistanceMeters,
    gpsAccuracy: aiEvaluation.gpsAccuracyMeters,
    fraudScore: aiEvaluation.fraudScore,
    fraudFlags: aiEvaluation.fraudFlags,
    aiSummary: aiEvaluation.aiSummary,
    approved: !isRejected,
    rewardAmount: aiEvaluation.adjustedReward,
    rewardToken: input.rewardToken,
    rewardMultiplier: aiEvaluation.rewardMultiplier,
    economicState: {
      vaultBalance: aiEvaluation.merchantBudget,
      budgetGuardActive: aiEvaluation.budgetCapActive,
      effectiveMultiplierRange: multiplierRange,
    },
    nftMint: mint,
    nftMetadata:
      mint && !isRejected
        ? {
            fraud_score: String(aiEvaluation.fraudScore),
            payment_verified: "true",
            location_verified: String(aiEvaluation.locationDistanceMeters < 200),
            reward_multiplier: String(aiEvaluation.rewardMultiplier),
            merchant: input.merchantName,
            visit_date: new Date().toISOString().split("T")[0],
            world_id_verified: String(input.worldVerified),
          }
        : undefined,
  };
}


export function DemoPayPanel() {
  const { state, dispatch } = useDemoContext();
  const { publicKey } = useWallet();
  const { quest, merchant, worldVerified, verifyPending } = state;
  const [submitting, setSubmitting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<DemoScenario>("clean");

  function handleWorldIdVerify() {
    if (!publicKey) {
      setWalletError("Connect wallet first.");
      return;
    }

    setWalletError(null);
    dispatch({ type: "VERIFY_START" });
    window.setTimeout(() => {
      dispatch({ type: "VERIFY_COMPLETE", payload: { worldVerified: true } });
    }, 800);
  }

  function handleMockPayment() {
    if (!publicKey) {
      setWalletError("Connect wallet first.");
      return;
    }

    setWalletError(null);
    setSubmitting(true);

    window.setTimeout(() => {
      const aiEvaluation = buildAIEvaluation(quest.rewardToken, true, scenario);
      const isRejected = aiEvaluation.decision === "REJECTED";

      dispatch({
        type: "PAYMENT_COMPLETE",
        payload: {
          rewardResult: {
            txSignature: null,
            rewardToken: quest.rewardToken,
            rewardAmount: isRejected ? 0 : aiEvaluation.adjustedReward,
            xpEarned: isRejected ? 0 : Math.round(quest.xpReward * aiEvaluation.rewardMultiplier),
            newLevel: isRejected ? 7 : 8,
            aiSummary: aiEvaluation.aiSummary,
            badgeReward: quest.badgeReward,
            nftMint: null,
          },
          aiEvaluation,
          decisionReceipt: buildMockReceipt({
            merchantName: merchant.name,
            rewardToken: quest.rewardToken,
            worldVerified: true,
            scenario,
          }),
        },
      });

      setSubmitting(false);
    }, 1200);
  }

  return (
    <div className="demoPayPanel" id="demo-pay-panel">
      <div className="demoPayPanelGlow" aria-hidden="true" />

      <div className="demoPayIntro">
        <p className="eyebrow">Step 3</p>
        <h2>Confirm the payment, then validate the claim</h2>
        <p className="supportText">
          Choose a scenario to prove the system enforces policy - not just rewards.
        </p>
      </div>

      <div className="demoPayFlow" role="radiogroup" aria-label="Demo scenario">
        {SCENARIOS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={scenario === item.id}
            className={`demoPayStep ${scenario === item.id ? "active" : ""}`}
            onClick={() => setScenario(item.id)}
            disabled={submitting}
          >
            <span className="demoPayStepNum">{scenario === item.id ? "ON" : "SET"}</span>
            <span>
              <strong>{item.label}</strong>
              {" - "}
              {item.helper}
            </span>
          </button>
        ))}
      </div>

      <VerificationGate
        worldVerified={worldVerified}
        wallet={publicKey?.toBase58() ?? "wallet-required"}
        sessionId="demo-flow"
        pending={verifyPending}
        onVerify={handleWorldIdVerify}
      />

      {walletError ? <p className="errorText">{walletError}</p> : null}

      {worldVerified ? (
        <>
          <div className="demoPayFlow">
            <div className="demoPayStep">
              <span className="demoPayStepNum">1</span>
              <span>Claim at <strong>{merchant.name}</strong></span>
            </div>
            <div className="demoPayStepArrow" aria-hidden="true">DOWN</div>
            <div className="demoPayStep">
              <span className="demoPayStepNum">2</span>
              <span>Run the <strong>controlled scoring event</strong></span>
            </div>
            <div className="demoPayStepArrow" aria-hidden="true">DOWN</div>
            <div className="demoPayStep">
              <span className="demoPayStepNum">3</span>
              <span>PIKO records validation and settles <strong>{formatReward(5, quest.rewardToken)}</strong></span>
            </div>
          </div>

          {submitting ? (
            <div className="demoPayStatus" aria-live="polite">
              <span className="demoPaySpinner" aria-hidden="true" />
              Verifying payment, location, and fraud signals...
            </div>
          ) : null}

          <button
            id="demo-pay-now-btn"
            className={`demoCta demoPayNowCta ${submitting ? "loading" : ""}`}
            type="button"
            onClick={handleMockPayment}
            disabled={submitting || !publicKey}
            aria-busy={submitting}
          >
            {submitting ? "Verifying reward..." : publicKey ? "Run selected scenario" : "Connect wallet first"}
          </button>

          <p className="demoPayWalletNote">
            Connected wallet gates this controlled judge flow. Demo proof transactions may still use the server-side demo signer.
          </p>
        </>
      ) : null}
    </div>
  );
}
