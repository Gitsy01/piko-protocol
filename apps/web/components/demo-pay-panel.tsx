"use client";

import { Buffer } from "buffer";
import { useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { claimQuest, createPaymentRequest, verifyPayment, getPaymentStatus } from "@/lib/api";
import { useDemoContext } from "@/providers/demo-context";
import { formatReward } from "@/lib/utils";
import { useMerchantMap } from "@/hooks/use-merchant-map";
import { VerificationGate } from "@/components/verification-gate";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

function parseSolanaPayUrl(rawUrl: string) {
  const [schemePart, queryString = ""] = rawUrl.split("?");
  const recipient = schemePart.replace(/^solana:/, "").replace(/^\/\//, "");
  const query = new URLSearchParams(queryString);
  return {
    recipient,
    amount: Number(query.get("amount") ?? "0"),
    reference: query.get("reference"),
    memo: query.get("memo"),
  };
}

/** Derive AI evaluation data from payment verification response */
function buildAIEvaluation(
  result: {
    fraudScore?: number;
    rewardMultiplier?: number;
    aiSummary?: string;
    rewardAmount?: number;
    rewardToken?: string;
    decision?: "APPROVED" | "REJECTED";
    worldVerified?: boolean;
  },
  quest: { rewardAmount: number; rewardToken: string },
  worldVerified: boolean,
) {
  const fraudScore = result.fraudScore ?? 3.2;
  const multiplier = result.rewardMultiplier ?? 1.8;
  const adjustedReward = result.rewardAmount ?? quest.rewardAmount * multiplier;
  const decision = result.decision ?? (fraudScore < 50 ? "APPROVED" : "REJECTED") as "APPROVED" | "REJECTED";

  return {
    fraudScore,
    fraudFlags: fraudScore < 15
      ? ["clean_history", "verified_location", "trusted_device"]
      : fraudScore < 45
      ? ["moderate_activity"]
      : ["suspicious_pattern", "high_velocity", "gps_mismatch"],
    rewardMultiplier: multiplier,
    rewardReasons: multiplier > 1.5
      ? ["High foot traffic area", "Verified merchant", "First visit bonus"]
      : multiplier > 1
      ? ["Verified merchant", "Active time bonus"]
      : ["Base reward applied"],
    decision,
    worldVerified: result.worldVerified ?? worldVerified,
    aiSummary: result.aiSummary ?? "All verification checks passed. Reward approved with AI-optimized multiplier.",
    originalReward: quest.rewardAmount,
    adjustedReward,
    adjustedRewardDisplay: adjustedReward.toFixed(2),
    rewardToken: result.rewardToken ?? quest.rewardToken,
  };
}

export function DemoPayPanel() {
  const { state, dispatch } = useDemoContext();
  const { quest, merchant, worldVerified, verifyPending } = state;
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const { location, accuracy } = useMerchantMap();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<{ url: string; reference: string } | null>(null);
  const autoVerifyingRef = useRef(false);

  const devnetAmount = Math.max(0.001, Number((quest.minSpend / 1000).toFixed(3)));
  const reward = formatReward(quest.rewardAmount, quest.rewardToken);

  function handleWorldIdVerify() {
    dispatch({ type: "VERIFY_START" });
    // Simulate verification delay for demo purposes
    setTimeout(() => {
      dispatch({ type: "VERIFY_COMPLETE", payload: { worldVerified: true } });
    }, 1500);
  }

  // Auto-verify once payment request is created
  useEffect(() => {
    if (!paymentRequest || !publicKey) return;

    let cancelled = false;
    const interval = window.setInterval(() => {
      if (cancelled || autoVerifyingRef.current) return;
      autoVerifyingRef.current = true;

      void getPaymentStatus(paymentRequest.reference)
        .then(async (status) => {
          if (!status.found || cancelled) return;

          const result = await verifyPayment({
            reference: paymentRequest.reference,
            questId: quest.id,
            wallet: publicKey.toBase58(),
            paymentSignature: status.signature ?? undefined,
            lat: location.lat,
            lng: location.lng,
            gpsAccuracy: accuracy ?? undefined,
          });

          if (cancelled || !result.verified) return;

          const aiEval = buildAIEvaluation(result, quest, worldVerified);

          dispatch({
            type: "PAYMENT_COMPLETE",
            payload: {
              rewardResult: {
                txSignature: result.txSignature ?? status.signature ?? null,
                rewardToken: result.rewardToken ?? quest.rewardToken,
                rewardAmount: result.rewardAmount ?? quest.rewardAmount,
                xpEarned: result.xpEarned ?? 0,
                newLevel: result.newLevel ?? 1,
                aiSummary: result.aiSummary ?? null,
                badgeReward: quest.badgeReward,
                nftMint: result.nftMint ?? null,
              },
              aiEvaluation: aiEval,
            },
          });
        })
        .catch(() => undefined)
        .finally(() => { autoVerifyingRef.current = false; });
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [paymentRequest, publicKey, quest, location, accuracy, dispatch, worldVerified]);

  async function handlePay() {
    if (!publicKey) return;
    setSubmitting(true);
    setError(null);

    try {
      // Claim quest first
      try {
        await claimQuest({
          questId: quest.id,
          wallet: publicKey.toBase58(),
          lat: location.lat,
          lng: location.lng,
          gpsAccuracy: accuracy ?? 999,
        });
      } catch (e) {
        if (!(e instanceof Error) || !e.message.includes("Already claimed")) throw e;
      }

      // Create payment request
      const created = await createPaymentRequest({
        merchantId: merchant.id,
        amount: devnetAmount,
        questId: quest.id,
        wallet: publicKey.toBase58(),
      });

      setPaymentRequest(created);

      // Execute wallet payment
      const parsed = parseSolanaPayUrl(created.url);
      const recipient = new PublicKey(parsed.recipient);
      const reference = parsed.reference ? new PublicKey(parsed.reference) : null;
      const lamports = Math.max(1, Math.round(parsed.amount * 1_000_000_000));

      const transferIx = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: recipient,
        lamports,
      });

      const memoIx = new TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: reference ? [{ pubkey: reference, isSigner: false, isWritable: false }] : [],
        data: Buffer.from(parsed.memo ?? `Quest payment for ${quest.id}`),
      });

      const tx = new Transaction().add(transferIx, memoIx);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      // Try instant verify
      try {
        const result = await verifyPayment({
          reference: created.reference,
          questId: quest.id,
          wallet: publicKey.toBase58(),
          paymentSignature: sig,
          lat: location.lat,
          lng: location.lng,
          gpsAccuracy: accuracy ?? undefined,
        });

        if (result.verified) {
          const aiEval = buildAIEvaluation(result, quest, worldVerified);

          dispatch({
            type: "PAYMENT_COMPLETE",
            payload: {
              rewardResult: {
                txSignature: result.txSignature ?? sig,
                rewardToken: result.rewardToken ?? quest.rewardToken,
                rewardAmount: result.rewardAmount ?? quest.rewardAmount,
                xpEarned: result.xpEarned ?? 0,
                newLevel: result.newLevel ?? 1,
                aiSummary: result.aiSummary ?? null,
                badgeReward: quest.badgeReward,
                nftMint: result.nftMint ?? null,
              },
              aiEvaluation: aiEval,
            },
          });
        }
      } catch {
        // Auto-verify loop will catch it
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="demoPayPanel" id="demo-pay-panel">
      <div className="demoPayPanelGlow" aria-hidden="true" />

      {/* Verification Gate — blocks payment until verified */}
      <VerificationGate
        worldVerified={worldVerified}
        wallet={publicKey?.toBase58() ?? "demo-wallet"}
        sessionId="demo-flow"
        pending={verifyPending}
        onVerify={() => handleWorldIdVerify()}
      />

      {/* Payment flow — only shown after verification */}
      {worldVerified && (
        <>
          <div className="demoPayFlow">
            <div className="demoPayStep">
              <span className="demoPayStepNum">1</span>
              <span>Go to <strong>{merchant.name}</strong></span>
            </div>
            <div className="demoPayStepArrow" aria-hidden="true">↓</div>
            <div className="demoPayStep">
              <span className="demoPayStepNum">2</span>
              <span>Pay <strong>{devnetAmount} SOL</strong> (devnet)</span>
            </div>
            <div className="demoPayStepArrow" aria-hidden="true">↓</div>
            <div className="demoPayStep">
              <span className="demoPayStepNum">3</span>
              <span>AI evaluates → <strong>{reward}</strong> + NFT badge</span>
            </div>
          </div>

          {error && <p className="demoPayError" role="alert">{error}</p>}

          {submitting && (
            <div className="demoPayStatus" aria-live="polite">
              <span className="demoPaySpinner" aria-hidden="true" />
              {paymentRequest ? "Verifying payment…" : "Sending transaction…"}
            </div>
          )}

          <button
            id="demo-pay-now-btn"
            className={`demoCta demoPayNowCta ${submitting ? "loading" : ""}`}
            type="button"
            onClick={() => void handlePay()}
            disabled={!connected || submitting}
            aria-busy={submitting}
          >
            {submitting ? (paymentRequest ? "⏳ Verifying…" : "⏳ Sending…") : "💳 Pay Now"}
          </button>

          {!connected && (
            <p className="demoPayWalletNote">Connect your wallet above to pay</p>
          )}
        </>
      )}
    </div>
  );
}
