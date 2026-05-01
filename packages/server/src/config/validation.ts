import { z } from "zod";
import { Category, MIN_GPS_ACCURACY_METERS, QuestType } from "@depokemongo/common";

const latSchema = z.number().min(-90).max(90);
const lngSchema = z.number().min(-180).max(180);

export const nearbyMerchantQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(50_000).optional(),
  filter: z.enum(["all", "reward_active", "sponsored", "trending"]).optional(),
});

export const registerMerchantSchema = z.object({
  wallet: z.string().min(32).max(44),
  name: z.string().trim().min(3).max(64),
  description: z.string().trim().max(280).optional(),
  category: z.nativeEnum(Category),
  lat: latSchema,
  lng: lngSchema,
  imageUrl: z.string().url().optional(),
  stakeAmount: z.coerce.number().min(0.1).default(0.1),
});

export const nearbyQuestQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(50_000).optional(),
});

export const claimQuestSchema = z.object({
  wallet: z.string().min(32).max(44),
  lat: latSchema,
  lng: lngSchema,
  gpsAccuracy: z.coerce.number().positive().max(MIN_GPS_ACCURACY_METERS),
});

export const createQuestSchema = z.object({
  merchantId: z.string().min(1),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(500),
  rewardAmount: z.coerce.number().positive(),
  rewardToken: z.string().trim().min(1).default("PIKO"),
  xpReward: z.coerce.number().int().positive().max(500).default(10),
  minSpend: z.coerce.number().nonnegative().default(0),
  maxClaims: z.coerce.number().int().positive().max(10_000).default(100),
  questType: z.nativeEnum(QuestType),
  expiresAt: z.coerce.date(),
  conditions: z.record(z.string(), z.unknown()).optional(),
});

export const createPaymentRequestSchema = z.object({
  merchantId: z.string().min(1),
  amount: z.coerce.number().positive(),
  questId: z.string().min(1).optional(),
  wallet: z.string().min(32).max(44),
});

export const verifyPaymentSchema = z.object({
  reference: z.string().min(1),
  paymentSignature: z.string().min(1).optional(),
  questId: z.string().min(1).optional(),
  wallet: z.string().min(32).max(44).optional(),
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
  gpsAccuracy: z.coerce.number().positive().optional(),
});

export const completeQuestSchema = z
  .object({
    questId: z.string().min(1),
    reference: z.string().min(1),
    paymentSignature: z.string().min(1).optional(),
    wallet: z.string().min(32).max(44).optional(),
    userWallet: z.string().min(32).max(44).optional(),
    lat: latSchema,
    lng: lngSchema,
    gpsAccuracy: z.coerce.number().positive().max(MIN_GPS_ACCURACY_METERS),
  })
  .transform((input) => ({
    ...input,
    wallet: input.wallet ?? input.userWallet,
  }))
  .refine((input) => input.wallet, {
    message: "wallet is required",
    path: ["wallet"],
  });

export const leaderboardQuerySchema = z.object({
  period: z.enum(["weekly", "monthly", "alltime"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  wallet: z.string().min(32).max(44).optional(),
});

export const aiSuggestSchema = z.object({
  wallet: z.string().min(32).max(44).optional(),
  lat: latSchema,
  lng: lngSchema,
});

export const aiGrowthSchema = z.object({
  timeRange: z.enum(["24h", "7d", "30d"]).optional(),
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
  radius: z.coerce.number().positive().max(50_000).optional(),
});

export const aiFraudCheckSchema = z.object({
  wallet: z.string().min(32).max(44),
  merchantId: z.string().min(1),
  lat: latSchema,
  lng: lngSchema,
  prevLat: latSchema.optional(),
  prevLng: lngSchema.optional(),
  timeDelta: z.coerce.number().positive().optional(),
  gpsAccuracy: z.coerce.number().positive().optional(),
  accountAge: z.coerce.number().nonnegative().optional(),
});

export const connectUserSchema = z.object({
  wallet: z.string().min(32).max(44),
});

export const verifyWorldIdSchema = z.object({
  userWallet: z.string().min(32).max(44),
  nullifier_hash: z.string().trim().min(3),
  proof: z.string().trim().min(3),
  merkle_root: z.string().trim().min(3),
  verification_level: z.string().trim().min(1).optional(),
});
