// ═══════════════════════════════════════════════════════════
// @depokemongo/common — Constants
// ═══════════════════════════════════════════════════════════

// ──── Solana ────
export const SOLANA_DEVNET_RPC = "https://api.devnet.solana.com";
export const SOLANA_DEVNET_WS = "wss://api.devnet.solana.com";

// ──── Map ────
export const DEFAULT_MAP_CENTER = { lat: 28.6139, lng: 77.2090 }; // New Delhi
export const DEFAULT_MAP_ZOOM = 14;
export const DEFAULT_SEARCH_RADIUS = 5000; // meters
export const MAX_SEARCH_RADIUS = 50000; // meters

// ──── Rewards ────
export const MIN_REWARD_AMOUNT = 0.01; // PIKO
export const MAX_REWARD_AMOUNT = 10; // PIKO
export const DEFAULT_REWARD_AMOUNT = 0.5; // PIKO
export const XP_PER_QUEST = 10;
export const XP_PER_LEVEL = 100;

// ──── Fraud ────
export const FRAUD_THRESHOLD = 60; // score above this = reject
export const MAX_CLAIMS_PER_HOUR = 10;
export const MAX_CLAIMS_PER_MERCHANT_PER_DAY = 3;
export const MAX_TRAVEL_SPEED_KMH = 200;
export const MIN_GPS_ACCURACY_METERS = 100;

// ──── Quest ────
export const MAX_QUEST_DURATION_DAYS = 30;
export const DEFAULT_MAX_CLAIMS = 100;

// ──── Leaderboard ────
export const LEADERBOARD_SIZE = 100;
export const LEADERBOARD_REFRESH_INTERVAL = 60_000; // ms

// ──── AI ────
export const OLLAMA_DEFAULT_MODEL = "llama3.2:3b";
export const OPENROUTER_DEFAULT_MODEL = "mistralai/mistral-7b-instruct";
export const AI_CACHE_TTL = 3600; // seconds
export const REWARD_MULTIPLIER_MIN = 0.1;
export const REWARD_MULTIPLIER_MAX = 3.0;
