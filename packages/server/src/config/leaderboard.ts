import { LeaderboardPeriod, xpToLevel } from "@depokemongo/common";
import { prisma } from "./db";
import { env } from "./env";
import { addRewardToTotals } from "../lib/rewardLedger";

const PERIODS: LeaderboardPeriod[] = ["weekly", "monthly", "alltime"];

export async function syncUserLeaderboard(wallet: string) {
  const user = await prisma.user.findUnique({
    where: { wallet },
  });

  if (!user) {
    return;
  }

  await Promise.all(
    PERIODS.map((period) =>
      prisma.leaderboardEntry.upsert({
        where: { wallet_period: { wallet, period } },
        update: { xp: user.xp },
        create: { wallet, xp: user.xp, period, rank: 0 },
      })
    )
  );

  for (const period of PERIODS) {
    const entries = await prisma.leaderboardEntry.findMany({
      where: { period },
      orderBy: [{ xp: "desc" }, { updatedAt: "asc" }],
    });

    await Promise.all(
      entries.map((entry, index) =>
        prisma.leaderboardEntry.update({
          where: { wallet_period: { wallet: entry.wallet, period } },
          data: { rank: index + 1 },
        })
      )
    );
  }
}

export async function applyUserReward(wallet: string, rewardAmountBaseUnits: bigint, xpReward: number) {
  const updated = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { wallet },
      select: {
        totalRewards: true,
        totalRewardsBaseUnits: true,
      },
    });

    const totals = addRewardToTotals(existingUser ?? {}, rewardAmountBaseUnits, env.PIKO_DECIMALS);

    const user =
      existingUser == null
        ? await tx.user.create({
            data: {
              wallet,
              totalRewards: totals.totalRewards,
              totalRewardsBaseUnits: totals.totalRewardsBaseUnits,
              questsCompleted: 1,
              xp: xpReward,
            },
          })
        : await tx.user.update({
            where: { wallet },
            data: {
              totalRewards: totals.totalRewards,
              totalRewardsBaseUnits: totals.totalRewardsBaseUnits,
              questsCompleted: { increment: 1 },
              xp: { increment: xpReward },
              lastActiveAt: new Date(),
            },
          });

    const level = xpToLevel(user.xp);
    return tx.user.update({
      where: { wallet },
      data: { level },
    });
  });

  await syncUserLeaderboard(wallet);
  return updated;
}
