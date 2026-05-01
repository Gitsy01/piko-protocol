import { REWARD_MULTIPLIER_MAX, REWARD_MULTIPLIER_MIN } from "@depokemongo/common";
import { BaseAgent, AgentDecision } from "./base.agent";
import { OllamaClient } from "../llm/ollama.client";
import { SYSTEM_PROMPTS } from "../llm/prompts";
import { clampConfidence, parseJsonObject, toStringArray } from "../llm/structured-output";

export interface RewardInput {
  merchantId: string;
  currentTraffic: number;
  avgTraffic: number;
  timeOfDay: number;
  dayOfWeek: number;
  userLevel: number;
  merchantBalance: number;
}

export interface RewardOutput {
  multiplier: number;
  adjustedAmount: number;
  reasons: string[];
}

interface RewardModelResponse {
  multiplier?: number;
  reasons?: unknown;
  reasoning?: string;
  confidence?: number;
}

export class RewardAgent extends BaseAgent<RewardInput, RewardOutput> {
  readonly name = "RewardAgent";
  readonly description =
    "Dynamic incentive pricing engine - adjusts on-chain reward multipliers using AI inference with deterministic fallback";
  private readonly ollamaClient = new OllamaClient();

  async execute(input: RewardInput): Promise<AgentDecision<RewardOutput>> {
    const fallbackDecision = this.buildRuleDecision(input);

    try {
      const prompt = [
        "Optimize the reward multiplier for this merchant reward loop.",
        "Keep the answer conservative and budget-aware.",
        `merchantId: ${input.merchantId}`,
        `currentTraffic: ${input.currentTraffic}`,
        `avgTraffic: ${input.avgTraffic}`,
        `timeOfDay: ${input.timeOfDay}`,
        `dayOfWeek: ${input.dayOfWeek}`,
        `userLevel: ${input.userLevel}`,
        `merchantBalance: ${input.merchantBalance}`,
        `fallbackMultiplier: ${fallbackDecision.decision.multiplier}`,
        "Return JSON only with keys: multiplier, reasons, reasoning, confidence.",
      ].join("\n");

      const response = await this.ollamaClient.generate(prompt, SYSTEM_PROMPTS.rewardOptimizer);
      const parsed = parseJsonObject<RewardModelResponse>(response);

      if (!parsed || !Number.isFinite(parsed.multiplier)) {
        return fallbackDecision;
      }

      const multiplier = Math.max(
        REWARD_MULTIPLIER_MIN,
        Math.min(parsed.multiplier as number, REWARD_MULTIPLIER_MAX)
      );
      const reasons = toStringArray(parsed.reasons);
      const reasoning = parsed.reasoning?.trim() || reasons.join("; ") || fallbackDecision.reasoning;

      return {
        agentName: this.name,
        decision: {
          multiplier,
          adjustedAmount: multiplier,
          reasons: reasons.length > 0 ? reasons : [reasoning],
        },
        confidence: clampConfidence(parsed.confidence, 0.76),
        reasoning,
        timestamp: new Date(),
      };
    } catch (error) {
      this.log("Ollama reward analysis failed, using rules", {
        error: error instanceof Error ? error.message : String(error),
      });
      return fallbackDecision;
    }
  }

  private buildRuleDecision(input: RewardInput): AgentDecision<RewardOutput> {
    const avgTraffic = Math.max(input.avgTraffic, 1);
    const trafficRatio = input.currentTraffic / avgTraffic;

    let multiplier = 1;
    const reasons: string[] = [];

    if (trafficRatio <= 0.5) {
      multiplier += 0.6;
      reasons.push("Low traffic detected, boosting rewards");
    } else if (trafficRatio <= 0.9) {
      multiplier += 0.25;
      reasons.push("Below-average traffic, slight boost applied");
    } else if (trafficRatio >= 1.8) {
      multiplier -= 0.3;
      reasons.push("Heavy traffic detected, reducing reward pressure");
    } else if (trafficRatio >= 1.2) {
      multiplier -= 0.05;
      reasons.push("Above-average traffic, minor reduction applied");
    } else {
      reasons.push("Traffic is balanced, keeping the base reward");
    }

    if (this.isOffPeakWindow(input.timeOfDay)) {
      multiplier += 0.15;
      reasons.push("Off-peak time bonus enabled");
    }

    if (input.userLevel <= 3) {
      multiplier += 0.2;
      reasons.push("New-user onboarding bonus applied");
    } else if (input.userLevel >= 15) {
      multiplier += 0.1;
      reasons.push("High-level retention bonus applied");
    }

    if (input.merchantBalance < 10) {
      multiplier = Math.min(multiplier, 0.75);
      reasons.push("Budget guard capped the multiplier");
    } else if (input.merchantBalance < 25) {
      multiplier = Math.min(multiplier, 1.2);
      reasons.push("Soft budget guard limited aggressive boosts");
    }

    multiplier = Number(
      Math.max(REWARD_MULTIPLIER_MIN, Math.min(multiplier, REWARD_MULTIPLIER_MAX)).toFixed(2)
    );

    return {
      agentName: this.name,
      decision: {
        multiplier,
        adjustedAmount: multiplier,
        reasons,
      },
      confidence: 0.9,
      reasoning: reasons.join("; "),
      timestamp: new Date(),
    };
  }

  private isOffPeakWindow(timeOfDay: number) {
    return timeOfDay < 9 || timeOfDay >= 20 || (timeOfDay >= 14 && timeOfDay <= 17);
  }
}
