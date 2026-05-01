// ═══════════════════════════════════════════════════════════
// MerchantAgent — Verifies merchant legitimacy
// ═══════════════════════════════════════════════════════════

import { BaseAgent, AgentDecision } from "./base.agent";

export interface MerchantVerifyInput {
  wallet: string;
  name: string;
  location: { lat: number; lng: number };
  category: string;
  stakeAmount: number;
}

export interface MerchantVerifyOutput {
  isLegit: boolean;
  riskScore: number; // 0-100
  issues: string[];
}

export class MerchantAgent extends BaseAgent<MerchantVerifyInput, MerchantVerifyOutput> {
  readonly name = "MerchantAgent";
  readonly description = "Verifies merchant legitimacy and risk assessment";

  async execute(input: MerchantVerifyInput): Promise<AgentDecision<MerchantVerifyOutput>> {
    const issues: string[] = [];
    let riskScore = 0;

    // Rule 1: Minimum stake check
    if (input.stakeAmount < 0.1) {
      riskScore += 30;
      issues.push("Very low stake amount — potential spam");
    }

    // Rule 2: Name validation
    if (input.name.length < 3) {
      riskScore += 10;
      issues.push("Suspiciously short name");
    }

    // Rule 3: Location validation (not in ocean)
    if (
      input.location.lat < -90 || input.location.lat > 90 ||
      input.location.lng < -180 || input.location.lng > 180
    ) {
      riskScore += 50;
      issues.push("Invalid coordinates");
    }

    // Rule 4: Check for known spam patterns
    const spamPatterns = ["test", "xxx", "aaa", "123"];
    if (spamPatterns.some((p) => input.name.toLowerCase().includes(p))) {
      riskScore += 20;
      issues.push("Name matches spam pattern");
    }

    // Rule 5: Wallet format validation
    if (input.wallet.length < 32 || input.wallet.length > 44) {
      riskScore += 40;
      issues.push("Invalid wallet address format");
    }

    return {
      agentName: this.name,
      decision: {
        isLegit: riskScore < 50,
        riskScore,
        issues,
      },
      confidence: riskScore < 30 ? 0.9 : 0.6,
      reasoning: issues.length === 0
        ? "Merchant passed all verification checks"
        : `Found ${issues.length} issue(s): ${issues.join("; ")}`,
      timestamp: new Date(),
    };
  }
}
