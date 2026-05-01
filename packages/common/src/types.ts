// ═══════════════════════════════════════════════════════════
// @depokemongo/common — Shared Types
// ═══════════════════════════════════════════════════════════

// ──── Merchant ────
export enum Category {
  CAFE = "CAFE",
  RESTAURANT = "RESTAURANT",
  RETAIL = "RETAIL",
  GROCERY = "GROCERY",
  ENTERTAINMENT = "ENTERTAINMENT",
  FITNESS = "FITNESS",
  BEAUTY = "BEAUTY",
  OTHER = "OTHER",
}

export interface Merchant {
  id: string;
  wallet: string;
  name: string;
  description?: string;
  category: Category;
  lat: number;
  lng: number;
  locationHash: string;
  imageUrl?: string;
  isVerified: boolean;
  stakeAmount: number;
  rating: number;
  totalVisits: number;
  conversionRate: number;
  isActive: boolean;
  createdAt: string;
}

// ──── Quest ────
export enum QuestType {
  VISIT = "VISIT",
  PURCHASE = "PURCHASE",
  REPEAT = "REPEAT",
  CHAIN = "CHAIN",
  SPONSORED = "SPONSORED",
}

export enum ClaimStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REWARDED = "REWARDED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

export interface Quest {
  id: string;
  merchantId: string;
  title: string;
  description: string;
  rewardAmount: number;
  rewardToken: string;
  xpReward: number;
  minSpend: number;
  maxClaims: number;
  claimedCount: number;
  questType: QuestType;
  conditions?: Record<string, unknown>;
  expiresAt: string;
  isActive: boolean;
  onChainId?: string;
  createdAt: string;
}

export interface QuestWithMerchant extends Quest {
  merchant: Merchant;
  distance?: number; // meters from user
}

export interface QuestClaim {
  id: string;
  questId: string;
  userWallet: string;
  txSignature?: string;
  status: ClaimStatus;
  claimedAt: string;
  verifiedAt?: string;
}

// ──── User ────
export interface User {
  id: string;
  wallet: string;
  displayName?: string;
  avatarUrl?: string;
  xp: number;
  level: number;
  totalRewards: number;
  questsCompleted: number;
  streak: number;
  lastActiveAt: string;
}

export interface Badge {
  id: string;
  userId: string;
  name: string;
  description: string;
  imageUrl: string;
  nftMint?: string;
  earnedAt: string;
}

// ──── Leaderboard ────
export type LeaderboardPeriod = "weekly" | "monthly" | "alltime";

export interface LeaderboardEntry {
  wallet: string;
  displayName?: string;
  xp: number;
  rank: number;
  period: LeaderboardPeriod;
}

// ──── Payment ────
export interface PaymentRequest {
  merchantId: string;
  amount: number;
  questId?: string;
}

export interface PaymentResponse {
  url: string; // Solana Pay URL
  reference: string; // Reference public key
}

export interface PaymentVerification {
  txSignature: string;
  reference: string;
}

export interface PaymentResult {
  verified: boolean;
  rewardAmount?: number;
}

// ──── AI ────
export interface AISuggestion {
  merchantId: string;
  merchantName: string;
  distance: number; // meters
  rewardAmount: number;
  reasoning: string;
  confidence: number; // 0-1
}

export interface FraudCheckInput {
  wallet: string;
  lat: number;
  lng: number;
  prevLat?: number;
  prevLng?: number;
  timeDelta?: number;
  merchantId: string;
  txSignature?: string;
  gpsAccuracy?: number;
}

export interface FraudCheckResult {
  score: number; // 0-100
  flags: string[];
  allow: boolean;
}

// ──── Map / Geo ────
export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface HeatmapPoint extends GeoPoint {
  weight: number;
}

export type MerchantFilter = "all" | "reward_active" | "sponsored" | "trending";

// ──── API Response Wrappers ────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ──── WebSocket Events ────
export enum WsEvent {
  SUBSCRIBE_LOCATION = "ws:subscribe:location",
  SUBSCRIBE_QUEST = "ws:subscribe:quest",
  MERCHANTS_UPDATE = "ws:merchants:update",
  QUEST_CLAIMED = "ws:quest:claimed",
  LEADERBOARD_UPDATE = "ws:leaderboard:update",
  REWARD_RECEIVED = "ws:reward:received",
}
