import test from "node:test";
import assert from "node:assert/strict";
import { Quest } from "@prisma/client";
import { RewardService } from "../src/services/rewardService";

function createQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: "quest-1",
    merchantId: "merchant-1",
    onChainId: null,
    onChainWallet: null,
    title: "Mint PIKO",
    description: "Reward test quest",
    rewardAmount: 10,
    rewardToken: "PIKO",
    xpReward: 25,
    minSpend: 0.001,
    maxClaims: 100,
    claimedCount: 0,
    isActive: true,
    questType: "PURCHASE",
    conditions: null,
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createReview(approved: boolean, multiplier = 1) {
  return {
    approved,
    reward: {
      reasoning: approved ? "reward approved" : "reward rejected",
      decision: {
        multiplier,
        reasons: approved ? ["eligible"] : ["blocked"],
      },
    },
    fraud: {
      reasoning: approved ? "fraud clear" : "fraud detected",
      decision: {
        score: approved ? 0.05 : 0.9,
        flags: approved ? [] : ["suspicious_velocity"],
      },
    },
  };
}

function createSettlementInput(overrides: Record<string, unknown> = {}) {
  return {
    claimId: "claim-1",
    transactionId: "txn-1",
    reference: "ref-1",
    quest: createQuest(),
    wallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
    merchantId: "merchant-1",
    txSignature: "payment-signature",
    ...overrides,
  };
}

function createDb(options?: {
  dailyTotalBaseUnits?: bigint;
  latestRewardAt?: Date | null;
  existingClaimRewardTx?: string | null;
  existingTransactionRewardTx?: string | null;
  ledgerAlreadyExists?: boolean;
  storedIntent?: {
    decision: "APPROVED" | "REJECTED";
    rewardAmountBaseUnits: bigint;
    rewardMultiplier: number;
    rewardToken: string;
    rewardReasons: string[];
    fraudScore: number;
    worldVerified: boolean;
    aiSummary: string;
    xpEarned: number;
    newLevel: number;
  } | null;
}) {
  const events = {
    questUpdateMany: [] as unknown[],
    questUpdates: [] as unknown[],
    rewardLedgerCreates: [] as unknown[],
    userCreates: [] as unknown[],
    userUpdates: [] as unknown[],
    leaderboardSyncs: [] as string[],
    claimUpdates: [] as unknown[],
    transactionUpdates: [] as unknown[],
  };

  const userRecord = {
    id: "user-1",
    wallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    level: 3,
    worldVerified: true,
    xp: 300,
    totalRewards: 0,
    totalRewardsBaseUnits: 0n,
    questsCompleted: 0,
    streak: 0,
    lastActiveAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  const txClient = {
    user: {
      findUnique: async () => ({
        wallet: userRecord.wallet,
        xp: userRecord.xp,
        totalRewards: userRecord.totalRewards,
        totalRewardsBaseUnits: userRecord.totalRewardsBaseUnits,
      }),
      create: async ({ data }: { data: typeof userRecord }) => {
        events.userCreates.push(data);
        Object.assign(userRecord, data);
        return { ...userRecord };
      },
      update: async ({ data }: { data: Partial<typeof userRecord> }) => {
        events.userUpdates.push(data);
        Object.assign(userRecord, data);
        return { ...userRecord };
      },
    },
    rewardLedger: {
      findUnique: async () => (options?.ledgerAlreadyExists ? { id: "ledger-1" } : null),
      create: async ({ data }: { data: unknown }) => {
        events.rewardLedgerCreates.push(data);
        return data;
      },
    },
  };

  return {
    events,
    client: {
      user: {
        findUnique: async () => ({ ...userRecord }),
      },
      questClaim: {
        findUnique: async () => ({ rewardTx: options?.existingClaimRewardTx ?? null }),
        update: async (payload: unknown) => {
          events.claimUpdates.push(payload);
          return payload;
        },
        count: async () => 0,
      },
      quest: {
        count: async () => 3,
        updateMany: async (payload: unknown) => {
          events.questUpdateMany.push(payload);
          return { count: 1 };
        },
        update: async (payload: unknown) => {
          events.questUpdates.push(payload);
          return payload;
        },
      },
      rewardLedger: {
        aggregate: async () => ({
          _sum: {
            amountBaseUnits: options?.dailyTotalBaseUnits ?? 0n,
          },
        }),
        findFirst: async () => (options?.latestRewardAt ? { createdAt: options.latestRewardAt } : null),
      },
      transaction: {
        findUnique: async () => {
          if (options?.storedIntent) {
            return {
              decision: options.storedIntent.decision,
              worldVerified: options.storedIntent.worldVerified,
              fraudScore: options.storedIntent.fraudScore,
              rewardMultiplier: options.storedIntent.rewardMultiplier,
              rewardToken: options.storedIntent.rewardToken,
              rewardAmountBaseUnits: options.storedIntent.rewardAmountBaseUnits,
              rewardReasons: options.storedIntent.rewardReasons,
              aiSummary: options.storedIntent.aiSummary,
              xpEarned: options.storedIntent.xpEarned,
              newLevel: options.storedIntent.newLevel,
              rewardTx: options.existingTransactionRewardTx ?? null,
            };
          }

          return {
            decision: null,
            worldVerified: null,
            fraudScore: null,
            rewardMultiplier: null,
            rewardToken: null,
            rewardAmountBaseUnits: null,
            rewardReasons: null,
            aiSummary: null,
            xpEarned: null,
            newLevel: null,
            rewardTx: options?.existingTransactionRewardTx ?? null,
          };
        },
        update: async (payload: unknown) => {
          events.transactionUpdates.push(payload);
          return payload;
        },
      },
      $transaction: async <T>(callback: (tx: typeof txClient) => Promise<T>) => callback(txClient),
    },
  };
}

test("settleReward mints PIKO after approval", async () => {
  const db = createDb();
  const mintCalls: Array<{ wallet: string; amount: bigint | number | string }> = [];

  const service = new RewardService({
    db: db.client as never,
    agentCouncil: {
      reviewClaim: async () => createReview(true, 1.25),
    },
    mintPikoFn: async (wallet, amount) => {
      mintCalls.push({ wallet, amount });
      return "mint-signature";
    },
    findMintedPikoRewardTxFn: async () => null,
    syncUserLeaderboardFn: async (wallet) => {
      db.events.leaderboardSyncs.push(wallet);
    },
  });

  const result = await service.settleReward({
    ...createSettlementInput(),
  });

  assert.equal(result.approved, true);
  assert.equal(result.worldVerified, true);
  assert.equal(result.decision, "APPROVED");
  assert.equal(result.rewardToken, "PIKO");
  assert.equal(result.rewardAmount, 12.5);
  assert.equal(result.rewardTx, "mint-signature");
  assert.deepEqual(mintCalls, [
    {
      wallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
      amount: 12_500_000_000n,
    },
  ]);
  assert.equal(db.events.questUpdateMany.length, 1);
  assert.equal(db.events.rewardLedgerCreates.length, 1);
  assert.equal(db.events.transactionUpdates.length, 2);
  assert.deepEqual(db.events.leaderboardSyncs, ["7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu"]);
});

test("settleReward preserves precision for small rewards", async () => {
  const db = createDb();
  const mintCalls: Array<{ wallet: string; amount: bigint | number | string }> = [];

  const service = new RewardService({
    db: db.client as never,
    agentCouncil: {
      reviewClaim: async () => createReview(true, 1.35),
    },
    mintPikoFn: async (wallet, amount) => {
      mintCalls.push({ wallet, amount });
      return "mint-signature";
    },
    findMintedPikoRewardTxFn: async () => null,
    syncUserLeaderboardFn: async () => undefined,
  });

  const result = await service.settleReward({
    ...createSettlementInput({
      quest: createQuest({ rewardAmount: 0.01 }),
    }),
  });

  assert.equal(result.rewardAmount, 0.0135);
  assert.deepEqual(mintCalls, [
    {
      wallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
      amount: 13_500_000n,
    },
  ]);
  assert.equal(result.rewardAmountBaseUnits, "13500000");
  assert.equal(result.rewardAmountDisplay, "0.0135");
});

test("settleReward does not mint when review rejects the claim", async () => {
  const db = createDb();
  let mintCalled = false;

  const service = new RewardService({
    db: db.client as never,
    agentCouncil: {
      reviewClaim: async () => createReview(false, 1),
    },
    mintPikoFn: async () => {
      mintCalled = true;
      return "should-not-happen";
    },
    findMintedPikoRewardTxFn: async () => null,
    syncUserLeaderboardFn: async () => undefined,
  });

  const result = await service.settleReward({
    ...createSettlementInput(),
  });

  assert.equal(result.approved, false);
  assert.equal(result.worldVerified, true);
  assert.equal(result.decision, "REJECTED");
  assert.equal(result.rewardTx, null);
  assert.equal(mintCalled, false);
  assert.equal(db.events.questUpdateMany.length, 0);
  assert.equal(db.events.rewardLedgerCreates.length, 0);
});

test("settleReward rejects unsupported reward tokens", async () => {
  const db = createDb();

  const service = new RewardService({
    db: db.client as never,
    agentCouncil: {
      reviewClaim: async () => createReview(true, 1),
    },
    mintPikoFn: async () => "mint-signature",
    findMintedPikoRewardTxFn: async () => null,
    syncUserLeaderboardFn: async () => undefined,
  });

  await assert.rejects(
    service.settleReward({
      ...createSettlementInput({
        quest: createQuest({ rewardToken: "DOGE" }),
      }),
    }),
    /Unsupported reward token: DOGE/,
  );
});

test("settleReward enforces the per-wallet daily cap in base units", async () => {
  const db = createDb({
    dailyTotalBaseUnits: 999_000_000_000n,
  });

  const service = new RewardService({
    db: db.client as never,
    agentCouncil: {
      reviewClaim: async () => createReview(true, 1),
    },
    mintPikoFn: async () => "mint-signature",
    findMintedPikoRewardTxFn: async () => null,
    syncUserLeaderboardFn: async () => undefined,
  });

  await assert.rejects(
    service.settleReward({
      ...createSettlementInput({
        quest: createQuest({ rewardAmount: 5 }),
      }),
    }),
    /Daily reward cap exceeded/,
  );
});

test("settleReward reuses stored mint signature for failed retries", async () => {
  const db = createDb({ existingClaimRewardTx: "mint-already-sent" });
  let mintCalled = false;

  const service = new RewardService({
    db: db.client as never,
    agentCouncil: {
      reviewClaim: async () => createReview(true, 1),
    },
    mintPikoFn: async () => {
      mintCalled = true;
      return "new-mint-signature";
    },
    findMintedPikoRewardTxFn: async () => null,
    syncUserLeaderboardFn: async () => undefined,
  });

  const result = await service.settleReward({
    ...createSettlementInput(),
  });

  assert.equal(result.rewardTx, "mint-already-sent");
  assert.equal(mintCalled, false);
  assert.equal(db.events.rewardLedgerCreates.length, 1);
  assert.equal(db.events.questUpdateMany.length, 0);
});

test("settleReward reuses a persisted settlement intent after a crash", async () => {
  const db = createDb({
    storedIntent: {
      decision: "APPROVED",
      rewardAmountBaseUnits: 12_500_000_000n,
      rewardMultiplier: 1.25,
      rewardToken: "PIKO",
      rewardReasons: ["eligible"],
      fraudScore: 0.05,
      worldVerified: true,
      aiSummary: "Reward AI: reward approved. Fraud AI: fraud clear.",
      xpEarned: 25,
      newLevel: 4,
    },
  });
  let reviewCalls = 0;

  const service = new RewardService({
    db: db.client as never,
    agentCouncil: {
      reviewClaim: async () => {
        reviewCalls += 1;
        return createReview(true, 3);
      },
    },
    mintPikoFn: async () => "mint-signature",
    findMintedPikoRewardTxFn: async () => null,
    syncUserLeaderboardFn: async () => undefined,
  });

  const result = await service.settleReward({
    ...createSettlementInput(),
  });

  assert.equal(reviewCalls, 0);
  assert.equal(result.rewardMultiplier, 1.25);
  assert.equal(result.rewardAmountBaseUnits, "12500000000");
});

test("settleReward recovers a chain mint instead of reminting", async () => {
  const db = createDb({
    storedIntent: {
      decision: "APPROVED",
      rewardAmountBaseUnits: 12_500_000_000n,
      rewardMultiplier: 1.25,
      rewardToken: "PIKO",
      rewardReasons: ["eligible"],
      fraudScore: 0.05,
      worldVerified: true,
      aiSummary: "Reward AI: reward approved. Fraud AI: fraud clear.",
      xpEarned: 25,
      newLevel: 4,
    },
  });
  let mintCalls = 0;

  const service = new RewardService({
    db: db.client as never,
    agentCouncil: {
      reviewClaim: async () => createReview(true, 1.25),
    },
    mintPikoFn: async () => {
      mintCalls += 1;
      return "new-mint-signature";
    },
    findMintedPikoRewardTxFn: async () => "recovered-chain-signature",
    syncUserLeaderboardFn: async () => undefined,
  });

  const result = await service.settleReward({
    ...createSettlementInput(),
  });

  assert.equal(result.rewardTx, "recovered-chain-signature");
  assert.equal(mintCalls, 0);
  assert.equal(db.events.questUpdateMany.length, 0);
});
