"use client";

import { useEffect, useState } from "react";
import { useDemoContext } from "@/providers/demo-context";

function getRiskLabel(score: number) {
  if (score <= 15) return "Low risk";
  if (score <= 45) return "Medium risk";
  return "High risk";
}

export function AIEvaluationScreen() {
  const { state, dispatch } = useDemoContext();
  const { aiEvaluation } = state;
  const [ready, setReady] = useState(false);

  const evaluation = aiEvaluation ?? {
    fraudScore: 8,
    fraudFlags: ["verified_payment", "world_id_verified", "clean_travel_history"],
    rewardMultiplier: 1.25,
    rewardReasons: ["First-time visit", "Verified payment", "Budget healthy"],
    decision: "APPROVED" as const,
    worldVerified: true,
    paymentVerified: true,
    paymentAmountSol: 0.05,
    locationDistanceMeters: 42,
    gpsAccuracyMeters: 9,
    impossibleTravelClear: true,
    aiSummary: "Verified payment, valid location, and clean travel history cleared the claim for settlement.",
    originalReward: 4,
    adjustedReward: 5,
    adjustedRewardDisplay: "5.00",
    rewardToken: "PIKO",
    merchantBudget: 120,
    dailyEmissionRemaining: 8500,
    budgetCapActive: false,
  };

  const isApproved = evaluation.decision === "APPROVED";
  const locationOk = evaluation.locationDistanceMeters <= 100 && evaluation.gpsAccuracyMeters <= 35;
  const fraudOk = evaluation.fraudScore <= 45 && evaluation.impossibleTravelClear;

  useEffect(() => {
    const revealTimer = window.setTimeout(() => setReady(true), 900);
    const rewardTimer = window.setTimeout(() => {
      dispatch({ type: "EVALUATION_DONE" });
    }, 3600);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(rewardTimer);
    };
  }, [dispatch]);

  if (!ready) {
    return (
      <div className="aiEvalScreen" id="ai-evaluation-screen">
        <div className="aiEvalScanOverlay" aria-live="polite">
          <div className="aiEvalScanIcon" aria-hidden="true">
            <span className="aiEvalScanRing" />
            <span className="aiEvalScanCore">OK</span>
          </div>
          <h2>Validating contribution</h2>
          <p>Checking payment, location, identity signal, fraud score, and reward policy.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="aiEvalScreen" id="ai-evaluation-screen">
      <section className={`validationHeroCard ${isApproved ? "approved" : "rejected"}`} aria-live="polite">
        <header className="validationHeroHeader">
          <span className="validationHeroIcon" aria-hidden="true">
            {isApproved ? "OK" : "NO"}
          </span>
          <p className="eyebrow">Validation complete</p>
          <h2>{isApproved ? "Contribution Verified" : "Contribution Rejected"}</h2>
          <p>
            {isApproved
              ? "PIKO verified the action before issuing the reward."
              : "PIKO blocked the reward before treasury was spent."}
          </p>
        </header>

        <ul className="validationHeroChecks">
          <li className={evaluation.paymentVerified ? "passed" : "failed"}>
            <span aria-hidden="true">{evaluation.paymentVerified ? "OK" : "NO"}</span>
            Payment confirmed
          </li>
          <li className={locationOk ? "passed" : "failed"}>
            <span aria-hidden="true">{locationOk ? "OK" : "NO"}</span>
            Location verified
          </li>
          <li className={evaluation.worldVerified ? "passed" : "failed"}>
            <span aria-hidden="true">{evaluation.worldVerified ? "OK" : "NO"}</span>
            Identity signal recorded
          </li>
          <li className={fraudOk ? "passed" : "failed"}>
            <span aria-hidden="true">{fraudOk ? "OK" : "NO"}</span>
            Fraud score: {evaluation.fraudScore}/100 ({getRiskLabel(evaluation.fraudScore)})
          </li>
          <li className={isApproved ? "passed" : "failed"}>
            <span aria-hidden="true">{isApproved ? "OK" : "NO"}</span>
            {isApproved ? "Reward approved" : "Reward blocked"}
          </li>
        </ul>

        <div className="validationHeroOutcome">
          <div>
            <span>Reward multiplier</span>
            <strong>{evaluation.rewardMultiplier.toFixed(2)}x</strong>
          </div>
          <div>
            <span>Reward</span>
            <strong>
              {evaluation.adjustedRewardDisplay} {evaluation.rewardToken}
            </strong>
          </div>
        </div>
      </section>
    </div>
  );
}
