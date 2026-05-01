"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { QuestCard } from "@/components/quest-card";
import { ScanPayButton } from "@/components/scan-pay-button";
import { useMerchantMap } from "@/hooks/use-merchant-map";
import { getQuest } from "@/lib/api";
import { QuestDetail } from "@/lib/types";
import { formatDistance } from "@/lib/utils";

type QuestPageClientProps = {
  questId: string;
};

export function QuestPageClient({ questId }: QuestPageClientProps) {
  const { connected, publicKey } = useWallet();
  const { location, accuracy } = useMerchantMap();
  const [quest, setQuest] = useState<QuestDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setIsMounted(true);
    getQuest(questId, publicKey?.toBase58())
      .then((data) => setQuest(data.quest))
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Failed to load quest"));
  }, [questId, publicKey]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (loadError) {
    return (
      <div className="pageStack questPage">
        <section className="heroPanel walletHero">
          <p className="eyebrow">Quest unavailable</p>
          <h1>Could not load this live quest</h1>
          <p className="heroCopy">{loadError}</p>
        </section>
      </div>
    );
  }

  if (!quest) {
    return (
      <div className="pageStack questPage">
        <section className="heroPanel walletHero">
          <p className="eyebrow">Loading live quest</p>
          <h1>Fetching mission state</h1>
          <p className="heroCopy">Reading the backend quest, claim status, and merchant wallet.</p>
        </section>
      </div>
    );
  }

  const expTime = Math.max(0, new Date(quest.expiresAt).getTime() - now);
  const totalSecs = Math.floor(expTime / 1000);
  const countdown = isMounted
    ? {
        hours: Math.floor(totalSecs / 3600),
        minutes: Math.floor((totalSecs % 3600) / 60),
        seconds: totalSecs % 60,
      }
    : {
        hours: 0,
        minutes: 0,
        seconds: 0,
      };

  const progress = Math.round((quest.claimedCount / quest.maxClaims) * 100);
  const devnetPaymentAmount = Math.max(0.001, Number((quest.minSpend / 1000).toFixed(3)));
  const ringStyle = {
    background: `conic-gradient(var(--brand) 0 ${progress}%, rgba(255,255,255,0.08) ${progress}% 100%)`,
  } as CSSProperties;

  return (
    <div className="pageStack questPage">
      <section className="questSpotlight">
        <div className="questSpotlightCopy">
          <p className="eyebrow">Active mission</p>
          <h1>{quest.title}</h1>
          <p className="heroCopy">
            Premium sponsored quest flow with live claim velocity, countdown pressure, and instant Solana rewards.
          </p>

          <div className="questMetaRow">
            <span>{quest.questType}</span>
            <span>{quest.multiplier.toFixed(1)}x multiplier</span>
            <span>{quest.xpReward} XP</span>
            <span>{quest.badgeReward}</span>
          </div>

          <div className="countdownCluster">
            <div className="countdownCard">
              <strong>{String(countdown.hours).padStart(2, "0")}</strong>
              <span>Hours</span>
            </div>
            <div className="countdownCard">
              <strong>{String(countdown.minutes).padStart(2, "0")}</strong>
              <span>Minutes</span>
            </div>
            <div className="countdownCard">
              <strong>{String(countdown.seconds).padStart(2, "0")}</strong>
              <span>Seconds</span>
            </div>
          </div>
        </div>

        <div className="questProgressCluster">
          <div className="progressRing" style={ringStyle}>
            <div className="progressRingInner">
              <strong>{progress}%</strong>
              <span>claimed</span>
            </div>
          </div>

          <div className="questPulseCard">
            <span className="metricLabel">Claim velocity</span>
            <strong>{quest.claimVelocity}% of live zone average</strong>
            <p>{quest.bonusWindow}</p>
          </div>
        </div>
      </section>

      <div className="twoColumnLayout questLayout">
        <div className="questColumn">
          <QuestCard quest={quest} />

          <section className="questChecklistCard">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Mission checklist</p>
                <h2>Complete the loop cleanly</h2>
              </div>
            </div>

            <div className="questChecklist">
              {quest.requirements.map((requirement) => (
                <div className={`checklistItem ${requirement.done ? "done" : ""}`} key={requirement.id}>
                  <div className="checklistMark">{requirement.done ? "OK" : "GO"}</div>
                  <div>
                    <strong>{requirement.label}</strong>
                    {requirement.hint ? <p>{requirement.hint}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="merchantMiniCard">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Merchant card</p>
                <h2>{quest.merchant.name}</h2>
              </div>
              <span className="distanceBadge">{formatDistance(quest.merchant.distance)}</span>
            </div>

            <div className="merchantMetrics">
              <div>
                <p className="metricLabel">Category</p>
                <strong>{quest.merchant.category}</strong>
              </div>
              <div>
                <p className="metricLabel">District</p>
                <strong>{quest.merchant.district}</strong>
              </div>
              <div>
                <p className="metricLabel">Scene</p>
                <strong>{quest.merchant.vibe}</strong>
              </div>
            </div>
          </section>
        </div>

        <div className="questSideColumn">
          <ScanPayButton
            merchantId={quest.merchantId}
            questId={quest.id}
            amount={devnetPaymentAmount}
            rewardAmount={quest.rewardAmount}
            rewardToken={quest.rewardToken}
            userLocation={location}
            userAccuracy={accuracy}
          />

          <section className="walletHint connectHint">
            <p className="eyebrow">Wallet status</p>
            <h3>{connected ? "Wallet connected and ready to sign" : "Connect a wallet to finish the mission"}</h3>
            <p className="supportText">
              Phantom and Backpack are ready for the QR handoff. NFC prompt stays primed for tap-based demos.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
