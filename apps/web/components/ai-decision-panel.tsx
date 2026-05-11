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
  if (score <= 15) return { label: "LOW", tone: "low" } as const;
  if (score <= 45) return { label: "MEDIUM", tone: "medium" } as const;
  return { label: "HIGH", tone: "high" } as const;
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
    .replace(/\b\w/g, (character) => character.toUpperCase());
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

    const scoreStart = performance.now();
    const scoreDuration = 1200;

    function animateScore(now: number) {
      const progress = Math.min((now - scoreStart) / scoreDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Number((fraudScore * eased).toFixed(2)));

      if (progress < 1) {
        requestAnimationFrame(animateScore);
      }
    }

    requestAnimationFrame(animateScore);

    const multiplierStart = performance.now();

    function animateMultiplier(now: number) {
      const progress = Math.min((now - multiplierStart) / 1400, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayMultiplier(Number((1 + (rewardMultiplier - 1) * eased).toFixed(2)));

      if (progress < 1) {
        requestAnimationFrame(animateMultiplier);
      }
    }

    requestAnimationFrame(animateMultiplier);

    rewardReasons.forEach((_, index) => {
      window.setTimeout(() => setRevealedReasons(index + 1), 800 + index * 300);
    });
  }, [animated, fraudScore, rewardMultiplier, rewardReasons]);

  useEffect(() => {
    if (animated) return;
    setDisplayScore(fraudScore);
    setDisplayMultiplier(rewardMultiplier);
    setRevealedReasons(rewardReasons.length);
  }, [animated, fraudScore, rewardMultiplier, rewardReasons.length]);

  const fraud = getFraudLevel(displayScore);
  const boostLabel = getBoostLabel(displayMultiplier);
  const isApproved = decision === "APPROVED";

  return (
    <div className={`aiDecisionPanel ${compact ? "compact" : ""}`} id="ai-decision-panel">
      <div className="aiDecisionHeader">
        <div className="aiDecisionIcon" aria-hidden="true">OK</div>
        <div>
          <p className="eyebrow">Validation Decision</p>
          <h3>Why the reward was issued</h3>
        </div>
        {decision ? (
          <span className={`aiDecisionBadge ${isApproved ? "approved" : "rejected"}`}>
            {isApproved ? "APPROVED" : "REJECTED"}
          </span>
        ) : null}
      </div>

      <div className="aiDecisionGrid">
        <div className="aiMetricRow">
          <span className="aiMetricLabel">Fraud Risk</span>
          <div className="aiMetricValue">
            <span className={`aiMetricNumber ${fraud.tone}`}>{displayScore.toFixed(2)}</span>
            <div className="aiFraudBar">
              <div
                className={`aiFraudBarFill ${fraud.tone}`}
                style={{ width: `${Math.min(displayScore, 100)}%` }}
              />
            </div>
            <span className={`aiFraudLevel ${fraud.tone}`}>{fraud.label}</span>
          </div>
        </div>

        <div className="aiMetricRow">
          <span className="aiMetricLabel">Reward Multiplier</span>
          <div className="aiMetricValue">
            <span className={`aiMultiplierBadge ${displayMultiplier > 1 ? "boosted" : ""}`}>
              {displayMultiplier.toFixed(2)}x
            </span>
            {boostLabel ? (
              <span className="aiBoostChip">
                <span className="aiBoostPulse" aria-hidden="true" />
                {boostLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="aiMetricRow">
          <span className="aiMetricLabel">Human Check</span>
          <div className="aiMetricValue">
            <span className={`aiVerifyBadge ${worldVerified ? "verified" : "unverified"}`}>
              {worldVerified ? "Human signal verified" : "Signal pending"}
            </span>
          </div>
        </div>
      </div>

      {fraudFlags.length > 0 ? (
        <div className="aiFlagList">
          <span className="aiMetricLabel">Signals</span>
          <div className="aiFlagChips">
            {fraudFlags.map((flag) => (
              <span key={flag} className="aiFlagChip">
                {formatFlag(flag)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {rewardReasons.length > 0 ? (
        <div className="aiReasonList">
          <span className="aiMetricLabel">Reason</span>
          <ul>
            {rewardReasons.slice(0, revealedReasons).map((reason, index) => (
              <li key={index} className="aiReasonItem" style={{ animationDelay: `${index * 0.1}s` }}>
                <span className="aiReasonDot" aria-hidden="true" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {displayMultiplier > 1 && isApproved ? (
        <div className="aiBoostBanner">
          <span className="aiBoostBannerIcon" aria-hidden="true">UP</span>
          <div>
            <strong>Risk-Adjusted Boost Active</strong>
            <span>+{((displayMultiplier - 1) * 100).toFixed(0)}% reward boost applied</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
