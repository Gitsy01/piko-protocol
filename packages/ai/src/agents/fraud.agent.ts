import {
  FRAUD_THRESHOLD,
  MAX_CLAIMS_PER_HOUR,
  MAX_CLAIMS_PER_MERCHANT_PER_DAY,
  MAX_TRAVEL_SPEED_KMH,
  MIN_GPS_ACCURACY_METERS,
  haversineDistance,
} from "@depokemongo/common";
import { BaseAgent, AgentDecision } from "./base.agent";
import { OllamaClient } from "../llm/ollama.client";
import { SYSTEM_PROMPTS } from "../llm/prompts";
import { clampConfidence, parseJsonObject, toStringArray } from "../llm/structured-output";

export interface FraudInput {
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
  worldVerified?: boolean;
}

export interface FraudOutput {
  score: number;
  flags: string[];
  allow: boolean;
}

interface FraudModelResponse {
  fraudScore?: number;
  flags?: unknown;
  recommendation?: string;
  reasoning?: string;
  confidence?: number;
}

export class FraudAgent extends BaseAgent<FraudInput, FraudOutput> {
  readonly name = "FraudAgent";
  readonly description =
    "Protocol-level fraud detection - validates location proofs and behavioral patterns to prevent incentive abuse";
  private readonly ollamaClient = new OllamaClient();

  async execute(input: FraudInput): Promise<AgentDecision<FraudOutput>> {
    const fallbackDecision = this.buildRuleDecision(input);

    try {
      const prompt = [
        "Assess the fraud risk for this incentive claim.",
        "Keep the analysis strict and return compact JSON only.",
        `wallet: ${input.wallet}`,
        `merchantId: ${input.merchantId}`,
        `lat: ${input.lat}`,
        `lng: ${input.lng}`,
        `prevLat: ${input.prevLat ?? "unknown"}`,
        `prevLng: ${input.prevLng ?? "unknown"}`,
        `timeDeltaSeconds: ${input.timeDelta ?? "unknown"}`,
        `gpsAccuracyMeters: ${input.gpsAccuracy ?? "unknown"}`,
        `recentClaimsLastHour: ${input.recentClaims}`,
        `claimsForMerchantToday: ${input.walletClaimsToday}`,
        `accountAgeDays: ${input.accountAge ?? "unknown"}`,
        `worldVerified: ${input.worldVerified ?? false}`,
        `fallbackScore: ${fallbackDecision.decision.score}`,
        "Return JSON only with keys: fraudScore, flags, recommendation, reasoning, confidence.",
      ].join("\n");

      const response = await this.ollamaClient.generate(prompt, SYSTEM_PROMPTS.fraudAnalysis);
      const parsed = parseJsonObject<FraudModelResponse>(response);

      if (!parsed || !Number.isFinite(parsed.fraudScore)) {
        return fallbackDecision;
      }

      const aiScore = Math.max(0, Math.min(parsed.fraudScore as number, 100));
      const recommendation =
        parsed.recommendation === "reject"
          ? "reject"
          : parsed.recommendation === "review"
            ? "review"
            : "approve";
      const flags = Array.from(new Set([...fallbackDecision.decision.flags, ...toStringArray(parsed.flags)]));
      const rawScore = Math.max(fallbackDecision.decision.score, aiScore);
      const score = this.applyWorldIdAdjustment(rawScore, input.worldVerified);
      const allow = score < FRAUD_THRESHOLD && recommendation !== "reject";
      const reasoning = [
        fallbackDecision.reasoning,
        parsed.reasoning?.trim(),
        input.worldVerified ? "World ID human proof reduced fraud risk" : undefined,
        recommendation === "review" ? "Ollama recommends manual review" : undefined,
      ]
        .filter((value): value is string => Boolean(value))
        .join("; ");

      return {
        agentName: this.name,
        decision: {
          score,
          flags,
          allow,
        },
        confidence: clampConfidence(parsed.confidence, 0.78),
        reasoning,
        timestamp: new Date(),
      };
    } catch (error) {
      this.log("Ollama fraud analysis failed, using rules", {
        error: error instanceof Error ? error.message : String(error),
      });
      return fallbackDecision;
    }
  }

  private buildRuleDecision(input: FraudInput): AgentDecision<FraudOutput> {
    let score = 0;
    const flags: string[] = [];

    if (input.recentClaims > MAX_CLAIMS_PER_HOUR) {
      score += 30;
      flags.push("RAPID_CLAIMS");
    }

    if (input.walletClaimsToday > MAX_CLAIMS_PER_MERCHANT_PER_DAY) {
      score += 20;
      flags.push("SAME_WALLET_ABUSE");
    }

    if (input.gpsAccuracy !== undefined && input.gpsAccuracy > MIN_GPS_ACCURACY_METERS) {
      score += 15;
      flags.push("GPS_SPOOF");
    }

    if (
      input.prevLat !== undefined &&
      input.prevLng !== undefined &&
      input.timeDelta !== undefined &&
      input.timeDelta > 0
    ) {
      const distance = haversineDistance(input.prevLat, input.prevLng, input.lat, input.lng);
      const maxDistance = (MAX_TRAVEL_SPEED_KMH * 1000 * input.timeDelta) / 3600;

      if (distance > maxDistance) {
        score += 40;
        flags.push("IMPOSSIBLE_TRAVEL");
      }
    }

    if ((input.accountAge ?? 999) < 1 && input.recentClaims > 5) {
      score += 10;
      flags.push("NEW_ACCOUNT_BURST");
    }

    if (!input.worldVerified) {
      score += 35;
      flags.push("WORLD_ID_UNVERIFIED");
    }

    score = this.applyWorldIdAdjustment(Math.min(score, 100), input.worldVerified);

    return {
      agentName: this.name,
      decision: {
        score,
        flags,
        allow: score < FRAUD_THRESHOLD,
      },
      confidence: 0.92,
      reasoning:
        flags.length === 0
          ? input.worldVerified
            ? "World ID human proof reduced fraud risk"
            : "No deterministic fraud rules triggered"
          : [
              flags.join("; "),
              input.worldVerified ? "World ID human proof reduced fraud risk" : undefined,
            ]
              .filter((value): value is string => Boolean(value))
              .join("; "),
      timestamp: new Date(),
    };
  }

  private applyWorldIdAdjustment(score: number, worldVerified?: boolean) {
    if (!worldVerified) {
      return score;
    }

    return Number((score * 0.3).toFixed(2));
  }
}
