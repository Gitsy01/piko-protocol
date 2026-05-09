import BigNumber from "bignumber.js";
import { encodeURL, findReference } from "@solana/pay";
import { Prisma } from "@prisma/client";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { HttpError } from "../config/http";
import { verifyMerchantPayment } from "../lib/txVerifier";

export type PendingPayment = {
  merchantId: string;
  questId?: string;
  amount: number;
  wallet: string;
  reference: PublicKey;
  createdAt: Date;
};

export type CreatePaymentRequestInput = {
  merchantId: string;
  amount: number;
  questId?: string;
  wallet: string;
};

export type VerifiedPaymentResult = {
  verified: boolean;
  signature: string | null;
  paymentInfo: PendingPayment | null;
};

export type FullVerificationResult = {
  verified: boolean;
  signature: string | null;
  senderVerified: boolean;
  recipientVerified: boolean;
  amountVerified: boolean;
  referenceVerified: boolean;
  senderWallet: string | null;
  recipientWallet: string | null;
  amountLamports: number;
  tokenMint: string | null;
  paymentInfo: PendingPayment | null;
};

export type RecordTransactionInput = {
  merchantId: string;
  userWallet: string;
  questId?: string | null;
  claimId?: string | null;
  reference?: string | null;
  amount: number;
  txSignature: string;
  token?: string;
  isVerified?: boolean;
  recipientWallet?: string | null;
  amountLamports?: bigint | null;
  tokenMint?: string | null;
  recipientVerified?: boolean;
  rewardTx?: string | null;
  rewardAmountBaseUnits?: bigint | null;
  rewardMultiplier?: number | null;
  rewardToken?: string | null;
  rewardReasons?: unknown;
  fraudScore?: number | null;
  worldVerified?: boolean | null;
  decision?: string | null;
  aiSummary?: string | null;
  xpEarned?: number | null;
  newLevel?: number | null;
  nftMint?: string | null;
  nftTxSignature?: string | null;
  completedAt?: Date | null;
};

export class PaymentService {
  private readonly connection: Connection;
  private readonly pendingPayments = new Map<string, PendingPayment>();

  constructor() {
    this.connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  }

  async createPaymentRequest(input: CreatePaymentRequestInput) {
    const { merchantId, amount, questId, wallet } = input;

    const [merchant, quest] = await Promise.all([
      prisma.merchant.findUnique({ where: { id: merchantId } }),
      questId ? prisma.quest.findUnique({ where: { id: questId } }) : Promise.resolve(null),
    ]);

    if (!merchant) {
      throw new HttpError(404, "Merchant not found");
    }

    if (questId && (!quest || quest.merchantId !== merchantId || !quest.isActive)) {
      throw new HttpError(404, "Quest not found for merchant");
    }

    if (questId) {
      const claim = await prisma.questClaim.findUnique({
        where: {
          questId_userWallet: {
            questId,
            userWallet: wallet,
          },
        },
      });

      if (!claim) {
        throw new HttpError(400, "Create a pending incentive claim before requesting payment");
      }
    }

    const reference = Keypair.generate().publicKey;
    const recipient = this.parseMerchantWallet(merchant.wallet, merchantId);
    const url = encodeURL({
      recipient,
      amount: new BigNumber(amount),
      reference,
      label: merchant.name,
      message: questId && quest ? `Quest: ${quest.title} @ ${merchant.name}` : `Payment @ ${merchant.name}`,
      memo: questId || undefined,
    });

    this.pendingPayments.set(reference.toBase58(), {
      merchantId,
      questId,
      amount,
      wallet,
      reference,
      createdAt: new Date(),
    });

    return {
      url: url.toString(),
      reference: reference.toBase58(),
    };
  }

  getPendingPayment(reference: string) {
    return this.pendingPayments.get(reference) ?? null;
  }

  clearPendingPayment(reference: string) {
    this.pendingPayments.delete(reference);
  }

  async verifyTransaction(reference: string): Promise<VerifiedPaymentResult> {
    let refKey: PublicKey;
    try {
      refKey = new PublicKey(reference);
    } catch {
      throw new HttpError(400, "Invalid payment reference");
    }

    const paymentInfo = this.getPendingPayment(reference);

    try {
      const signatureInfo = await findReference(this.connection, refKey, {
        finality: "confirmed",
      });

      return {
        verified: true,
        signature: signatureInfo.signature,
        paymentInfo,
      };
    } catch {
      return {
        verified: false,
        signature: null,
        paymentInfo,
      };
    }
  }

  async verifyTransactionFull(
    reference: string,
    expectedSenderWallet: string,
    expectedMerchantWallet: string,
    minSpendLamports: number,
  ): Promise<FullVerificationResult> {
    let refKey: PublicKey;
    try {
      refKey = new PublicKey(reference);
    } catch {
      throw new HttpError(400, "Invalid payment reference");
    }

    const paymentInfo = this.getPendingPayment(reference);

    try {
      const signatureInfo = await findReference(this.connection, refKey, {
        finality: "confirmed",
      });

      const report = await verifyMerchantPayment(
        this.connection,
        signatureInfo.signature,
        expectedSenderWallet,
        expectedMerchantWallet,
        minSpendLamports,
        reference,
      );

      return {
        verified: report.confirmed,
        signature: signatureInfo.signature,
        senderVerified: report.senderVerified,
        recipientVerified: report.recipientVerified,
        amountVerified: report.amountVerified,
        referenceVerified: report.referenceVerified,
        senderWallet: report.actualSender,
        recipientWallet: report.actualRecipient,
        amountLamports: report.actualAmountLamports,
        tokenMint: report.tokenMint,
        paymentInfo,
      };
    } catch {
      return {
        verified: false,
        signature: null,
        senderVerified: false,
        recipientVerified: false,
        amountVerified: false,
        referenceVerified: false,
        senderWallet: null,
        recipientWallet: null,
        amountLamports: 0,
        tokenMint: null,
        paymentInfo,
      };
    }
  }

  async getPaymentStatus(reference: string) {
    const result = await this.verifyTransaction(reference);

    return {
      found: result.verified,
      signature: result.signature,
    };
  }

  async recordTransaction(input: RecordTransactionInput) {
    const payload = {
      merchantId: input.merchantId,
      userWallet: input.userWallet,
      questId: input.questId ?? null,
      claimId: input.claimId ?? null,
      reference: input.reference ?? null,
      amount: input.amount,
      token: input.token ?? "SOL",
      txSignature: input.txSignature,
      isVerified: input.isVerified ?? true,
      recipientWallet: input.recipientWallet ?? null,
      amountLamports: input.amountLamports ?? null,
      tokenMint: input.tokenMint ?? null,
      recipientVerified: input.recipientVerified ?? false,
      rewardTx: input.rewardTx ?? null,
      rewardAmountBaseUnits: input.rewardAmountBaseUnits ?? null,
      rewardMultiplier: input.rewardMultiplier ?? null,
      rewardToken: input.rewardToken ?? null,
      rewardReasons:
        input.rewardReasons === undefined ? undefined : input.rewardReasons ?? Prisma.JsonNull,
      fraudScore: input.fraudScore ?? null,
      worldVerified: input.worldVerified ?? null,
      decision: input.decision ?? null,
      aiSummary: input.aiSummary ?? null,
      xpEarned: input.xpEarned ?? null,
      newLevel: input.newLevel ?? null,
      nftMint: input.nftMint ?? null,
      nftTxSignature: input.nftTxSignature ?? null,
      completedAt: input.completedAt ?? null,
    };

    const update = payload as Prisma.TransactionUncheckedUpdateInput;
    const create = payload as Prisma.TransactionUncheckedCreateInput;

    if (input.reference) {
      return prisma.transaction.upsert({
        where: { reference: input.reference },
        update,
        create,
      });
    }

    return prisma.transaction.upsert({
      where: { txSignature: input.txSignature },
      update,
      create,
    });
  }

  async incrementMerchantVisit(merchantId: string) {
    await prisma.merchant.update({
      where: { id: merchantId },
      data: {
        totalVisits: { increment: 1 },
      },
    });
  }

  private parseMerchantWallet(rawWallet: string, merchantId: string) {
    try {
      return new PublicKey(rawWallet);
    } catch {
      throw new HttpError(
        422,
        `Merchant ${merchantId} has an invalid Solana wallet address: "${rawWallet}"`,
      );
    }
  }
}
