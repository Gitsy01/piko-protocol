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
  if (env.ANCHOR_WALLET_SECRET) {
    return Keypair.fromSecretKey(Uint8Array.from(parseAnchorWalletSecret(env.ANCHOR_WALLET_SECRET)));
  }

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

function parseAnchorWalletSecret(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as number[];
  }

  return JSON.parse(Buffer.from(trimmed, "base64").toString("utf8")) as number[];
}
