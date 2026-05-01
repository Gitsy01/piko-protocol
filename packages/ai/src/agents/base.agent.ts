import { AI_CACHE_TTL } from "@depokemongo/common";
import { buildAgentCacheKey, getAgentCache } from "../cache";

export interface AgentDecision<T = unknown> {
  agentName: string;
  decision: T;
  confidence: number;
  reasoning: string;
  timestamp: Date;
}

export abstract class BaseAgent<TInput, TOutput> {
  abstract readonly name: string;
  abstract readonly description: string;

  abstract execute(input: TInput): Promise<AgentDecision<TOutput>>;

  protected log(message: string, data?: unknown) {
    console.log(`[${this.name}] ${message}`, data ? JSON.stringify(data) : "");
  }

  protected getCacheKey(input: TInput): string | null {
    return buildAgentCacheKey(this.name, input);
  }

  protected getCacheTtlSeconds(): number {
    return AI_CACHE_TTL;
  }

  protected reviveCachedDecision(value: unknown): AgentDecision<TOutput> | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const candidate = value as Partial<AgentDecision<TOutput>> & {
      timestamp?: string | Date;
    };

    if (
      typeof candidate.agentName !== "string" ||
      typeof candidate.confidence !== "number" ||
      typeof candidate.reasoning !== "string" ||
      candidate.decision === undefined ||
      candidate.timestamp === undefined
    ) {
      return null;
    }

    return {
      agentName: candidate.agentName,
      decision: candidate.decision,
      confidence: candidate.confidence,
      reasoning: candidate.reasoning,
      timestamp: new Date(candidate.timestamp),
    };
  }

  async run(input: TInput): Promise<AgentDecision<TOutput>> {
    const start = Date.now();
    const cache = getAgentCache();
    const cacheKey = this.getCacheKey(input);

    this.log("Starting execution...");

    if (cache && cacheKey) {
      try {
        const cached = await cache.get<AgentDecision<TOutput>>(cacheKey);
        const revived = this.reviveCachedDecision(cached);
        if (revived) {
          this.log(`Cache hit after ${Date.now() - start}ms`);
          return revived;
        }
      } catch (error) {
        this.log("Cache lookup failed", { error });
      }
    }

    try {
      const result = await this.execute(input);

      if (cache && cacheKey) {
        try {
          await cache.set(cacheKey, result, this.getCacheTtlSeconds());
        } catch (error) {
          this.log("Cache write failed", { error });
        }
      }

      this.log(`Completed in ${Date.now() - start}ms`, {
        confidence: result.confidence,
      });
      return result;
    } catch (error) {
      this.log(`Failed after ${Date.now() - start}ms`, { error });
      throw error;
    }
  }
}
