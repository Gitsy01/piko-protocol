"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AIDecisionSummaryPanel } from "@/components/ai-decision-summary-panel";
import { DecisionReceipt } from "@/components/DecisionReceipt";
import { QuestCard } from "@/components/quest-card";
import { ScanPayButton } from "@/components/scan-pay-button";
import { useDemoMode } from "@/hooks/use-demo-mode";
import type { QuestCompletionReceipt } from "@/lib/decision-receipt";
import { useMerchantMap } from "@/hooks/use-merchant-map";
import { getQuest } from "@/lib/api";
import { toFriendlyMessage } from "@/lib/ui-messages";
import { AIDecisionSummary, QuestDetail } from "@/lib/types";
import { formatDistance } from "@/lib/utils";

type QuestPageClientProps = {
  questId: string;
};

export function QuestPageClient({ questId }: QuestPageClientProps) {
  const demoMode = useDemoMode();
  const { connected, publicKey } = useWallet();
  const { location, accuracy } = useMerchantMap();
  const [quest, setQuest] = useState<QuestDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [aiDecision, setAiDecision] = useState<AIDecisionSummary | null>(null);
  const [completionResult, setCompletionResult] = useState<QuestCompletionReceipt | null>(null);

  useEffect(() => {
    setIsMounted(true);
    getQuest(questId, publicKey?.toBase58())
      .then((data) => setQuest(data.quest))
      .catch((error) =>
        setLoadError(
          toFriendlyMessage(
            error instanceof Error ? error.message : "",
            "Failed to load quest",
          )
        )
      );
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
          <h1>Could not load this live incentive</h1>
          <p className="heroCopy">{loadError}</p>
        </section>
      </div>
    );
  }

  if (!quest) {
    return (
      <div className="pageStack questPage">
        <section className="heroPanel walletHero">
          <p className="eyebrow">Loading live incentive</p>
          <h1>Fetching settlement context</h1>
          <p className="heroCopy">Reading merchant details, claim status, and verification context.</p>
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

  if (demoMode) {
    return (
      <div className="pageStack questPage">
        <section className="heroPanel walletHero demoQuestHero">
          <div>
            <p className="eyebrow">Focused demo flow</p>
            <h1>{quest.title}</h1>
            <p className="heroCopy">
              One merchant, one payment loop, one visible decision receipt.
            </p>
            <div className="questMetaRow">
              <span>{quest.questType}</span>
              <span>{quest.rewardAmount.toFixed(2)} {quest.rewardToken}</span>
              <span>{formatDistance(quest.merchant.distance)}</span>
            </div>
          </div>
          <div className="heroStats">
            <div className="statChip">
              <span>{quest.multiplier.toFixed(1)}x</span>
              <p>Boost cap</p>
            </div>
            <div className="statChip">
              <span>{connected ? "Ready" : "Connect"}</span>
              <p>Wallet</p>
            </div>
          </div>
        </section>

        <div className="twoColumnLayout questLayout">
          <div className="questColumn">
            <QuestCard quest={quest} compact />

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
                  <p className="metricLabel">Area</p>
                  <strong>{quest.merchant.district}</strong>
                </div>
                <div>
                  <p className="metricLabel">Merchant profile</p>
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
              onAiDecisionChange={setAiDecision}
              onCompletionChange={setCompletionResult}
            />

            {completionResult ? <DecisionReceipt data={completionResult} /> : null}
            <AIDecisionSummaryPanel decision={aiDecision} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pageStack questPage">
      <section className="questSpotlight">
        <div className="questSpotlightCopy">
          <p className="eyebrow">Active incentive</p>
          <h1>{quest.title}</h1>
          <p className="heroCopy">
            Merchant-funded incentive flow with live demand, visible verification, and instant Solana settlement.
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
                <span>allocated</span>
            </div>
          </div>

          <div className="questPulseCard">
            <span className="metricLabel">Demand signal</span>
            <strong>{quest.claimVelocity}% of live area average</strong>
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
                <p className="eyebrow">Settlement checklist</p>
                <h2>Complete the verification flow cleanly</h2>
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
                  <p className="metricLabel">Area</p>
                  <strong>{quest.merchant.district}</strong>
                </div>
                <div>
                  <p className="metricLabel">Merchant profile</p>
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
            onCompletionChange={setCompletionResult}
          />

          {completionResult ? <DecisionReceipt data={completionResult} /> : null}

          <section className="walletHint connectHint">
            <p className="eyebrow">Wallet status</p>
            <h3>{connected ? "Wallet connected and ready to sign" : "Connect a wallet to complete the incentive flow"}</h3>
            <p className="supportText">
              Phantom and Backpack are ready for the QR handoff and verification loop.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
