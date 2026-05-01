"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { DemoSettlementData } from "@/lib/api";

type AIApprovalCardProps = {
  settlement: DemoSettlementData["settlement"];
  blockchain: DemoSettlementData["blockchain"];
  rewardReadout: DemoSettlementData["rewardReadout"];
};

type ChecklistItem = {
  id: string;
  label: string;
  passed: boolean;
};

function getExplorerUrl(signature: string | null, mode: string) {
  if (!signature || mode !== "live") return null;
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function truncateSig(sig: string | null, chars = 8) {
  if (!sig) return "—";
  if (sig.length <= chars * 2 + 3) return sig;
  return `${sig.slice(0, chars)}...${sig.slice(-chars)}`;
}

export function AIApprovalCard({
  settlement,
  blockchain,
  rewardReadout,
}: AIApprovalCardProps) {
  const [revealStep, setRevealStep] = useState(0);
  const isApproved = settlement.decision === "APPROVED";
  const explorerUrl = getExplorerUrl(blockchain.rewardTx, blockchain.rewardTxMode);
  const nftExplorerUrl = getExplorerUrl(blockchain.nftMint, blockchain.nftMode);

  const checklist: ChecklistItem[] = useMemo(() => [
    {
      id: "payment",
      label: "Payment verified on-chain",
      passed: true,
    },
    {
      id: "location",
      label: "Location valid (GPS proof)",
      passed: settlement.fraudScore < 50,
    },
    {
      id: "human",
      label: `Human verified (World ID)`,
      passed: settlement.worldVerified,
    },
    {
      id: "fraud",
      label: `Fraud score passed (${settlement.fraudScore.toFixed(2)})`,
      passed: settlement.fraudScore < 50,
    },
    {
      id: "reward",
      label: `Reward calculated (${rewardReadout.multiplier.toFixed(2)}x multiplier)`,
      passed: isApproved,
    },
  ], [settlement, rewardReadout, isApproved]);

  // Staggered reveal animation
  useEffect(() => {
    if (revealStep >= checklist.length + 2) return;

    const delay = revealStep === 0 ? 400 : 500;
    const timer = setTimeout(() => {
      setRevealStep((s) => s + 1);
    }, delay);

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

  return (
    <div
      className={`aiApprovalCard ${isApproved ? "approved" : "rejected"}`}
      id="ai-approval-card"
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
            <span className="aiRewardOriginal">
              {rewardReadout.originalReward.toFixed(2)}
            </span>
            <span className="aiRewardArrow" aria-hidden="true">→</span>
            <span className="aiRewardBoosted">
              {rewardReadout.adjustedRewardDisplay} {rewardReadout.rewardToken}
            </span>
            {rewardReadout.multiplier > 1 && (
              <span className="aiRewardBoostTag">AI boosted</span>
            )}
          </div>
        </div>
      )}

      {/* NFT badge */}
      {showNft && blockchain.nftMint && (
        <div className="aiNftReveal">
          <span className="aiNftIcon" aria-hidden="true">🏅</span>
          <div>
            <strong>NFT Badge Minted</strong>
            <span className="aiNftMint">{truncateSig(blockchain.nftMint)}</span>
          </div>
          {nftExplorerUrl && (
            <a
              className="aiNftLink"
              href={nftExplorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              View ↗
            </a>
          )}
        </div>
      )}

      {/* Blockchain details */}
      {showExplorer && (
        <div className="aiApprovalBlockchain">
          <div className="aiApprovalBlockchainRow">
            <span>Tx Signature</span>
            <strong>{truncateSig(blockchain.txSignature)}</strong>
          </div>
          <div className="aiApprovalBlockchainRow">
            <span>Mode</span>
            <strong className={`aiModeBadge ${blockchain.rewardTxMode}`}>
              {blockchain.rewardTxMode.toUpperCase()}
            </strong>
          </div>
          {explorerUrl && (
            <a
              className="primaryButton aiExplorerButton"
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              View on Solana Explorer →
            </a>
          )}
        </div>
      )}

      {/* AI summary */}
      {showExplorer && settlement.aiSummary && (
        <div className="aiApprovalSummary">
          <span className="aiMetricLabel">AI Summary</span>
          <p>{settlement.aiSummary}</p>
        </div>
      )}
    </div>
  );
}
