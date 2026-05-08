import { Request, Response, Router } from "express";
import { parseWithSchema, sendError, sendSuccess } from "../config/http";
import {
  claimQuestSchema,
  completeQuestSchema,
  createQuestSchema,
  nearbyQuestQuerySchema,
} from "../config/validation";
import { questService } from "../services";

export const questRouter = Router();

questRouter.get("/nearby", async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 5000 } = parseWithSchema(nearbyQuestQuerySchema, req.query);
    const quests = await questService.getNearbyQuests(lat, lng, radius);
    sendSuccess(res, { quests }, "Nearby quests loaded");
  } catch (error) {
    console.error("Failed to fetch nearby incentives:", error);
    sendError(res, error, "Failed to fetch nearby incentives");
  }
});

questRouter.post("/complete", async (req: Request, res: Response) => {
  try {
    const { questId, reference, paymentSignature, wallet, lat, lng, gpsAccuracy } = parseWithSchema(
      completeQuestSchema,
      req.body
    );

    const result = await questService.completeQuest({
      questId,
      reference,
      paymentSignature,
      userWallet: wallet as string,
      lat,
      lng,
      gpsAccuracy,
    });

    sendSuccess(res, result, "Quest completion verified");
  } catch (error) {
    console.error("Failed to complete quest:", error);
    sendError(res, error, "Failed to complete quest");
  }
});

questRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const wallet =
      typeof req.query.wallet === "string" && req.query.wallet.length > 0 ? req.query.wallet : undefined;
    const result = await questService.getQuestById(req.params.id, wallet);
    sendSuccess(res, result, "Quest loaded");
  } catch (error) {
    console.error("Failed to fetch quest:", error);
    sendError(res, error, "Failed to fetch quest");
  }
});

questRouter.post("/", async (req: Request, res: Response) => {
  try {
    const payload = parseWithSchema(createQuestSchema, req.body);
    const quest = await questService.createQuest(payload);
    sendSuccess(res, { quest }, "Quest created", 201);
  } catch (error) {
    console.error("Failed to create quest:", error);
    sendError(res, error, "Failed to create quest");
  }
});

questRouter.post("/:id/claim", async (req: Request, res: Response) => {
  try {
    const { wallet, lat, lng, gpsAccuracy } = parseWithSchema(claimQuestSchema, req.body);
    const result = await questService.claimQuest(req.params.id, wallet, lat, lng, gpsAccuracy);
    sendSuccess(res, result, "Quest claim created", 201);
  } catch (error) {
    console.error("Failed to claim quest:", error);
    sendError(res, error, "Failed to claim quest");
  }
});
