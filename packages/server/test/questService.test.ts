import test from "node:test";
import assert from "node:assert/strict";
import { QuestService } from "../src/services/questService";

function createQuest() {
  return {
    id: "quest-1",
    merchantId: "merchant-1",
    onChainId: null,
    onChainWallet: null,
    title: "Quest",
    description: "Description",
    rewardAmount: 1,
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
    merchant: {
      id: "merchant-1",
      wallet: "GvHeQ9NfL7KPLWjXrbgNqE6W5gK4Tz6M3fVhHq7w8Y9Z",
      name: "Merchant",
      category: "CAFE",
      lat: 28.6139,
      lng: 77.209,
      description: "Quest merchant",
      locationHash: "demo",
      imageUrl: null,
      isVerified: true,
      stakeAmount: 0,
      rating: 0,
      totalVisits: 0,
      conversionRate: 0,
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  };
}

function createCompletedTransaction() {
  return {
    id: "txn-1",
    merchantId: "merchant-1",
    userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
    questId: "quest-1",
    claimId: "claim-1",
    reference: "ref-1",
    amount: 0.001,
    amountLamports: 1_000_000n,
    token: "SOL",
    tokenMint: null,
    txSignature: "pay-signature",
    rewardTx: "reward-signature",
    rewardAmountBaseUnits: 1_250_000_000n,
    rewardMultiplier: 1.25,
    rewardToken: "PIKO",
    rewardReasons: ["eligible"],
    fraudScore: 0.05,
    worldVerified: true,
    decision: "APPROVED",
    aiSummary: "Reward AI: approved. Fraud AI: clear.",
    xpEarned: 25,
    newLevel: 4,
    nftMint: "nft-mint",
    nftTxSignature: null,
    completedAt: new Date("2026-01-01T00:00:00.000Z"),
    recipientWallet: null,
    recipientVerified: true,
    isVerified: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

test("completeQuest returns the stored result for an idempotent retry", async () => {
  let rewardServiceCalled = false;

  const questService = new QuestService(
    {
      verifyTransactionFull: async () => {
        throw new Error("verifyTransactionFull should not run for a completed reference");
      },
      recordTransaction: async () => {
        throw new Error("recordTransaction should not run for a completed reference");
      },
      clearPendingPayment: () => undefined,
    } as never,
    {
      settleReward: async () => {
        rewardServiceCalled = true;
        throw new Error("settleReward should not run for a completed reference");
      },
    } as never,
    {
      db: {
        quest: {
          findUnique: async () => createQuest(),
        },
        questClaim: {
          findUnique: async () => ({
            id: "claim-1",
            questId: "quest-1",
            userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
            txSignature: "pay-signature",
            rewardTx: "reward-signature",
            status: "REWARDED",
            claimedAt: new Date("2026-01-01T00:00:00.000Z"),
            verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
        },
        transaction: {
          findUnique: async () => createCompletedTransaction(),
        },
      } as never,
    },
  );

  const result = await questService.completeQuest({
    questId: "quest-1",
    reference: "ref-1",
    userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
    lat: 28.6139,
    lng: 77.209,
    gpsAccuracy: 10,
  });

  assert.equal(result.transactionId, "txn-1");
  assert.equal(result.rewardAmountBaseUnits, "1250000000");
  assert.equal(result.rewardAmountDisplay, "1.25");
  assert.equal(result.nftMint, "nft-mint");
  assert.equal(rewardServiceCalled, false);
});

test("completeQuest blocks a second processor when the claim is already reserved", async () => {
  let rewardServiceCalled = false;

  const questService = new QuestService(
    {
      verifyTransactionFull: async () => ({
        verified: true,
        signature: "pay-signature",
        senderVerified: true,
        recipientVerified: true,
        amountVerified: true,
        referenceVerified: true,
        senderWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
        recipientWallet: "merchant-wallet",
        amountLamports: 1_000_000,
        tokenMint: null,
        paymentInfo: {
          merchantId: "merchant-1",
          questId: "quest-1",
          amount: 0.001,
          wallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
          reference: {} as never,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
      recordTransaction: async () => ({
        ...createCompletedTransaction(),
        completedAt: null,
      }),
      clearPendingPayment: () => undefined,
    } as never,
    {
      settleReward: async () => {
        rewardServiceCalled = true;
        throw new Error("settleReward should not run when the claim is already reserved");
      },
    } as never,
    {
      db: {
        quest: {
          findUnique: async () => createQuest(),
        },
        transaction: {
          findUnique: async () => null,
          findFirst: async () => null,
        },
        questClaim: {
          findUnique: async () => ({
            id: "claim-1",
            questId: "quest-1",
            userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
            txSignature: null,
            rewardTx: null,
            status: "VERIFIED",
            claimedAt: new Date("2026-01-01T00:00:00.000Z"),
            verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
          updateMany: async () => ({ count: 0 }),
        },
      } as never,
    },
  );

  await assert.rejects(
    questService.completeQuest({
      questId: "quest-1",
      reference: "ref-1",
      userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
      lat: 28.6139,
      lng: 77.209,
      gpsAccuracy: 10,
    }),
    /already being processed/,
  );

  assert.equal(rewardServiceCalled, false);
});

test("completeQuest marks claim FAILED when reward settlement throws", async () => {
  const questService = new QuestService(
    {
      verifyTransactionFull: async () => ({
        verified: true,
        signature: "pay-signature",
        senderVerified: true,
        recipientVerified: true,
        amountVerified: true,
        referenceVerified: true,
        senderWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
        recipientWallet: "merchant-wallet",
        amountLamports: 1_000_000,
        tokenMint: null,
        paymentInfo: {
          merchantId: "merchant-1",
          questId: "quest-1",
          amount: 0.001,
          wallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
          reference: {} as never,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
      recordTransaction: async () => ({
        ...createCompletedTransaction(),
        completedAt: null,
      }),
      clearPendingPayment: () => undefined,
    } as never,
    {
      settleReward: async () => {
        throw new Error("mint failed");
      },
    } as never,
    {
      db: {
        quest: {
          findUnique: async () => createQuest(),
        },
        transaction: {
          findUnique: async () => null,
          findFirst: async () => null,
        },
        questClaim: {
          findUnique: async () => ({
            id: "claim-1",
            questId: "quest-1",
            userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
            txSignature: null,
            rewardTx: null,
            status: "PENDING",
            claimedAt: new Date("2026-01-01T00:00:00.000Z"),
            verifiedAt: null,
          }),
          updateMany: async () => ({ count: 1 }),
          update: async ({ data }: { data: { status: string } }) => {
            assert.equal(data.status, "FAILED");
            return null as never;
          },
        },
      } as never,
    },
  );

  await assert.rejects(
    questService.completeQuest({
      questId: "quest-1",
      reference: "ref-1",
      userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
      lat: 28.6139,
      lng: 77.209,
      gpsAccuracy: 10,
    }),
    /mint failed/,
  );
});

test("completeQuest retries stale VERIFIED claims and completes deterministically", async () => {
  let settleCalls = 0;

  const questService = new QuestService(
    {
      verifyTransactionFull: async () => ({
        verified: true,
        signature: "pay-signature",
        senderVerified: true,
        recipientVerified: true,
        amountVerified: true,
        referenceVerified: true,
        senderWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
        recipientWallet: "merchant-wallet",
        amountLamports: 1_000_000,
        tokenMint: null,
        paymentInfo: {
          merchantId: "merchant-1",
          questId: "quest-1",
          amount: 0.001,
          wallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
          reference: {} as never,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
      recordTransaction: async () => ({
        ...createCompletedTransaction(),
        completedAt: null,
      }),
      clearPendingPayment: () => undefined,
    } as never,
    {
      settleReward: async () => {
        settleCalls += 1;
        return {
          approved: false,
          worldVerified: true,
          decision: "REJECTED",
          fraudScore: 0.9,
          fraudFlags: ["suspicious_velocity"],
          rewardMultiplier: 1,
          rewardAmountBaseUnits: "0",
          rewardAmountDisplay: "0",
          rewardAmount: 0,
          rewardToken: "PIKO",
          rewardTx: null,
          rewardReasons: ["blocked"],
          aiSummary: "blocked",
          xpEarned: 0,
          newLevel: 3,
        };
      },
    } as never,
    {
      db: {
        quest: {
          findUnique: async () => createQuest(),
        },
        transaction: {
          findUnique: async () => null,
          findFirst: async () => null,
        },
        questClaim: {
          findUnique: async () => ({
            id: "claim-1",
            questId: "quest-1",
            userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
            txSignature: "pay-signature",
            rewardTx: null,
            status: "VERIFIED",
            claimedAt: new Date("2026-01-01T00:00:00.000Z"),
            verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
          updateMany: async () => ({ count: 1 }),
        },
        $transaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
          callback({
            questClaim: { update: async () => null },
            merchant: { update: async () => null },
            transaction: { update: async () => null },
          }),
      } as never,
    },
  );

  const result = await questService.completeQuest({
    questId: "quest-1",
    reference: "ref-1",
    userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
    lat: 28.6139,
    lng: 77.209,
    gpsAccuracy: 10,
  });

  assert.equal(settleCalls, 1);
  assert.equal(result.verified, true);
  assert.equal(result.decision, "REJECTED");
  assert.equal(result.transactionId, "txn-1");
});

test("completeQuest retries FAILED claims with the same reference", async () => {
  let settleCalls = 0;

  const questService = new QuestService(
    {
      verifyTransactionFull: async () => ({
        verified: true,
        signature: "pay-signature",
        senderVerified: true,
        recipientVerified: true,
        amountVerified: true,
        referenceVerified: true,
        senderWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
        recipientWallet: "merchant-wallet",
        amountLamports: 1_000_000,
        tokenMint: null,
        paymentInfo: {
          merchantId: "merchant-1",
          questId: "quest-1",
          amount: 0.001,
          wallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
          reference: {} as never,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
      recordTransaction: async () => ({
        ...createCompletedTransaction(),
        completedAt: null,
      }),
      clearPendingPayment: () => undefined,
    } as never,
    {
      settleReward: async () => {
        settleCalls += 1;
        return {
          approved: true,
          worldVerified: true,
          decision: "APPROVED",
          fraudScore: 0.05,
          fraudFlags: [],
          rewardMultiplier: 1.25,
          rewardAmountBaseUnits: "1250000000",
          rewardAmountDisplay: "1.25",
          rewardAmount: 1.25,
          rewardToken: "PIKO",
          rewardTx: "reward-signature",
          rewardReasons: ["eligible"],
          aiSummary: "approved",
          xpEarned: 25,
          newLevel: 4,
        };
      },
    } as never,
    {
      db: {
        quest: {
          findUnique: async () => createQuest(),
        },
        transaction: {
          findUnique: async () => null,
          findFirst: async () => null,
        },
        questClaim: {
          findUnique: async () => ({
            id: "claim-1",
            questId: "quest-1",
            userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
            txSignature: "pay-signature",
            rewardTx: null,
            status: "FAILED",
            claimedAt: new Date("2026-01-01T00:00:00.000Z"),
            verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
          updateMany: async () => ({ count: 1 }),
        },
        user: {
          findUnique: async () => ({
            id: "user-1",
          }),
        },
        badge: {
          create: async () => null as never,
        },
        $transaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
          callback({
            questClaim: { update: async () => null },
            merchant: { update: async () => null },
            transaction: { update: async () => null },
          }),
      } as never,
      mintRewardNftFn: async () => ({
        name: "Quest Badge",
        nftMint: "nft-mint",
        txSignature: "nft-signature",
      }),
    },
  );

  const result = await questService.completeQuest({
    questId: "quest-1",
    reference: "ref-1",
    userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
    lat: 28.6139,
    lng: 77.209,
    gpsAccuracy: 10,
  });

  assert.equal(settleCalls, 1);
  assert.equal(result.decision, "APPROVED");
  assert.equal(result.rewardAmountBaseUnits, "1250000000");
});

test("completeQuest rejects references already bound to another claim", async () => {
  const questService = new QuestService(
    {
      verifyTransactionFull: async () => {
        throw new Error("verifyTransactionFull should not run when claim binding is invalid");
      },
      recordTransaction: async () => {
        throw new Error("recordTransaction should not run when claim binding is invalid");
      },
      clearPendingPayment: () => undefined,
    } as never,
    {
      settleReward: async () => {
        throw new Error("settleReward should not run when claim binding is invalid");
      },
    } as never,
    {
      db: {
        quest: {
          findUnique: async () => createQuest(),
        },
        questClaim: {
          findUnique: async () => ({
            id: "claim-1",
            questId: "quest-1",
            userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
            txSignature: null,
            rewardTx: null,
            status: "PENDING",
            claimedAt: new Date("2026-01-01T00:00:00.000Z"),
            verifiedAt: null,
          }),
        },
        transaction: {
          findUnique: async () => ({
            ...createCompletedTransaction(),
            completedAt: null,
            claimId: "claim-other",
          }),
        },
      } as never,
    },
  );

  await assert.rejects(
    questService.completeQuest({
      questId: "quest-1",
      reference: "ref-1",
      userWallet: "7QpM4vTxD8fJ2kLmN5rS9wXaBcDeFgHiJkLmNoPqRsTu",
      lat: 28.6139,
      lng: 77.209,
      gpsAccuracy: 10,
    }),
    /bound to another claim/,
  );
});
