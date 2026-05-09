import { Router, type Request, type Response } from "express";
import { prisma } from "../config/db";
import { getErrorMessage, getErrorStatus, parseWithSchema } from "../config/http";
import { verifyWorldIdSchema } from "../config/validation";
import { type VerifyWorldIdInput, verifyWorldIdProof } from "../lib/worldId";

export const identityRouter = Router();

type WorldIdentityUser = {
  id: string;
  wallet?: string;
  worldVerified?: boolean;
  worldNullifier?: string | null;
};

identityRouter.post("/verify-world-id", async (req: Request, res: Response) => {
  try {
    const input = parseWithSchema(verifyWorldIdSchema, req.body) as VerifyWorldIdInput;
    const verification = await verifyWorldIdProof(input);

    const existingNullifierOwner = (await (prisma.user as any).findUnique({
      where: {
        worldNullifier: verification.nullifierHash,
      },
    })) as WorldIdentityUser | null;

    if (existingNullifierOwner) {
      res.status(409).json({
        success: false,
        error:
          existingNullifierOwner.wallet === input.userWallet
            ? "World ID already used"
            : "This World ID has already been used by another wallet",
      });
      return;
    }

    const user = (await (prisma.user as any).upsert({
      where: { wallet: input.userWallet },
      update: {
        lastActiveAt: new Date(),
        worldVerified: true,
        worldNullifier: verification.nullifierHash,
      },
      create: {
        wallet: input.userWallet,
        worldVerified: true,
        worldNullifier: verification.nullifierHash,
      },
    })) as WorldIdentityUser;

    res.json({
      success: true,
      data: {
        userId: user.id,
        worldVerified: Boolean(user.worldVerified),
        nullifierHash: user.worldNullifier ?? null,
        merkleRoot: verification.merkleRoot,
        verificationLevel: verification.verificationLevel,
      },
    });
  } catch (error) {
    console.error("Failed to verify World ID:", error);
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
});
