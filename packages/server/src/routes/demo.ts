import fs from "fs";
import path from "path";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AgentCouncil } from "@depokemongo/ai";
import { Category, QuestType } from "@depokemongo/common";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { HttpError, getErrorMessage, getErrorStatus, parseWithSchema } from "../config/http";
import { getPikoMintAuthorityConfigError } from "../lib/mintAuthorityWallet";
import { mintPiko } from "../lib/pikoMinter";
import { decimalToBaseUnits } from "../lib/tokenMath";
import { mintRewardNFT } from "../services/nftService";
import { RewardService } from "../services/rewardService";
import { questService } from "../services";

type DemoLogLevel = "info" | "success" | "warning" | "error";
type DemoLayer = "system" | "api" | "ai" | "solana";

type DemoLogEvent = {
  id: string;
  sessionId: string;
  step: number;
  layer: DemoLayer;
  level: DemoLogLevel;
  title: string;
  detail?: string;
  payload?: unknown;
  timestamp: string;
};

type DemoCapability = {
  live: boolean;
  mode: "live" | "simulated";
  reason?: string;
};

const demoRouter = Router();
const agentCouncil = new AgentCouncil();

const DEMO_MERCHANT_WALLET = "9xQeWvG816bUx9EPu4wQfCj4n8k3B7hRz7D2mM8tLQ5";
const DEMO_USER_WALLET = "7YnaQm9GdrM9C8pQ2tQY6xH8q4vM2zK6fV9Lr3JbW8P";
const DEMO_REFERENCE = "AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9";
const DEMO_DEFAULTS = {
  title: "Visit the signal zone",
  description: "Enter the merchant geofence, complete the check-in, and let PIKO settle the reward on Solana.",
  condition: "Arrive within 40m and hold location for 15 seconds",
  rewardAmount: 1.25,
  minSpend: 0,
  rewardToken: "PIKO",
  lat: 28.6139,
  lng: 77.209,
};

const demoSessionQuerySchema = z.object({
  sessionId: z.string().trim().min(6),
});

const demoCreateIncentiveSchema = z.object({
  sessionId: z.string().trim().min(6),
  title: z.string().trim().min(3).max(120).default(DEMO_DEFAULTS.title),
  description: z.string().trim().min(3).max(500).default(DEMO_DEFAULTS.description),
  condition: z.string().trim().min(3).max(240).default(DEMO_DEFAULTS.condition),
  rewardAmount: z.coerce.number().positive().max(25).default(DEMO_DEFAULTS.rewardAmount),
  rewardToken: z.string().trim().min(1).default(DEMO_DEFAULTS.rewardToken),
  minSpend: z.coerce.number().min(0).max(100).default(DEMO_DEFAULTS.minSpend),
  lat: z.coerce.number().min(-90).max(90).default(DEMO_DEFAULTS.lat),
  lng: z.coerce.number().min(-180).max(180).default(DEMO_DEFAULTS.lng),
});

const demoSimulateActionSchema = z.object({
  sessionId: z.string().trim().min(6),
  questId: z.string().trim().min(1),
  wallet: z.string().trim().min(32).max(44),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  gpsAccuracy: z.coerce.number().positive().default(12),
  forceReject: z.coerce.boolean().optional().default(false),
});

const demoSettleSchema = demoSimulateActionSchema;

const demoClients = new Map<string, Set<Response>>();
const demoHistory = new Map<string, DemoLogEvent[]>();

type DemoWorldUser = {
  id: string;
  wallet: string;
  level: number;
  createdAt: Date;
  worldVerified?: boolean;
  worldNullifier?: string | null;
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readDemoKey(req: Request) {
  const bodyKey =
    req.body && typeof req.body === "object" && "key" in req.body
      ? req.body.key
      : undefined;

  const value =
    req.query.key ??
    req.headers["x-demo-key"] ??
    (typeof bodyKey === "string" ? bodyKey : undefined);

  return typeof value === "string" ? value.trim() : "";
}

function requireDemoAccess(req: Request) {
  const expectedKey = env.DEMO_ACCESS_KEY.trim();

  if (!expectedKey) {
    return;
  }

  if (readDemoKey(req) !== expectedKey) {
    throw new HttpError(403, "Demo key required. Open /demo?key=your-secret to unlock the live protocol route.");
  }
}

function walletPathExists() {
  const walletPath = path.isAbsolute(env.ANCHOR_WALLET)
    ? env.ANCHOR_WALLET
    : path.resolve(process.cwd(), env.ANCHOR_WALLET);

  return fs.existsSync(walletPath);
}

function resolveCapabilities() {
  const walletConfigured = walletPathExists();
  const mintAuthorityError = getPikoMintAuthorityConfigError();
  const pikoMintConfigured = env.PIKO_MINT_ADDRESS.trim().length >= 32;

  const pikoMint: DemoCapability =
    !mintAuthorityError && pikoMintConfigured
      ? { live: true, mode: "live" }
      : {
          live: false,
          mode: "simulated",
          reason: mintAuthorityError
            ? mintAuthorityError
            : "PIKO_MINT_ADDRESS is not configured",
        };

  const nft: DemoCapability =
    env.NFT_REWARDS_ENABLED && walletConfigured
      ? { live: true, mode: "live" }
      : {
          live: false,
          mode: "simulated",
          reason: !env.NFT_REWARDS_ENABLED
            ? "NFT rewards are disabled"
            : "ANCHOR_WALLET is missing or unreadable",
        };

  return {
    pikoMint,
    nft,
  };
}

function pushDemoEvent(
  sessionId: string,
  event: Omit<DemoLogEvent, "id" | "sessionId" | "timestamp">,
) {
  const record: DemoLogEvent = {
    id: makeId("demo-log"),
    sessionId,
    timestamp: new Date().toISOString(),
    ...event,
  };

  const history = demoHistory.get(sessionId) ?? [];
  history.push(record);
  demoHistory.set(sessionId, history.slice(-120));

  const clients = demoClients.get(sessionId);
  if (!clients) {
    return;
  }

  const payload = `data: ${JSON.stringify(record)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

function resolveExplorerUrl(signature: string | null, mode: DemoCapability["mode"]) {
  if (!signature || mode !== "live") {
    return null;
  }

  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function resolveAccountExplorerUrl(address: string | null, mode: DemoCapability["mode"]) {
  if (!address || mode !== "live") {
    return null;
  }

  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

function buildLocationHash(lat: number, lng: number) {
  return `demo:${lat.toFixed(5)}:${lng.toFixed(5)}`;
}

async function ensureDemoMerchant(lat = DEMO_DEFAULTS.lat, lng = DEMO_DEFAULTS.lng) {
  return prisma.merchant.upsert({
    where: { wallet: DEMO_MERCHANT_WALLET },
    update: {
      lat,
      lng,
      isActive: true,
      isVerified: true,
      description: "Protocol-owned showcase merchant for the System Reveal demo flow.",
      locationHash: buildLocationHash(lat, lng),
      totalVisits: 18,
      conversionRate: 0.64,
    },
    create: {
      wallet: DEMO_MERCHANT_WALLET,
      name: "PIKO Protocol Kiosk",
      description: "Protocol-owned showcase merchant for the System Reveal demo flow.",
      category: Category.ENTERTAINMENT,
      lat,
      lng,
      locationHash: buildLocationHash(lat, lng),
      isVerified: true,
      totalVisits: 18,
      conversionRate: 0.64,
      isActive: true,
    },
  });
}

async function ensureDemoUser(resetWorldVerification = false) {
  return (prisma.user as any).upsert({
    where: { wallet: DEMO_USER_WALLET },
    update: {
      displayName: "Protocol Walker",
      level: 7,
      xp: 620,
      lastActiveAt: new Date(),
      ...(resetWorldVerification
        ? {
            worldVerified: false,
            worldNullifier: null,
          }
        : {}),
    },
    create: {
      wallet: DEMO_USER_WALLET,
      displayName: "Protocol Walker",
      level: 7,
      xp: 620,
      totalRewardsBaseUnits: decimalToBaseUnits(18.5, env.PIKO_DECIMALS),
      totalRewards: 18.5,
      questsCompleted: 9,
      streak: 3,
      worldVerified: false,
    },
  }) as Promise<DemoWorldUser>;
}

async function getQuestWithMerchant(questId: string) {
  const quest = await prisma.quest.findUnique({
    where: { id: questId },
    include: { merchant: true },
  });

  if (!quest) {
    throw new HttpError(404, "Demo quest not found");
  }

  return quest;
}

async function ensureDemoClaim(questId: string, wallet: string) {
  return prisma.questClaim.upsert({
    where: {
      questId_userWallet: {
        questId,
        userWallet: wallet,
      },
    },
    update: {
      status: "PENDING",
      txSignature: null,
      rewardTx: null,
      verifiedAt: null,
    },
    create: {
      questId,
      userWallet: wallet,
      status: "PENDING",
    },
  });
}

async function buildReviewRequest(
  questId: string,
  wallet: string,
  lat: number,
  lng: number,
  gpsAccuracy: number,
  forceReject: boolean,
) {
  const quest = await getQuestWithMerchant(questId);
  const user = (await (prisma.user as any).findUnique({ where: { wallet } })) as DemoWorldUser | null;

  const accountAgeDays = user
    ? Math.max(0, (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const request = forceReject
    ? {
        wallet,
        lat,
        lng,
        prevLat: lat + 0.82,
        prevLng: lng + 0.79,
        timeDelta: 60,
        gpsAccuracy: Math.max(gpsAccuracy, 500),
        recentClaims: 13,
        walletClaimsToday: 5,
        merchantId: quest.merchantId,
        accountAge: 0.2,
        currentTraffic: Math.max(quest.merchant.totalVisits, 18),
        avgTraffic: Math.max(Math.round(quest.merchant.totalVisits / 2), 6),
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        userLevel: user?.level ?? 1,
        merchantBalance: 100,
        worldVerified: user?.worldVerified ?? false,
      }
    : {
        wallet,
        lat,
        lng,
        prevLat: lat - 0.0003,
        prevLng: lng - 0.0002,
        timeDelta: 300,
        gpsAccuracy,
        recentClaims: 1,
        walletClaimsToday: 1,
        merchantId: quest.merchantId,
        accountAge: Math.max(accountAgeDays, 45),
        currentTraffic: Math.max(quest.merchant.totalVisits, 18),
        avgTraffic: Math.max(Math.round(quest.merchant.totalVisits / 2), 6),
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        userLevel: user?.level ?? 7,
        merchantBalance: 100,
        worldVerified: user?.worldVerified ?? false,
      };

  return { quest, request };
}

demoRouter.use((req, res, next) => {
  try {
    requireDemoAccess(req);
    next();
  } catch (error) {
    if (req.path === "/stream") {
      res.status(getErrorStatus(error)).end(getErrorMessage(error));
      return;
    }

    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

demoRouter.get("/stream", (req, res) => {
  const { sessionId } = parseWithSchema(demoSessionQuerySchema, req.query);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(": connected\n\n");

  const clients = demoClients.get(sessionId) ?? new Set<Response>();
  clients.add(res);
  demoClients.set(sessionId, clients);

  const history = demoHistory.get(sessionId) ?? [];
  for (const event of history) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  pushDemoEvent(sessionId, {
    step: 0,
    layer: "system",
    level: "info",
    title: "Log stream connected",
    detail: "Server-sent events channel is ready for live protocol narration.",
  });

  req.on("close", () => {
    const listeners = demoClients.get(sessionId);
    listeners?.delete(res);

    if (listeners && listeners.size === 0) {
      demoClients.delete(sessionId);
    }
  });
});

demoRouter.get("/bootstrap", async (req, res) => {
  try {
    const { sessionId } = parseWithSchema(demoSessionQuerySchema, req.query);
    const merchant = await ensureDemoMerchant();
    const user = await ensureDemoUser(true);
    const capabilities = resolveCapabilities();

    pushDemoEvent(sessionId, {
      step: 0,
      layer: "system",
      level: "success",
      title: "Demo session primed",
      detail: "Seed merchant and protocol walker are ready for a live reveal run.",
      payload: {
        merchantId: merchant.id,
        merchantWallet: merchant.wallet,
        demoWallet: user.wallet,
        user: {
          worldVerified: Boolean(user.worldVerified),
          worldNullifier: user.worldNullifier,
        },
        capabilities,
      },
    });

    res.json({
      success: true,
      data: {
        merchant: {
          id: merchant.id,
          name: merchant.name,
          wallet: merchant.wallet,
          description: merchant.description,
          category: merchant.category,
          lat: merchant.lat,
          lng: merchant.lng,
        },
        demoWallet: user.wallet,
        user: {
          worldVerified: Boolean(user.worldVerified),
          worldNullifier: user.worldNullifier,
        },
        demoReference: DEMO_REFERENCE,
        capabilities,
        defaults: DEMO_DEFAULTS,
        access: {
          protected: env.DEMO_ACCESS_KEY.trim().length > 0,
        },
        network: {
          cluster: "devnet",
          explorerBaseUrl: "https://explorer.solana.com",
        },
      },
    });
  } catch (error) {
    console.error("Failed to bootstrap demo session:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

demoRouter.post("/create-incentive", async (req, res) => {
  try {
    const input = parseWithSchema(demoCreateIncentiveSchema, req.body);
    const title = input.title ?? DEMO_DEFAULTS.title;
    const description = input.description ?? DEMO_DEFAULTS.description;
    const condition = input.condition ?? DEMO_DEFAULTS.condition;
    const rewardAmount = input.rewardAmount ?? DEMO_DEFAULTS.rewardAmount;
    const rewardToken = input.rewardToken ?? DEMO_DEFAULTS.rewardToken;
    const minSpend = input.minSpend ?? DEMO_DEFAULTS.minSpend;
    const lat = input.lat ?? DEMO_DEFAULTS.lat;
    const lng = input.lng ?? DEMO_DEFAULTS.lng;

    const merchant = await ensureDemoMerchant(lat, lng);
    await ensureDemoUser();

    pushDemoEvent(input.sessionId, {
      step: 1,
      layer: "api",
      level: "info",
      title: "Merchant seeded",
      detail: "Layer 3 is preparing a live incentive against the protocol-owned demo merchant.",
      payload: {
        merchantId: merchant.id,
        wallet: merchant.wallet,
        lat: merchant.lat,
        lng: merchant.lng,
      },
    });

    const merchantReview = await agentCouncil.reviewMerchant({
      wallet: merchant.wallet,
      name: merchant.name,
      location: { lat, lng },
      category: merchant.category,
      stakeAmount: 1.25,
    });

    pushDemoEvent(input.sessionId, {
      step: 2,
      layer: "ai",
      level: merchantReview.approved ? "success" : "warning",
      title: "MerchantAgent pre-screen complete",
      detail: merchantReview.merchant.reasoning,
      payload: merchantReview,
    });

    const quest = await questService.createQuest({
      merchantId: merchant.id,
      title,
      description,
      rewardAmount,
      rewardToken,
      minSpend,
      questType: QuestType.VISIT,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      conditions: {
        narrativeCondition: condition,
        geofenceRadiusMeters: 40,
        holdDurationSeconds: 15,
      },
    });

    pushDemoEvent(input.sessionId, {
      step: 1,
      layer: "api",
      level: "success",
      title: "Quest created",
      detail: "The incentive is now registered in Layer 3 and ready for a claimant.",
      payload: {
        questId: quest.id,
        rewardAmount: quest.rewardAmount,
        rewardToken: quest.rewardToken,
        expiresAt: quest.expiresAt,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        merchant,
        quest,
        merchantReview,
        paymentReference: DEMO_REFERENCE,
      },
    });
  } catch (error) {
    console.error("Failed to create demo incentive:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

demoRouter.post("/simulate-action", async (req, res) => {
  try {
    const input = parseWithSchema(demoSimulateActionSchema, req.body);
    const gpsAccuracy = input.gpsAccuracy ?? 12;
    const forceReject = input.forceReject ?? false;

    await ensureDemoUser();
    const { quest, request } = await buildReviewRequest(
      input.questId,
      input.wallet,
      input.lat,
      input.lng,
      gpsAccuracy,
      forceReject,
    );

    const claimResult = await questService.claimQuest(
      input.questId,
      input.wallet,
      input.lat,
      input.lng,
      gpsAccuracy,
    );
    const claim = await prisma.questClaim.findUniqueOrThrow({
      where: {
        questId_userWallet: {
          questId: input.questId,
          userWallet: input.wallet,
        },
      },
    });

    pushDemoEvent(input.sessionId, {
      step: 3,
      layer: "api",
      level: "info",
      title: "User action captured",
      detail: "The claimant payload is entering Layer 2 for fraud and reward evaluation.",
      payload: {
        questId: input.questId,
        claimId: claimResult.claimId,
        wallet: input.wallet,
        lat: input.lat,
        lng: input.lng,
        gpsAccuracy,
        forceReject,
        worldVerified: request.worldVerified,
      },
    });

    const review = await agentCouncil.reviewClaim(request);

    pushDemoEvent(input.sessionId, {
      step: 4,
      layer: "ai",
      level: review.approved ? "success" : "warning",
      title: "AgentCouncil review complete",
      detail: `Fraud score ${review.fraud.decision.score}. Reward multiplier ${review.reward.decision.multiplier}.`,
      payload: {
        request,
        review,
      },
    });

    res.json({
      success: true,
      data: {
        quest,
        claim,
        request,
        review,
        paymentReference: DEMO_REFERENCE,
      },
    });
  } catch (error) {
    console.error("Failed to simulate demo action:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

demoRouter.post("/settle", async (req, res) => {
  try {
    const input = parseWithSchema(demoSettleSchema, req.body);
    const gpsAccuracy = input.gpsAccuracy ?? 12;
    const forceReject = input.forceReject ?? false;
    const capabilities = resolveCapabilities();
    const { quest, request } = await buildReviewRequest(
      input.questId,
      input.wallet,
      input.lat,
      input.lng,
      gpsAccuracy,
      forceReject,
    );
    const user = (await (prisma.user as any).findUnique({
      where: { wallet: input.wallet },
    })) as DemoWorldUser | null;

    if (!user?.worldVerified) {
      throw new HttpError(403, "World ID verification required");
    }

    const review = await agentCouncil.reviewClaim(request);
    const claim = await ensureDemoClaim(input.questId, input.wallet);

    pushDemoEvent(input.sessionId, {
      step: 5,
      layer: "solana",
      level: "info",
      title: "Settlement started",
      detail: review.approved
        ? "Layer 1 is preparing the token settlement path."
        : "Settlement path invoked, but approval status will decide whether minting proceeds.",
      payload: {
        capabilities,
        request,
        approved: review.approved,
      },
    });

    let rewardMode: DemoCapability["mode"] = capabilities.pikoMint.mode;
    const settlementService = new RewardService({
      agentCouncil: {
        reviewClaim: async () => review,
      },
      mintPikoFn: async (wallet, amount, anchor) => {
        const amountLabel = typeof amount === "bigint" ? amount.toString() : String(amount);

        if (!capabilities.pikoMint.live) {
          rewardMode = "simulated";
          return `simulated-piko-${makeId("reward")}-${amountLabel}`;
        }

        try {
          rewardMode = "live";
          return await mintPiko(wallet, amount, anchor);
        } catch (error) {
          rewardMode = "simulated";

          pushDemoEvent(input.sessionId, {
            step: 5,
            layer: "solana",
            level: "warning",
            title: "PIKO mint fell back to simulation",
            detail: getErrorMessage(error),
          });

          return `simulated-piko-${makeId("reward")}-${amountLabel}`;
        }
      },
    });

    const transaction = await prisma.transaction.upsert({
      where: { reference: DEMO_REFERENCE },
      update: {
        merchantId: quest.merchantId,
        userWallet: input.wallet,
        questId: input.questId,
        claimId: claim.id,
        amount: quest.minSpend > 0 ? quest.minSpend : quest.rewardAmount,
        txSignature: DEMO_REFERENCE,
        token: "SOL",
        isVerified: true,
      },
      create: {
        merchantId: quest.merchantId,
        userWallet: input.wallet,
        questId: input.questId,
        claimId: claim.id,
        reference: DEMO_REFERENCE,
        amount: quest.minSpend > 0 ? quest.minSpend : quest.rewardAmount,
        txSignature: DEMO_REFERENCE,
        token: "SOL",
        isVerified: true,
      },
    });

    const settlement = await settlementService.settleReward({
      claimId: claim.id,
      transactionId: transaction.id,
      reference: DEMO_REFERENCE,
      quest,
      wallet: input.wallet,
      merchantId: quest.merchantId,
      txSignature: DEMO_REFERENCE,
      lat: input.lat,
      lng: input.lng,
      gpsAccuracy,
    });

    await prisma.questClaim.update({
      where: {
        questId_userWallet: {
          questId: input.questId,
          userWallet: input.wallet,
        },
      },
      data: settlement.approved
        ? {
            status: "REWARDED",
            rewardTx: settlement.rewardTx,
            txSignature: DEMO_REFERENCE,
            verifiedAt: new Date(),
          }
        : {
            status: "REJECTED",
            txSignature: DEMO_REFERENCE,
            verifiedAt: new Date(),
          },
    });

    if (settlement.approved) {
      await prisma.merchant.update({
        where: { id: quest.merchantId },
        data: {
          totalVisits: { increment: 1 },
        },
      });
    }

    let nftMode: DemoCapability["mode"] = capabilities.nft.mode;
    let nftMint: string | null = null;
    let nftTxSignature: string | null = null;

    if (settlement.approved) {
      if (!capabilities.nft.live) {
        nftMode = "simulated";
        nftMint = `simulated-nft-${makeId("badge")}`;
      } else {
        try {
          const nftResult = await mintRewardNFT(input.wallet, quest.title, quest.merchant.name);
          nftMode = "live";
          nftMint = nftResult.nftMint;
          nftTxSignature = nftResult.txSignature;
        } catch (error) {
          nftMode = "simulated";
          nftMint = `simulated-nft-${makeId("badge")}`;

          pushDemoEvent(input.sessionId, {
            step: 5,
            layer: "solana",
            level: "warning",
            title: "NFT mint fell back to simulation",
            detail: getErrorMessage(error),
          });
        }
      }
    }

    pushDemoEvent(input.sessionId, {
      step: 5,
      layer: "solana",
      level: settlement.approved ? "success" : "warning",
      title: settlement.approved ? "Settlement finished" : "Settlement halted",
      detail: settlement.approved
        ? `Reward ${settlement.rewardAmountDisplay} ${settlement.rewardToken} settled in ${rewardMode} mode.`
        : `Fraud score ${settlement.fraudScore} blocked the on-chain mint path.`,
      payload: {
        settlement,
        rewardMode,
        nftMode,
        nftMint,
        nftTxSignature,
      },
    });

    pushDemoEvent(input.sessionId, {
      step: 6,
      layer: "ai",
      level: "success",
      title: "Dynamic reward readout ready",
      detail: settlement.rewardReasons.join("; ") || settlement.aiSummary,
      payload: {
        originalReward: quest.rewardAmount,
        adjustedReward: settlement.rewardAmount,
        adjustedRewardDisplay: settlement.rewardAmountDisplay,
        multiplier: settlement.rewardMultiplier,
        reasons: settlement.rewardReasons,
      },
    });

    res.json({
      success: true,
      data: {
        quest,
        request,
        review,
        settlement,
        blockchain: {
          rewardTx: settlement.rewardTx,
          rewardTxMode: rewardMode,
          explorerUrl: resolveExplorerUrl(settlement.rewardTx, rewardMode),
          nftMint,
          nftMode,
          nftExplorerUrl: resolveAccountExplorerUrl(nftMint, nftMode),
          txSignature: settlement.rewardTx,
          nftTxSignature,
        },
        rewardReadout: {
          originalReward: quest.rewardAmount,
          adjustedReward: settlement.rewardAmount,
          adjustedRewardDisplay: settlement.rewardAmountDisplay,
          rewardToken: settlement.rewardToken,
          multiplier: settlement.rewardMultiplier,
          reasons: settlement.rewardReasons,
          aiSummary: settlement.aiSummary,
        },
      },
    });
  } catch (error) {
    console.error("Failed to settle demo reward:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

export { demoRouter };
