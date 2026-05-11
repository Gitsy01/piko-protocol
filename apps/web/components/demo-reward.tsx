"use client";

import { useEffect, useState } from "react";
import { DecisionReceipt } from "@/components/DecisionReceipt";
import { useDemoContext } from "@/providers/demo-context";

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
  const nftMint = decisionReceipt?.nftMint ?? null;
  const nftExplorerUrl = nftMint
    ? `https://explorer.solana.com/address/${nftMint}?cluster=devnet`
    : null;

  useEffect(() => {
    if (revealStep >= 4) return;
    const delay = revealStep === 0 ? 200 : 500;
    const timer = window.setTimeout(() => setRevealStep((c) => c + 1), delay);
    return () => clearTimeout(timer);
  }, [revealStep]);

  const showReward = revealStep >= 1;
  const showProof = revealStep >= 2;
  const showExplorer = revealStep >= 3;
  const earnedAmount = rewardResult?.rewardAmount ?? quest.rewardAmount;
  const earnedToken = rewardResult?.rewardToken ?? quest.rewardToken;

  return (
    <div
      className={`receiptScreen receiptRewardScreen ${isApproved ? "approved" : "rejected"}`}
      id="demo-reward-screen"
      role="status"
      aria-live="polite"
    >
      <section className={`receiptCard rewardReceiptCard ${isApproved ? "approved" : "rejected"}`}>

        {/* Hero */}
        <header className="receiptHero">
          <div className="receiptHeroBadge" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isApproved ? <path d="M20 6L9 17l-5-5" /> : <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>}
            </svg>
          </div>
          <h2 className="receiptHeading">
            {isApproved ? "Contribution Verified" : "Reward Rejected"}
          </h2>
          <p className="receiptSubheading">
            {isApproved
              ? "Settlement confirmed and contribution proof issued on Solana devnet."
              : "The claim did not pass validation. Treasury protected."}
          </p>
        </header>

        {/* Large reward pill */}
        {showReward && isApproved ? (
          <div className="receiptRewardHero">
            <span className="receiptRewardSign">+</span>
            <span className="receiptRewardBig">{earnedAmount.toFixed(0)}</span>
            <span className="receiptRewardTokenBig">{earnedToken}</span>
          </div>
        ) : null}

        {/* NFT proof card */}
        {showProof && isApproved ? (
          <div className="receiptProofCard">
            <div className="receiptProofIcon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <div className="receiptProofText">
              <strong>Contribution Proof Issued</strong>
              <span>Stored on Solana</span>
              {nftMint ? (
                <code className="receiptProofMint">{truncateSignature(nftMint)}</code>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Decision Receipt (detailed checks) */}
        {showReward && decisionReceipt ? <DecisionReceipt data={decisionReceipt} /> : null}

        {/* Explorer CTA */}
        {showExplorer ? (
          <div className="receiptActions">
            {nftExplorerUrl ? (
              <a
                id="demo-nft-explorer-link"
                className="receiptExplorerCta"
                href={nftExplorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                View Proof on Explorer
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h7v7" />
                  <path d="M13 3L6 10" />
                </svg>
              </a>
            ) : explorerUrl ? (
              <a
                id="demo-explorer-link"
                className="receiptExplorerCta"
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                View on Explorer
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h7v7" />
                  <path d="M13 3L6 10" />
                </svg>
              </a>
            ) : null}

            {rewardResult?.txSignature ? (
              <div className="receiptTxRow">
                <span>Reward Tx</span>
                <code>{truncateSignature(rewardResult.txSignature)}</code>
              </div>
            ) : null}

            <button
              id="demo-do-another-btn"
              className="receiptRerunBtn"
              type="button"
              onClick={() => dispatch({ type: "RESET" })}
            >
              Run the demo again
            </button>
          </div>
        ) : null}

      </section>
    </div>
  );
}
