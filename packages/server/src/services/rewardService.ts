import { AgentCouncil } from "@depokemongo/ai";
import { formatPiko, xpToLevel } from "@depokemongo/common";
import { Prisma, Quest, User } from "@prisma/client";
import { prisma } from "../config/db";
import { syncUserLeaderboard } from "../config/leaderboard";
import { env } from "../config/env";
import { HttpError } from "../config/http";
import {
  findMintedPikoRewardTx,
  mintPiko,
  RewardMintAnchor,
} from "../lib/pikoMinter";
import { addRewardToTotals } from "../lib/rewardLedger";
import { baseUnitsToNumber, multiplyTokenAmountToBaseUnits } from "../lib/tokenMath";

export type SettlementContext = {
  claimId: string;
  transactionId: string;
  reference: string;
  quest: Quest;
  wallet: string;
  merchantId: string;
  txSignature: string;
  lat?: number;
  lng?: number;
  gpsAccuracy?: number;
};

export type SettlementResult = {
  approved: boolean;
  worldVerified: boolean;
  decision: "APPROVED" | "REJECTED";
  fraudScore: number;
  fraudFlags: string[];
  rewardMultiplier: number;
  rewardAmountBaseUnits: string;
  rewardAmountDisplay: string;
  rewardAmount: number;
  rewardToken: string;
  rewardTx: string | null;
  rewardReasons: string[];
  aiSummary: string;
  xpEarned: number;
  newLevel: number;
  economicState: EconomicState;
};

type PreparedSettlement = Omit<SettlementResult, "rewardTx"> & {
  rewardAmountBaseUnitsBigInt: bigint;
};

export type EconomicState = {
  vaultBalance: number;
  budgetGuardActive: boolean;
  effectiveMultiplierRange: string;
};

type StoredSettlementIntent = {
  decision: string | null;
  worldVerified: boolean | null;
  fraudScore: number | null;
  rewardMultiplier: number | null;
  rewardToken: string | null;
  rewardAmountBaseUnits: bigint | null;
  rewardReasons: Prisma.JsonValue | null;
  aiSummary: string | null;
  xpEarned: number | null;
  newLevel: number | null;
  rewardTx: string | null;
};

type RewardServiceDeps = {
  agentCouncil?: Pick<AgentCouncil, "reviewClaim">;
  db?: typeof prisma;
  mintPikoFn?: typeof mintPiko;
  findMintedPikoRewardTxFn?: typeof findMintedPikoRewardTx;
  syncUserLeaderboardFn?: typeof syncUserLeaderboard;
};

export class RewardService {
  private readonly agentCouncil: Pick<AgentCouncil, "reviewClaim">;
  private readonly db: typeof prisma;
  private readonly mintPikoFn: typeof mintPiko;
  private readonly findMintedPikoRewardTxFn: typeof findMintedPikoRewardTx;
  private readonly syncUserLeaderboardFn: typeof syncUserLeaderboard;

  constructor(deps: RewardServiceDeps = {}) {
    this.agentCouncil = deps.agentCouncil ?? new AgentCouncil();
    this.db = deps.db ?? prisma;
    this.mintPikoFn = deps.mintPikoFn ?? mintPiko;
    this.findMintedPikoRewardTxFn = deps.findMintedPikoRewardTxFn ?? findMintedPikoRewardTx;
    this.syncUserLeaderboardFn = deps.syncUserLeaderboardFn ?? syncUserLeaderboard;
  }

  async settleReward(context: SettlementContext): Promise<SettlementResult> {
    const { claimId, transactionId, reference, quest, wallet, merchantId, txSignature, lat, lng, gpsAccuracy } =
      context;

    void txSignature;

    const [user, recentClaims, walletClaimsToday, merchantQuestCount] = await Promise.all([
      this.db.user.findUnique({ where: { wallet } }),
      this.db.questClaim.count({
        where: {
          userWallet: wallet,
          claimedAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
        },
      }),
      this.db.questClaim.count({
        where: {
          userWallet: wallet,
          quest: { merchantId },
          claimedAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.db.quest.count({
        where: {
          merchantId,
          isActive: true,
        },
      }),
    ]);

    const preparedSettlement = await this.loadOrCreateSettlementIntent({
      transactionId,
      quest,
      wallet,
      merchantId,
      user,
      recentClaims,
      walletClaimsToday,
      merchantQuestCount,
      lat,
      lng,
      gpsAccuracy,
    });

    if (!preparedSettlement.approved) {
      return {
        approved: false,
        worldVerified: preparedSettlement.worldVerified,
        decision: "REJECTED",
        fraudScore: preparedSettlement.fraudScore,
        fraudFlags: preparedSettlement.fraudFlags,
        rewardMultiplier: preparedSettlement.rewardMultiplier,
        rewardAmountBaseUnits: preparedSettlement.rewardAmountBaseUnits,
        rewardAmountDisplay: preparedSettlement.rewardAmountDisplay,
        rewardAmount: preparedSettlement.rewardAmount,
        rewardToken: preparedSettlement.rewardToken,
        rewardTx: null,
        rewardReasons: preparedSettlement.rewardReasons,
        aiSummary: preparedSettlement.aiSummary,
        xpEarned: preparedSettlement.xpEarned,
        newLevel: preparedSettlement.newLevel,
        economicState: preparedSettlement.economicState,
      };
    }

    const rewardAnchor: RewardMintAnchor = { claimId, reference };
    const existingRewardTx = await this.resolveExistingRewardTx({
      claimId,
      transactionId,
      wallet,
      quest,
      rewardAmountBaseUnits: preparedSettlement.rewardAmountBaseUnitsBigInt,
      rewardAnchor,
    });

    if (existingRewardTx) {
      const updatedUser = await this.recordReward({
        claimId,
        wallet,
        rewardAmountBaseUnits: preparedSettlement.rewardAmountBaseUnitsBigInt,
        rewardTx: existingRewardTx,
        xpReward: preparedSettlement.xpEarned,
      });

      return {
        approved: true,
        worldVerified: preparedSettlement.worldVerified,
        decision: "APPROVED",
        fraudScore: preparedSettlement.fraudScore,
        fraudFlags: preparedSettlement.fraudFlags,
        rewardMultiplier: preparedSettlement.rewardMultiplier,
        rewardAmountBaseUnits: preparedSettlement.rewardAmountBaseUnits,
        rewardAmountDisplay: preparedSettlement.rewardAmountDisplay,
        rewardAmount: preparedSettlement.rewardAmount,
        rewardToken: preparedSettlement.rewardToken,
        rewardTx: existingRewardTx,
        rewardReasons: preparedSettlement.rewardReasons,
        aiSummary: preparedSettlement.aiSummary,
        xpEarned: preparedSettlement.xpEarned,
        newLevel: updatedUser.level,
        economicState: preparedSettlement.economicState,
      };
    }

    const reservedQuestSlot = await this.db.quest.updateMany({
      where: {
        id: quest.id,
        claimedCount: { lt: quest.maxClaims },
      },
      data: {
        claimedCount: { increment: 1 },
      },
    });

    if (reservedQuestSlot.count !== 1) {
      throw new HttpError(409, "Quest has reached its maximum claims");
    }

    try {
      await this.assertRewardPolicy(wallet, preparedSettlement.rewardAmountBaseUnitsBigInt);

      const rewardTx = await this.handleReward(
        wallet,
        quest,
        preparedSettlement.rewardAmountBaseUnitsBigInt,
        rewardAnchor,
      );

      await this.storeRewardTx(transactionId, claimId, rewardTx);

      const updatedUser = await this.recordReward({
        claimId,
        wallet,
        rewardAmountBaseUnits: preparedSettlement.rewardAmountBaseUnitsBigInt,
        rewardTx,
        xpReward: preparedSettlement.xpEarned,
      });

      return {
        approved: true,
        worldVerified: preparedSettlement.worldVerified,
        decision: "APPROVED",
        fraudScore: preparedSettlement.fraudScore,
        fraudFlags: preparedSettlement.fraudFlags,
        rewardMultiplier: preparedSettlement.rewardMultiplier,
        rewardAmountBaseUnits: preparedSettlement.rewardAmountBaseUnits,
        rewardAmountDisplay: preparedSettlement.rewardAmountDisplay,
        rewardAmount: preparedSettlement.rewardAmount,
        rewardToken: preparedSettlement.rewardToken,
        rewardTx,
        rewardReasons: preparedSettlement.rewardReasons,
        aiSummary: preparedSettlement.aiSummary,
        xpEarned: preparedSettlement.xpEarned,
        newLevel: updatedUser.level,
        economicState: preparedSettlement.economicState,
      };
    } catch (error) {
      await this.db.quest.update({
        where: { id: quest.id },
        data: {
          claimedCount: { decrement: 1 },
        },
      });
      throw error;
    }
  }

  private async loadOrCreateSettlementIntent(input: {
    transactionId: string;
    quest: Quest;
    wallet: string;
    merchantId: string;
    user: User | null;
    recentClaims: number;
    walletClaimsToday: number;
    merchantQuestCount: number;
    lat?: number;
    lng?: number;
    gpsAccuracy?: number;
  }): Promise<PreparedSettlement> {
    const storedIntent = await this.db.transaction.findUnique({
      where: { id: input.transactionId },
      select: {
        decision: true,
        worldVerified: true,
        fraudScore: true,
        rewardMultiplier: true,
        rewardToken: true,
        rewardAmountBaseUnits: true,
        rewardReasons: true,
        aiSummary: true,
        xpEarned: true,
        newLevel: true,
        rewardTx: true,
      },
    });

    const recoveredIntent = storedIntent ? this.restoreSettlementIntent(storedIntent) : null;
    if (recoveredIntent) {
      return recoveredIntent;
    }

    const worldVerified = Boolean((input.user as { worldVerified?: boolean } | null)?.worldVerified);
    const merchantBalance = 100;

    // Provide prior rewarded-claim coordinates so the fraud layer can detect impossible travel.
    const lastClaim = await this.db.questClaim.findFirst({
      where: { userWallet: input.wallet, status: "REWARDED" },
      orderBy: { claimedAt: "desc" },
      include: { quest: { include: { merchant: true } } },
    });

    const prevLat = lastClaim?.quest.merchant.lat ?? undefined;
    const prevLng = lastClaim?.quest.merchant.lng ?? undefined;
    const timeDelta = lastClaim
      ? (Date.now() - lastClaim.claimedAt.getTime()) / 1000
      : undefined;

    const review = await this.agentCouncil.reviewClaim({
      wallet: input.wallet,
      lat: input.lat ?? 0,
      lng: input.lng ?? 0,
      prevLat,
      prevLng,
      timeDelta,
      gpsAccuracy: input.gpsAccuracy,
      recentClaims: input.recentClaims,
      walletClaimsToday: input.walletClaimsToday,
      merchantId: input.merchantId,
      accountAge: this.getAccountAgeDays(input.user),
      currentTraffic: input.merchantQuestCount,
      avgTraffic: Math.max(input.merchantQuestCount, 1),
      timeOfDay: this.getHourBucket(),
      dayOfWeek: this.getDayBucket(),
      userLevel: input.user?.level ?? 1,
      merchantBalance,
      worldVerified,
    } as never);

    const rewardMultiplier = review.reward.decision.multiplier;
    const rewardToken = (input.quest.rewardToken ?? "PIKO").toUpperCase();
    const rewardAmountBaseUnitsBigInt = multiplyTokenAmountToBaseUnits(
      input.quest.rewardAmount,
      rewardMultiplier,
      env.PIKO_DECIMALS,
    );
    const rewardAmountDisplay = formatPiko(rewardAmountBaseUnitsBigInt, env.PIKO_DECIMALS);
    const rewardAmount = baseUnitsToNumber(rewardAmountBaseUnitsBigInt, env.PIKO_DECIMALS);
    const aiSummary = this.buildAiSummary(review.reward.reasoning, review.fraud.reasoning);
    const economicState = buildEconomicState(merchantBalance);
    const preparedSettlement: PreparedSettlement = {
      approved: review.approved,
      worldVerified,
      decision: review.approved ? "APPROVED" : "REJECTED",
      fraudScore: review.fraud.decision.score,
      fraudFlags: review.fraud.decision.flags,
      rewardMultiplier,
      rewardAmountBaseUnits: rewardAmountBaseUnitsBigInt.toString(),
      rewardAmountBaseUnitsBigInt,
      rewardAmountDisplay,
      rewardAmount,
      rewardToken,
      rewardReasons: review.reward.decision.reasons,
      aiSummary,
      xpEarned: review.approved ? input.quest.xpReward : 0,
      newLevel: review.approved
        ? xpToLevel((input.user?.xp ?? 0) + input.quest.xpReward)
        : input.user?.level ?? 1,
      economicState,
    };

    await this.db.transaction.update({
      where: { id: input.transactionId },
      data: {
        rewardAmountBaseUnits: rewardAmountBaseUnitsBigInt,
        rewardMultiplier: preparedSettlement.rewardMultiplier,
        rewardToken: preparedSettlement.rewardToken,
        rewardReasons: preparedSettlement.rewardReasons,
        fraudScore: preparedSettlement.fraudScore,
        worldVerified: preparedSettlement.worldVerified,
        decision: preparedSettlement.decision,
        aiSummary: preparedSettlement.aiSummary,
        xpEarned: preparedSettlement.xpEarned,
        newLevel: preparedSettlement.newLevel,
      },
    });

    return preparedSettlement;
  }

  private restoreSettlementIntent(storedIntent: StoredSettlementIntent): PreparedSettlement | null {
    if (
      storedIntent.decision !== "APPROVED" &&
      storedIntent.decision !== "REJECTED"
    ) {
      return null;
    }

    if (
      storedIntent.worldVerified == null ||
      storedIntent.fraudScore == null ||
      storedIntent.rewardMultiplier == null ||
      storedIntent.rewardToken == null ||
      storedIntent.rewardAmountBaseUnits == null ||
      storedIntent.aiSummary == null ||
      storedIntent.xpEarned == null ||
      storedIntent.newLevel == null
    ) {
      return null;
    }

    return {
      approved: storedIntent.decision === "APPROVED",
      worldVerified: storedIntent.worldVerified,
      decision: storedIntent.decision,
      fraudScore: storedIntent.fraudScore,
      fraudFlags: [],
      rewardMultiplier: storedIntent.rewardMultiplier,
      rewardAmountBaseUnits: storedIntent.rewardAmountBaseUnits.toString(),
      rewardAmountBaseUnitsBigInt: storedIntent.rewardAmountBaseUnits,
      rewardAmountDisplay: formatPiko(storedIntent.rewardAmountBaseUnits, env.PIKO_DECIMALS),
      rewardAmount: baseUnitsToNumber(storedIntent.rewardAmountBaseUnits, env.PIKO_DECIMALS),
      rewardToken: storedIntent.rewardToken,
      rewardReasons: normalizeReasonList(storedIntent.rewardReasons),
      aiSummary: storedIntent.aiSummary,
      xpEarned: storedIntent.xpEarned,
      newLevel: storedIntent.newLevel,
      economicState: buildEconomicState(100),
    };
  }

  private async recordReward(input: {
    claimId: string;
    wallet: string;
    rewardAmountBaseUnits: bigint;
    rewardTx: string | null;
    xpReward: number;
  }) {
    const updatedUser = await this.db.$transaction(async (tx) => {
      const existingLedger = await tx.rewardLedger.findUnique({
        where: { claimId: input.claimId },
        select: { id: true },
      });

      if (existingLedger) {
        const currentUser = await tx.user.findUnique({
          where: { wallet: input.wallet },
        });

        if (!currentUser) {
          throw new Error(`Reward ledger exists for claim ${input.claimId}, but user ${input.wallet} is missing`);
        }

        return currentUser;
      }

      const existingUser = await tx.user.findUnique({
        where: { wallet: input.wallet },
        select: {
          wallet: true,
          xp: true,
          totalRewards: true,
          totalRewardsBaseUnits: true,
        },
      });

      const totals = addRewardToTotals(existingUser ?? {}, input.rewardAmountBaseUnits, env.PIKO_DECIMALS);
      const nextXp = (existingUser?.xp ?? 0) + input.xpReward;
      const nextLevel = xpToLevel(nextXp);

      const user =
        existingUser == null
          ? await tx.user.create({
              data: {
                wallet: input.wallet,
                totalRewards: totals.totalRewards,
                totalRewardsBaseUnits: totals.totalRewardsBaseUnits,
                questsCompleted: 1,
                xp: nextXp,
                level: nextLevel,
              },
            })
          : await tx.user.update({
              where: { wallet: input.wallet },
              data: {
                totalRewards: totals.totalRewards,
                totalRewardsBaseUnits: totals.totalRewardsBaseUnits,
                questsCompleted: { increment: 1 },
                xp: nextXp,
                level: nextLevel,
                lastActiveAt: new Date(),
              },
            });

      await tx.rewardLedger.create({
        data: {
          claimId: input.claimId,
          wallet: input.wallet,
          amountBaseUnits: input.rewardAmountBaseUnits,
          txSignature: input.rewardTx,
        },
      });

      return user;
    });

    await this.syncUserLeaderboardFn(input.wallet);
    return updatedUser;
  }

  private async resolveExistingRewardTx(input: {
    claimId: string;
    transactionId: string;
    wallet: string;
    quest: Quest;
    rewardAmountBaseUnits: bigint;
    rewardAnchor: RewardMintAnchor;
  }): Promise<string | null> {
    const [claim, transaction] = await Promise.all([
      this.db.questClaim.findUnique({
        where: { id: input.claimId },
        select: { rewardTx: true },
      }),
      this.db.transaction.findUnique({
        where: { id: input.transactionId },
        select: { rewardTx: true },
      }),
    ]);

    const storedRewardTx = claim?.rewardTx ?? transaction?.rewardTx ?? null;
    if (storedRewardTx) {
      await this.storeRewardTx(input.transactionId, input.claimId, storedRewardTx);
      return storedRewardTx;
    }

    const token = (input.quest.rewardToken ?? "PIKO").toUpperCase();
    if (token !== "PIKO") {
      return null;
    }

    const recoveredRewardTx = await this.findMintedPikoRewardTxFn(
      input.wallet,
      input.rewardAmountBaseUnits,
      input.rewardAnchor,
    );

    if (!recoveredRewardTx) {
      return null;
    }

    await this.storeRewardTx(input.transactionId, input.claimId, recoveredRewardTx);
    return recoveredRewardTx;
  }

  private async storeRewardTx(transactionId: string, claimId: string, rewardTx: string | null) {
    await Promise.all([
      this.db.questClaim.update({
        where: { id: claimId },
        data: { rewardTx },
      }),
      this.db.transaction.update({
        where: { id: transactionId },
        data: { rewardTx },
      }),
    ]);
  }

  private async assertRewardPolicy(wallet: string, rewardAmountBaseUnits: bigint) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [dailyRewards, latestReward] = await Promise.all([
      this.db.rewardLedger.aggregate({
        where: {
          wallet,
          createdAt: { gte: startOfDay },
        },
        _sum: {
          amountBaseUnits: true,
        },
      }),
      this.db.rewardLedger.findFirst({
        where: { wallet },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    const dailyTotal = dailyRewards._sum.amountBaseUnits ?? 0n;
    const dailyCap = BigInt(env.PIKO_DAILY_WALLET_CAP_BASE_UNITS);
    if (dailyTotal + rewardAmountBaseUnits > dailyCap) {
      throw new HttpError(
        429,
        `Daily reward cap exceeded. Per-wallet cap is ${formatPiko(dailyCap, env.PIKO_DECIMALS)} PIKO (rate limiting, not identity).`,
      );
    }

    if (env.REWARD_COOLDOWN_SECONDS <= 0 || latestReward == null) {
      return;
    }

    const cooldownMs = env.REWARD_COOLDOWN_SECONDS * 1000;
    const elapsedMs = now.getTime() - latestReward.createdAt.getTime();
    if (elapsedMs < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      throw new HttpError(429, `Reward cooldown active. Try again in ${remainingSeconds}s.`);
    }
  }

  private async handleReward(
    wallet: string,
    quest: Quest,
    rewardAmountBaseUnits: bigint,
    rewardAnchor: RewardMintAnchor,
  ): Promise<string | null> {
    const token = (quest.rewardToken ?? "PIKO").toUpperCase();

    switch (token) {
      case "PIKO":
        return this.mintPikoFn(wallet, rewardAmountBaseUnits, rewardAnchor);
      case "NFT":
        return null;
      default:
        throw new Error(`Unsupported reward token: ${token}`);
    }
  }

  private getHourBucket(date = new Date()) {
    return date.getHours();
  }

  private getDayBucket(date = new Date()) {
    return date.getDay();
  }

  private getAccountAgeDays(user: User | null) {
    if (!user) {
      return 0;
    }

    return Math.max(
      0,
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  private buildAiSummary(rewardReasoning: string, fraudReasoning: string) {
    return `Reward AI: ${rewardReasoning}. Fraud AI: ${fraudReasoning}.`;
  }
}

function normalizeReasonList(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function buildEconomicState(merchantBalance: number): EconomicState {
  return {
    vaultBalance: merchantBalance,
    budgetGuardActive: merchantBalance < 25,
    effectiveMultiplierRange:
      merchantBalance < 10 ? "0.1× – 0.75×" : merchantBalance < 25 ? "0.1× – 1.2×" : "0.1× – 3.0×",
  };
}
