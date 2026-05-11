"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useDemoContext } from "@/providers/demo-context";
import { formatDistance, formatReward } from "@/lib/utils";

export function DemoQuestCard() {
  const { state, dispatch } = useDemoContext();
  const { publicKey } = useWallet();
  const { quest, merchant } = state;

  const reward = formatReward(quest.rewardAmount, quest.rewardToken);
  const distance = formatDistance(merchant.distance);

  return (
    <div className="demoQuestCard" id="demo-quest-card">
      <div className="demoQuestCardTop">
        <div className="demoQuestMerchantAvatar" aria-hidden="true">
          {merchant.avatar}
        </div>
        <div className="demoQuestMerchantInfo">
          <p className="receiptEyebrow">Merchant opportunity</p>
          <h2 className="demoQuestMerchantName">Visit {merchant.name}</h2>
          <p className="demoQuestCategory">
            {merchant.category} — {merchant.district}
          </p>
        </div>
      </div>

      <div className="demoQuestStory">
        <h3>Earn {quest.rewardAmount} {quest.rewardToken}</h3>
        <p>PIKO will check payment, location, identity signal, and fraud risk before the reward is settled.</p>
      </div>

      <div className="demoQuestMeta">
        <div className="demoQuestMetaItem">
          <span>Distance</span>
          <strong>{distance}</strong>
        </div>
        <div className="demoQuestMetaItem demoQuestReward">
          <span>Reward</span>
          <strong>{reward}</strong>
        </div>
      </div>

      <button
        id="demo-complete-quest-btn"
        className="demoCta"
        type="button"
        onClick={() => {
          if (!publicKey) {
            return;
          }

          dispatch({ type: "START_QUEST" });
        }}
        disabled={!publicKey}
      >
        {publicKey ? "Continue to validation" : "Connect wallet first"}
      </button>
    </div>
  );
}
