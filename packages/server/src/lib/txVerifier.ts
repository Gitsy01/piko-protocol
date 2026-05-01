import {
  Connection,
  LAMPORTS_PER_SOL,
  ParsedInstruction,
  ParsedTransactionWithMeta,
} from "@solana/web3.js";

export type PaymentVerificationReport = {
  signature: string;
  confirmed: boolean;
  senderVerified: boolean;
  recipientVerified: boolean;
  amountVerified: boolean;
  referenceVerified: boolean;
  actualSender: string | null;
  actualRecipient: string | null;
  actualAmountLamports: number;
  tokenMint: string | null;
  error?: string;
};

type TransferMatch = {
  sender: string | null;
  recipient: string | null;
  amountLamports: number;
  tokenMint: string | null;
};

export async function verifyMerchantPayment(
  connection: Connection,
  signature: string,
  expectedSender: string,
  expectedRecipient: string,
  minAmountLamports: number,
  expectedReference: string,
): Promise<PaymentVerificationReport> {
  const tx = await connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx?.meta || tx.meta.err) {
    return {
      signature,
      confirmed: false,
      senderVerified: false,
      recipientVerified: false,
      amountVerified: false,
      referenceVerified: false,
      actualSender: null,
      actualRecipient: null,
      actualAmountLamports: 0,
      tokenMint: null,
      error: tx?.meta?.err
        ? JSON.stringify(tx.meta.err)
        : "Transaction not found or failed",
    };
  }

  const matchedTransfer =
    extractSolTransfer(tx, expectedRecipient) ?? extractSplTransfer(tx, expectedRecipient);

  if (matchedTransfer) {
    const sender = matchedTransfer.sender ?? getFeePayer(tx);
    return {
      signature,
      confirmed: true,
      senderVerified: sender === expectedSender,
      recipientVerified: true,
      amountVerified: matchedTransfer.amountLamports >= minAmountLamports,
      referenceVerified: includesReference(tx, expectedReference),
      actualSender: sender,
      actualRecipient: matchedTransfer.recipient ?? expectedRecipient,
      actualAmountLamports: matchedTransfer.amountLamports,
      tokenMint: matchedTransfer.tokenMint,
    };
  }

  const firstTransfer = extractSolTransfer(tx) ?? extractSplTransfer(tx);

  return {
    signature,
    confirmed: true,
    senderVerified: false,
    recipientVerified: false,
    amountVerified: false,
    referenceVerified: includesReference(tx, expectedReference),
    actualSender: firstTransfer?.sender ?? getFeePayer(tx),
    actualRecipient: firstTransfer?.recipient ?? null,
    actualAmountLamports: firstTransfer?.amountLamports ?? 0,
    tokenMint: firstTransfer?.tokenMint ?? null,
    error: `No transfer to ${expectedRecipient} found in tx`,
  };
}

function extractSolTransfer(
  tx: ParsedTransactionWithMeta,
  expectedRecipient?: string,
): TransferMatch | null {
  const systemTransfers = getParsedInstructions(tx).filter(
    (ix) => ix.program === "system" && ix.parsed?.type === "transfer",
  );

  const matchingInstruction = systemTransfers.find((ix) => {
    const destination = readStringField(ix.parsed?.info, "destination");
    return expectedRecipient ? destination === expectedRecipient : true;
  });

  if (matchingInstruction) {
    return {
      sender:
        readStringField(matchingInstruction.parsed?.info, "source") ??
        readStringField(matchingInstruction.parsed?.info, "from"),
      recipient: readStringField(matchingInstruction.parsed?.info, "destination"),
      amountLamports: readNumberField(matchingInstruction.parsed?.info, "lamports"),
      tokenMint: null,
    };
  }

  if (!expectedRecipient) {
    return null;
  }

  const accountIndex = tx.transaction.message.accountKeys.findIndex(
    (account) => account.pubkey.toBase58() === expectedRecipient,
  );

  if (accountIndex < 0) {
    return null;
  }

  const meta = tx.meta;
  if (!meta) {
    return null;
  }

  const delta =
    Number(meta.postBalances[accountIndex] ?? 0) - Number(meta.preBalances[accountIndex] ?? 0);

  if (delta > 0) {
    return {
      sender: null,
      recipient: expectedRecipient,
      amountLamports: delta,
      tokenMint: null,
    };
  }

  return null;
}

function extractSplTransfer(
  tx: ParsedTransactionWithMeta,
  expectedRecipient?: string,
): TransferMatch | null {
  const tokenOwners = new Map<string, string>();
  const tokenMints = new Map<string, string>();
  const accountKeys = tx.transaction.message.accountKeys.map((account) => account.pubkey.toBase58());

  for (const balance of [...(tx.meta?.preTokenBalances ?? []), ...(tx.meta?.postTokenBalances ?? [])]) {
    const account = accountKeys[balance.accountIndex];
    if (!account) {
      continue;
    }

    tokenOwners.set(account, balance.owner ?? tokenOwners.get(account) ?? "");
    tokenMints.set(account, balance.mint);
  }

  const tokenTransfers = getParsedInstructions(tx).filter((ix) => {
    if (ix.program !== "spl-token") {
      return false;
    }

    const type = ix.parsed?.type;
    return type === "transfer" || type === "transferChecked";
  });

  for (const ix of tokenTransfers) {
    const info = ix.parsed?.info;
    const destination = readStringField(info, "destination");
    const destinationOwner =
      readStringField(info, "destinationOwner") ||
      (destination ? tokenOwners.get(destination) ?? null : null);
    const recipient = destinationOwner ?? destination;

    if (expectedRecipient && recipient !== expectedRecipient) {
      continue;
    }

    return {
      sender:
        readStringField(info, "authority") ??
        readStringField(info, "sourceOwner") ??
        readStringField(info, "owner") ??
        readStringField(info, "source"),
      recipient,
      amountLamports: toLamportEquivalent(info),
      tokenMint:
        readStringField(info, "mint") ||
        (destination ? tokenMints.get(destination) ?? null : null),
    };
  }

  return null;
}

function getParsedInstructions(tx: ParsedTransactionWithMeta): ParsedInstruction[] {
  const instructions: ParsedInstruction[] = [];

  for (const ix of tx.transaction.message.instructions) {
    if ("parsed" in ix) {
      instructions.push(ix);
    }
  }

  for (const inner of tx.meta?.innerInstructions ?? []) {
    for (const ix of inner.instructions) {
      if ("parsed" in ix) {
        instructions.push(ix);
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

function readNumberField(value: unknown, key: string): number {
  if (!value || typeof value !== "object") {
    return 0;
  }

  const field = (value as Record<string, unknown>)[key];

  if (typeof field === "number") {
    return field;
  }

  if (typeof field === "string") {
    const parsed = Number(field);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toLamportEquivalent(info: unknown): number {
  if (!info || typeof info !== "object") {
    return 0;
  }

  const record = info as Record<string, unknown>;
  const rawAmount = record.amount;

  if (typeof rawAmount === "string" || typeof rawAmount === "number") {
    const parsedAmount = Number(rawAmount);
    const tokenAmount = record.tokenAmount;
    const decimals =
      tokenAmount && typeof tokenAmount === "object"
        ? readNumberField(tokenAmount, "decimals")
        : null;

    if (decimals != null && decimals >= 0) {
      return Math.round((parsedAmount / 10 ** decimals) * LAMPORTS_PER_SOL);
    }
  }

  const tokenAmount = record.tokenAmount;
  if (tokenAmount && typeof tokenAmount === "object") {
    const uiAmount = (tokenAmount as Record<string, unknown>).uiAmount;
    const parsedUiAmount = Number(uiAmount ?? 0);
    if (Number.isFinite(parsedUiAmount)) {
      return Math.round(parsedUiAmount * LAMPORTS_PER_SOL);
    }
  }

  return 0;
}

function getFeePayer(tx: ParsedTransactionWithMeta): string | null {
  const signer = tx.transaction.message.accountKeys.find((account) => account.signer);
  return signer?.pubkey.toBase58() ?? null;
}

function includesReference(tx: ParsedTransactionWithMeta, expectedReference: string): boolean {
  return tx.transaction.message.accountKeys.some(
    (account) => account.pubkey.toBase58() === expectedReference,
  );
}
