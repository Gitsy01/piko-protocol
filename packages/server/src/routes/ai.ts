import { Router, Request, Response } from "express";
import { FraudAgent, RewardAgent } from "@depokemongo/ai";
import { prisma } from "../config/db";
import { haversineDistance, formatDistance, formatTokenAmount } from "@depokemongo/common";
import { getErrorMessage, getErrorStatus, parseWithSchema } from "../config/http";
import {
  aiFraudCheckSchema,
  aiGrowthSchema,
  aiSuggestSchema,
} from "../config/validation";
import { env } from "../config/env";
import { baseUnitsToNumber, multiplyTokenAmountToBaseUnits } from "../lib/tokenMath";
import { growthService } from "../services";

export const aiRouter = Router();

const rewardAgent = new RewardAgent();
const fraudAgent = new FraudAgent();

/**
 * POST /api/ai/suggest
 * AI-powered incentive routing for nearby businesses and reward opportunities
 * Body: { wallet?, lat, lng }
 */
aiRouter.post("/suggest", async (req: Request, res: Response) => {
  try {
    const { lat, lng } = parseWithSchema(aiSuggestSchema, req.body);

    const merchants = await prisma.merchant.findMany({
      where: { isActive: true },
      include: {
        quests: {
          where: { isActive: true, expiresAt: { gt: new Date() } },
        },
      },
    });

    const now = new Date();
    const suggestions = (
      await Promise.all(
        merchants
          .filter((merchant) => merchant.quests.length > 0)
          .map(async (merchant) => {
            const distance = haversineDistance(lat, lng, merchant.lat, merchant.lng);
            const bestQuest = merchant.quests.reduce((best, quest) =>
              quest.rewardAmount > best.rewardAmount ? quest : best
            );

            const rewardDecision = await rewardAgent.run({
              merchantId: merchant.id,
              currentTraffic: Math.max(merchant.totalVisits, 1),
              avgTraffic: Math.max(merchant.totalVisits / 2, 1),
              timeOfDay: now.getHours(),
              dayOfWeek: now.getDay(),
              userLevel: 1,
              merchantBalance: 100,
            });

            const adjustedReward = baseUnitsToNumber(
              multiplyTokenAmountToBaseUnits(
                bestQuest.rewardAmount,
                rewardDecision.decision.multiplier,
                env.PIKO_DECIMALS,
              ),
              env.PIKO_DECIMALS,
            );
            const rewardPerMeter = adjustedReward / Math.max(distance, 1);
            const popularityScore = Math.min(merchant.totalVisits / 100, 1);
            const conversionScore = Math.max(merchant.conversionRate || 0.5, 0.1);
            const smartScore =
              rewardPerMeter *
              (1 + popularityScore) *
              conversionScore *
              rewardDecision.decision.multiplier;

            return {
              merchantId: merchant.id,
              merchantName: merchant.name,
              distance,
              rewardAmount: adjustedReward,
              questId: bestQuest.id,
              smartScore,
              reasoning: `Go ${formatDistance(distance)} -> earn ${formatTokenAmount(adjustedReward, bestQuest.rewardToken || "PIKO")} at ${merchant.name}`,
              confidence: Math.min(smartScore * 10, 1),
            };
          })
      )
    )
      .sort((a, b) => b.smartScore - a.smartScore)
      .slice(0, 5);

    res.json({ success: true, data: { suggestions } });
  } catch (error) {
    console.error("AI suggestion failed:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

aiRouter.post("/growth", async (req: Request, res: Response) => {
  try {
    const input = parseWithSchema(aiGrowthSchema, req.body);
    const analysis = await growthService.analyze(input);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error("Growth analysis failed:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * POST /api/ai/fraud-check
 * Protocol-level fraud validation for location proofs and claim activity
 * Body: { wallet, lat, lng, merchantId, prevLat?, prevLng?, timeDelta?, gpsAccuracy? }
 */
aiRouter.post("/fraud-check", async (req: Request, res: Response) => {
  try {
    const input = parseWithSchema(aiFraudCheckSchema, req.body);

    const [recentClaims, merchantClaims, user] = await Promise.all([
      prisma.questClaim.count({
        where: {
          userWallet: input.wallet,
          claimedAt: { gt: new Date(Date.now() - 3600_000) },
        },
      }),
      prisma.questClaim.count({
        where: {
          userWallet: input.wallet,
          quest: { merchantId: input.merchantId },
          claimedAt: { gt: new Date(Date.now() - 86400_000) },
        },
      }),
      prisma.user.findUnique({
        where: { wallet: input.wallet },
      }),
    ]);

    const accountAge =
      user == null
        ? input.accountAge ?? 0
        : (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);

    const decision = await fraudAgent.run({
      wallet: input.wallet,
      lat: input.lat,
      lng: input.lng,
      prevLat: input.prevLat,
      prevLng: input.prevLng,
      timeDelta: input.timeDelta,
      gpsAccuracy: input.gpsAccuracy,
      recentClaims,
      walletClaimsToday: merchantClaims,
      merchantId: input.merchantId,
      accountAge,
    });

    res.json({
      success: true,
      data: decision.decision,
    });
  } catch (error) {
    console.error("Fraud check failed:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});


