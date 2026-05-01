import { AgentDecision, BaseAgent } from "./agents/base.agent";
import {
  FraudAgent,
  FraudInput,
  FraudOutput,
} from "./agents/fraud.agent";
import {
  GrowthAgent,
  GrowthInput,
  GrowthOutput,
} from "./agents/growth.agent";
import {
  MerchantAgent,
  MerchantVerifyInput,
  MerchantVerifyOutput,
} from "./agents/merchant.agent";
import {
  RewardAgent,
  RewardInput,
  RewardOutput,
} from "./agents/reward.agent";
import { configureAgentCache } from "./cache";
import { OpenRouterClient, callAI } from "./llm/openrouter.client";

export class AgentCouncil {
  private readonly merchantAgent = new MerchantAgent();
  private readonly rewardAgent = new RewardAgent();
  private readonly fraudAgent = new FraudAgent();
  private readonly growthAgent = new GrowthAgent();

  async reviewClaim(
    input: FraudInput &
      RewardInput
  ): Promise<{
    fraud: AgentDecision<FraudOutput>;
    reward: AgentDecision<RewardOutput>;
    approved: boolean;
  }> {
    const [fraud, reward] = await Promise.all([
      this.fraudAgent.run({
        wallet: input.wallet,
        lat: input.lat,
        lng: input.lng,
        prevLat: input.prevLat,
        prevLng: input.prevLng,
        timeDelta: input.timeDelta,
        gpsAccuracy: input.gpsAccuracy,
        recentClaims: input.recentClaims,
        walletClaimsToday: input.walletClaimsToday,
        merchantId: input.merchantId,
        accountAge: input.accountAge,
        worldVerified: input.worldVerified,
      }),
      this.rewardAgent.run({
        merchantId: input.merchantId,
        currentTraffic: input.currentTraffic,
        avgTraffic: input.avgTraffic,
        timeOfDay: input.timeOfDay,
        dayOfWeek: input.dayOfWeek,
        userLevel: input.userLevel,
        merchantBalance: input.merchantBalance,
      }),
    ]);

    return {
      fraud,
      reward,
      approved: fraud.decision.allow,
    };
  }

  async reviewMerchant(input: MerchantVerifyInput): Promise<{
    merchant: AgentDecision<MerchantVerifyOutput>;
    approved: boolean;
  }> {
    const merchant = await this.merchantAgent.run(input);

    return {
      merchant,
      approved: merchant.decision.isLegit,
    };
  }

  async analyzeGrowth(input: GrowthInput): Promise<{
    growth: AgentDecision<GrowthOutput>;
  }> {
    const growth = await this.growthAgent.run(input);

    return { growth };
  }
}

export { BaseAgent, AgentDecision };
export { MerchantAgent, MerchantVerifyInput, MerchantVerifyOutput } from "./agents/merchant.agent";
export { RewardAgent, RewardInput, RewardOutput } from "./agents/reward.agent";
export { FraudAgent, FraudInput, FraudOutput } from "./agents/fraud.agent";
export { GrowthAgent, GrowthInput, GrowthOutput } from "./agents/growth.agent";
export { configureAgentCache } from "./cache";
export { OpenRouterClient, callAI };
