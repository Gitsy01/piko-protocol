import { Request, Response, Router } from "express";
import { getErrorMessage, getErrorStatus, parseWithSchema } from "../config/http";
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
    res.json({ success: true, data: { quests } });
  } catch (error) {
    console.error("Failed to fetch nearby quests:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
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

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Failed to complete quest:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

questRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const wallet =
      typeof req.query.wallet === "string" && req.query.wallet.length > 0 ? req.query.wallet : undefined;
    const result = await questService.getQuestById(req.params.id, wallet);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Failed to fetch quest:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

questRouter.post("/", async (req: Request, res: Response) => {
  try {
    const payload = parseWithSchema(createQuestSchema, req.body);
    const quest = await questService.createQuest(payload);
    res.status(201).json({ success: true, data: { quest } });
  } catch (error) {
    console.error("Failed to create quest:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});

questRouter.post("/:id/claim", async (req: Request, res: Response) => {
  try {
    const { wallet, lat, lng, gpsAccuracy } = parseWithSchema(claimQuestSchema, req.body);
    const result = await questService.claimQuest(req.params.id, wallet, lat, lng, gpsAccuracy);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Failed to claim quest:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});
