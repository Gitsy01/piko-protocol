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

const PROGRAM_PROOFS = [
  {
    label: "Merchant Registry Program",
    programId: "3GyfAzucGoL1FFpkhpCm3sRjTCjLxPyeFLp4vayw35GH",
  },
  {
    label: "Quest Program",
    programId: "21qTx6xMKjy4v23BbfGvM1mSKvkk3bNVHvgSnXZEMcpC",
  },
] as const;

function getExplorerUrl(signature: string | null, mode: string) {
  if (!signature || mode !== "live") return null;
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function getProgramExplorerUrl(programId: string) {
  return `https://explorer.solana.com/address/${programId}?cluster=devnet`;
}

function truncateSignature(signature: string | null, chars = 8) {
  if (!signature) return "-";
  if (signature.length <= chars * 2 + 3) return signature;
  return `${signature.slice(0, chars)}...${signature.slice(-chars)}`;
}

export function AIApprovalCard({
  settlement,
  blockchain,
  rewardReadout,
}: AIApprovalCardProps) {
  const [revealStep, setRevealStep] = useState(0);
  const isApproved = settlement.decision === "APPROVED";
  const rewardExplorerUrl = getExplorerUrl(blockchain.rewardTx, blockchain.rewardTxMode);
  const nftTxExplorerUrl = getExplorerUrl(blockchain.nftTxSignature, blockchain.nftMode);
  const explorerUrl = rewardExplorerUrl ?? nftTxExplorerUrl;
  const explorerLabel = rewardExplorerUrl ? "View reward transaction" : "View proof NFT transaction";
  const displayedTxSignature = blockchain.rewardTx ?? blockchain.nftTxSignature;
  const displayedTxMode = blockchain.rewardTxMode === "live" ? blockchain.rewardTxMode : blockchain.nftMode;

  const checklist: ChecklistItem[] = useMemo(
    () => [
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
        label: "Human verified (identity signal)",
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
    ],
    [settlement, rewardReadout, isApproved]
  );

  useEffect(() => {
    if (revealStep >= checklist.length + 2) return;

    const delay = revealStep === 0 ? 400 : 500;
    const timer = window.setTimeout(() => {
      setRevealStep((current) => current + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [revealStep, checklist.length]);

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

  const showReward = revealStep >= checklist.length;
  const showNft = revealStep >= checklist.length + 1;
  const showExplorer = revealStep >= checklist.length + 2;

  return (
    <div className={`aiApprovalCard ${isApproved ? "approved" : "rejected"}`} id="ai-approval-card">
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
        <div>
          <h2 className="aiApprovalTitle">
            {isApproved ? "AI approved reward" : "AI rejected claim"}
          </h2>
          <p className="aiSignerDisclosure">On-chain demo proof is executed by the server-side demo signer.</p>
        </div>
      </div>

      <div className="aiApprovalChecklist">
        {checklist.map((item, index) => {
          const visible = index < revealStep;

          return (
            <div
              key={item.id}
              className={`aiApprovalCheck ${visible ? "visible" : ""} ${item.passed ? "passed" : "failed"}`}
            >
              <span className="aiApprovalCheckIcon" aria-hidden="true">
                {item.passed ? "OK" : "NO"}
              </span>
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>

      {showReward ? (
        <div className={`aiRewardReveal ${isApproved ? "show" : ""}`}>
          <div className="aiRewardRevealRow">
            <span className="aiRewardLabel">Reward</span>
            <span className="aiRewardOriginal">{rewardReadout.originalReward.toFixed(2)}</span>
            <span className="aiRewardArrow" aria-hidden="true">TO</span>
            <span className="aiRewardBoosted">
              {rewardReadout.adjustedRewardDisplay} {rewardReadout.rewardToken}
            </span>
            {rewardReadout.multiplier > 1 ? (
              <span className="aiRewardBoostTag">Risk-adjusted</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {showNft && blockchain.nftMint ? (
        <div className="aiNftReveal">
          <span className="aiNftIcon" aria-hidden="true">NFT</span>
          <div className="aiProofNftCard">
            <strong>Proof NFT mint account</strong>
            <span className="aiSignerBadge">Powered by demo signer</span>
            <span className="aiNftMint">{truncateSignature(blockchain.nftMint)}</span>
            <div className="aiProofNftGrid">
              <div className="aiProofNftAttribute">
                <span>Fraud Score</span>
                <strong>{settlement.fraudScore.toFixed(0)}</strong>
              </div>
              <div className="aiProofNftAttribute">
                <span>Verified Payment</span>
                <strong>Yes</strong>
              </div>
              <div className="aiProofNftAttribute">
                <span>Location Verified</span>
                <strong>{settlement.fraudScore < 50 ? "Yes" : "No"}</strong>
              </div>
              <div className="aiProofNftAttribute">
                <span>Multiplier</span>
                <strong>{rewardReadout.multiplier.toFixed(1)}x</strong>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showExplorer ? (
        <div className="aiApprovalBlockchain">
          <div className="aiApprovalBlockchainRow">
            <span>Tx Signature</span>
            <strong>{truncateSignature(displayedTxSignature)}</strong>
          </div>
          <div className="aiApprovalBlockchainRow">
            <span>Mode</span>
            <strong className={`aiModeBadge ${displayedTxMode}`}>
              {displayedTxMode.toUpperCase()}
            </strong>
          </div>
          {explorerUrl ? (
            <a className="primaryButton aiExplorerButton" href={explorerUrl} target="_blank" rel="noreferrer">
              {explorerLabel}
            </a>
          ) : null}
          <div className="aiProgramProofList">
            <span className="aiProgramProofTitle">Executable program proof</span>
            {PROGRAM_PROOFS.map((program) => (
              <a
                key={program.programId}
                className="aiProgramProofLink"
                href={getProgramExplorerUrl(program.programId)}
                target="_blank"
                rel="noreferrer"
              >
                <span>{program.label}</span>
                <strong>{truncateSignature(program.programId)}</strong>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {showExplorer && settlement.aiSummary ? (
        <div className="aiApprovalSummary">
          <span className="aiMetricLabel">AI Summary</span>
          <p>{settlement.aiSummary}</p>
        </div>
      ) : null}
    </div>
  );
}
