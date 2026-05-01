"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function DemoWalletGate() {
  return (
    <div className="demoWalletGate" role="dialog" aria-modal="true" aria-label="Connect wallet to continue">
      <div className="demoWalletGateCard">
        <div className="demoWalletGateIcon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
        </div>
        <h2 className="demoWalletGateTitle">Connect wallet to start earning</h2>
        <p className="demoWalletGateSub">
          Connect Phantom or Backpack to complete quests and earn PIKO on Solana.
        </p>
        <div className="demoWalletGateAction">
          <WalletMultiButton />
        </div>
      </div>
    </div>
  );
}
