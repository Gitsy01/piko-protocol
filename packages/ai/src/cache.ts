import crypto from "crypto";

export interface AgentCacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

let agentCacheProvider: AgentCacheProvider | null = null;

export function configureAgentCache(provider: AgentCacheProvider | null) {
  agentCacheProvider = provider;
}

export function getAgentCache() {
  return agentCacheProvider;
}

export function buildAgentCacheKey(agentName: string, input: unknown) {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(normalizeForCache(input)))
    .digest("hex");

  return `depokemongo:ai:${agentName}:${hash}`;
}

function normalizeForCache(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForCache(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((result, [key, entryValue]) => {
        result[key] = normalizeForCache(entryValue);
        return result;
      }, {});
  }

  return value;
}
