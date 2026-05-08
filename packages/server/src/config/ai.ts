import Redis from "ioredis";
import { configureAgentCache, type AgentDecision } from "@depokemongo/ai";
import { env } from "./env";
import { log } from "./logger";

class RedisAgentCache {
  private readonly client: Redis;
  private hasLoggedConnectionIssue = false;

  constructor(url: string) {
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    this.client.on("error", (error) => {
      if (this.hasLoggedConnectionIssue) {
        return;
      }

      this.hasLoggedConnectionIssue = true;
      log("info", "[AI Cache] Redis unavailable, continuing without cache", error.message);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const payload = await this.client.get(key);
      if (!payload) {
        return null;
      }

      return JSON.parse(payload) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      // Ignore cache writes when Redis is unavailable.
    }
  }
}

configureAgentCache(new RedisAgentCache(env.REDIS_URL));

export type CachedAgentDecision<T> = AgentDecision<T>;
