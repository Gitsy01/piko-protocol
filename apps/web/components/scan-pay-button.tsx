"use client";

import { Buffer } from "buffer";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { claimQuest, createPaymentRequest, getPaymentStatus, verifyPayment } from "@/lib/api";
import { RewardToast } from "./reward-toast";

type ScanPayButtonProps = {
  merchantId: string;
  questId: string;
  amount: number;
  rewardAmount?: number;
  rewardToken?: string;
  userLocation: { lat: number; lng: number };
  userAccuracy?: number | null;
};

type TxStage = "ready" | "claimed" | "paying" | "rewarded";

type PaymentRequestState = {
  url: string;
  reference: string;
};

type CompletionState = {
  txSignature: string | null;
  rewardToken: string;
  rewardAmount: number;
  rewardMultiplier: number;
  aiSummary: string | null;
  xpEarned: number;
  newLevel: number;
};

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

const STAGES: { key: TxStage; label: string }[] = [
  { key: "ready", label: "Ready" },
  { key: "claimed", label: "Claimed" },
  { key: "paying", label: "Paying" },
  { key: "rewarded", label: "Rewarded" },
];

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

function getExplorerUrl(signature: string | null) {
  if (!signature) {
    return null;
  }

  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function formatRewardAmount(amount: number) {
  return Number.isInteger(amount) ? amount.toString() : amount.toFixed(2).replace(/\.?0+$/, "");
}

export function ScanPayButton({
  merchantId,
  questId,
  amount,
  rewardAmount = 10,
  rewardToken = "PIKO",
  userLocation,
  userAccuracy,
}: ScanPayButtonProps) {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const [stage, setStage] = useState<TxStage>("ready");
  const [error, setError] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequestState | null>(null);
  const [completion, setCompletion] = useState<CompletionState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string; highlight: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoVerifyingRef = useRef(false);

  const paymentUrl = paymentRequest?.url ?? null;
  const devnetAmountLabel = `${amount.toFixed(3)} SOL`;
  const walletLink = useMemo(() => paymentUrl ?? undefined, [paymentUrl]);
  const verificationLocation = userLocation;

  useEffect(() => {
    if (!paymentUrl || !canvasRef.current) {
      return;
    }

    QRCode.toCanvas(canvasRef.current, paymentUrl, {
      width: 208,
      margin: 1,
      color: { dark: "#f8f4ff", light: "#0a0a12" },
    }).catch(() => undefined);
  }, [paymentUrl]);

  useEffect(() => {
    if (!paymentRequest || !publicKey || stage !== "paying" || completion) {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(() => {
      if (cancelled || autoVerifyingRef.current) {
        return;
      }

      autoVerifyingRef.current = true;

      void getPaymentStatus(paymentRequest.reference)
        .then(async (status) => {
          if (!status.found || cancelled) {
            return;
          }

          const result = await verifyPayment({
            reference: paymentRequest.reference,
            questId,
            wallet: publicKey.toBase58(),
            paymentSignature: status.signature ?? undefined,
            lat: verificationLocation.lat,
            lng: verificationLocation.lng,
            gpsAccuracy: userAccuracy ?? undefined,
          });

          if (cancelled || !result.verified) {
            return;
          }

          const earnedToken = result.rewardToken ?? rewardToken;
          const earnedAmount = result.rewardAmount ?? rewardAmount;
          setCompletion({
            txSignature: result.txSignature ?? status.signature,
            rewardToken: earnedToken,
            rewardAmount: earnedAmount,
            rewardMultiplier: result.rewardMultiplier ?? 1,
            aiSummary: result.aiSummary ?? null,
            xpEarned: result.xpEarned ?? 0,
            newLevel: result.newLevel ?? 1,
          });
          setStage("rewarded");
          setError(null);
          setToast({
            title: "Reward unlocked!",
            body: `You earned +${formatRewardAmount(earnedAmount)} ${earnedToken} 🎉`,
            highlight: `+${formatRewardAmount(earnedAmount)} ${earnedToken}`,
          });
        })
        .catch(() => undefined)
        .finally(() => {
          autoVerifyingRef.current = false;
        });
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    completion,
    paymentRequest,
    publicKey,
    questId,
    rewardAmount,
    rewardToken,
    stage,
    verificationLocation.lat,
    verificationLocation.lng,
    userAccuracy,
  ]);

  async function generatePaymentRequest() {
    if (!publicKey) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setCompletion(null);
    setToast(null);

    try {
      if (userAccuracy == null) {
        throw new Error("Live GPS accuracy is required before claiming this quest.");
      }

      try {
        await claimQuest({
          questId,
          wallet: publicKey.toBase58(),
          lat: verificationLocation.lat,
          lng: verificationLocation.lng,
          gpsAccuracy: userAccuracy,
        });
      } catch (claimError) {
        if (!(claimError instanceof Error) || !claimError.message.includes("Already claimed")) {
          throw claimError;
        }
      }

      setStage("claimed");

      const created = await createPaymentRequest({
        merchantId,
        amount,
        questId,
        wallet: publicKey.toBase58(),
      });

      setPaymentRequest(created);
      setStage("paying");
    } catch (claimError) {
      setStage("ready");
      setError(
        claimError instanceof Error
          ? claimError.message
          : "Failed to prepare the quest payment. Try claiming again from the merchant zone."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function finalizeQuestPayment(signatureHint?: string) {
    if (!publicKey || !paymentRequest) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const status = await getPaymentStatus(paymentRequest.reference);

      if (!status.found) {
        setError("Payment not found on devnet yet. Once the reference lands, backend verification will finish automatically.");
        return;
      }

      const result = await verifyPayment({
        reference: paymentRequest.reference,
        questId,
        wallet: publicKey.toBase58(),
        paymentSignature: signatureHint ?? status.signature ?? undefined,
        lat: verificationLocation.lat,
        lng: verificationLocation.lng,
        gpsAccuracy: userAccuracy ?? undefined,
      });

      if (!result.verified) {
        setError("Payment is still propagating on devnet. Give it a moment and retry verification.");
        return;
      }

      const earnedToken2 = result.rewardToken ?? rewardToken;
      const earnedAmount2 = result.rewardAmount ?? rewardAmount;
      setCompletion({
        txSignature: result.txSignature ?? status.signature ?? signatureHint ?? null,
        rewardToken: earnedToken2,
        rewardAmount: earnedAmount2,
        rewardMultiplier: result.rewardMultiplier ?? 1,
        aiSummary: result.aiSummary ?? null,
        xpEarned: result.xpEarned ?? 0,
        newLevel: result.newLevel ?? 1,
      });
      setStage("rewarded");
      setToast({
        title: "Reward unlocked!",
        body: `You earned +${formatRewardAmount(earnedAmount2)} ${earnedToken2} 🎉`,
        highlight: `+${formatRewardAmount(earnedAmount2)} ${earnedToken2}`,
      });
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Backend verification failed. Retry after the devnet transaction is confirmed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function payWithConnectedWallet() {
    if (!publicKey || !paymentRequest) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const parsed = parseSolanaPayUrl(paymentRequest.url);
      const recipient = new PublicKey(parsed.recipient);
      const reference = parsed.reference ? new PublicKey(parsed.reference) : null;
      const lamports = Math.max(1, Math.round(parsed.amount * 1_000_000_000));

      const transferInstruction = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: recipient,
        lamports,
      });

      const memoInstruction = new TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: reference ? [{ pubkey: reference, isSigner: false, isWritable: false }] : [],
        data: Buffer.from(parsed.memo ?? `Quest payment for ${questId}`),
      });

      const transaction = new Transaction().add(transferInstruction, memoInstruction);
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      try {
        await finalizeQuestPayment(signature);
      } catch {
        setError("Payment sent. Waiting for backend verification to catch up on devnet.");
      }
    } catch {
      setError("Wallet payment failed. You can retry or open the Solana Pay link directly in your wallet.");
    } finally {
      setSubmitting(false);
    }
  }

  const stageIndex = STAGES.findIndex((item) => item.key === stage);
  const paymentExplorerUrl = getExplorerUrl(completion?.txSignature ?? null);

  return (
    <section className="payPanel questPayPanel" id="scan-pay-panel">
      <div className="payPanelHeader">
        <div>
          <p className="eyebrow">Pay & Earn</p>
          <h3>Trigger the Solana Pay loop</h3>
          <p className="supportText">Devnet transfer, backend verification, then PIKO mint.</p>
        </div>
        <span className={`walletState ${connected ? "connected" : ""}`}>
          {connected ? "Wallet ready" : "Connect wallet"}
        </span>
      </div>

      <div className="txStepper">
        {STAGES.map((item, index) => (
          <div
            key={item.key}
            className={`txStep ${index < stageIndex ? "done" : ""} ${index === stageIndex ? "active" : ""}`}
          >
            {item.label}
          </div>
        ))}
      </div>

      <div className="payAmountCard">
        <span className="metricLabel">Devnet payment</span>
        <strong>{devnetAmountLabel}</strong>
        <p>Use this small SOL payment for the demo verification loop.</p>
      </div>

      <button
        className="primaryButton pulseCta payTrigger"
        onClick={() => void generatePaymentRequest()}
        type="button"
        disabled={!connected || submitting || stage !== "ready"}
      >
        {stage === "ready" ? "Generate QR" : stage === "rewarded" ? "Reward complete" : "Quest request ready"}
      </button>

      <div className="tapPrompt">
        <div className="tapPromptIcon">QR</div>
        <div>
          <strong>Solana Pay handoff</strong>
          <p>Generate the QR, open it in a wallet, send payment, then let the backend verify the reference.</p>
        </div>
      </div>

      <div className="qrShell brandedQrShell">
        <div className="qrFrameAccent qrFrameAccentTop" />
        <div className="qrFrameAccent qrFrameAccentBottom" />
        {paymentUrl ? (
          <canvas ref={canvasRef} aria-label="Solana Pay QR code" />
        ) : (
          <div className="qrPlaceholder">
            <strong>Awaiting request</strong>
            <p>Generate the quest payment to show the live Solana Pay QR.</p>
          </div>
        )}
      </div>

      <div className="walletChips">
        <span className="walletChip">Devnet</span>
        <span className="walletChip">Solana Pay</span>
        <span className="walletChip">Phantom</span>
        <span className="walletChip">Backpack</span>
      </div>

      <div className="paymentActionStack">
        {walletLink ? (
          <a className="ghostButton paymentActionButton" href={walletLink}>
            Open in wallet
          </a>
        ) : null}

        <button
          className="ghostButton paymentActionButton"
          onClick={() => void payWithConnectedWallet()}
          type="button"
          disabled={!paymentRequest || !connected || submitting || stage === "rewarded"}
        >
          Send payment
        </button>

        <button
          className="ghostButton paymentActionButton"
          onClick={() => void finalizeQuestPayment()}
          type="button"
          disabled={!paymentRequest || !connected || submitting || stage === "rewarded"}
        >
          Verify reward
        </button>
      </div>

      {completion ? (
        <div className="paymentResultCard">
          <div>
            <span className="metricLabel">Payment tx</span>
            <strong>{completion.txSignature ?? "Pending"}</strong>
          </div>
          <div>
            <span className="metricLabel">Reward issued</span>
            <strong>+{formatRewardAmount(completion.rewardAmount)} {completion.rewardToken}</strong>
          </div>
          <div>
            <span className="metricLabel">AI result</span>
            <strong>{completion.aiSummary ?? "Awaiting AI summary"}</strong>
          </div>
          <div>
            <span className="metricLabel">XP earned</span>
            <strong>
              +{completion.xpEarned} XP - Lv {completion.newLevel}
            </strong>
          </div>
          {paymentExplorerUrl ? (
            <a href={paymentExplorerUrl} target="_blank" rel="noreferrer">
              View payment on Explorer
            </a>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="errorText">{error}</p> : null}

      {toast ? (
        <RewardToast
          title={toast.title}
          body={toast.body}
          highlight={toast.highlight}
          onClose={() => setToast(null)}
        />
      ) : null}
    </section>
  );
}
