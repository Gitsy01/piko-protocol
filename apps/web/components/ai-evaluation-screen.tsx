"use client";

import { useEffect, useRef, useState } from "react";
import { useDemoContext } from "@/providers/demo-context";

type Phase = "scanning" | "fraud" | "reward" | "decision";

function getFraudLevel(score: number) {
  if (score <= 15) return { label: "LOW", tone: "low" } as const;
  if (score <= 45) return { label: "MEDIUM", tone: "medium" } as const;
  return { label: "HIGH", tone: "high" } as const;
}

function formatFlag(flag: string) {
  return flag
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatRiskLabel(score: number) {
  if (score <= 15) return "LOW";
  if (score <= 45) return "MEDIUM";
  return "HIGH";
}

function formatVerdictText(decision: "APPROVED" | "REJECTED", risk: string) {
  return decision === "APPROVED" ? `VERIFIED - ${risk} RISK` : `REJECTED - ${risk} RISK`;
}

export function AIEvaluationScreen() {
  const { state, dispatch } = useDemoContext();
  const { aiEvaluation } = state;
  const [phase, setPhase] = useState<Phase>("scanning");
  const [displayScore, setDisplayScore] = useState(0);
  const [displayMultiplier, setDisplayMultiplier] = useState(1);
  const [revealedFlags, setRevealedFlags] = useState(0);
  const [revealedReasons, setRevealedReasons] = useState(0);
  const [showDecision, setShowDecision] = useState(false);
  const started = useRef(false);

  const evaluation = aiEvaluation ?? {
    fraudScore: 8,
    fraudFlags: ["verified_payment", "world_id_verified", "clean_travel_history"],
    rewardMultiplier: 1.3,
    rewardReasons: ["First-time visit", "Verified payment", "Budget healthy"],
    decision: "APPROVED" as const,
    worldVerified: true,
    paymentVerified: true,
    paymentAmountSol: 0.05,
    locationDistanceMeters: 42,
    gpsAccuracyMeters: 9,
    impossibleTravelClear: true,
    aiSummary: "Verified payment, valid location, and clean travel history cleared the claim for settlement.",
    originalReward: 3.85,
    adjustedReward: 5,
    adjustedRewardDisplay: "5.00",
    rewardToken: "PIKO",
    merchantBudget: 120,
    dailyEmissionRemaining: 8500,
    budgetCapActive: false,
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const scanningTimer = window.setTimeout(() => setPhase("fraud"), 1000);

    const fraudTimer = window.setTimeout(() => {
      const start = performance.now();

      function tick(now: number) {
        const progress = Math.min((now - start) / 1200, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayScore(Number((evaluation.fraudScore * eased).toFixed(2)));

        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      }

      requestAnimationFrame(tick);
    }, 1000);

    evaluation.fraudFlags.forEach((_, index) => {
      window.setTimeout(() => setRevealedFlags(index + 1), 1600 + index * 300);
    });

    const rewardTimer = window.setTimeout(() => {
      setPhase("reward");
      const start = performance.now();

      function tick(now: number) {
        const progress = Math.min((now - start) / 1200, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayMultiplier(Number((1 + (evaluation.rewardMultiplier - 1) * eased).toFixed(2)));

        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      }

      requestAnimationFrame(tick);
    }, 2600);

    evaluation.rewardReasons.forEach((_, index) => {
      window.setTimeout(() => setRevealedReasons(index + 1), 3000 + index * 300);
    });

    const decisionTimer = window.setTimeout(() => {
      setPhase("decision");
      setShowDecision(true);
    }, 4200);

    const rewardScreenTimer = window.setTimeout(() => {
      dispatch({ type: "EVALUATION_DONE" });
    }, 5800);

    return () => {
      clearTimeout(scanningTimer);
      clearTimeout(fraudTimer);
      clearTimeout(rewardTimer);
      clearTimeout(decisionTimer);
      clearTimeout(rewardScreenTimer);
    };
  }, [dispatch, evaluation]);

  const fraud = getFraudLevel(displayScore);
  const isApproved = evaluation.decision === "APPROVED";
  const boostPercent = ((displayMultiplier - 1) * 100).toFixed(0);
  const rewardDelta = Number((evaluation.adjustedReward - evaluation.originalReward).toFixed(2));
  const locationPass = evaluation.locationDistanceMeters <= 100 && evaluation.gpsAccuracyMeters <= 35;
  const fraudPass = evaluation.fraudScore <= 45 && evaluation.impossibleTravelClear;
  const livePipelineSteps = [
    {
      id: "identity",
      label: "Identity",
      detail: evaluation.worldVerified ? "Verified" : "Rejected",
      passed: evaluation.worldVerified,
      visible: phase !== "scanning" && phase !== "decision",
    },
    {
      id: "payment",
      label: "Payment",
      detail: evaluation.paymentVerified
        ? `${evaluation.paymentAmountSol.toFixed(2)} SOL confirmed`
        : "Rejected",
      passed: evaluation.paymentVerified,
      visible: phase !== "scanning" && phase !== "decision",
    },
    {
      id: "location",
      label: "Location check",
      detail: locationPass ? "Verified" : "Suspicious",
      passed: locationPass,
      visible: phase !== "scanning" && phase !== "decision",
    },
    {
      id: "risk",
      label: "Risk scan",
      detail: phase === "fraud" || phase === "reward" ? "Evaluating..." : "Queued",
      passed: fraudPass,
      visible: phase !== "scanning" && phase !== "decision",
    },
  ];
  const conciseReasons = isApproved
    ? "This action passed all security checks."
    : evaluation.aiSummary ?? "This action violates trust and integrity policy checks.";
  const verdictLabel = formatVerdictText(evaluation.decision, formatRiskLabel(evaluation.fraudScore));
  const rewardDisplay = `${evaluation.adjustedRewardDisplay} ${evaluation.rewardToken}`;
  const riskLevel = formatRiskLabel(evaluation.fraudScore);

  return (
    <div className="aiEvalScreen" id="ai-evaluation-screen">
      {phase === "scanning" ? (
        <div className="aiEvalScanOverlay" aria-live="polite">
          <div className="aiEvalScanIcon" aria-hidden="true">
            <span className="aiEvalScanRing" />
            <span className="aiEvalScanRing delay" />
            <span className="aiEvalScanCore">AI</span>
          </div>
          <h2>AI is verifying the payment</h2>
          <p>Checking fraud risk and reward logic...</p>
        </div>
      ) : null}

      <div className={`aiEvalPanel ${phase !== "scanning" ? "visible" : ""}`}>
        <div className="aiEvalHeader">
          <div className="aiEvalHeaderIcon" aria-hidden="true">AI</div>
          <div>
            <p className="eyebrow">AI Decision</p>
            <h3>{showDecision ? "Decision with confidence evidence" : "Analyzing trust layers"}</h3>
          </div>
          {showDecision ? (
            <span className={`aiEvalDecisionBadge ${isApproved ? "approved" : "rejected"}`}>
              {isApproved ? "APPROVED" : "REJECTED"}
            </span>
          ) : null}
        </div>

        {!showDecision ? (
          <div className="aiEvalSection visible">
            <div className="aiEvalSectionTitle">
              <span className="aiEvalSectionIcon" aria-hidden="true">FLOW</span>
              <span>Verification Layers</span>
            </div>
            <div className="aiApprovalChecklist">
              {livePipelineSteps.map((step) => (
                <div
                  key={step.id}
                  className={`aiApprovalCheck ${step.visible ? "visible" : ""} ${step.passed ? "passed" : "failed"}`}
                >
                  <span className="aiApprovalCheckIcon" aria-hidden="true">
                    {step.passed ? "✔" : step.id === "risk" ? "⚠" : "✖"}
                  </span>
                  <span>
                    <strong>{step.label}</strong>
                    {" - "}
                    {step.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <section className={`aiEvalVerdictCard ${isApproved ? "approved" : "rejected"}`}>
            <p className="aiEvalVerdictEyebrow">{isApproved ? "SUCCESSFUL ACTION" : "BLOCKED ACTION"}</p>
            <h2>{verdictLabel}</h2>
            <p className="aiEvalVerdictScore">Fraud Score: {evaluation.fraudScore.toFixed(0)} / 100</p>
            <p className="aiEvalVerdictSummary">{conciseReasons}</p>
            <div className="aiEvalVerdictDivider" aria-hidden="true" />
            <div className="aiEvalEvidence">
              <p className="aiEvalEvidenceTitle">Details</p>
              <p>✔ Identity verified</p>
              <p>✔ Payment confirmed ({evaluation.paymentAmountSol.toFixed(2)} SOL)</p>
              <p>{locationPass ? "✔" : "✖"} Location {locationPass ? "valid" : "invalid"} ({Math.round(evaluation.locationDistanceMeters)}m, accuracy {Math.round(evaluation.gpsAccuracyMeters)}m)</p>
            </div>
            {isApproved ? (
              <p className="aiEvalVerdictReward">
                Reward: {rewardDisplay} ({displayMultiplier.toFixed(2)}x)
              </p>
            ) : (
              <p className="aiEvalVerdictReward reject">
                Reason: {evaluation.fraudFlags[0] ? formatFlag(evaluation.fraudFlags[0]) : `Risk ${riskLevel}`}
              </p>
            )}
          </section>
        )}

        {!showDecision ? (
        <div className={`aiEvalSection ${phase !== "scanning" ? "visible" : ""}`}>
          <div className="aiEvalSectionTitle">
            <span className="aiEvalSectionIcon" aria-hidden="true">RISK</span>
            <span>Fraud Analysis</span>
            {phase !== "scanning" ? <span className="aiEvalAgentBadge">FraudAgent</span> : null}
          </div>

          <div className="aiEvalMetricRow">
            <span className="aiEvalMetricLabel">Fraud Risk</span>
            <div className="aiEvalMetricValue">
              <span className={`aiEvalScore ${fraud.tone}`}>{displayScore.toFixed(2)}</span>
              <div className="aiEvalFraudBar">
                <div
                  className={`aiEvalFraudBarFill ${fraud.tone}`}
                  style={{ width: `${Math.min(displayScore, 100)}%` }}
                />
              </div>
              <span className={`aiEvalFraudLevel ${fraud.tone}`}>{fraud.label}</span>
            </div>
          </div>

          <div className="aiEvalFlagList">
            {evaluation.fraudFlags.slice(0, revealedFlags).map((flag) => (
              <span key={flag} className="aiEvalFlagChip">
                <span className="aiEvalFlagDot" aria-hidden="true" />
                {formatFlag(flag)}
              </span>
            ))}
          </div>
        </div>
        ) : null}

        {!showDecision ? (
        <div className={`aiEvalSection ${phase !== "scanning" ? "visible" : ""}`}>
          <div className="aiEvalMetricRow">
            <span className="aiEvalMetricLabel">Human Check</span>
            <div className="aiEvalMetricValue">
              <span className={`aiEvalVerifyBadge ${evaluation.worldVerified ? "verified" : "unverified"}`}>
                {evaluation.worldVerified ? "World ID verified" : "Verification pending"}
              </span>
            </div>
          </div>
        </div>
        ) : null}

        {!showDecision ? (
        <div className={`aiEvalSection ${phase === "reward" || phase === "decision" ? "visible" : ""}`}>
          <div className="aiEvalSectionTitle">
            <span className="aiEvalSectionIcon" aria-hidden="true">PIKO</span>
            <span>Reward Optimization</span>
            {phase === "reward" || phase === "decision" ? (
              <span className="aiEvalAgentBadge reward">RewardAgent</span>
            ) : null}
          </div>

          <div className="aiEvalMetricRow">
            <span className="aiEvalMetricLabel">Reward Multiplier</span>
            <div className="aiEvalMetricValue">
              <span className={`aiEvalMultiplier ${displayMultiplier > 1 ? "boosted" : ""}`}>
                {displayMultiplier.toFixed(2)}x
              </span>
              {displayMultiplier > 1 ? (
                <span className="aiEvalBoostChip">
                  <span className="aiEvalBoostPulse" aria-hidden="true" />
                  +{boostPercent}% reward boost
                </span>
              ) : null}
            </div>
          </div>

          <div className="aiEvalReasonList">
            {evaluation.rewardReasons.slice(0, revealedReasons).map((reason) => (
              <div key={reason} className="aiEvalReasonItem">
                <span className="aiEvalReasonDot" aria-hidden="true" />
                {reason}
              </div>
            ))}
          </div>
        </div>
        ) : null}

        {!showDecision && displayMultiplier > 1 && isApproved ? (
          <div className="aiEvalBoostBanner">
            <span className="aiEvalBoostBannerIcon" aria-hidden="true">UP</span>
            <div>
              <strong>AI Boost Active</strong>
              <span>+{boostPercent}% reward boost applied</span>
            </div>
          </div>
        ) : null}

        {!showDecision && isApproved ? (
          <div className="aiEvalRewardPreview">
            <span className="aiEvalRewardLabel">Reward Decision</span>
            <div className="aiEvalRewardRow">
              <span className="aiEvalRewardOriginal">{evaluation.originalReward.toFixed(2)}</span>
              <span className="aiEvalRewardArrow" aria-hidden="true">TO</span>
              <span className="aiEvalRewardBoosted">
                {evaluation.adjustedRewardDisplay} {evaluation.rewardToken}
              </span>
              <span className="aiEvalRewardTag">
                {rewardDelta >= 0 ? "AI boosted" : "Budget capped"}
              </span>
            </div>
          </div>
        ) : null}

        {/* ── Economic State Panel ── */}
        {!showDecision && (phase === "reward" || phase === "decision") ? (
          <div className="aiEvalEconomicPanel">
            <div className="aiEvalEconomicHeader">
              <span className="aiEvalSectionIcon" aria-hidden="true">ECO</span>
              <span>Economic State</span>
              <span className="aiEvalAgentBadge">RewardAgent</span>
            </div>

            <div className="aiEvalEconomicGrid">
              <div className="aiEvalEconomicStat">
                <span className="aiEvalEconomicLabel">Merchant Budget</span>
                <strong
                  className={`aiEvalEconomicValue ${
                    evaluation.merchantBudget < 25 ? "warn" : "ok"
                  }`}
                >
                  {(evaluation.merchantBudget ?? 120).toLocaleString()} PIKO
                </strong>
              </div>
              <div className="aiEvalEconomicStat">
                <span className="aiEvalEconomicLabel">Daily Emission Remaining</span>
                <strong className="aiEvalEconomicValue ok">
                  {(evaluation.dailyEmissionRemaining ?? 8500).toLocaleString()} PIKO
                </strong>
              </div>
            </div>

            {evaluation.budgetCapActive ? (
              <div className="aiEvalBudgetCapWarning" role="alert">
                <span aria-hidden="true">⚠</span>
                Multiplier capped due to low budget
              </div>
            ) : (
              <div className="aiEvalBudgetOk">
                <span aria-hidden="true">✓</span>
                Budget healthy — full multiplier range active
              </div>
            )}
          </div>
        ) : null}
      </div>

      {!showDecision && phase !== "scanning" ? (
        <div className="aiEvalProcessing" aria-live="polite">
          <span className="aiEvalSpinner" aria-hidden="true" />
          <span>{phase === "fraud" ? "Checking fraud risk..." : "Optimizing the reward..."}</span>
        </div>
      ) : null}
    </div>
  );
}
