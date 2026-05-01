import {
  createMintToInstruction,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import {
  Connection,
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { env } from "../config/env";
import { HttpError } from "../config/http";
import { loadAnchorWalletKeypair } from "./anchorWallet";
import { loadPikoMintAuthorityKeypair } from "./mintAuthorityWallet";
import { decimalToBaseUnits } from "./tokenMath";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const RECOVERY_SIGNATURE_SCAN_LIMIT = 25;

export type RewardMintAnchor = {
  claimId: string;
  reference: string;
};

export function buildRewardMintMemo(anchor: RewardMintAnchor) {
  return `depokemongo:reward:${anchor.claimId}:${anchor.reference}`;
}

/**
 * Mint PIKO tokens to a user's associated token account.
 *
 * Prerequisites:
 *  - env.PIKO_MINT_ADDRESS is set to the on-chain PIKO mint address
 *  - env.PIKO_MINT_AUTHORITY_WALLET points to the dedicated mint authority keypair
 */
export async function mintPiko(
  userWallet: string,
  amount: bigint | number | string,
  anchor?: RewardMintAnchor,
): Promise<string> {
  let mintAddress: PublicKey;
  try {
    mintAddress = new PublicKey(env.PIKO_MINT_ADDRESS);
  } catch {
    throw new HttpError(
      500,
      "PIKO_MINT_ADDRESS is invalid. Set it to the SPL token mint public key before minting.",
    );
  }

  let userPubkey: PublicKey;
  try {
    userPubkey = new PublicKey(userWallet);
  } catch {
    throw new HttpError(400, "Invalid user wallet address");
  }

  const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  const payer = loadAnchorWalletKeypair();
  const mintAuthority = loadPikoMintAuthorityKeypair();
  const rawAmount =
    typeof amount === "bigint" ? amount : decimalToBaseUnits(amount, env.PIKO_DECIMALS);

  const userAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mintAddress,
    userPubkey,
  );

  const transaction = new Transaction();
  if (anchor) {
    transaction.add(
      new TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [{ pubkey: mintAuthority.publicKey, isSigner: true, isWritable: false }],
        data: Buffer.from(buildRewardMintMemo(anchor), "utf8"),
      }),
    );
  }

  transaction.add(
    createMintToInstruction(
      mintAddress,
      userAta.address,
      mintAuthority.publicKey,
      rawAmount,
    ),
  );

  return sendAndConfirmTransaction(connection, transaction, [payer, mintAuthority], {
    commitment: "confirmed",
  });
}

export async function findMintedPikoRewardTx(
  userWallet: string,
  amountBaseUnits: bigint,
  anchor: RewardMintAnchor,
): Promise<string | null> {
  let mintAddress: PublicKey;
  let userPubkey: PublicKey;
  try {
    mintAddress = new PublicKey(env.PIKO_MINT_ADDRESS);
    userPubkey = new PublicKey(userWallet);
  } catch {
    return null;
  }

  const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  const mintAuthority = loadPikoMintAuthorityKeypair();
  const userAta = await getAssociatedTokenAddress(mintAddress, userPubkey);
  const memo = buildRewardMintMemo(anchor);
  const signatures = await collectCandidateSignatures(connection, [
    userAta,
    mintAddress,
    mintAuthority.publicKey,
  ]);

  for (const signature of signatures) {
    const transaction = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction?.meta || transaction.meta.err) {
      continue;
    }

    if (!includesRewardMemo(transaction, memo)) {
      continue;
    }

    if (
      !hasMintToInstruction(
        transaction,
        mintAddress.toBase58(),
        userAta.toBase58(),
        amountBaseUnits,
      )
    ) {
      continue;
    }

    return signature;
  }

  return null;
}

async function collectCandidateSignatures(connection: Connection, addresses: PublicKey[]) {
  const signatures = new Set<string>();

  for (const address of addresses) {
    const results = await connection.getSignaturesForAddress(address, {
      limit: RECOVERY_SIGNATURE_SCAN_LIMIT,
    });

    for (const result of results) {
      signatures.add(result.signature);
    }
  }

  return [...signatures];
}

function includesRewardMemo(transaction: ParsedTransactionWithMeta, expectedMemo: string) {
  if (transaction.meta?.logMessages?.some((log) => log.includes(expectedMemo))) {
    return true;
  }

  for (const instruction of getParsedInstructions(transaction)) {
    const memo =
      typeof instruction.parsed === "string"
        ? instruction.parsed
        : readStringField(instruction.parsed, "memo");

    if (memo === expectedMemo) {
      return true;
    }
  }

  return false;
}

function hasMintToInstruction(
  transaction: ParsedTransactionWithMeta,
  expectedMint: string,
  expectedAccount: string,
  expectedAmount: bigint,
) {
  return getParsedInstructions(transaction).some((instruction) => {
    if (instruction.program !== "spl-token") {
      return false;
    }

    const type =
      instruction.parsed && typeof instruction.parsed === "object"
        ? readStringField(instruction.parsed, "type")
        : null;

    if (type !== "mintTo" && type !== "mintToChecked") {
      return false;
    }

    const info =
      instruction.parsed && typeof instruction.parsed === "object"
        ? (instruction.parsed as { info?: unknown }).info
        : null;
    const mint = readStringField(info, "mint");
    const account = readStringField(info, "account") ?? readStringField(info, "destination");
    const amount =
      readBigIntField(info, "amount") ??
      readBigIntField(readObjectField(info, "tokenAmount"), "amount") ??
      0n;

    return mint === expectedMint && account === expectedAccount && amount === expectedAmount;
  });
}

function getParsedInstructions(transaction: ParsedTransactionWithMeta): ParsedInstruction[] {
  const instructions: ParsedInstruction[] = [];

  for (const instruction of transaction.transaction.message.instructions) {
    if ("parsed" in instruction) {
      instructions.push(instruction);
    }
  }

  for (const inner of transaction.meta?.innerInstructions ?? []) {
    for (const instruction of inner.instructions) {
      if ("parsed" in instruction) {
        instructions.push(instruction);
      }
    }
  }

  return instructions;
}

function readStringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : null;
}

function readObjectField(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const field = (value as Record<string, unknown>)[key];
  return field && typeof field === "object" ? (field as Record<string, unknown>) : null;
}

function readBigIntField(value: unknown, key: string): bigint | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const field = (value as Record<string, unknown>)[key];
  if (typeof field === "bigint") {
    return field;
  }

  if (typeof field === "number" && Number.isInteger(field)) {
    return BigInt(field);
  }

  if (typeof field === "string" && /^-?\d+$/.test(field)) {
    return BigInt(field);
  }

  return null;
}
