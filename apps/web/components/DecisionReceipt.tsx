"use client";

import type { DecisionReceiptData } from "@/lib/decision-receipt";

interface Props {
  data: DecisionReceiptData;
}

function riskBand(score: number) {
  if (score < 20) return { label: "Low risk", tone: "low" } as const;
  if (score < 60) return { label: "Medium risk", tone: "medium" } as const;
  return { label: "High risk", tone: "high" } as const;
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
  <li className={`decisionReceiptCheck ${ok ? "passed" : "failed"}`}>
    <span className="decisionReceiptCheckIcon" aria-hidden="true">
      {ok ? "OK" : "NO"}
    </span>
    <span>
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
        <p className="eyebrow">Validation receipt</p>
        <h2>{data.approved ? "Contribution Verified" : "Contribution Rejected"}</h2>
        <p>
          {data.approved
            ? "PIKO approved this reward after payment, location, identity, and risk checks passed."
            : "PIKO blocked this reward because one or more validation checks failed."}
        </p>
      </header>

      <ul className="decisionReceiptChecks">
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

      <div className="decisionReceiptOutcome">
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
        <div className="decisionReceiptProof">
          <div>
            <span>Proof NFT minted</span>
            <strong>{truncateAddress(data.nftMint)}</strong>
          </div>
          {explorerUrl ? (
            <a href={explorerUrl} target="_blank" rel="noreferrer">
              Inspect on Explorer
            </a>
          ) : null}
        </div>
      ) : null}

      {data.nftMetadata ? (
        <dl className="decisionReceiptMetadata" aria-label="Proof NFT metadata">
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
