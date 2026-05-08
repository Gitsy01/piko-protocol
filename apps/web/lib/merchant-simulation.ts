// ═══════════════════════════════════════════════════════════
// Cafe Bloom — Realistic Merchant Simulation Engine
// ═══════════════════════════════════════════════════════════
//
// This module powers the "merchant acquisition demo" that
// shows judges how PIKO Protocol economics work from the
// merchant's perspective — budgets, slow-hour multipliers,
// reward drain curves, and real transaction flow.

export type MenuItem = {
  id: string;
  name: string;
  price: number;         // ₹ INR
  priceUsd: number;      // approximate USD
  category: "coffee" | "food" | "specialty" | "dessert";
  popular: boolean;
  pikoEligible: boolean; // only eligible items earn rewards
  image?: string;
};

export type HourlyTrafficPoint = {
  hour: number;          // 0–23
  visitors: number;
  avgSpend: number;      // ₹
  rewardsClaimed: number;
  multiplier: number;    // reward multiplier at this hour
  isSlowHour: boolean;
};

export type TransactionRecord = {
  id: string;
  timestamp: Date;
  customerWallet: string;
  menuItem: string;
  amountInr: number;
  amountSol: number;
  pikoRewarded: number;
  multiplierApplied: number;
  fraudScore: number;
  status: "settled" | "rejected" | "pending";
  rejectReason?: string;   // short label
  rejectReasons?: string[]; // detailed flag list shown in UI
};

export type MerchantEconomics = {
  dailyBudgetPiko: number;
  budgetSpentToday: number;
  budgetRemaining: number;
  budgetUtilization: number;  // 0–1
  slowHourStart: number;      // 14 (2PM)
  slowHourEnd: number;        // 17 (5PM)
  baseMultiplier: number;
  slowHourMultiplier: number;
  currentMultiplier: number;
  isSlowHourNow: boolean;
  avgCostPerAcquisition: number; // PIKO per new customer
  repeatVisitRate: number;       // %
  rewardToRevenueRatio: number;  // cost efficiency
  totalCustomersToday: number;
  uniqueCustomersToday: number;
  projectedBudgetExhaustion: string; // time string
  // ROI metrics — the numbers that prove merchant value
  revenueGeneratedInr: number;   // ₹ total spend attributed to PIKO campaigns
  cacInr: number;                // Cost-per-acquisition in ₹
  lifetimeValueInr: number;      // estimated LTV per repeat customer
  networkRoiX: number;           // revenue ÷ PIKO budget spend (as multiplier)
  fraudRejectedCount: number;    // transactions blocked by anti-cheat
  fraudSavedPiko: number;        // PIKO that would have leaked if no fraud guard
};

export type CafeBloomProfile = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  address: string;
  district: string;
  city: string;
  lat: number;
  lng: number;
  wallet: string;
  rating: number;
  reviewCount: number;
  operatingHours: string;
  foundedYear: number;
  logoUrl: string;
  interiorUrl: string;
  menuPhotoUrl: string;
  socialLinks: { instagram: string; google: string };
  tags: string[];
};

type TransactionHistoryOptions = {
  now?: Date;
  seed?: number;
};

type EconomicsOptions = {
  now?: Date;
};

export const DEMO_REFERENCE_TIME_ISO = "2026-05-07T13:30:00+05:30";
export const DEMO_SIMULATION_SEED = 424242;

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function getDemoReferenceTime() {
  return new Date(DEMO_REFERENCE_TIME_ISO);
}

// ── Menu ─────────────────────────────────────────────────

export const cafeBloomMenu: MenuItem[] = [
  { id: "cb-latte",      name: "Bloom Signature Latte",   price: 280, priceUsd: 3.35, category: "coffee",    popular: true,  pikoEligible: true },
  { id: "cb-espresso",   name: "Double Espresso",         price: 180, priceUsd: 2.15, category: "coffee",    popular: false, pikoEligible: true },
  { id: "cb-cappuccino", name: "Oat Milk Cappuccino",     price: 260, priceUsd: 3.10, category: "coffee",    popular: true,  pikoEligible: true },
  { id: "cb-cold-brew",  name: "24h Cold Brew",           price: 300, priceUsd: 3.60, category: "coffee",    popular: true,  pikoEligible: true },
  { id: "cb-matcha",     name: "Ceremonial Matcha Bowl",  price: 320, priceUsd: 3.85, category: "specialty", popular: true,  pikoEligible: true },
  { id: "cb-chai",       name: "Masala Chai",             price: 120, priceUsd: 1.45, category: "coffee",    popular: false, pikoEligible: true },
  { id: "cb-avotoast",   name: "Avocado Toast",           price: 350, priceUsd: 4.20, category: "food",      popular: true,  pikoEligible: true },
  { id: "cb-croissant",  name: "Butter Croissant",        price: 180, priceUsd: 2.15, category: "food",      popular: false, pikoEligible: true },
  { id: "cb-granola",    name: "Açaí Granola Bowl",       price: 380, priceUsd: 4.55, category: "food",      popular: true,  pikoEligible: true },
  { id: "cb-sandwich",   name: "Grilled Panini",          price: 320, priceUsd: 3.85, category: "food",      popular: false, pikoEligible: true },
  { id: "cb-brownie",    name: "Dark Chocolate Brownie",  price: 200, priceUsd: 2.40, category: "dessert",   popular: false, pikoEligible: true },
  { id: "cb-cheesecake", name: "Baked Cheesecake Slice",  price: 280, priceUsd: 3.35, category: "dessert",   popular: true,  pikoEligible: true },
];

// ── Profile ──────────────────────────────────────────────

export const cafeBloomProfile: CafeBloomProfile = {
  id: "demo-cafe-bloom",
  name: "Cafe Bloom",
  tagline: "Third-wave coffee · Connaught Place",
  description:
    "Cafe Bloom is a specialty coffee house in the heart of Connaught Place, New Delhi. Known for single-origin pour-overs, plant-based pastries, and a workspace-friendly vibe. One of the first merchants on the PIKO Protocol incentive network — using programmable rewards to fill slow afternoon hours.",
  category: "Cafe & Specialty Coffee",
  address: "B-14, Inner Circle, Connaught Place",
  district: "Connaught Place",
  city: "New Delhi",
  lat: 28.6139,
  lng: 77.209,
  wallet: "6g7B1nVfD9yB4h3mK2p8QwX4JcN7sLr5TzUa9Fh2PkLm",
  rating: 4.6,
  reviewCount: 328,
  operatingHours: "8:00 AM – 10:00 PM",
  foundedYear: 2022,
  logoUrl: "/merchant/cafe-bloom/logo.png",
  interiorUrl: "/merchant/cafe-bloom/interior.png",
  menuPhotoUrl: "/merchant/cafe-bloom/menu.png",
  socialLinks: {
    instagram: "cafeblooom.cp",
    google: "cafe-bloom-connaught-place",
  },
  tags: ["Single Origin", "Plant-Based", "Workspace", "Crypto-Friendly", "PIKO Merchant"],
};

// ── Hourly Traffic Pattern ───────────────────────────────

export function generateHourlyTraffic(): HourlyTrafficPoint[] {
  // Realistic cafe traffic: morning rush, lunch bump, afternoon dip, evening peak
  const pattern = [
    { hour: 8,  visitors: 18, avgSpend: 240, claimed: 6,  mult: 1.0, slow: false },
    { hour: 9,  visitors: 34, avgSpend: 280, claimed: 12, mult: 1.0, slow: false },
    { hour: 10, visitors: 42, avgSpend: 310, claimed: 18, mult: 1.0, slow: false },
    { hour: 11, visitors: 38, avgSpend: 340, claimed: 14, mult: 1.0, slow: false },
    { hour: 12, visitors: 48, avgSpend: 390, claimed: 22, mult: 1.0, slow: false },
    { hour: 13, visitors: 44, avgSpend: 360, claimed: 18, mult: 1.0, slow: false },
    { hour: 14, visitors: 16, avgSpend: 220, claimed: 4,  mult: 1.4, slow: true  },
    { hour: 15, visitors: 12, avgSpend: 200, claimed: 3,  mult: 1.4, slow: true  },
    { hour: 16, visitors: 14, avgSpend: 210, claimed: 5,  mult: 1.4, slow: true  },
    { hour: 17, visitors: 22, avgSpend: 270, claimed: 8,  mult: 1.1, slow: false },
    { hour: 18, visitors: 36, avgSpend: 320, claimed: 14, mult: 1.0, slow: false },
    { hour: 19, visitors: 40, avgSpend: 350, claimed: 16, mult: 1.0, slow: false },
    { hour: 20, visitors: 28, avgSpend: 300, claimed: 10, mult: 1.0, slow: false },
    { hour: 21, visitors: 14, avgSpend: 250, claimed: 4,  mult: 1.2, slow: false },
  ];

  return pattern.map((p) => ({
    hour: p.hour,
    visitors: p.visitors,
    avgSpend: p.avgSpend,
    rewardsClaimed: p.claimed,
    multiplier: p.mult,
    isSlowHour: p.slow,
  }));
}

// ── Transaction History ──────────────────────────────────

const WALLET_FRAGMENTS = [
  "7N6Q...1KxP", "8rV2...9LMt", "5Pkx...4vUn", "3Lzm...7QeR",
  "9Bcd...2FwN", "4Hjn...6TpK", "2Wxy...8GsJ", "6Mnp...3HrV",
  "1Qrs...5DkL", "4AbC...8XyZ", "7FgH...2JkL", "3MnO...9PqR",
];

// Fraud rejection reasons mapped to human-readable explanations
const REJECT_REASON_SETS = [
  {
    summary: "GPS mismatch · Impossible travel detected · Fraud score: 72/100",
    flags: [
      "GPS signal outside merchant geofence (318m drift)",
      "Impossible travel: 2 claims in <4 min across 12km",
      "Fraud score 72/100 — above threshold of 60",
    ],
  },
  {
    summary: "Wallet velocity spike · Device pattern mismatch · Fraud score: 81/100",
    flags: [
      "Wallet submitted 9 claims in 45 minutes (limit: 10/hr)",
      "Device fingerprint mismatch vs. previous session",
      "Fraud score 81/100 — automatic hold triggered",
    ],
  },
  {
    summary: "New account burst · No prior visit history · Fraud score: 68/100",
    flags: [
      "Account created <2 hours before claim attempt",
      "No prior verified visit history on this wallet",
      "Fraud score 68/100 — exceeds threshold of 60",
    ],
  },
];

export function generateTransactionHistory(count = 24, options: TransactionHistoryOptions = {}): TransactionRecord[] {
  const rng = createSeededRandom(options.seed ?? DEMO_SIMULATION_SEED);
  const now = (options.now ?? getDemoReferenceTime()).getTime();
  const records: TransactionRecord[] = [];

  for (let i = 0; i < count; i++) {
    const minutesAgo = i * (15 + Math.floor(rng() * 30));
    const timestamp = new Date(now - minutesAgo * 60_000);
    const hour = timestamp.getHours();
    const isSlowHour = hour >= 14 && hour < 17;
    const multiplier = isSlowHour ? 1.4 : 1.0;
    const item = cafeBloomMenu[Math.floor(rng() * cafeBloomMenu.length)];
    // Seed specific rejections at indices 7, 14, 20 for variety
    const baseScore = Math.floor(rng() * 28);
    const fraudScore = (i === 7 || i === 14 || i === 20) ? 65 + Math.floor(rng() * 25) : baseScore;
    const isRejected = fraudScore > 60;
    const basePikoReward = item.pikoEligible ? +(item.priceUsd * 0.08 * multiplier).toFixed(2) : 0;
    const rejectSet = REJECT_REASON_SETS[i % REJECT_REASON_SETS.length];

    records.push({
      id: `tx-${i.toString().padStart(3, "0")}`,
      timestamp,
      customerWallet: WALLET_FRAGMENTS[i % WALLET_FRAGMENTS.length],
      menuItem: item.name,
      amountInr: item.price,
      amountSol: +(item.priceUsd / 180).toFixed(4),
      pikoRewarded: isRejected ? 0 : basePikoReward,
      multiplierApplied: isRejected ? 0 : multiplier,
      fraudScore,
      status: isRejected ? "rejected" : "settled",
      rejectReason: isRejected ? rejectSet.summary : undefined,
      rejectReasons: isRejected ? rejectSet.flags : undefined,
    });
  }

  return records;
}

// ── Economics Dashboard State ────────────────────────────

export function computeEconomics(transactions: TransactionRecord[], options: EconomicsOptions = {}): MerchantEconomics {
  const dailyBudget = 500; // PIKO/day
  const settled = transactions.filter((tx) => tx.status === "settled");
  const rejected = transactions.filter((tx) => tx.status === "rejected");
  const totalSpent = settled.reduce((sum, tx) => sum + tx.pikoRewarded, 0);
  const remaining = Math.max(0, dailyBudget - totalSpent);
  const uniqueWallets = new Set(settled.map((t) => t.customerWallet));

  const now = options.now ?? getDemoReferenceTime();
  const hour = now.getHours();
  const isSlowHour = hour >= 14 && hour < 17;

  const settledCount = settled.length;
  const avgCpa = settledCount > 0 ? +(totalSpent / settledCount).toFixed(2) : 0;

  // Revenue: sum of actual INR spend on settled transactions
  const revenueInr = settled.reduce((sum, tx) => sum + tx.amountInr, 0);

  // CAC in INR: reward budget cost per acquired customer
  // PIKO is priced at ~₹41/token (example market rate for demo)
  const pikoInrRate = 41;
  const rewardBudgetInr = totalSpent * pikoInrRate;
  const cacInr = uniqueWallets.size > 0 ? Math.round(rewardBudgetInr / uniqueWallets.size) : 0;

  // LTV: repeat visits contribute avg ₹290/visit × 34% repeat rate × avg 3.2 visits/quarter
  const lifetimeValueInr = Math.round(290 * 3.2 * 1.12); // ~₹1,040

  // ROI: revenue generated per ₹1 of reward spend
  const networkRoiX = rewardBudgetInr > 0 ? +(revenueInr / rewardBudgetInr).toFixed(1) : 0;

  // Fraud savings: PIKO that would have leaked without the anti-cheat guard
  const fraudSavedPiko = +(rejected.reduce((sum, tx) => sum + (tx.amountInr * 0.08 * 0.034), 0)).toFixed(2);

  // Budget exhaustion projection
  const hoursElapsed = Math.max(1, hour - 8);
  const burnRate = totalSpent / hoursElapsed;
  const hoursUntilEmpty = burnRate > 0 ? remaining / burnRate : 99;
  const exhaustionHour = Math.min(22, hour + Math.ceil(hoursUntilEmpty));
  const exhaustionTime =
    remaining <= 0
      ? "Budget exhausted"
      : `~${exhaustionHour > 12 ? exhaustionHour - 12 : exhaustionHour}:00 ${exhaustionHour >= 12 ? "PM" : "AM"}`;

  return {
    dailyBudgetPiko: dailyBudget,
    budgetSpentToday: +totalSpent.toFixed(2),
    budgetRemaining: +remaining.toFixed(2),
    budgetUtilization: +(totalSpent / dailyBudget).toFixed(3),
    slowHourStart: 14,
    slowHourEnd: 17,
    baseMultiplier: 1.0,
    slowHourMultiplier: 1.4,
    currentMultiplier: isSlowHour ? 1.4 : 1.0,
    isSlowHourNow: isSlowHour,
    avgCostPerAcquisition: avgCpa,
    repeatVisitRate: 34,
    rewardToRevenueRatio: 0.08,
    totalCustomersToday: settledCount,
    uniqueCustomersToday: uniqueWallets.size,
    projectedBudgetExhaustion: exhaustionTime,
    revenueGeneratedInr: revenueInr,
    cacInr,
    lifetimeValueInr,
    networkRoiX,
    fraudRejectedCount: rejected.length,
    fraudSavedPiko,
  };
}

export function buildMerchantSimulationSnapshot(count = 24) {
  const now = getDemoReferenceTime();
  const transactions = generateTransactionHistory(count, {
    now,
    seed: DEMO_SIMULATION_SEED,
  });

  return {
    now,
    transactions,
    economics: computeEconomics(transactions, { now }),
  };
}

// ── Format helpers ───────────────────────────────────────

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatTimeAgo(date: Date, now = getDemoReferenceTime()): string {
  const mins = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}
