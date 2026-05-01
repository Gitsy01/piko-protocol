"use client";

import { useEffect, useRef, useState } from "react";

type AIDecisionPanelProps = {
  fraudScore: number;
  fraudFlags: string[];
  rewardMultiplier: number;
  rewardReasons: string[];
  decision: "APPROVED" | "REJECTED" | null;
  worldVerified: boolean;
  animated?: boolean;
  compact?: boolean;
};

function getFraudLevel(score: number) {
  if (score <= 15) return { label: "LOW RISK", tone: "low" } as const;
  if (score <= 45) return { label: "MEDIUM", tone: "medium" } as const;
  return { label: "HIGH RISK", tone: "high" } as const;
}

function getBoostLabel(multiplier: number) {
  if (multiplier <= 1.0) return null;
  const boost = ((multiplier - 1) * 100).toFixed(0);
  return `+${boost}% reward boost`;
}

function formatFlag(flag: string) {
  return flag
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AIDecisionPanel({
  fraudScore,
  fraudFlags,
  rewardMultiplier,
  rewardReasons,
  decision,
  worldVerified,
  animated = false,
  compact = false,
}: AIDecisionPanelProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : fraudScore);
  const [displayMultiplier, setDisplayMultiplier] = useState(animated ? 1 : rewardMultiplier);
  const [revealedReasons, setRevealedReasons] = useState(animated ? 0 : rewardReasons.length);
  const animatedRef = useRef(false);

  useEffect(() => {
    if (!animated || animatedRef.current) return;
    animatedRef.current = true;

    // Animate fraud score counting up
    const scoreTarget = fraudScore;
    const scoreDuration = 1200;
    const scoreStart = performance.now();

    function animateScore(now: number) {
      const elapsed = now - scoreStart;
      const progress = Math.min(elapsed / scoreDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Number((scoreTarget * eased).toFixed(2)));
      if (progress < 1) requestAnimationFrame(animateScore);
    }
    requestAnimationFrame(animateScore);

    // Animate multiplier
    const multTarget = rewardMultiplier;
    const multStart = performance.now();

    function animateMultiplier(now: number) {
      const elapsed = now - multStart;
      const progress = Math.min(elapsed / 1400, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayMultiplier(Number((1 + (multTarget - 1) * eased).toFixed(2)));
      if (progress < 1) requestAnimationFrame(animateMultiplier);
    }
    requestAnimationFrame(animateMultiplier);

    // Stagger reasons
    rewardReasons.forEach((_, i) => {
      setTimeout(() => setRevealedReasons(i + 1), 800 + i * 300);
    });
  }, [animated, fraudScore, rewardMultiplier, rewardReasons]);

  // Update when props change (non-animated mode)
  useEffect(() => {
    if (animated) return;
    setDisplayScore(fraudScore);
    setDisplayMultiplier(rewardMultiplier);
    setRevealedReasons(rewardReasons.length);
  }, [animated, fraudScore, rewardMultiplier, rewardReasons.length]);

  const fraud = getFraudLevel(displayScore);
  const boostLabel = getBoostLabel(displayMultiplier);
  const isApproved = decision === "APPROVED";
  const isRejected = decision === "REJECTED";

  return (
    <div className={`aiDecisionPanel ${compact ? "compact" : ""}`} id="ai-decision-panel">
      <div className="aiDecisionHeader">
        <div className="aiDecisionIcon" aria-hidden="true">🧠</div>
        <div>
          <p className="eyebrow">AI Evaluation</p>
          <h3>Real-time decision engine</h3>
        </div>
        {decision && (
          <span className={`aiDecisionBadge ${isApproved ? "approved" : "rejected"}`}>
            {isApproved ? "✅ APPROVED" : "❌ REJECTED"}
          </span>
        )}
      </div>

      <div className="aiDecisionGrid">
        {/* Fraud score bar */}
        <div className="aiMetricRow">
          <span className="aiMetricLabel">Fraud Score</span>
          <div className="aiMetricValue">
            <span className={`aiMetricNumber ${fraud.tone}`}>
              {displayScore.toFixed(2)}
            </span>
            <div className="aiFraudBar">
              <div
                className={`aiFraudBarFill ${fraud.tone}`}
                style={{ width: `${Math.min(displayScore, 100)}%` }}
              />
            </div>
            <span className={`aiFraudLevel ${fraud.tone}`}>{fraud.label}</span>
          </div>
        </div>

        {/* Reward multiplier */}
        <div className="aiMetricRow">
          <span className="aiMetricLabel">Reward Multiplier</span>
          <div className="aiMetricValue">
            <span className={`aiMultiplierBadge ${displayMultiplier > 1 ? "boosted" : ""}`}>
              {displayMultiplier.toFixed(2)}x
            </span>
            {boostLabel && (
              <span className="aiBoostChip">
                <span className="aiBoostPulse" aria-hidden="true" />
                🔥 {boostLabel}
              </span>
            )}
          </div>
        </div>

        {/* World ID status */}
        <div className="aiMetricRow">
          <span className="aiMetricLabel">Human Verification</span>
          <div className="aiMetricValue">
            <span className={`aiVerifyBadge ${worldVerified ? "verified" : "unverified"}`}>
              {worldVerified ? "✔ World ID Verified" : "❌ Not Verified"}
            </span>
          </div>
        </div>
      </div>

      {/* Fraud flags */}
      {fraudFlags.length > 0 && (
        <div className="aiFlagList">
          <span className="aiMetricLabel">Flags</span>
          <div className="aiFlagChips">
            {fraudFlags.map((flag) => (
              <span key={flag} className="aiFlagChip">{formatFlag(flag)}</span>
            ))}
          </div>
        </div>
      )}

      {/* Reward reasons */}
      {rewardReasons.length > 0 && (
        <div className="aiReasonList">
          <span className="aiMetricLabel">AI Reasoning</span>
          <ul>
            {rewardReasons.slice(0, revealedReasons).map((reason, i) => (
              <li key={i} className="aiReasonItem" style={{ animationDelay: `${i * 0.1}s` }}>
                <span className="aiReasonDot" aria-hidden="true" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Boost Active indicator */}
      {displayMultiplier > 1 && isApproved && (
        <div className="aiBoostBanner">
          <span className="aiBoostBannerIcon" aria-hidden="true">🔥</span>
          <div>
            <strong>AI Boost Active</strong>
            <span>+{((displayMultiplier - 1) * 100).toFixed(0)}% reward (based on demand surge)</span>
          </div>
        </div>
      )}
    </div>
  );
}
