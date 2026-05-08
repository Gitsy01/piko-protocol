"use client";

import React from "react";
import type { DecisionReceiptData } from "@/lib/decision-receipt";

interface Props {
  data: DecisionReceiptData;
}

function riskBand(score: number) {
  if (score < 20) return { label: "LOW RISK", color: "#0F6E56", bg: "#E1F5EE" };
  if (score < 60) return { label: "MEDIUM RISK", color: "#854F0B", bg: "#FAEEDA" };
  return { label: "HIGH RISK", color: "#A32D2D", bg: "#FCEBEB" };
}

function formatAmount(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, "");
}

const Check = ({ ok, label, detail }: { ok: boolean; label: string; detail: string }) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "10px 0",
      borderBottom: "0.5px solid var(--color-border-tertiary)",
    }}
  >
    <span
      aria-hidden="true"
      style={{
        marginTop: 1,
        flexShrink: 0,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: ok ? "#E1F5EE" : "#FCEBEB",
        color: ok ? "#0F6E56" : "#A32D2D",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {ok ? "✓" : "✗"}
    </span>
    <div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{detail}</div>
    </div>
  </div>
);

export function DecisionReceipt({ data }: Props) {
  const band = riskBand(data.fraudScore);

  return (
    <section
      aria-label="Decision receipt"
      style={{
        border: "0.5px solid var(--color-border-secondary)",
        borderRadius: 12,
        overflow: "hidden",
        fontFamily: "var(--font-sans)",
        background: "var(--color-background-primary)",
        marginTop: 16,
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          background: data.approved ? "#E1F5EE" : "#FCEBEB",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: data.approved ? "#0F6E56" : "#A32D2D" }}>
          {data.approved ? "✓  AI Decision: APPROVED" : "✗  AI Decision: REJECTED"}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.04em",
            padding: "2px 10px",
            borderRadius: 20,
            background: band.bg,
            color: band.color,
          }}
        >
          Fraud {data.fraudScore}/100 · {band.label}
        </span>
      </div>

      {data.aiSummary ? (
        <div
          style={{
            padding: "10px 16px",
            fontSize: 12,
            color: "var(--color-text-secondary)",
            borderBottom: "0.5px solid var(--color-border-tertiary)",
            fontStyle: "italic",
          }}
        >
          "{data.aiSummary}"
        </div>
      ) : null}

      <div style={{ padding: "0 16px" }}>
        <Check
          ok={data.worldIdVerified}
          label="Identity — World ID"
          detail={data.worldIdVerified ? "1 human · 1 wallet · sybil-resistant" : "World ID not verified"}
        />
        <Check
          ok={Boolean(data.txSignature)}
          label="Payment — Solana Pay"
          detail={
            data.txSignature
              ? `Tx ${data.txSignature.slice(0, 8)}…${data.txSignature.slice(-6)} confirmed`
              : "Payment not found"
          }
        />
        <Check
          ok={data.distanceMeters < 200}
          label={`Location — ${Math.round(data.distanceMeters)}m from merchant`}
          detail={`GPS accuracy ${Math.round(data.gpsAccuracy)}m · threshold 200m`}
        />
        <Check
          ok={data.fraudScore < 60}
          label={`Behavioral AI — score ${data.fraudScore}/100`}
          detail={
            data.fraudFlags.length > 0
              ? `Flags: ${data.fraudFlags.join(", ")}`
              : "No suspicious signals detected"
          }
        />
        <Check
          ok={!data.economicState.budgetGuardActive}
          label={`Economic guard — ${data.economicState.effectiveMultiplierRange}`}
          detail={
            data.economicState.budgetGuardActive
              ? `Budget guard active (vault: ${data.economicState.vaultBalance} PIKO)`
              : "Vault healthy · full multiplier range available"
          }
        />
      </div>

      <div
        style={{
          padding: "12px 16px",
          background: "var(--color-background-secondary)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          borderTop: "0.5px solid var(--color-border-tertiary)",
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 2 }}>REWARD ISSUED</div>
          <div style={{ fontWeight: 600, fontSize: 18 }}>
            {formatAmount(data.rewardAmount)} {data.rewardToken}
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "var(--color-text-secondary)",
                marginLeft: 6,
              }}
            >
              × {data.rewardMultiplier} multiplier
            </span>
          </div>
        </div>

        {data.nftMint && data.nftMetadata ? (
          <div
            style={{
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 11,
              maxWidth: 240,
              flex: "1 1 220px",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>Proof NFT Created</div>
            {Object.entries(data.nftMetadata).map(([key, value]) => (
              <div
                key={key}
                style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }}
              >
                <span style={{ color: "var(--color-text-secondary)" }}>{key.replace(/_/g, " ")}</span>
                <span style={{ fontWeight: 500 }}>{value}</span>
              </div>
            ))}
            <a
              href={`https://explorer.solana.com/address/${data.nftMint}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                marginTop: 6,
                fontSize: 11,
                color: "var(--color-text-info)",
                minHeight: 40,
                paddingTop: 8,
              }}
            >
              {data.nftMint.slice(0, 8)}…{data.nftMint.slice(-6)} ↗
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
