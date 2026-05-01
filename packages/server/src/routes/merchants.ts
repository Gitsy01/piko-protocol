// ===========================================================
// Merchant Registry API - onboard businesses into the
// PIKO Protocol incentive network
// ===========================================================

import { Router, Request, Response } from "express";
import { prisma } from "../config/db";
import { haversineDistance, simpleGeohash } from "@depokemongo/common";
import { AgentCouncil } from "@depokemongo/ai";
import { getErrorMessage, getErrorStatus, parseWithSchema } from "../config/http";
import {
  nearbyMerchantQuerySchema,
  registerMerchantSchema,
} from "../config/validation";

export const merchantRouter = Router();
const agentCouncil = new AgentCouncil();

async function registerMerchant(req: Request, res: Response) {
  try {
    const { wallet, name, description, category, lat, lng, imageUrl, stakeAmount } =
      parseWithSchema(registerMerchantSchema, req.body);

    const existingMerchants = await prisma.merchant.findMany({
      where: { isActive: true },
      select: { id: true, lat: true, lng: true },
    });

    const duplicate = existingMerchants.find(
      (merchant) => haversineDistance(lat, lng, merchant.lat, merchant.lng) <= 50
    );

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: "A merchant is already registered within 50 meters of this location",
      });
    }

    const review = await agentCouncil.reviewMerchant({
      wallet,
      name,
      location: { lat, lng },
      category,
      stakeAmount: stakeAmount ?? 0.1,
    });

    if (!review.approved) {
      return res.status(400).json({
        success: false,
        error: review.merchant.reasoning,
      });
    }

    const locationHash = simpleGeohash(lat, lng);

    const merchant = await prisma.merchant.create({
      data: {
        wallet,
        name,
        description,
        category,
        lat,
        lng,
        locationHash,
        imageUrl,
        stakeAmount: stakeAmount ?? 0.1,
        isVerified: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        merchant,
        verification: review.merchant.decision,
      },
    });
  } catch (error) {
    console.error("Failed to register merchant:", error);
    return res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
}

/**
 * GET /api/merchants/nearby
 * Query: lat, lng, radius (meters), filter
 */
merchantRouter.get("/nearby", async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 5000, filter = "all" } = parseWithSchema(
      nearbyMerchantQuerySchema,
      req.query
    );

    // Fetch all active merchants (in production, use PostGIS for geo queries)
    const merchants = await prisma.merchant.findMany({
      where: { isActive: true },
      include: {
        quests: {
          where: { isActive: true, expiresAt: { gt: new Date() } },
          select: {
            id: true,
            title: true,
            rewardAmount: true,
            rewardToken: true,
            questType: true,
            xpReward: true,
            expiresAt: true,
            claimedCount: true,
            maxClaims: true,
          },
        },
      },
    });

    // Calculate distance and filter by radius
    const nearby = merchants
      .map((m) => ({
        ...m,
        distance: haversineDistance(lat, lng, m.lat, m.lng),
      }))
      .filter((m) => m.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    // Apply filters
    let filtered = nearby;
    if (filter === "reward_active") {
      filtered = nearby.filter((m) => m.quests.length > 0);
    } else if (filter === "sponsored") {
      filtered = nearby.filter((m) => m.quests.some((q) => q.questType === "SPONSORED"));
    } else if (filter === "trending") {
      filtered = nearby.sort((a, b) => b.totalVisits - a.totalVisits);
    }

    const heatmapData = filtered.map((merchant) => ({
      lat: merchant.lat,
      lng: merchant.lng,
      weight: Math.min((merchant.totalVisits || 0) / 50, 1),
    }));

    res.json({ success: true, data: { merchants: filtered, heatmapData } });
  } catch (error) {
    console.error("Failed to fetch nearby merchants:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * GET /api/merchants/:id
 */
merchantRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.params.id },
      include: {
        quests: {
          where: { isActive: true, expiresAt: { gt: new Date() } },
        },
      },
    });

    if (!merchant) {
      return res.status(404).json({ success: false, error: "Merchant not found" });
    }

    res.json({ success: true, data: { merchant } });
  } catch (error) {
    console.error("Failed to fetch merchant:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * POST /api/merchants
 * POST /api/merchants/register
 */
merchantRouter.post("/", registerMerchant);
merchantRouter.post("/register", registerMerchant);
