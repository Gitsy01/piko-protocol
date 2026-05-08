"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { DecisionReceipt } from "@/components/DecisionReceipt";
import { useDemoContext } from "@/providers/demo-context";

function formatSolAmount(amount: number) {
  return `${amount.toFixed(2)} SOL`;
}

function getExplorerUrl(signature: string | null) {
  if (!signature) return null;
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function truncateSignature(signature: string | null, chars = 8) {
  if (!signature) return "-";
  if (signature.length <= chars * 2 + 3) return signature;
  return `${signature.slice(0, chars)}...${signature.slice(-chars)}`;
}

export function DemoReward() {
  const { state, dispatch } = useDemoContext();
  const { rewardResult, aiEvaluation, decisionReceipt, quest } = state;
  const [revealStep, setRevealStep] = useState(0);

  const isApproved = aiEvaluation?.decision === "APPROVED";
  const explorerUrl = getExplorerUrl(rewardResult?.txSignature ?? null);

  useEffect(() => {
    if (revealStep >= 3) return;
    const delay = revealStep === 0 ? 300 : 450;
    const timer = window.setTimeout(() => setRevealStep((current) => current + 1), delay);
    return () => clearTimeout(timer);
  }, [revealStep]);

  const particles = useMemo(
    () =>
      isApproved
        ? Array.from({ length: 24 }, (_, index) => ({
            id: index,
            style: {
              ["--particle-left" as string]: `${Math.random() * 100}%`,
              ["--particle-delay" as string]: `${Math.random() * 1.2}s`,
              ["--particle-color" as string]:
                index % 4 === 0
                  ? "var(--solana-green)"
                  : index % 4 === 1
                    ? "var(--brand)"
                    : index % 4 === 2
                      ? "var(--solana-purple)"
                      : "#FFD700",
            } as CSSProperties,
          }))
        : [],
    [isApproved]
  );

  const showReward = revealStep >= 1;
  const showExplorer = revealStep >= 2;
  const earnedAmount = rewardResult?.rewardAmount ?? quest.rewardAmount;
  const earnedToken = rewardResult?.rewardToken ?? quest.rewardToken;
  const originalReward = aiEvaluation?.originalReward ?? quest.rewardAmount;
  const rewardMultiplier = aiEvaluation?.rewardMultiplier ?? 1;

  return (
    <div
      className={`aiApprovalCard ${isApproved ? "approved" : "rejected"}`}
      id="demo-reward-screen"
      role="status"
      aria-live="polite"
    >
      {isApproved && showReward ? (
        <div className="aiApprovalParticles" aria-hidden="true">
          {particles.map((particle) => (
            <div key={particle.id} className="aiApprovalParticle" style={particle.style} />
          ))}
        </div>
      ) : null}

      <div className="aiApprovalHeader">
        <span className="aiApprovalIcon" aria-hidden="true">
          {isApproved ? "OK" : "NO"}
        </span>
        <h2 className="aiApprovalTitle">
          {isApproved ? `${earnedAmount.toFixed(2)} ${earnedToken} settled` : "Reward rejected"}
        </h2>
      </div>

      {showReward && isApproved ? (
        <div className="demoRewardMoment">
          <p className="eyebrow">Decision Receipt</p>
          <strong>The anti-cheat system explains exactly why this reward cleared</strong>
          <span>{quest.merchant.name} payment, location, identity, and travel signals all passed before settlement.</span>
        </div>
      ) : null}

      {showReward && decisionReceipt ? <DecisionReceipt data={decisionReceipt} /> : null}

      {showReward ? (
        <div className={`aiRewardReveal ${isApproved ? "show" : ""}`}>
          <div className="aiRewardRevealRow">
            <span className="aiRewardLabel">Reward</span>
            <span className="aiRewardOriginal">{originalReward.toFixed(2)}</span>
            <span className="aiRewardArrow" aria-hidden="true">TO</span>
            <span className="aiRewardBoosted">
              {earnedAmount.toFixed(2)} {earnedToken}
            </span>
            {rewardMultiplier > 1 ? <span className="aiRewardBoostTag">AI boosted</span> : null}
          </div>
        </div>
      ) : null}

      {showExplorer ? (
        <div className="aiApprovalBlockchain">
          {rewardResult?.txSignature ? (
            <div className="aiApprovalBlockchainRow">
              <span>Tx Signature</span>
              <strong>{truncateSignature(rewardResult.txSignature)}</strong>
            </div>
          ) : null}
          <div className="aiApprovalBlockchainRow">
            <span>Location proof</span>
            <strong>
              {Math.round(aiEvaluation?.locationDistanceMeters ?? 42)}m away / {Math.round(aiEvaluation?.gpsAccuracyMeters ?? 9)}m accuracy
            </strong>
          </div>
          <div className="aiApprovalBlockchainRow">
            <span>Payment proof</span>
            <strong>{formatSolAmount(aiEvaluation?.paymentAmountSol ?? 0.05)}</strong>
          </div>
          <div className="aiApprovalActions">
            {explorerUrl ? (
              <a
                id="demo-explorer-link"
                className="primaryButton aiExplorerButton"
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                View on Solana Explorer
              </a>
            ) : null}
            <button
              id="demo-do-another-btn"
              className="demoCta"
              type="button"
              onClick={() => dispatch({ type: "RESET" })}
            >
              Run the demo again
            </button>
          </div>
        </div>
      ) : null}

      {showExplorer && aiEvaluation?.aiSummary ? (
        <div className="aiApprovalSummary">
          <span className="aiMetricLabel">AI Summary</span>
          <p>{aiEvaluation.aiSummary}</p>
        </div>
      ) : null}
    </div>
  );
}
