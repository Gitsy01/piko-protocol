"use client";

import type { WorldIdProofPayload } from "@/lib/api";

type VerifyWithWorldIDProps = {
  wallet: string;
  sessionId: string;
  disabled?: boolean;
  pending?: boolean;
  onVerify: (payload: WorldIdProofPayload) => void | Promise<void>;
};

function buildDemoProof(wallet: string, sessionId: string): WorldIdProofPayload {
  const seed = `${wallet.slice(0, 10)}-${sessionId.slice(0, 8)}`;

  return {
    userWallet: wallet,
    nullifier_hash: `world-nullifier-${seed}`,
    proof: `world-proof-${seed}`,
    merkle_root: `world-root-${sessionId.slice(-12)}`,
    verification_level: "orb",
  };
}

export function VerifyWithWorldID({
  wallet,
  sessionId,
  disabled = false,
  pending = false,
  onVerify,
}: VerifyWithWorldIDProps) {
  return (
    <button
      className="primaryButton demoStageAction"
      type="button"
      disabled={disabled || pending}
      onClick={() => void onVerify(buildDemoProof(wallet, sessionId))}
    >
      {pending ? "Verifying human..." : "Verify with World ID"}
    </button>
  );
}
