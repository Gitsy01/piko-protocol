import fs from "fs";
import path from "path";
import { Keypair } from "@solana/web3.js";
import { env, repoRoot } from "../config/env";
import { HttpError } from "../config/http";

function resolveConfiguredPath(configuredPath: string) {
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(repoRoot, configuredPath);
}

function isInsideRepo(targetPath: string) {
  const relativePath = path.relative(repoRoot, targetPath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

export function resolvePikoMintAuthorityPath() {
  const configuredPath = env.PIKO_MINT_AUTHORITY_WALLET.trim();
  return configuredPath ? resolveConfiguredPath(configuredPath) : "";
}

export function hasPikoMintAuthorityWallet() {
  return resolvePikoMintAuthorityPath().length > 0;
}

export function getPikoMintAuthorityConfigError() {
  const walletPath = resolvePikoMintAuthorityPath();

  if (!walletPath) {
    return "PIKO_MINT_AUTHORITY_WALLET is not configured";
  }

  if (env.NODE_ENV === "production" && isInsideRepo(walletPath)) {
    return "PIKO_MINT_AUTHORITY_WALLET must point outside the repository in production";
  }

  if (!fs.existsSync(walletPath)) {
    return `PIKO_MINT_AUTHORITY_WALLET not found at ${walletPath}`;
  }

  return null;
}

export function loadPikoMintAuthorityKeypair() {
  const walletPath = resolvePikoMintAuthorityPath();
  const configError = getPikoMintAuthorityConfigError();

  if (configError) {
    throw new HttpError(
      500,
      `${configError}. Create or mount the dedicated mint authority wallet before minting rewards.`,
    );
  }

  const secret = JSON.parse(fs.readFileSync(walletPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}
