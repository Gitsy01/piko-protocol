import fs from "fs";
import path from "path";
import { Keypair } from "@solana/web3.js";
import { env, repoRoot } from "../config/env";
import { HttpError } from "../config/http";

export function resolveAnchorWalletPath() {
  return path.isAbsolute(env.ANCHOR_WALLET)
    ? env.ANCHOR_WALLET
    : path.resolve(repoRoot, env.ANCHOR_WALLET);
}

export function loadAnchorWalletKeypair() {
  const walletPath = resolveAnchorWalletPath();

  if (!fs.existsSync(walletPath)) {
    throw new HttpError(
      500,
      `ANCHOR_WALLET not found at ${walletPath}. Configure the server signer before running Anchor or NFT operations.`,
    );
  }

  const secret = JSON.parse(fs.readFileSync(walletPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}
