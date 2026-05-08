import {
  demoMerchants,
  demoSuggestions,
  demoUser,
  getDemoLeaderboard,
} from "./demo-data";
import type { DecisionReceiptNftMetadata, QuestCompletionReceipt } from "./decision-receipt";
import {
  AIDecisionSummary,
  HeatmapNode,
  LeaderboardEntry,
  MapSuggestion,
  MerchantPinType,
  QuestDetail,
  QuestPreview,
  UserProfile,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const FALLBACK_MERCHANTS = demoMerchants.slice(0, 5);
const FALLBACK_RECIPIENT = "GvHeQ9NfL7KPLWjXrbgNqE6W5gK4Tz6M3fVhHq7w8Y9Z";
const DEMO_CLUSTER_CENTER = demoMerchants.reduce(
  (accumulator, merchant) => ({
    lat: accumulator.lat + merchant.lat / demoMerchants.length,
    lng: accumulator.lng + merchant.lng / demoMerchants.length,
  }),
  { lat: 0, lng: 0 }
);

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
};

export type DemoLogEvent = {
  id: string;
  sessionId: string;
  step: number;
  layer: "system" | "api" | "ai" | "solana";
  level: "info" | "success" | "warning" | "error";
  title: string;
  detail?: string;
  payload?: unknown;
  timestamp: string;
};

export type DemoCapability = {
  live: boolean;
  mode: "live" | "simulated";
  reason?: string;
};

export type DemoBootstrapData = {
  merchant: {
    id: string;
    name: string;
    wallet: string;
    description?: string | null;
    category: string;
    lat: number;
    lng: number;
  };
  demoWallet: string;
  user: {
    worldVerified: boolean;
    worldNullifier: string | null;
  };
  demoReference: string;
  capabilities: {
    pikoMint: DemoCapability;
    nft: DemoCapability;
  };
  defaults: {
    title: string;
    description: string;
    condition: string;
    rewardAmount: number;
    minSpend: number;
    rewardToken: string;
    lat: number;
    lng: number;
  };
  access: {
    protected: boolean;
  };
  network: {
    cluster: string;
    explorerBaseUrl: string;
  };
};

export type WorldIdProofPayload = {
  userWallet: string;
  nullifier_hash: string;
  proof: string;
  merkle_root: string;
  verification_level?: string;
};

export type WorldIdVerificationData = {
  userId: string;
  worldVerified: boolean;
  nullifierHash: string | null;
  merkleRoot: string;
  verificationLevel: string;
};

export type DemoCreateIncentiveData = {
  merchant: {
    id: string;
    wallet: string;
    name: string;
    description?: string | null;
    category: string;
    lat: number;
    lng: number;
  };
  quest: {
    id: string;
    merchantId: string;
    title: string;
    description: string;
    rewardAmount: number;
    rewardToken: string;
    minSpend: number;
    xpReward: number;
    questType: string;
    expiresAt: string;
    conditions?: Record<string, unknown>;
  };
  merchantReview: {
    merchant: {
      agentName: string;
      decision: {
        isLegit: boolean;
        riskScore: number;
        issues: string[];
      };
      confidence: number;
      reasoning: string;
      timestamp: string;
    };
    approved: boolean;
  };
  paymentReference: string;
};

export type DemoSimulationData = {
  quest: DemoCreateIncentiveData["quest"] & {
    merchant: DemoCreateIncentiveData["merchant"];
  };
  claim: {
    id: string;
    status: string;
    userWallet: string;
    questId: string;
  };
  request: {
    wallet: string;
    lat: number;
    lng: number;
    prevLat?: number;
    prevLng?: number;
    timeDelta?: number;
    gpsAccuracy?: number;
    recentClaims: number;
    walletClaimsToday: number;
    merchantId: string;
    accountAge?: number;
    currentTraffic: number;
    avgTraffic: number;
    timeOfDay: number;
    dayOfWeek: number;
    userLevel: number;
    merchantBalance: number;
  };
  review: {
    fraud: {
      agentName: string;
      decision: {
        score: number;
        flags: string[];
        allow: boolean;
      };
      confidence: number;
      reasoning: string;
      timestamp: string;
    };
    reward: {
      agentName: string;
      decision: {
        multiplier: number;
        adjustedAmount: number;
        reasons: string[];
      };
      confidence: number;
      reasoning: string;
      timestamp: string;
    };
    approved: boolean;
  };
  paymentReference: string;
};

export type DemoSettlementData = {
  quest: DemoSimulationData["quest"];
  request: DemoSimulationData["request"];
  review: DemoSimulationData["review"];
  settlement: {
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
    economicState: {
      vaultBalance: number;
      budgetGuardActive: boolean;
      effectiveMultiplierRange: string;
    };
  };
  blockchain: {
    rewardTx: string | null;
    rewardTxMode: "live" | "simulated";
    explorerUrl: string | null;
    nftMint: string | null;
    nftMetadata?: DecisionReceiptNftMetadata;
    nftMode: "live" | "simulated";
    nftExplorerUrl: string | null;
    txSignature: string | null;
    nftTxSignature: string | null;
  };
  rewardReadout: {
    originalReward: number;
    adjustedReward: number;
    adjustedRewardDisplay: string;
    rewardToken: string;
    multiplier: number;
    reasons: string[];
    aiSummary: string;
  };
};

type BackendQuestPreview = {
  id: string;
  title?: string;
  rewardAmount: number;
  rewardToken?: string;
  questType: string;
  xpReward?: number;
  expiresAt?: string;
  claimedCount?: number;
  maxClaims?: number;
};

type BackendMerchant = {
  id: string;
  wallet?: string;
  name: string;
  description?: string | null;
  category: string;
  lat: number;
  lng: number;
  locationHash?: string | null;
  totalVisits?: number | null;
  conversionRate?: number | null;
  distance?: number;
  quests: BackendQuestPreview[];
};

type BackendQuest = {
  id: string;
  merchantId: string;
  title: string;
  description: string;
  rewardAmount: number;
  rewardToken?: string;
  xpReward?: number;
  minSpend?: number;
  maxClaims?: number;
  claimedCount?: number;
  questType: string;
  expiresAt: string;
  isActive?: boolean;
  onChainId?: string | null;
  distance?: number;
  merchant: {
    id: string;
    wallet?: string;
    name: string;
    description?: string | null;
    category: string;
    lat: number;
    lng: number;
    locationHash?: string | null;
    totalVisits?: number | null;
  };
};

type BackendLeaderboardEntry = {
  wallet: string;
  xp: number;
  rank: number;
  period: string;
  updatedAt?: string;
};

type ClaimStatus =
  | "PENDING"
  | "VERIFIED"
  | "REWARDED"
  | "REJECTED"
  | "EXPIRED"
  | null;

function isUiMerchant(merchant: BackendMerchant | MerchantPinType): merchant is MerchantPinType {
  return "rewardMultiplier" in merchant;
}

function isUiQuest(quest: BackendQuest | QuestDetail): quest is QuestDetail {
  return "requirements" in quest;
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAvatar(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

function getWalletAvatar(wallet: string) {
  const cleaned = wallet.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return (cleaned.slice(0, 2) || "PK").padEnd(2, "O");
}

function getLeaderboardTitle(rank: number) {
  if (rank === 1) return "Top Operator";
  if (rank === 2) return "Growth Lead";
  if (rank === 3) return "Program Analyst";
  if (rank <= 10) return "Protocol Builder";
  return "Network Operator";
}

function buildLeaderboardSparkline(entry: BackendLeaderboardEntry) {
  const seed = entry.wallet
    .split("")
    .reduce((sum, character, index) => sum + character.charCodeAt(0) * (index + 1), 0);
  const periodBias =
    entry.period === "alltime" ? 18 : entry.period === "monthly" ? 12 : 6;
  const xpScale = Math.max(8, Math.min(92, Math.round(Math.log10(entry.xp + 10) * 22)));

  return Array.from({ length: 7 }, (_, index) => {
    const growth = Math.round((xpScale * (index + 2)) / 8);
    const wobble = ((seed >> (index % 8)) & 3) * 2;
    return Math.max(4, growth + periodBias - entry.rank + wobble);
  });
}

function normalizeLeaderboardEntry(
  entry: BackendLeaderboardEntry | LeaderboardEntry
): LeaderboardEntry {
  if ("sparkline" in entry && Array.isArray(entry.sparkline)) {
    return {
      ...entry,
      sparkline: entry.sparkline.length > 0 ? entry.sparkline : buildLeaderboardSparkline(entry),
    };
  }

  return {
    wallet: entry.wallet,
    xp: entry.xp,
    rank: entry.rank,
    period: entry.period,
    avatar: getWalletAvatar(entry.wallet),
    title: getLeaderboardTitle(entry.rank),
    delta: 0,
    sparkline: buildLeaderboardSparkline(entry),
    streak: Math.max(1, Math.min(30, 3 + Math.round(entry.xp / 500))),
  };
}

function deriveRewardMultiplier(rewardAmount: number) {
  return Number(Math.max(1.2, rewardAmount / 0.35).toFixed(1));
}

function distanceBetweenMeters(
  left: { lat: number; lng: number },
  right: { lat: number; lng: number }
) {
  const earthRadius = 6_371_000;
  const latDelta = ((right.lat - left.lat) * Math.PI) / 180;
  const lngDelta = ((right.lng - left.lng) * Math.PI) / 180;
  const leftLat = (left.lat * Math.PI) / 180;
  const rightLat = (right.lat * Math.PI) / 180;

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function projectFallbackMerchants(lat: number, lng: number): MerchantPinType[] {
  return FALLBACK_MERCHANTS.map((merchant) => {
    const projected = {
      ...merchant,
      lat: lat + (merchant.lat - DEMO_CLUSTER_CENTER.lat),
      lng: lng + (merchant.lng - DEMO_CLUSTER_CENTER.lng),
    };

    return {
      ...projected,
      distance: distanceBetweenMeters({ lat, lng }, projected),
      district: "Demo merchant district",
      vibe: `${merchant.vibe} near your current location`,
    };
  }).sort((left, right) => (left.distance ?? Number.MAX_SAFE_INTEGER) - (right.distance ?? Number.MAX_SAFE_INTEGER));
}

function normalizeQuestPreview(quest: BackendQuestPreview | QuestPreview): QuestPreview {
  return {
    id: quest.id,
    title: quest.title ?? "Merchant quest",
    rewardAmount: quest.rewardAmount,
    rewardToken: quest.rewardToken ?? "PIKO",
    questType: toTitleCase(quest.questType),
    xpReward: quest.xpReward ?? 10,
    expiresAt: quest.expiresAt,
    claimedCount: quest.claimedCount ?? 0,
    maxClaims: quest.maxClaims ?? 100,
  };
}

function normalizeMerchant(merchant: BackendMerchant | MerchantPinType): MerchantPinType {
  if (isUiMerchant(merchant)) {
    return merchant;
  }

  const quests = merchant.quests.map(normalizeQuestPreview);
  const topReward = Math.max(...quests.map((quest) => quest.rewardAmount), 0.4);
  const totalVisits = merchant.totalVisits ?? 0;

  return {
    id: merchant.id,
    wallet: merchant.wallet ?? FALLBACK_RECIPIENT,
    name: merchant.name,
    lat: merchant.lat,
    lng: merchant.lng,
    rewardMultiplier: deriveRewardMultiplier(topReward),
    category: toTitleCase(merchant.category),
    district: `${toTitleCase(merchant.category)} district`,
    vibe: merchant.description?.trim() || `${toTitleCase(merchant.category)} merchant program cluster`,
    isSponsored: quests.some((quest) => quest.questType.toUpperCase() === "SPONSORED"),
    isTrending: totalVisits >= 20,
    distance: merchant.distance,
    totalVisits,
    rewardPool: Number((Math.max(24, topReward * 100 + totalVisits * 0.6)).toFixed(0)),
    hotspotScore: Math.min(99, Math.max(52, Math.round(topReward * 60 + totalVisits * 0.35))),
    avatar: getAvatar(merchant.name),
    quests,
  };
}

function normalizeStatusSteps(status: ClaimStatus) {
  const claimed = status === "PENDING" || status === "VERIFIED" || status === "REWARDED";
  const paying = status === "VERIFIED" || status === "REWARDED";
  const rewarded = status === "REWARDED";

  return [
    { label: "Ready", state: "complete" as const },
    { label: "Claimed", state: claimed ? ("complete" as const) : ("active" as const) },
    { label: "Paying", state: paying ? ("complete" as const) : claimed ? ("active" as const) : ("locked" as const) },
    { label: "Rewarded", state: rewarded ? ("complete" as const) : ("locked" as const) },
  ];
}

function normalizeQuest(quest: BackendQuest | QuestDetail, claimStatus: ClaimStatus = null): QuestDetail {
  if (isUiQuest(quest)) {
    return quest;
  }

  const rewardAmount = quest.rewardAmount;
  const claimedCount = quest.claimedCount ?? 0;
  const maxClaims = quest.maxClaims ?? 100;
  const progress = maxClaims > 0 ? claimedCount / maxClaims : 0;
  const questType = toTitleCase(quest.questType);
  const merchantCategory = toTitleCase(quest.merchant.category);

  return {
    id: quest.id,
    merchantId: quest.merchantId,
    title: quest.title,
    description: quest.description,
    rewardAmount,
    rewardToken: quest.rewardToken ?? "PIKO",
    xpReward: quest.xpReward ?? 10,
    minSpend: quest.minSpend ?? Math.max(1, rewardAmount * 10),
    maxClaims,
    claimedCount,
    questType,
    expiresAt: quest.expiresAt,
    multiplier: deriveRewardMultiplier(rewardAmount),
    bonusWindow: "Reward settles immediately after backend verification.",
    badgeReward: `${quest.merchant.name} Proof of Play`,
    claimVelocity: Math.max(12, Math.min(99, Math.round(progress * 100))),
    merchant: {
      id: quest.merchant.id,
      wallet: quest.merchant.wallet ?? FALLBACK_RECIPIENT,
      name: quest.merchant.name,
      category: merchantCategory,
      lat: quest.merchant.lat,
      lng: quest.merchant.lng,
      distance: quest.distance ?? 120,
      district: `${merchantCategory} district`,
      vibe: quest.merchant.description?.trim() || `${merchantCategory} merchant in the live network`,
    },
    requirements: [
      {
        id: "req-claim",
        label: "Open the incentive in the merchant zone",
        done: claimStatus === "PENDING" || claimStatus === "VERIFIED" || claimStatus === "REWARDED",
        hint: "Claim is created when you generate the payment request",
      },
      {
        id: "req-pay",
        label: `Pay at least ${Math.max(0.001, Number(((quest.minSpend ?? rewardAmount) / 1000).toFixed(3)))} SOL on devnet`,
        done: claimStatus === "VERIFIED" || claimStatus === "REWARDED",
        hint: "QR, deep link, or connected wallet transfer",
      },
      {
        id: "req-verify",
        label: "Wait for backend verification and PIKO settlement",
        done: claimStatus === "REWARDED",
        hint: "The reference key is matched on devnet before PIKO is settled",
      },
    ],
    statusSteps: normalizeStatusSteps(claimStatus),
  };
}

async function request<T>(path: string, init?: RequestInit, fallback?: T): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    const payload = (await response.json()) as ApiEnvelope<T>;

    if (!response.ok || payload.success === false || payload.data === undefined) {
      throw new Error(payload.message || payload.error || `Request failed for ${path}`);
    }

    return payload.data;
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

function buildDemoQuery(input: { sessionId: string; key?: string }) {
  const params = new URLSearchParams({ sessionId: input.sessionId });

  if (input.key) {
    params.set("key", input.key);
  }

  return params.toString();
}

export function buildDemoStreamUrl(input: { sessionId: string; key?: string }) {
  return `${API_URL}/api/demo/stream?${buildDemoQuery(input)}`;
}

export async function getNearbyMerchants(lat: number, lng: number, radius = 1500) {
  const data = await request<{
    merchants: Array<BackendMerchant | MerchantPinType>;
    heatmapData?: HeatmapNode[];
  }>(
    `/api/merchants/nearby?lat=${lat}&lng=${lng}&radius=${radius}&filter=all`,
    undefined,
    {
      merchants: FALLBACK_MERCHANTS,
      heatmapData: FALLBACK_MERCHANTS.map((merchant) => ({
        lat: merchant.lat,
        lng: merchant.lng,
        weight: Math.min(merchant.rewardMultiplier / 3, 1),
      })),
    }
  );

  const merchants = data.merchants
    .map(normalizeMerchant)
    .sort((left, right) => (left.distance ?? Number.MAX_SAFE_INTEGER) - (right.distance ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 5);

  const resolvedMerchants = merchants.length > 0 ? merchants : projectFallbackMerchants(lat, lng);

  const heatmapData =
    data.heatmapData && data.heatmapData.length > 0
      ? data.heatmapData.slice(0, resolvedMerchants.length)
      : resolvedMerchants.map((merchant) => ({
          lat: merchant.lat,
          lng: merchant.lng,
          weight: Math.min(merchant.rewardMultiplier / 3, 1),
        }));

  return { merchants: resolvedMerchants, heatmapData };
}

export async function getQuest(questId: string, wallet?: string) {
  const query = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
  const data = await request<{ quest: BackendQuest | QuestDetail; claimStatus?: ClaimStatus }>(
    `/api/quests/${questId}${query}`
  );

  return {
    quest: normalizeQuest(data.quest, data.claimStatus ?? null),
    claimStatus: data.claimStatus ?? null,
  };
}

export async function getNearbyQuests(lat: number, lng: number, radius = 5000) {
  const data = await request<{ quests: BackendQuest[] }>(
    `/api/quests/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
  );

  return data.quests.map((quest) => normalizeQuest(quest, null));
}

export async function getLeaderboard(period = "weekly") {
  const data = await request<{ entries: Array<BackendLeaderboardEntry | LeaderboardEntry>; userRank?: number | null }>(
    `/api/leaderboard?period=${period}&limit=20`,
    undefined,
    {
      entries: getDemoLeaderboard(period),
      userRank: getDemoLeaderboard(period).find((entry) => entry.isCurrentUser)?.rank ?? 9,
    }
  );

  return {
    ...data,
    entries: data.entries.map(normalizeLeaderboardEntry),
  };
}

export async function getUser(wallet: string) {
  return request<{ user: UserProfile; recentActivity: unknown[] }>(
    `/api/user/${wallet}`,
    undefined,
    { user: demoUser, recentActivity: demoUser.recentActivity }
  );
}

export async function createPaymentRequest(input: {
  merchantId: string;
  amount: number;
  questId?: string;
  wallet: string;
}) {
  return request<{ url: string; reference: string }>(
    "/api/payments/create-request",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function getPaymentStatus(reference: string) {
  return request<{ found: boolean; signature: string | null }>(
    `/api/payments/status/${reference}`,
    undefined,
    { found: false, signature: null }
  );
}

export async function verifyPayment(input: {
  reference: string;
  paymentSignature?: string;
  questId?: string;
  wallet?: string;
  lat?: number;
  lng?: number;
  gpsAccuracy?: number;
}) {
  return request<{
      verified: boolean;
      txSignature: string | null;
      approved?: boolean;
      worldVerified?: boolean;
      worldIdVerified?: boolean;
      decision?: "APPROVED" | "REJECTED";
      rewardAmount?: number;
      rewardToken?: string;
      rewardMultiplier?: number;
      aiSummary?: string;
      fraudScore?: number;
      fraudFlags?: string[];
      distanceMeters?: number;
      gpsAccuracy?: number;
      economicState?: QuestCompletionReceipt["economicState"];
      xpEarned?: number;
      newLevel?: number;
      transactionId?: string;
      rewardAmountBaseUnits?: string;
      rewardAmountDisplay?: string;
      nftMint?: string | null;
      nftMetadata?: DecisionReceiptNftMetadata;
  }>(
    "/api/payments/verify",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function completeQuest(input: {
  questId: string;
  reference: string;
  paymentSignature?: string;
  wallet: string;
  lat: number;
  lng: number;
  gpsAccuracy: number;
}) {
  return request<QuestCompletionReceipt>(
    "/api/quests/complete",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function claimQuest(input: {
  questId: string;
  wallet: string;
  lat: number;
  lng: number;
  gpsAccuracy: number;
}) {
  return request<{ claimId: string; status: string }>(
    `/api/quests/${input.questId}/claim`,
    {
      method: "POST",
      body: JSON.stringify({
        wallet: input.wallet,
        lat: input.lat,
        lng: input.lng,
        gpsAccuracy: input.gpsAccuracy,
      }),
    }
  );
}

export async function verifyWorldId(input: WorldIdProofPayload) {
  return request<WorldIdVerificationData>(
    "/api/verify-world-id",
    { method: "POST", body: JSON.stringify(input) },
    {
      userId: "demo-user",
      worldVerified: true,
      nullifierHash: input.nullifier_hash,
      merkleRoot: input.merkle_root,
      verificationLevel: input.verification_level ?? "orb",
    }
  );
}

export async function getSuggestions(lat: number, lng: number) {
  return request<{ suggestions: MapSuggestion[] }>(
    "/api/ai/suggest",
    { method: "POST", body: JSON.stringify({ lat, lng }) },
    { suggestions: demoSuggestions }
  );
}

export async function getAiDecision(reference: string) {
  return request<AIDecisionSummary>(`/api/ai/decision/${encodeURIComponent(reference)}`);
}



export async function bootstrapDemoSession(input: { sessionId: string; key?: string }) {
  return request<DemoBootstrapData>(`/api/demo/bootstrap?${buildDemoQuery(input)}`);
}

export async function createDemoIncentive(input: {
  sessionId: string;
  key?: string;
  title: string;
  description: string;
  condition: string;
  rewardAmount: number;
  rewardToken?: string;
  minSpend: number;
  lat: number;
  lng: number;
}) {
  return request<DemoCreateIncentiveData>("/api/demo/create-incentive", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function simulateDemoAction(input: {
  sessionId: string;
  key?: string;
  questId: string;
  wallet: string;
  lat: number;
  lng: number;
  gpsAccuracy: number;
  forceReject?: boolean;
}) {
  return request<DemoSimulationData>("/api/demo/simulate-action", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function settleDemoReward(input: {
  sessionId: string;
  key?: string;
  questId: string;
  wallet: string;
  lat: number;
  lng: number;
  gpsAccuracy: number;
  forceReject?: boolean;
}) {
  return request<DemoSettlementData>("/api/demo/settle", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
