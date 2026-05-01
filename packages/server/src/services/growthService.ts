import { AgentCouncil } from "@depokemongo/ai";
import { haversineDistance } from "@depokemongo/common";
import { prisma } from "../config/db";

export type GrowthTimeRange = "24h" | "7d" | "30d";

export type AnalyzeGrowthInput = {
  timeRange?: GrowthTimeRange;
  lat?: number;
  lng?: number;
  radius?: number;
};

export class GrowthService {
  private readonly agentCouncil = new AgentCouncil();

  async analyze(input: AnalyzeGrowthInput) {
    const timeRange = input.timeRange ?? "24h";
    const days = this.getDaysForRange(timeRange);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const merchants = await prisma.merchant.findMany({
      where: { isActive: true },
      include: {
        analytics: {
          where: { date: { gte: startDate } },
          orderBy: { date: "desc" },
        },
      },
    });

    const filteredMerchants = merchants.filter((merchant) => {
      if (input.lat == null || input.lng == null) {
        return true;
      }

      const radius = input.radius ?? 5000;
      return haversineDistance(input.lat, input.lng, merchant.lat, merchant.lng) <= radius;
    });

    const growthInput = filteredMerchants.map((merchant) => {
      const analyticsVisits = merchant.analytics.reduce((sum, entry) => sum + entry.visits, 0);
      const recentVisits = analyticsVisits > 0 ? analyticsVisits : Math.max(merchant.totalVisits, 1);
      const avgDailyVisits =
        merchant.analytics.length > 0
          ? analyticsVisits / Math.max(merchant.analytics.length, 1)
          : Math.max(1, merchant.totalVisits / Math.max(days, 1));

      return {
        id: merchant.id,
        name: merchant.name,
        lat: merchant.lat,
        lng: merchant.lng,
        totalVisits: merchant.totalVisits,
        conversionRate: merchant.conversionRate || 0.1,
        recentVisits,
        avgDailyVisits,
      };
    });

    const { growth } = await this.agentCouncil.analyzeGrowth({
      merchants: growthInput,
      timeRange,
    });

    return {
      timeRange,
      merchantCount: growthInput.length,
      trending: growth.decision.trending,
      underperforming: growth.decision.underperforming,
      heatmapWeights: growth.decision.heatmapWeights,
      reasoning: growth.reasoning,
      confidence: growth.confidence,
    };
  }

  private getDaysForRange(timeRange: GrowthTimeRange) {
    if (timeRange === "7d") {
      return 7;
    }

    if (timeRange === "30d") {
      return 30;
    }

    return 1;
  }
}
