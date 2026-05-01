// ═══════════════════════════════════════════════════════════
// GrowthAgent — Identifies trending locations & growth opportunities
// ═══════════════════════════════════════════════════════════

import { BaseAgent, AgentDecision } from "./base.agent";

export interface GrowthInput {
  merchants: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    totalVisits: number;
    conversionRate: number;
    recentVisits: number;  // last 24h
    avgDailyVisits: number;
  }>;
  timeRange: "24h" | "7d" | "30d";
}

export interface GrowthOutput {
  trending: Array<{ merchantId: string; name: string; growthRate: number; reason: string }>;
  underperforming: Array<{ merchantId: string; name: string; suggestion: string }>;
  heatmapWeights: Array<{ lat: number; lng: number; weight: number }>;
}

export class GrowthAgent extends BaseAgent<GrowthInput, GrowthOutput> {
  readonly name = "GrowthAgent";
  readonly description = "Analyzes merchant traffic patterns and suggests growth strategies";

  async execute(input: GrowthInput): Promise<AgentDecision<GrowthOutput>> {
    const trending: GrowthOutput["trending"] = [];
    const underperforming: GrowthOutput["underperforming"] = [];
    const heatmapWeights: GrowthOutput["heatmapWeights"] = [];

    for (const m of input.merchants) {
      const growthRate =
        m.avgDailyVisits > 0
          ? (m.recentVisits - m.avgDailyVisits) / m.avgDailyVisits
          : m.recentVisits > 0
          ? 1
          : 0;

      // Heatmap weight based on activity
      heatmapWeights.push({
        lat: m.lat,
        lng: m.lng,
        weight: Math.min(m.recentVisits / 10, 1), // Normalize 0-1
      });

      // Trending: >50% growth
      if (growthRate > 0.5 && m.recentVisits > 5) {
        trending.push({
          merchantId: m.id,
          name: m.name,
          growthRate,
          reason: `${Math.round(growthRate * 100)}% traffic increase`,
        });
      }

      // Underperforming: <30% of average + decent conversion
      if (growthRate < -0.3 && m.conversionRate > 0.3) {
        underperforming.push({
          merchantId: m.id,
          name: m.name,
          suggestion: `Increase rewards by 50% — high conversion (${Math.round(
            m.conversionRate * 100
          )}%) but low traffic`,
        });
      }
    }

    // Sort trending by growth rate
    trending.sort((a, b) => b.growthRate - a.growthRate);

    return {
      agentName: this.name,
      decision: { trending, underperforming, heatmapWeights },
      confidence: 0.75,
      reasoning: `Found ${trending.length} trending, ${underperforming.length} underperforming merchants`,
      timestamp: new Date(),
    };
  }
}
