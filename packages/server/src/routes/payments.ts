import { Request, Response, Router } from "express";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { prisma } from "../config/db";
import { getErrorMessage, getErrorStatus, parseWithSchema } from "../config/http";
import {
  createPaymentRequestSchema,
  verifyPaymentSchema,
} from "../config/validation";
import { paymentService, questService } from "../services";

export const paymentRouter = Router();

paymentRouter.post("/create-request", async (req: Request, res: Response) => {
  try {
    const input = parseWithSchema(createPaymentRequestSchema, req.body);
    const data = await paymentService.createPaymentRequest(input);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Failed to create payment request:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

paymentRouter.post("/verify", async (req: Request, res: Response) => {
  try {
    const { reference, paymentSignature, questId, wallet, lat, lng, gpsAccuracy } = parseWithSchema(
      verifyPaymentSchema,
      req.body
    );

    const pendingPayment = paymentService.getPendingPayment(reference);
    const resolvedQuestId = questId ?? pendingPayment?.questId;
    const resolvedWallet = wallet ?? pendingPayment?.wallet;

    if (resolvedQuestId && !resolvedWallet) {
      return res.status(400).json({
        success: false,
        error: "Wallet is required to complete a quest payment",
      });
    }

    if (resolvedQuestId && resolvedWallet) {
      const result = await questService.completeQuest({
        questId: resolvedQuestId,
        reference,
        paymentSignature,
        userWallet: resolvedWallet,
        lat,
        lng,
        gpsAccuracy,
      });

      return res.json({ success: true, data: result });
    }

    if (!pendingPayment) {
      return res.status(404).json({ success: false, error: "Payment reference not found" });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: pendingPayment.merchantId },
    });

    if (!merchant) {
      return res.status(404).json({ success: false, error: "Merchant not found" });
    }

    const verification = await paymentService.verifyTransactionFull(
      reference,
      pendingPayment.wallet,
      merchant.wallet,
      Math.round(pendingPayment.amount * LAMPORTS_PER_SOL),
    );
    if (!verification.verified || !verification.signature) {
      return res.json({ success: true, data: { verified: false } });
    }

    if (!verification.recipientVerified) {
      return res.status(409).json({
        success: false,
        error: `Payment did not go to merchant wallet ${merchant.wallet}`,
      });
    }

    if (!verification.senderVerified) {
      return res.status(409).json({
        success: false,
        error: `Payment sender does not match claimant wallet ${pendingPayment.wallet}`,
      });
    }

    if (!verification.referenceVerified) {
      return res.status(409).json({
        success: false,
        error: `Payment transaction does not include reference ${reference}`,
      });
    }

    if (!verification.amountVerified) {
      return res.status(400).json({
        success: false,
        error: `Payment amount too low: got ${verification.amountLamports} lamports, need ${Math.round(pendingPayment.amount * LAMPORTS_PER_SOL)}`,
      });
    }

    const transaction = await paymentService.recordTransaction({
      merchantId: pendingPayment.merchantId,
      userWallet: pendingPayment.wallet,
      reference,
      amount:
        verification.amountLamports > 0
          ? Number((verification.amountLamports / LAMPORTS_PER_SOL).toFixed(9))
          : pendingPayment.amount,
      txSignature: verification.signature,
      token: verification.tokenMint ? "SPL" : "SOL",
      recipientWallet: verification.recipientWallet,
      amountLamports: BigInt(verification.amountLamports),
      tokenMint: verification.tokenMint,
      recipientVerified: verification.recipientVerified,
    });

    await paymentService.incrementMerchantVisit(pendingPayment.merchantId);
    paymentService.clearPendingPayment(reference);

    res.json({
      success: true,
      data: {
        verified: true,
        txSignature: verification.signature,
        transactionId: transaction.id,
        approved: true,
      },
    });
  } catch (error) {
    console.error("Failed to verify payment:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

paymentRouter.get("/status/:reference", async (req: Request, res: Response) => {
  try {
    const data = await paymentService.getPaymentStatus(req.params.reference);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Failed to fetch payment status:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});
