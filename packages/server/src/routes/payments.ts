import { Request, Response, Router } from "express";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { prisma } from "../config/db";
import { parseWithSchema, sendError, sendSuccess } from "../config/http";
import {
  createPaymentRequestSchema,
  verifyPaymentSchema,
} from "../config/validation";
import { paymentService, questService } from "../services";

export const paymentRouter = Router();

paymentRouter.post("/create-request", async (req: Request, res: Response) => {
  try {
    const input = parseWithSchema(createPaymentRequestSchema, req.body) as Parameters<
      typeof paymentService.createPaymentRequest
    >[0];
    const data = await paymentService.createPaymentRequest(input);
    sendSuccess(res, data, "Payment request created");
  } catch (error) {
    console.error("Failed to create payment request:", error);
    sendError(res, error, "Failed to create payment request");
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
        message: "Wallet is required to complete an incentive payment",
        error: "Wallet is required to complete an incentive payment",
        data: null,
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

      return sendSuccess(res, result, "Quest payment verified");
    }

    if (!pendingPayment) {
      return res.status(404).json({
        success: false,
        message: "Payment reference not found",
        error: "Payment reference not found",
        data: null,
      });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: pendingPayment.merchantId },
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
        error: "Merchant not found",
        data: null,
      });
    }

    const verification = await paymentService.verifyTransactionFull(
      reference,
      pendingPayment.wallet,
      merchant.wallet,
      Math.round(pendingPayment.amount * LAMPORTS_PER_SOL),
    );
    if (!verification.verified || !verification.signature) {
      return sendSuccess(res, { verified: false }, "Payment not settled yet");
    }

    if (!verification.recipientVerified) {
      return res.status(409).json({
        success: false,
        message: `Payment did not go to merchant wallet ${merchant.wallet}`,
        error: `Payment did not go to merchant wallet ${merchant.wallet}`,
        data: null,
      });
    }

    if (!verification.senderVerified) {
      return res.status(409).json({
        success: false,
        message: `Payment sender does not match claimant wallet ${pendingPayment.wallet}`,
        error: `Payment sender does not match claimant wallet ${pendingPayment.wallet}`,
        data: null,
      });
    }

    if (!verification.referenceVerified) {
      return res.status(409).json({
        success: false,
        message: `Payment transaction does not include reference ${reference}`,
        error: `Payment transaction does not include reference ${reference}`,
        data: null,
      });
    }

    if (!verification.amountVerified) {
      return res.status(400).json({
        success: false,
        message: `Payment amount too low: got ${verification.amountLamports} lamports, need ${Math.round(pendingPayment.amount * LAMPORTS_PER_SOL)}`,
        error: `Payment amount too low: got ${verification.amountLamports} lamports, need ${Math.round(pendingPayment.amount * LAMPORTS_PER_SOL)}`,
        data: null,
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

    sendSuccess(
      res,
      {
        verified: true,
        txSignature: verification.signature,
        transactionId: transaction.id,
        approved: true,
      },
      "Payment verified",
    );
  } catch (error) {
    console.error("Failed to verify payment:", error);
    sendError(res, error, "Failed to verify payment");
  }
});

paymentRouter.get("/status/:reference", async (req: Request, res: Response) => {
  try {
    const data = await paymentService.getPaymentStatus(req.params.reference);
    sendSuccess(res, data, "Payment status loaded");
  } catch (error) {
    console.error("Failed to fetch payment status:", error);
    sendError(res, error, "Failed to fetch payment status");
  }
});
