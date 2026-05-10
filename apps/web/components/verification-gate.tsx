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
        <div className="verificationGateIcon" aria-hidden="true">Shield</div>
        <div className="verificationGateContent">
          <strong>Human Verified</strong>
          <span className="supportText">Human-verification signal accepted. The settlement path is now available.</span>
        </div>
        <span className="verificationGateBadge verified">Verified</span>
      </div>
    );
  }

  return (
    <div className="verificationGate blocked" id="verification-gate">
      <div className="verificationGateCard">
        <div className="verificationGateIcon" aria-hidden="true">Lock</div>
        <h3>Verification Required</h3>
        <p>
          A human-verification signal is required before rewards can be claimed.
          This helps reduce bot farming and gives each reward a human-verification signal.
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
          {pending ? "Verifying signal..." : "Verify human signal"}
        </button>

        <p className="verificationGateNote">
          The demo stores a World ID-style proof payload. Production SDK verification is future work.
        </p>
      </div>
    </div>
  );
}
