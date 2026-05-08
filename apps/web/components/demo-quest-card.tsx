"use client";

import Link from "next/link";
import { useDemoContext } from "@/providers/demo-context";
import { formatDistance, formatReward } from "@/lib/utils";

export function DemoQuestCard() {
  const { state, dispatch } = useDemoContext();
  const { quest, merchant } = state;

  const reward = formatReward(quest.rewardAmount, quest.rewardToken);
  const distance = formatDistance(merchant.distance);

  return (
    <div className="demoQuestCard" id="demo-quest-card">
      <div className="demoQuestCardGlow" aria-hidden="true" />

      <div className="demoQuestCardTop">
        <div className="demoQuestMerchantAvatar" aria-hidden="true">
          {merchant.avatar}
        </div>
        <div className="demoQuestMerchantInfo">
          <h2 className="demoQuestMerchantName">{merchant.name}</h2>
          <p className="demoQuestCategory">
            {merchant.category} · {merchant.district}
          </p>
        </div>
        <span className="demoQuestTypeBadge">{quest.questType}</span>
      </div>

      <div className="demoQuestStory">
        <p className="eyebrow">Step 2</p>
        <h3>Enter the incentive flow</h3>
      </div>

      <div className="demoQuestMeta">
        <div className="demoQuestMetaItem">
          <span className="demoQuestMetaIcon" aria-hidden="true">PIN</span>
          <span>{distance}</span>
        </div>
        <div className="demoQuestMetaItem demoQuestReward">
          <span className="demoQuestMetaIcon" aria-hidden="true">PIKO</span>
          <span>Reward: <strong>{reward}</strong></span>
        </div>
      </div>

      <p className="demoQuestDesc">
        {merchant.vibe}
      </p>

      <button
        id="demo-complete-quest-btn"
        className="demoCta"
        type="button"
        onClick={() => dispatch({ type: "START_QUEST" })}
      >
        Start the 5 PIKO incentive
      </button>

      <Link
        href="/merchant/cafe-bloom"
        className="demoMerchantProfileLink"
        id="demo-merchant-profile-link"
      >
        View full merchant profile →
      </Link>
    </div>
  );
}
