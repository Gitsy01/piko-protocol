// ═══════════════════════════════════════════════════════════
// User Route — /api/user
// ═══════════════════════════════════════════════════════════

import { Router, Request, Response } from "express";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { getErrorMessage, getErrorStatus, parseWithSchema } from "../config/http";
import { connectUserSchema } from "../config/validation";
import { addRewardToTotals } from "../lib/rewardLedger";

export const userRouter = Router();

function normalizeUserRewardTotals<T extends { totalRewards?: number | null; totalRewardsBaseUnits?: bigint | null }>(
  user: T,
) {
  const totals = addRewardToTotals(user, 0n, env.PIKO_DECIMALS);

  return {
    ...user,
    totalRewards: totals.totalRewards,
    totalRewardsBaseUnits: totals.totalRewardsBaseUnits,
  };
}

/**
 * GET /api/user/:wallet
 */
userRouter.get("/:wallet", async (req: Request, res: Response) => {
  try {
    let user = await prisma.user.findUnique({
      where: { wallet: req.params.wallet },
      include: { badges: true },
    });

    if (!user) {
      // Auto-create user on first access
      user = await prisma.user.create({
        data: { wallet: req.params.wallet },
        include: { badges: true },
      });
    }

    // Get recent quest completions
    const recentActivity = await prisma.questClaim.findMany({
      where: { userWallet: req.params.wallet, status: "REWARDED" },
      include: { quest: { include: { merchant: true } } },
      orderBy: { claimedAt: "desc" },
      take: 10,
    });

    res.json({
      success: true,
      data: { user: normalizeUserRewardTotals(user), recentActivity },
    });
  } catch (error) {
    console.error("Failed to fetch user:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * POST /api/user/connect
 * Body: { wallet, signedMessage }
 */
userRouter.post("/connect", async (req: Request, res: Response) => {
  try {
    const { wallet } = parseWithSchema(connectUserSchema, req.body);

    // Upsert user
    const user = await prisma.user.upsert({
      where: { wallet },
      update: { lastActiveAt: new Date() },
      create: { wallet },
    });

    // In production: verify signed message + issue JWT
    res.json({
      success: true,
      data: { user: normalizeUserRewardTotals(user), token: "dev-token" },
    });
  } catch (error) {
    console.error("Failed to connect user:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});
