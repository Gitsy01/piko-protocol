"use client";

import type { WorldIdProofPayload } from "@/lib/api";

type VerificationGateProps = {
  worldVerified: boolean;
  wallet: string;
  sessionId: string;
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

export function VerificationGate({
  worldVerified,
  wallet,
  sessionId,
  pending = false,
  onVerify,
}: VerificationGateProps) {
  if (worldVerified) {
    return (
      <div className="verificationGate verified" id="verification-gate">
        <div className="verificationGateIcon" aria-hidden="true">🛡️</div>
        <div className="verificationGateContent">
          <strong>Human Verified</strong>
          <span className="supportText">World ID proof accepted — claim path is unlocked.</span>
        </div>
        <span className="verificationGateBadge verified">✔ Verified</span>
      </div>
    );
  }

  return (
    <div className="verificationGate blocked" id="verification-gate">
      <div className="verificationGateCard">
        <div className="verificationGateIcon" aria-hidden="true">🔒</div>
        <h3>Verification Required</h3>
        <p>
          World ID verification is required before rewards can be claimed.
          This prevents bots from farming incentives and ensures every reward
          goes to a real human.
        </p>

        <div className="verificationGateStatus">
          <span className="verificationGateStatusDot" aria-hidden="true" />
          <span>Status: <strong>Not verified</strong></span>
        </div>

        <button
          className="primaryButton verificationGateCta"
          type="button"
          disabled={pending}
          onClick={() => void onVerify(buildDemoProof(wallet, sessionId))}
        >
          {pending ? "Verifying human..." : "🌐 Verify with World ID"}
        </button>

        <p className="verificationGateNote">
          In production, this uses the World ID SDK with biometric proof.
          For the demo, we simulate the proof payload.
        </p>
      </div>
    </div>
  );
}
