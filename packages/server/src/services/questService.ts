import { formatPiko, haversineDistance, MIN_GPS_ACCURACY_METERS } from "@depokemongo/common";
import { QuestType } from "@depokemongo/common";
import { ClaimStatus, Prisma, Transaction } from "@prisma/client";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { HttpError } from "../config/http";
import { PaymentService } from "./paymentService";
import { buildEconomicState, RewardService, SettlementResult } from "./rewardService";
import { mintRewardNFT, ProofNftMetadata } from "./nftService";

export type CompleteQuestInput = {
  userWallet: string;
  questId: string;
  reference: string;
  paymentSignature?: string;
  lat?: number;
  lng?: number;
  gpsAccuracy?: number;
};

export type QuestCompletionResult = {
  verified: boolean;
  txSignature: string | null;
  approved: boolean;
  worldVerified: boolean;
  worldIdVerified: boolean;
  decision: "APPROVED" | "REJECTED";
  rewardToken: string;
  rewardAmountBaseUnits: string;
  rewardAmountDisplay: string;
  rewardAmount: number;
  rewardMultiplier: number;
  aiSummary: string;
  fraudScore: number;
  fraudFlags: string[];
  distanceMeters: number;
  gpsAccuracy: number;
  economicState: SettlementResult["economicState"];
  xpEarned: number;
  newLevel: number;
  transactionId: string;
  nftMint?: string | null;
  nftMetadata?: ProofNftMetadata;
};

type CreateQuestPayload = {
  merchantId: string;
  title: string;
  description: string;
  rewardAmount: number;
  rewardToken?: string;
  xpReward?: number;
  minSpend?: number;
  maxClaims?: number;
  questType: QuestType;
  expiresAt: Date;
  conditions?: Record<string, unknown>;
};

type QuestServiceDeps = {
  db?: typeof prisma;
  mintRewardNftFn?: typeof mintRewardNFT;
};

type CompletionSnapshot = Pick<
  Transaction,
  | "id"
  | "txSignature"
  | "decision"
  | "worldVerified"
  | "rewardToken"
  | "rewardAmountBaseUnits"
  | "rewardMultiplier"
  | "aiSummary"
  | "fraudScore"
  | "xpEarned"
  | "newLevel"
  | "nftMint"
>;

const STALE_VERIFIED_LOCK_WINDOW_MS = 10 * 60 * 1000;

export class QuestService {
  private readonly db: typeof prisma;
  private readonly mintRewardNftFn: typeof mintRewardNFT;

  constructor(
    private readonly paymentService: PaymentService,
    private readonly rewardService: RewardService,
    deps: QuestServiceDeps = {},
  ) {
    this.db = deps.db ?? prisma;
    this.mintRewardNftFn = deps.mintRewardNftFn ?? mintRewardNFT;
  }

  async completeQuest(input: CompleteQuestInput): Promise<QuestCompletionResult> {
    const quest = await this.db.quest.findUnique({
      where: { id: input.questId },
      include: { merchant: true },
    });

    if (!quest) {
      throw new HttpError(404, "Quest not found");
    }

    const claim = await this.db.questClaim.findUnique({
      where: {
        questId_userWallet: {
          questId: input.questId,
          userWallet: input.userWallet,
        },
      },
    });

    if (!claim) {
      throw new HttpError(400, "Create a pending incentive claim before completing the settlement");
    }

    const existingTransaction = await this.db.transaction.findUnique({
      where: { reference: input.reference },
    });

    if (existingTransaction?.questId && existingTransaction.questId !== input.questId) {
      throw new HttpError(409, "Payment reference is already bound to another quest");
    }

    if (existingTransaction?.userWallet && existingTransaction.userWallet !== input.userWallet) {
      throw new HttpError(409, "Payment reference is already bound to another wallet");
    }

    if (existingTransaction?.claimId && existingTransaction.claimId !== claim.id) {
      throw new HttpError(409, "Payment reference is already bound to another claim");
    }

    if (existingTransaction?.completedAt) {
      return this.buildCompletionResultFromTransaction(existingTransaction, quest, input);
    }

    const verification = await this.paymentService.verifyTransactionFull(
      input.reference,
      input.userWallet,
      quest.onChainWallet ?? quest.merchant.wallet,
      Math.round(quest.minSpend * LAMPORTS_PER_SOL),
    );

    if (!verification.verified || !verification.signature) {
      throw new HttpError(400, "Transaction not found for reference");
    }

    if (input.paymentSignature && input.paymentSignature !== verification.signature) {
      throw new HttpError(409, "Provided payment signature does not match the verified reference");
    }

    if (!verification.recipientVerified) {
      throw new HttpError(
        409,
        `Payment did not go to merchant wallet ${quest.onChainWallet ?? quest.merchant.wallet}`,
      );
    }

    if (!verification.senderVerified) {
      throw new HttpError(409, `Payment sender does not match claimant wallet ${input.userWallet}`);
    }

    if (!verification.referenceVerified) {
      throw new HttpError(409, `Payment transaction does not include reference ${input.reference}`);
    }

    const minSpendLamports = Math.round(quest.minSpend * LAMPORTS_PER_SOL);
    if (!verification.amountVerified) {
      throw new HttpError(
        400,
        `Payment amount too low: got ${verification.amountLamports} lamports, need ${minSpendLamports}`,
      );
    }

    this.validateQuestEligibility(quest, input.lat, input.lng, input.gpsAccuracy);

    if (verification.paymentInfo?.questId && verification.paymentInfo.questId !== input.questId) {
      throw new HttpError(409, "Payment reference does not match quest");
    }

    if (verification.paymentInfo?.wallet && verification.paymentInfo.wallet !== input.userWallet) {
      throw new HttpError(409, "Payment reference does not match wallet");
    }

    const claimBoundToOtherReference = await this.db.transaction.findFirst({
      where: {
        claimId: claim.id,
        reference: {
          not: input.reference,
        },
      },
      select: { id: true },
    });

    if (claimBoundToOtherReference) {
      throw new HttpError(409, "Quest claim is already bound to another payment reference");
    }

    const transaction = await this.paymentService.recordTransaction({
      merchantId: quest.merchantId,
      userWallet: input.userWallet,
      questId: input.questId,
      claimId: claim.id,
      reference: input.reference,
      amount:
        verification.amountLamports > 0
          ? Number((verification.amountLamports / LAMPORTS_PER_SOL).toFixed(9))
          : verification.paymentInfo?.amount ?? Math.max(quest.minSpend, quest.rewardAmount),
      token: verification.tokenMint ? "SPL" : "SOL",
      txSignature: verification.signature,
      isVerified: true,
      recipientWallet: verification.recipientWallet,
      amountLamports: BigInt(verification.amountLamports),
      tokenMint: verification.tokenMint,
      recipientVerified: verification.recipientVerified,
    });

    if (transaction.completedAt) {
      return this.buildCompletionResultFromTransaction(transaction, quest, input);
    }

    const claimReservation = await this.db.questClaim.updateMany({
      where: {
        id: claim.id,
        OR: [
          { status: ClaimStatus.PENDING },
          { status: ClaimStatus.FAILED },
          {
            status: ClaimStatus.VERIFIED,
            verifiedAt: { lt: new Date(Date.now() - STALE_VERIFIED_LOCK_WINDOW_MS) },
          },
        ],
      },
      data: {
        status: ClaimStatus.VERIFIED,
        txSignature: verification.signature,
        verifiedAt: new Date(),
      },
    });

    if (claimReservation.count !== 1) {
      const latestTransaction = await this.db.transaction.findUnique({
        where: { reference: input.reference },
      });

      if (latestTransaction?.completedAt) {
        return this.buildCompletionResultFromTransaction(latestTransaction, quest, input);
      }

      const freshClaim = await this.db.questClaim.findUnique({
        where: { id: claim.id },
      });

      if (freshClaim?.status === ClaimStatus.REJECTED || freshClaim?.status === ClaimStatus.EXPIRED) {
        throw new HttpError(409, `Quest claim is ${freshClaim.status.toLowerCase()}`);
      }

      if (freshClaim?.status === ClaimStatus.FAILED) {
        throw new HttpError(409, "Previous settlement attempt failed. Retry with the same reference.");
      }

      throw new HttpError(409, "Quest completion is already being processed");
    }

    let settlement: SettlementResult;
    const distanceMeters = haversineDistance(input.lat ?? 0, input.lng ?? 0, quest.merchant.lat, quest.merchant.lng);
    try {
      settlement = await this.rewardService.settleReward({
        claimId: claim.id,
        transactionId: transaction.id,
        reference: input.reference,
        quest,
        wallet: input.userWallet,
        merchantId: quest.merchantId,
        txSignature: verification.signature,
        lat: input.lat,
        lng: input.lng,
        gpsAccuracy: input.gpsAccuracy,
      });
    } catch (error) {
      await this.db.questClaim.update({
        where: { id: claim.id },
        data: {
          status: ClaimStatus.FAILED,
        },
      });
      throw error;
    }

    let nftMint: string | null = null;
    let nftTxSignature: string | null = null;
    let nftMetadata: ProofNftMetadata | undefined;

    if (settlement.approved && env.NFT_REWARDS_ENABLED) {
      try {
        const nftResult = await this.mintRewardNftFn(
          input.userWallet,
          quest.title,
          quest.merchant.name,
          settlement.fraudScore,
          settlement.rewardMultiplier,
          settlement.worldVerified,
        );
        nftMint = nftResult.nftMint;
        nftTxSignature = nftResult.txSignature;
        nftMetadata = nftResult.metadata;

        const user = await this.db.user.findUnique({
          where: { wallet: input.userWallet },
        });

        if (user) {
          await this.db.badge.create({
            data: {
              userId: user.id,
              name: nftResult.name,
              description: `Quest: ${quest.title}`,
              imageUrl: quest.merchant.imageUrl || "",
              nftMint,
            },
          });
        }
      } catch (nftError) {
        console.error("Failed to mint NFT reward:", nftError);
      }
    }

    const completedAt = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.questClaim.update({
        where: { id: claim.id },
        data: {
          status: settlement.approved ? ClaimStatus.REWARDED : ClaimStatus.REJECTED,
          rewardTx: settlement.rewardTx,
          txSignature: verification.signature,
          verifiedAt: new Date(),
        },
      });

      if (settlement.approved) {
        await tx.merchant.update({
          where: { id: quest.merchantId },
          data: {
            totalVisits: { increment: 1 },
          },
        });
      }

      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          rewardTx: settlement.rewardTx,
          rewardAmountBaseUnits: BigInt(settlement.rewardAmountBaseUnits),
          rewardMultiplier: settlement.rewardMultiplier,
          rewardToken: settlement.rewardToken,
          rewardReasons: settlement.rewardReasons,
          fraudScore: settlement.fraudScore,
          worldVerified: settlement.worldVerified,
          decision: settlement.decision,
          aiSummary: settlement.aiSummary,
          xpEarned: settlement.xpEarned,
          newLevel: settlement.newLevel,
          nftMint,
          nftTxSignature,
          completedAt,
        },
      });
    });

    this.paymentService.clearPendingPayment(input.reference);

    return {
      verified: true,
      txSignature: verification.signature,
      approved: settlement.approved,
      worldVerified: settlement.worldVerified,
      worldIdVerified: settlement.worldVerified,
      decision: settlement.decision,
      rewardToken: settlement.rewardToken,
      rewardAmountBaseUnits: settlement.rewardAmountBaseUnits,
      rewardAmountDisplay: settlement.rewardAmountDisplay,
      rewardAmount: settlement.rewardAmount,
      rewardMultiplier: settlement.rewardMultiplier,
      aiSummary: settlement.aiSummary,
      fraudScore: settlement.fraudScore,
      fraudFlags: settlement.fraudFlags,
      distanceMeters,
      gpsAccuracy: input.gpsAccuracy ?? 0,
      economicState: settlement.economicState,
      xpEarned: settlement.xpEarned,
      newLevel: settlement.newLevel,
      transactionId: transaction.id,
      nftMint,
      nftMetadata,
    };
  }

  async getNearbyQuests(lat: number, lng: number, radius = 5000) {
    const quests = await this.db.quest.findMany({
      where: {
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      include: { merchant: true },
    });

    return quests
      .filter((quest) => quest.claimedCount < quest.maxClaims)
      .map((quest) => ({
        ...quest,
        distance: haversineDistance(lat, lng, quest.merchant.lat, quest.merchant.lng),
      }))
      .filter((quest) => quest.distance <= radius)
      .sort((left, right) => left.distance - right.distance);
  }

  async getQuestById(id: string, wallet?: string) {
    const quest = await this.db.quest.findUnique({
      where: { id },
      include: { merchant: true, claims: true },
    });

    if (!quest) {
      throw new HttpError(404, "Quest not found");
    }

    const claimStatus = wallet
      ? quest.claims.find((claim) => claim.userWallet === wallet)?.status ?? null
      : null;

    return { quest, claimStatus };
  }

  async createQuest(payload: CreateQuestPayload) {
    const merchant = await this.db.merchant.findUnique({
      where: { id: payload.merchantId },
    });

    if (!merchant || !merchant.isActive) {
      throw new HttpError(404, "Merchant not found or inactive");
    }

    if (payload.expiresAt <= new Date()) {
      throw new HttpError(400, "Quest expiry must be in the future");
    }

    return this.db.quest.create({
      data: {
        merchantId: payload.merchantId,
        title: payload.title,
        description: payload.description,
        rewardAmount: payload.rewardAmount,
        rewardToken: payload.rewardToken ?? "PIKO",
        xpReward: payload.xpReward ?? 10,
        minSpend: payload.minSpend ?? 0,
        maxClaims: payload.maxClaims ?? 100,
        questType: payload.questType,
        expiresAt: payload.expiresAt,
        conditions: payload.conditions as Prisma.InputJsonValue | undefined,
        onChainWallet: merchant.wallet,
      },
    });
  }

  async claimQuest(
    questId: string,
    wallet: string,
    lat: number,
    lng: number,
    gpsAccuracy?: number,
  ) {
    const quest = await this.db.quest.findUnique({
      where: { id: questId },
      include: { merchant: true },
    });

    if (!quest) {
      throw new HttpError(404, "Quest not found or inactive");
    }

    this.validateQuestEligibility(quest, lat, lng, gpsAccuracy);

    const user = (await this.db.user.findUnique({
      where: { wallet },
    })) as { worldVerified?: boolean } | null;

    if (!user?.worldVerified) {
      throw new HttpError(403, "World ID verification required");
    }

    const existingClaim = await this.db.questClaim.findUnique({
      where: {
        questId_userWallet: {
          questId,
          userWallet: wallet,
        },
      },
    });

    if (existingClaim) {
      throw new HttpError(409, "Already claimed");
    }

    const cooldownCutoff = new Date(Date.now() - env.REWARD_COOLDOWN_SECONDS * 1000);
    const latestRewardClaim = await this.db.rewardLedger.findFirst({
      where: {
        wallet,
        createdAt: { gt: cooldownCutoff },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (latestRewardClaim) {
      throw new HttpError(429, "Reward cooldown active. Complete the next claim after the cooldown window.");
    }

    const claim = await this.db.questClaim.create({
      data: {
        questId,
        userWallet: wallet,
        status: ClaimStatus.PENDING,
      },
    });

    return {
      claimId: claim.id,
      status: claim.status,
      questType: quest.questType,
      gpsAccuracy: gpsAccuracy ?? null,
    };
  }

  private buildCompletionResultFromTransaction(
    transaction: CompletionSnapshot,
    quest: { merchant: { lat: number; lng: number; name: string } },
    input: Pick<CompleteQuestInput, "lat" | "lng" | "gpsAccuracy">,
  ): QuestCompletionResult {
    if (
      transaction.decision == null ||
      transaction.worldVerified == null ||
      transaction.rewardToken == null ||
      transaction.rewardAmountBaseUnits == null ||
      transaction.rewardMultiplier == null ||
      transaction.aiSummary == null ||
      transaction.fraudScore == null ||
      transaction.xpEarned == null ||
      transaction.newLevel == null
    ) {
      throw new HttpError(409, "Quest completion is already being processed");
    }

    const rewardAmountBaseUnits = transaction.rewardAmountBaseUnits.toString();
    const rewardAmountDisplay = formatPiko(transaction.rewardAmountBaseUnits, env.PIKO_DECIMALS);
    const distanceMeters = haversineDistance(input.lat ?? 0, input.lng ?? 0, quest.merchant.lat, quest.merchant.lng);
    const nftMetadata =
      transaction.nftMint && transaction.decision === "APPROVED"
        ? buildProofNftMetadata({
            merchantName: quest.merchant.name,
            fraudScore: transaction.fraudScore,
            rewardMultiplier: transaction.rewardMultiplier,
            worldVerified: transaction.worldVerified,
          })
        : undefined;

    return {
      verified: true,
      txSignature: transaction.txSignature,
      approved: transaction.decision === "APPROVED",
      worldVerified: transaction.worldVerified,
      worldIdVerified: transaction.worldVerified,
      decision: transaction.decision as "APPROVED" | "REJECTED",
      rewardToken: transaction.rewardToken,
      rewardAmountBaseUnits,
      rewardAmountDisplay,
      rewardAmount: Number(rewardAmountDisplay),
      rewardMultiplier: transaction.rewardMultiplier,
      aiSummary: transaction.aiSummary,
      fraudScore: transaction.fraudScore,
      fraudFlags: [],
      distanceMeters,
      gpsAccuracy: input.gpsAccuracy ?? 0,
      economicState: buildEconomicState(100),
      xpEarned: transaction.xpEarned,
      newLevel: transaction.newLevel,
      transactionId: transaction.id,
      nftMint: transaction.nftMint,
      nftMetadata,
    };
  }

  private validateQuestEligibility(
    quest: {
      isActive: boolean;
      expiresAt: Date;
      claimedCount: number;
      maxClaims: number;
      merchant: { lat: number; lng: number };
    },
    lat?: number,
    lng?: number,
    gpsAccuracy?: number,
  ) {
    if (!quest.isActive || quest.expiresAt <= new Date()) {
      throw new HttpError(404, "Quest not found or inactive");
    }

    if (quest.claimedCount >= quest.maxClaims) {
      throw new HttpError(400, "Quest has reached its maximum claims");
    }

    if (lat == null || lng == null) {
      throw new HttpError(400, "GPS location is required to claim this quest");
    }

    if (gpsAccuracy == null) {
      throw new HttpError(400, "GPS accuracy is required to claim this quest");
    }

    if (gpsAccuracy > MIN_GPS_ACCURACY_METERS) {
      throw new HttpError(
        400,
        `GPS accuracy too low (${Math.round(gpsAccuracy)}m, need <= ${MIN_GPS_ACCURACY_METERS}m)`,
      );
    }

    const distance = haversineDistance(lat, lng, quest.merchant.lat, quest.merchant.lng);
    if (distance > 200) {
      throw new HttpError(
        400,
        `Too far from merchant (${Math.round(distance)}m away, need < 200m)`,
      );
    }
  }
}

function buildProofNftMetadata(input: {
  merchantName: string;
  fraudScore: number;
  rewardMultiplier: number;
  worldVerified: boolean;
}): ProofNftMetadata {
  return {
    fraud_score: String(input.fraudScore),
    payment_verified: "true",
    location_verified: "true",
    reward_multiplier: String(input.rewardMultiplier),
    merchant: input.merchantName,
    visit_date: new Date().toISOString().split("T")[0],
    world_id_verified: String(input.worldVerified),
  };
}
