"use client";

import type { DecisionReceiptData } from "@/lib/decision-receipt";

interface Props {
  data: DecisionReceiptData;
}

function riskBand(score: number) {
  if (score < 20) return { label: "LOW RISK", tone: "low" } as const;
  if (score < 60) return { label: "MEDIUM RISK", tone: "medium" } as const;
  return { label: "HIGH RISK", tone: "high" } as const;
}

function formatAmount(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, "");
}

function truncateAddress(value: string, chars = 8) {
  if (value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars)}...${value.slice(-6)}`;
}

function formatMetaKey(key: string) {
  return key.replace(/_/g, " ");
}

const VerificationRow = ({ ok, label, detail }: { ok: boolean; label: string; detail: string }) => (
  <li className={`receiptCheckRow ${ok ? "passed" : "failed"}`}>
    <span className="receiptCheckIcon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        {ok
          ? <path d="M3.5 9l4 4L14.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          : <><path d="M4.5 4.5l9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
      </svg>
    </span>
    <span className="receiptCheckContent">
      <strong>{label}</strong>
      <small>{detail}</small>
    </span>
  </li>
);

export function DecisionReceipt({ data }: Props) {
  const band = riskBand(data.fraudScore);
  const locationOk = data.distanceMeters < 200;
  const fraudOk = data.fraudScore < 60;
  const explorerUrl = data.nftMint
    ? `https://explorer.solana.com/address/${data.nftMint}?cluster=devnet`
    : null;

  return (
    <section
      className={`decisionReceipt ${data.approved ? "approved" : "rejected"}`}
      aria-label="Contribution validation receipt"
    >
      <header className="decisionReceiptHero">
        <p className="receiptEyebrow">Validation Receipt</p>
        <h2>{data.approved ? "Contribution Verified" : "Contribution Rejected"}</h2>
        <p>
          {data.approved
            ? "PIKO approved this reward after payment, location, identity, and risk checks passed."
            : "PIKO blocked this reward because one or more validation checks failed."}
        </p>
      </header>

      <ul className="receiptChecklist">
        <VerificationRow
          ok={Boolean(data.txSignature)}
          label="Payment confirmed"
          detail={
            data.txSignature
              ? `Transaction ${truncateAddress(data.txSignature)}`
              : "Payment transaction missing"
          }
        />
        <VerificationRow
          ok={locationOk}
          label="Location verified"
          detail={`${Math.round(data.distanceMeters)}m from merchant, ${Math.round(data.gpsAccuracy)}m GPS accuracy`}
        />
        <VerificationRow
          ok={data.worldIdVerified}
          label="Identity signal recorded"
          detail={data.worldIdVerified ? "Human-verification signal present" : "No identity signal"}
        />
        <VerificationRow
          ok={fraudOk}
          label={`Fraud score: ${data.fraudScore}/100`}
          detail={data.fraudFlags.length ? data.fraudFlags.join(", ") : band.label}
        />
        <VerificationRow
          ok={data.approved}
          label={data.approved ? "Reward approved" : "Reward blocked"}
          detail={
            data.economicState.budgetGuardActive
              ? `Budget guard active, vault ${data.economicState.vaultBalance} PIKO`
              : "Budget guard cleared"
          }
        />
      </ul>

      {/* Fraud score card */}
      <div className={`receiptFraudCard ${band.tone}`}>
        <div className="receiptFraudScore">{data.fraudScore}</div>
        <div className="receiptFraudMeta">
          <span className="receiptFraudDenom">/ 100</span>
          <span className={`receiptFraudLabel ${band.tone}`}>{band.label}</span>
        </div>
      </div>

      <div className="receiptOutcomeGrid">
        <div>
          <span>Reward multiplier</span>
          <strong>{data.rewardMultiplier}x</strong>
        </div>
        <div>
          <span>Reward issued</span>
          <strong>
            {formatAmount(data.rewardAmount)} {data.rewardToken}
          </strong>
        </div>
      </div>

      {data.nftMint && data.nftMetadata ? (
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
            <code className="receiptProofMint">{truncateAddress(data.nftMint)}</code>
          </div>
          {explorerUrl ? (
            <a className="receiptProofLink" href={explorerUrl} target="_blank" rel="noreferrer">
              View on Explorer
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h7v7" />
                <path d="M13 3L6 10" />
              </svg>
            </a>
          ) : null}
        </div>
      ) : null}

      {data.nftMetadata ? (
        <dl className="receiptMetadataGrid" aria-label="Proof NFT metadata">
          {Object.entries(data.nftMetadata).slice(0, 4).map(([key, value]) => (
            <div key={key}>
              <dt>{formatMetaKey(key)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
