"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useDemoContext } from "@/providers/demo-context";

type ChecklistItem = {
  id: string;
  label: string;
  passed: boolean;
};

function getExplorerUrl(sig: string | null) {
  if (!sig) return null;
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function truncateSig(sig: string | null, chars = 8) {
  if (!sig) return "—";
  if (sig.length <= chars * 2 + 3) return sig;
  return `${sig.slice(0, chars)}...${sig.slice(-chars)}`;
}

export function DemoReward() {
  const { state, dispatch } = useDemoContext();
  const { rewardResult, aiEvaluation, quest } = state;
  const [revealStep, setRevealStep] = useState(0);

  const isApproved = aiEvaluation?.decision === "APPROVED";
  const explorerUrl = getExplorerUrl(rewardResult?.txSignature ?? null);

  const checklist: ChecklistItem[] = useMemo(() => [
    {
      id: "payment",
      label: "Payment verified on-chain",
      passed: true,
    },
    {
      id: "location",
      label: "Location valid (GPS proof)",
      passed: (aiEvaluation?.fraudScore ?? 0) < 50,
    },
    {
      id: "human",
      label: "Human verified (World ID)",
      passed: aiEvaluation?.worldVerified ?? false,
    },
    {
      id: "fraud",
      label: `Fraud score passed (${(aiEvaluation?.fraudScore ?? 0).toFixed(2)})`,
      passed: (aiEvaluation?.fraudScore ?? 0) < 50,
    },
    {
      id: "reward",
      label: `Reward calculated (${(aiEvaluation?.rewardMultiplier ?? 1).toFixed(2)}x multiplier)`,
      passed: isApproved ?? false,
    },
  ], [aiEvaluation, isApproved]);

  // Staggered reveal animation
  useEffect(() => {
    if (revealStep >= checklist.length + 2) return;
    const delay = revealStep === 0 ? 400 : 500;
    const timer = setTimeout(() => setRevealStep((s) => s + 1), delay);
    return () => clearTimeout(timer);
  }, [revealStep, checklist.length]);

  // Confetti particles
  const particles = useMemo(
    () =>
      isApproved
        ? Array.from({ length: 24 }, (_, i) => ({
            id: i,
            style: {
              ["--particle-left" as string]: `${Math.random() * 100}%`,
              ["--particle-delay" as string]: `${Math.random() * 1.2}s`,
              ["--particle-color" as string]:
                i % 4 === 0
                  ? "var(--solana-green)"
                  : i % 4 === 1
                  ? "var(--brand)"
                  : i % 4 === 2
                  ? "var(--solana-purple)"
                  : "#FFD700",
            } as CSSProperties,
          }))
        : [],
    [isApproved]
  );

  const showReward = revealStep >= checklist.length;
  const showNft = revealStep >= checklist.length + 1;
  const showExplorer = revealStep >= checklist.length + 2;

  const earnedAmount = rewardResult?.rewardAmount ?? quest.rewardAmount;
  const earnedToken = rewardResult?.rewardToken ?? quest.rewardToken;
  const badge = rewardResult?.badgeReward ?? quest.badgeReward;
  const originalReward = aiEvaluation?.originalReward ?? quest.rewardAmount;

  return (
    <div
      className={`aiApprovalCard ${isApproved ? "approved" : "rejected"}`}
      id="demo-reward-screen"
      role="status"
      aria-live="polite"
    >
      {/* Confetti */}
      {isApproved && showReward && (
        <div className="aiApprovalParticles" aria-hidden="true">
          {particles.map((p) => (
            <div key={p.id} className="aiApprovalParticle" style={p.style} />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="aiApprovalHeader">
        <span className="aiApprovalIcon" aria-hidden="true">
          {isApproved ? "✅" : "🛑"}
        </span>
        <h2 className="aiApprovalTitle">
          {isApproved ? "AI APPROVED REWARD" : "AI REJECTED CLAIM"}
        </h2>
      </div>

      {/* Checklist */}
      <div className="aiApprovalChecklist">
        {checklist.map((item, i) => {
          const visible = i < revealStep;
          return (
            <div
              key={item.id}
              className={`aiApprovalCheck ${visible ? "visible" : ""} ${item.passed ? "passed" : "failed"}`}
            >
              <span className="aiApprovalCheckIcon" aria-hidden="true">
                {item.passed ? "✔" : "✘"}
              </span>
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* Reward reveal */}
      {showReward && (
        <div className={`aiRewardReveal ${isApproved ? "show" : ""}`}>
          <div className="aiRewardRevealRow">
            <span className="aiRewardLabel">Reward</span>
            <span className="aiRewardOriginal">{originalReward.toFixed(2)}</span>
            <span className="aiRewardArrow" aria-hidden="true">→</span>
            <span className="aiRewardBoosted">
              {earnedAmount.toFixed(2)} {earnedToken}
            </span>
            {(aiEvaluation?.rewardMultiplier ?? 1) > 1 && (
              <span className="aiRewardBoostTag">AI boosted</span>
            )}
          </div>
        </div>
      )}

      {/* NFT badge */}
      {showNft && badge && (
        <div className="aiNftReveal">
          <span className="aiNftIcon" aria-hidden="true">🏅</span>
          <div>
            <strong>NFT Badge Minted</strong>
            <span className="aiNftMint">{badge}</span>
          </div>
        </div>
      )}

      {/* Blockchain details & actions */}
      {showExplorer && (
        <div className="aiApprovalBlockchain">
          {rewardResult?.txSignature && (
            <div className="aiApprovalBlockchainRow">
              <span>Tx Signature</span>
              <strong>{truncateSig(rewardResult.txSignature)}</strong>
            </div>
          )}
          <div className="aiApprovalActions">
            {explorerUrl && (
              <a
                id="demo-explorer-link"
                className="primaryButton aiExplorerButton"
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                View on Solana Explorer →
              </a>
            )}
            <button
              id="demo-do-another-btn"
              className="demoCta"
              type="button"
              onClick={() => dispatch({ type: "RESET" })}
            >
              🗺️ Do Another Quest
            </button>
          </div>
        </div>
      )}

      {/* AI summary */}
      {showExplorer && aiEvaluation?.aiSummary && (
        <div className="aiApprovalSummary">
          <span className="aiMetricLabel">AI Summary</span>
          <p>{aiEvaluation.aiSummary}</p>
        </div>
      )}
    </div>
  );
}
