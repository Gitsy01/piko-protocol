import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

// Resolve repo root; works from both src/ (tsx watch) and dist/ (compiled).
export const repoRoot = path.resolve(__dirname, "../../../..");
const serverRoot = path.resolve(repoRoot, "packages/server");

// Load .env files only if they exist (they won't in Railway / Docker)
for (const envPath of [
  path.join(repoRoot, ".env"),
  path.join(serverRoot, ".env"),
]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("postgresql://localhost:5432/depokemongo"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  SOLANA_RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
  SOLANA_WS_URL: z.string().url().default("wss://api.devnet.solana.com"),
  ANCHOR_WALLET: z.string().min(1).default("./wallet/dev-wallet.json"),
  PIKO_MINT_AUTHORITY_WALLET: z.string().trim().default(""),
  PIKO_MINT_ADDRESS: z.string().trim().default(""),
  PIKO_DECIMALS: z.coerce.number().int().nonnegative().max(18).default(9),
  PIKO_DAILY_WALLET_CAP_BASE_UNITS: z.string().regex(/^\d+$/).default("1000000000000"),
  REWARD_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(60),
  MERCHANT_REGISTRY_PROGRAM_ID: z.string().default(""),
  QUEST_PROGRAM_ID: z.string().default(""),
  SOLANA_PAY_FALLBACK_RECIPIENT: z
    .string()
    .default("GvHeQ9NfL7KPLWjXrbgNqE6W5gK4Tz6M3fVhHq7w8Y9Z"),
  NFT_REWARDS_ENABLED: z.coerce.boolean().default(false),
  NFT_REWARD_METADATA_BASE_URI: z.string().default(""),
  NFT_REWARD_METADATA_TEMPLATE: z.string().default(""),
  NFT_REWARD_IMAGE_URL: z.string().default(""),
  NFT_REWARD_IMAGE_BASE_URI: z.string().default(""),
  NFT_REWARD_SYMBOL: z.string().default("PIKO"),
  OPENROUTER_API_KEY: z.string().default(""),
  OPENROUTER_MODEL: z.string().default("mistralai/mistral-7b-instruct"),
  OPENROUTER_SITE_URL: z.string().default(""),
  OPENROUTER_SITE_NAME: z.string().default("PIKO Protocol"),
  OLLAMA_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3.2:3b"),
  PORT: z.coerce.number().int().positive().default(3001),
  JWT_SECRET: z.string().min(1).default("dev-secret-change-me"),
  DEMO_ACCESS_KEY: z.string().default(""),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NODE_ENV: z.string().default("development"),
});

export const env = envSchema.parse(process.env);
