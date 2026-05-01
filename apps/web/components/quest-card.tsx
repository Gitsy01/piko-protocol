import Link from "next/link";
import { QuestDetail } from "@/lib/types";
import { formatCountdownLabel, formatReward } from "@/lib/utils";

type QuestCardProps = {
  quest: QuestDetail;
  compact?: boolean;
};

export function QuestCard({ quest, compact = false }: QuestCardProps) {
  const progress = quest.maxClaims > 0 ? (quest.claimedCount / quest.maxClaims) * 100 : 0;
  const claimState = progress >= 80 ? "Last slots" : progress >= 45 ? "Claim window heating up" : "Claim available";
  const wallet = quest.merchant.wallet;
  const shortWallet = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  const solscanUrl = `https://solscan.io/account/${wallet}?cluster=devnet`;

  return (
    <article className={`questCard ${compact ? "compact" : ""}`} id={`quest-card-${quest.id}`}>
      <div className="questCardGlow" />
      <div className="questCardHeader">
        <div>
          <p className="eyebrow">Active reward</p>
          <h2>{quest.title}</h2>
          <p className="questDescription">{quest.description}</p>
        </div>
        <div className="questRewardCluster">
          <span className="rewardBadge">{formatReward(quest.rewardAmount, quest.rewardToken)}</span>
          <span className="xpRewardBadge">{quest.xpReward} XP</span>
        </div>
      </div>

      <div className="claimAvailableTag">
        <span className="claimDot" />
        {claimState}
      </div>

      <div className="claimProgress">
        <div className="claimProgressFill" style={{ width: `${progress}%` }} />
      </div>

      <div className="claimProgressMeta">
        <span>
          {quest.claimedCount}/{quest.maxClaims} claimed
        </span>
        <span>{formatCountdownLabel(quest.expiresAt)}</span>
      </div>

      <div className="questMetaRow">
        <span>{quest.questType}</span>
        <span>${quest.minSpend.toFixed(0)} minimum spend</span>
        <span>{quest.multiplier.toFixed(1)}x multiplier</span>
        <span>{quest.badgeReward}</span>
      </div>

      <div className="questFooter">
        <div className="questFooterIdentity">
          <div>
            <p className="metricLabel">Merchant</p>
            <strong>{quest.merchant.name}</strong>
          </div>
          <div className="merchantWalletBadge">
            <span className="merchantWalletLabel">Merchant wallet</span>
            <span className="walletAddress" title={wallet}>
              {shortWallet}
            </span>
            <a
              className="walletExplorerLink"
              href={solscanUrl}
              target="_blank"
              rel="noreferrer"
            >
              View on Solscan
            </a>
          </div>
        </div>
        <div>
          <p className="metricLabel">District</p>
          <strong>{quest.merchant.district}</strong>
        </div>
        {!compact ? (
          <Link className="primaryLink" href={`/quest/${quest.id}`}>
            Open mission
          </Link>
        ) : null}
      </div>
    </article>
  );
}
