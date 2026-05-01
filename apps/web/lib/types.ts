export type QuestPreview = {
  id: string;
  title: string;
  rewardAmount: number;
  rewardToken: string;
  questType: string;
  xpReward: number;
  expiresAt?: string;
  claimedCount?: number;
  maxClaims?: number;
};

export type MerchantPinType = {
  id: string;
  wallet: string;
  name: string;
  lat: number;
  lng: number;
  rewardMultiplier: number;
  category: string;
  district: string;
  vibe: string;
  isSponsored: boolean;
  isTrending: boolean;
  distance?: number;
  totalVisits?: number;
  rewardPool: number;
  hotspotScore: number;
  avatar: string;
  quests: QuestPreview[];
};

export type QuestRequirement = {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
};

export type QuestStatusStep = {
  label: string;
  state: "complete" | "active" | "locked";
};

export type QuestDetail = {
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
  questType: string;
  expiresAt: string;
  multiplier: number;
  bonusWindow: string;
  badgeReward: string;
  claimVelocity: number;
  merchant: {
    id: string;
    wallet: string;
    name: string;
    category: string;
    lat: number;
    lng: number;
    distance: number;
    district: string;
    vibe: string;
  };
  requirements: QuestRequirement[];
  statusSteps: QuestStatusStep[];
};

export type LeaderboardEntry = {
  wallet: string;
  xp: number;
  rank: number;
  period: string;
  avatar: string;
  title: string;
  delta: number;
  sparkline: number[];
  streak: number;
  isCurrentUser?: boolean;
};

export type UserBadge = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  rarity: string;
  earnedAt: string;
  icon: string;
};

export type ActivityItem = {
  id: string;
  type: "reward" | "quest" | "badge" | "streak";
  title: string;
  detail: string;
  timestamp: string;
};

export type UserProfile = {
  wallet: string;
  worldVerified?: boolean;
  worldNullifier?: string | null;
  xp: number;
  level: number;
  totalRewards: number;
  questsCompleted: number;
  streak: number;
  nextLevelXp: number;
  solBalance: number;
  pikoBalance: number;
  rewardsThisWeek: number;
  levelTitle: string;
  badges?: UserBadge[];
  recentActivity: ActivityItem[];
};

export type HeatmapNode = {
  lat: number;
  lng: number;
  weight: number;
};

export type MapSuggestion = {
  merchantName: string;
  reasoning: string;
  confidence: number;
};
