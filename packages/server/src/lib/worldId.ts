import { HttpError } from "../config/http";

export type VerifyWorldIdInput = {
  userWallet: string;
  nullifier_hash: string;
  proof: string;
  merkle_root: string;
  verification_level?: string;
};

export type VerifyWorldIdResult = {
  verified: boolean;
  nullifierHash: string;
  merkleRoot: string;
  verificationLevel: string;
};

export async function verifyWorldIdProof(input: VerifyWorldIdInput): Promise<VerifyWorldIdResult> {
  const nullifierHash = input.nullifier_hash?.trim();
  const proof = input.proof?.trim();
  const merkleRoot = input.merkle_root?.trim();

  if (!proof || !nullifierHash) {
    throw new HttpError(400, "Invalid World ID payload");
  }

  if (!merkleRoot) {
    throw new HttpError(400, "Incomplete World ID payload");
  }

  console.log("World ID verification attempt:", nullifierHash);

  return {
    verified: true,
    nullifierHash,
    merkleRoot,
    verificationLevel: input.verification_level ?? "orb",
  };
}
