"use client";

import { useEffect, useState } from "react";
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

  const showReward = revealStep >= 1;
  const showExplorer = revealStep >= 2;
  const earnedAmount = rewardResult?.rewardAmount ?? quest.rewardAmount;
  const earnedToken = rewardResult?.rewardToken ?? quest.rewardToken;

  return (
    <div
      className={`aiApprovalCard ${isApproved ? "approved" : "rejected"}`}
      id="demo-reward-screen"
      role="status"
      aria-live="polite"
    >
      <div className="aiApprovalHeader">
        <span className="aiApprovalIcon" aria-hidden="true">
          {isApproved ? "OK" : "NO"}
        </span>
        <h2 className="aiApprovalTitle">
          {isApproved ? "Contribution Verified" : "Reward rejected"}
        </h2>
        <p className="aiApprovalSubtitle">
          {isApproved
            ? `${earnedAmount.toFixed(2)} ${earnedToken} settled and proof NFT minted.`
            : "The claim did not pass validation."}
        </p>
      </div>

      {showReward && isApproved ? (
        <div className="demoRewardMoment">
          <p className="eyebrow">Decision Receipt</p>
          <strong>System-level verification completed</strong>
          <span>{quest.merchant.name} passed payment, location, identity, and fraud checks before settlement.</span>
        </div>
      ) : null}

      {showReward && decisionReceipt ? <DecisionReceipt data={decisionReceipt} /> : null}

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

    </div>
  );
}
