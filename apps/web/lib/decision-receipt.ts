export type DecisionReceiptNftMetadata = {
  fraud_score: string;
  payment_verified: string;
  location_verified: string;
  reward_multiplier: string;
  merchant: string;
  visit_date: string;
  world_id_verified?: string;
};

export type DecisionReceiptEconomicState = {
  vaultBalance: number;
  budgetGuardActive: boolean;
  effectiveMultiplierRange: string;
};

export type DecisionReceiptData = {
  worldIdVerified: boolean;
  txSignature: string | null;
  distanceMeters: number;
  gpsAccuracy: number;
  fraudScore: number;
  fraudFlags: string[];
  aiSummary: string;
  approved: boolean;
  rewardAmount: number;
  rewardToken: string;
  rewardMultiplier: number;
  economicState: DecisionReceiptEconomicState;
  nftMint?: string | null;
  nftMetadata?: DecisionReceiptNftMetadata;
};

export type QuestCompletionReceipt = DecisionReceiptData & {
  verified: boolean;
  worldVerified: boolean;
  decision: "APPROVED" | "REJECTED";
  rewardAmountBaseUnits: string;
  rewardAmountDisplay: string;
  xpEarned: number;
  newLevel: number;
  transactionId: string;
};
