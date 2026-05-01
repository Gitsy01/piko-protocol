"use client";

import { useEffect, useRef, useState } from "react";
import { useDemoContext } from "@/providers/demo-context";

type Phase = "scanning" | "fraud" | "reward" | "decision";

function getFraudLevel(score: number) {
  if (score <= 15) return { label: "LOW RISK", tone: "low" } as const;
  if (score <= 45) return { label: "MEDIUM", tone: "medium" } as const;
  return { label: "HIGH RISK", tone: "high" } as const;
}

function formatFlag(flag: string) {
  return flag
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

  const eval_ = aiEvaluation ?? {
    fraudScore: 3.2,
    fraudFlags: [],
    rewardMultiplier: 1.8,
    rewardReasons: ["High foot traffic area", "Verified merchant", "First visit bonus"],
    decision: "APPROVED" as const,
    worldVerified: true,
    aiSummary: "All checks passed. Reward approved with AI boost.",
    originalReward: 1.25,
    adjustedReward: 2.25,
    adjustedRewardDisplay: "2.25",
    rewardToken: "PIKO",
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Phase 1: Scanning (0-1.2s)
    const t1 = setTimeout(() => setPhase("fraud"), 1200);

    // Phase 2: Fraud score animation (1.2s-3s)
    const t2 = setTimeout(() => {
      const target = eval_.fraudScore;
      const start = performance.now();
      function tick(now: number) {
        const p = Math.min((now - start) / 1200, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplayScore(Number((target * eased).toFixed(2)));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, 1200);

    // Stagger fraud flags
    (eval_.fraudFlags.length > 0 ? eval_.fraudFlags : ["clean_history", "verified_location", "human_verified"]).forEach((_, i) => {
      setTimeout(() => setRevealedFlags(i + 1), 1800 + i * 350);
    });

    // Phase 3: Reward multiplier (3s-4.5s)
    const t3 = setTimeout(() => {
      setPhase("reward");
      const target = eval_.rewardMultiplier;
      const start = performance.now();
      function tick(now: number) {
        const p = Math.min((now - start) / 1200, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplayMultiplier(Number((1 + (target - 1) * eased).toFixed(2)));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, 3000);

    // Stagger reward reasons
    eval_.rewardReasons.forEach((_, i) => {
      setTimeout(() => setRevealedReasons(i + 1), 3400 + i * 350);
    });

    // Phase 4: Decision (4.8s)
    const t4 = setTimeout(() => {
      setPhase("decision");
      setShowDecision(true);
    }, 4800);

    // Auto-transition to reward step (6.5s)
    const t5 = setTimeout(() => {
      dispatch({ type: "EVALUATION_DONE" });
    }, 6500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [eval_, dispatch]);

  const fraud = getFraudLevel(displayScore);
  const isApproved = eval_.decision === "APPROVED";
  const flags = eval_.fraudFlags.length > 0
    ? eval_.fraudFlags
    : ["clean_history", "verified_location", "human_verified"];
  const boostPct = ((displayMultiplier - 1) * 100).toFixed(0);

  return (
    <div className="aiEvalScreen" id="ai-evaluation-screen">
      {/* Scanning overlay */}
      {phase === "scanning" && (
        <div className="aiEvalScanOverlay" aria-live="polite">
          <div className="aiEvalScanIcon" aria-hidden="true">
            <span className="aiEvalScanRing" />
            <span className="aiEvalScanRing delay" />
            <span className="aiEvalScanCore">🧠</span>
          </div>
          <h2>AI Agent Council Activated</h2>
          <p>Evaluating quest completion...</p>
        </div>
      )}

      {/* Main evaluation panel */}
      <div className={`aiEvalPanel ${phase !== "scanning" ? "visible" : ""}`}>
        <div className="aiEvalHeader">
          <div className="aiEvalHeaderIcon" aria-hidden="true">🧠</div>
          <div>
            <p className="eyebrow">AI Evaluation</p>
            <h3>Real-time Decision Engine</h3>
          </div>
          {showDecision && (
            <span className={`aiEvalDecisionBadge ${isApproved ? "approved" : "rejected"}`}>
              {isApproved ? "✅ APPROVED" : "❌ REJECTED"}
            </span>
          )}
        </div>

        {/* Fraud Analysis */}
        <div className={`aiEvalSection ${phase !== "scanning" ? "visible" : ""}`}>
          <div className="aiEvalSectionTitle">
            <span className="aiEvalSectionIcon" aria-hidden="true">🛡️</span>
            <span>Fraud Analysis</span>
            {phase !== "scanning" && (
              <span className="aiEvalAgentBadge">FraudAgent</span>
            )}
          </div>

          <div className="aiEvalMetricRow">
            <span className="aiEvalMetricLabel">Fraud Score</span>
            <div className="aiEvalMetricValue">
              <span className={`aiEvalScore ${fraud.tone}`}>
                {displayScore.toFixed(2)}
              </span>
              <div className="aiEvalFraudBar">
                <div
                  className={`aiEvalFraudBarFill ${fraud.tone}`}
                  style={{ width: `${Math.min(displayScore, 100)}%` }}
                />
              </div>
              <span className={`aiEvalFraudLevel ${fraud.tone}`}>{fraud.label}</span>
            </div>
          </div>

          {/* Fraud Flags */}
          <div className="aiEvalFlagList">
            {flags.slice(0, revealedFlags).map((flag, i) => (
              <span key={i} className="aiEvalFlagChip">
                <span className="aiEvalFlagDot" aria-hidden="true" />
                {formatFlag(flag)}
              </span>
            ))}
          </div>
        </div>

        {/* Human Verification */}
        <div className={`aiEvalSection ${phase !== "scanning" ? "visible" : ""}`}>
          <div className="aiEvalMetricRow">
            <span className="aiEvalMetricLabel">Human Verification</span>
            <div className="aiEvalMetricValue">
              <span className={`aiEvalVerifyBadge ${eval_.worldVerified ? "verified" : "unverified"}`}>
                {eval_.worldVerified ? "✔ World ID Verified" : "❌ Not Verified"}
              </span>
            </div>
          </div>
        </div>

        {/* Reward Optimization */}
        <div className={`aiEvalSection ${phase === "reward" || phase === "decision" ? "visible" : ""}`}>
          <div className="aiEvalSectionTitle">
            <span className="aiEvalSectionIcon" aria-hidden="true">💰</span>
            <span>Reward Optimization</span>
            {(phase === "reward" || phase === "decision") && (
              <span className="aiEvalAgentBadge reward">RewardAgent</span>
            )}
          </div>

          <div className="aiEvalMetricRow">
            <span className="aiEvalMetricLabel">Reward Multiplier</span>
            <div className="aiEvalMetricValue">
              <span className={`aiEvalMultiplier ${displayMultiplier > 1 ? "boosted" : ""}`}>
                {displayMultiplier.toFixed(2)}x
              </span>
              {displayMultiplier > 1 && (
                <span className="aiEvalBoostChip">
                  <span className="aiEvalBoostPulse" aria-hidden="true" />
                  🔥 +{boostPct}% reward boost
                </span>
              )}
            </div>
          </div>

          {/* Reward Reasons */}
          <div className="aiEvalReasonList">
            {eval_.rewardReasons.slice(0, revealedReasons).map((reason, i) => (
              <div key={i} className="aiEvalReasonItem">
                <span className="aiEvalReasonDot" aria-hidden="true" />
                {reason}
              </div>
            ))}
          </div>
        </div>

        {/* AI Boost Banner */}
        {showDecision && displayMultiplier > 1 && isApproved && (
          <div className="aiEvalBoostBanner">
            <span className="aiEvalBoostBannerIcon" aria-hidden="true">🔥</span>
            <div>
              <strong>AI Boost Active</strong>
              <span>+{boostPct}% reward (based on demand surge)</span>
            </div>
          </div>
        )}

        {/* Reward Preview */}
        {showDecision && isApproved && (
          <div className="aiEvalRewardPreview">
            <span className="aiEvalRewardLabel">Reward Decision</span>
            <div className="aiEvalRewardRow">
              <span className="aiEvalRewardOriginal">{eval_.originalReward.toFixed(2)}</span>
              <span className="aiEvalRewardArrow" aria-hidden="true">→</span>
              <span className="aiEvalRewardBoosted">
                {eval_.adjustedRewardDisplay} {eval_.rewardToken}
              </span>
              <span className="aiEvalRewardTag">AI boosted</span>
            </div>
          </div>
        )}
      </div>

      {/* Processing indicator */}
      {!showDecision && phase !== "scanning" && (
        <div className="aiEvalProcessing" aria-live="polite">
          <span className="aiEvalSpinner" aria-hidden="true" />
          <span>
            {phase === "fraud" ? "Running fraud analysis..." : "Optimizing reward..."}
          </span>
        </div>
      )}
    </div>
  );
}
