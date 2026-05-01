import { getMint } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { env } from "./env";
import { HttpError } from "./http";

export async function assertPikoMintDecimals() {
  const rawMintAddress = env.PIKO_MINT_ADDRESS.trim();

  if (!rawMintAddress) {
    return;
  }

  let mintAddress: PublicKey;
  try {
    mintAddress = new PublicKey(rawMintAddress);
  } catch {
    throw new HttpError(500, "PIKO_MINT_ADDRESS is invalid.");
  }

  const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  const mint = await getMint(connection, mintAddress);

  if (mint.decimals !== env.PIKO_DECIMALS) {
    throw new HttpError(
      500,
      `PIKO_DECIMALS mismatch. Env is ${env.PIKO_DECIMALS}, on-chain mint is ${mint.decimals}.`,
    );
  }
}
