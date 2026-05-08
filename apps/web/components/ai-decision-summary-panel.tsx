"use client";

import type { AIDecisionSummary } from "@/lib/types";

type AIDecisionSummaryPanelProps = {
  decision: AIDecisionSummary | null;
  loading?: boolean;
};

function renderEmptyState() {
  return (
    <div className="aiSummaryEmpty">
      <strong>AI decision pending</strong>
      <p className="supportText">Complete the payment step to reveal the fraud tier, reward multiplier, and agent reason.</p>
    </div>
  );
}

export function AIDecisionSummaryPanel({
  decision,
  loading = false,
}: AIDecisionSummaryPanelProps) {
  if (!decision && !loading) {
    return (
      <section className="aiSummaryPanel" aria-live="polite">
        <div className="aiSummaryHeader">
          <div>
            <p className="eyebrow">AI Decision</p>
            <h3>Read-only agent output</h3>
          </div>
        </div>
        {renderEmptyState()}
      </section>
    );
  }

  return (
    <section className="aiSummaryPanel" aria-live="polite">
      <div className="aiSummaryHeader">
        <div>
          <p className="eyebrow">AI Decision</p>
          <h3>Read-only agent output</h3>
        </div>
        {decision ? (
          <span className={`aiSummaryDecisionBadge ${decision.decision.toLowerCase()}`}>
            {decision.decision}
          </span>
        ) : null}
      </div>

      {loading && !decision ? (
        <div className="aiSummaryEmpty">
          <strong>Loading agent output</strong>
          <p className="supportText">Pulling the finalized decision from `/api/ai`.</p>
        </div>
      ) : null}

      {decision ? (
        <div className="aiSummaryGrid">
          <article className="aiSummaryMetric">
            <span className="metricLabel">Fraud tier</span>
            <strong className={`aiSummaryTier ${decision.fraudTier.toLowerCase()}`}>
              {decision.fraudTier}
            </strong>
            <p className="supportText">Score {decision.fraudScore.toFixed(2)}</p>
          </article>

          <article className="aiSummaryMetric">
            <span className="metricLabel">Reward multiplier</span>
            <strong>{decision.rewardMultiplier.toFixed(2)}x</strong>
            <p className="supportText">Applied after fraud review</p>
          </article>

          <article className="aiSummaryMetric aiSummaryReason">
            <span className="metricLabel">Agent reason</span>
            <strong>{decision.reason}</strong>
          </article>
        </div>
      ) : null}
    </section>
  );
}
