// ═══════════════════════════════════════════════════════════
// Leaderboard Route — /api/leaderboard
// ═══════════════════════════════════════════════════════════

import { Router, Request, Response } from "express";
import { prisma } from "../config/db";
import { getErrorMessage, getErrorStatus, parseWithSchema } from "../config/http";
import { leaderboardQuerySchema } from "../config/validation";

export const leaderboardRouter = Router();

/**
 * GET /api/leaderboard
 * Query: period (weekly|monthly|alltime), limit
 */
leaderboardRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { period = "weekly", limit = 50, wallet } = parseWithSchema(
      leaderboardQuerySchema,
      req.query
    );

    const entries = await prisma.leaderboardEntry.findMany({
      where: { period },
      orderBy: { rank: "asc" },
      take: limit,
    });

    // Get requesting user's rank if wallet provided
    let userRank = null;
    if (wallet) {
      const userEntry = await prisma.leaderboardEntry.findUnique({
        where: { wallet_period: { wallet, period } },
      });
      userRank = userEntry?.rank || null;
    }

    res.json({
      success: true,
      data: { entries, userRank },
    });
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});
