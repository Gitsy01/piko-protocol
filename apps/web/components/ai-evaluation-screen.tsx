"use client";

import { useEffect, useState } from "react";
import { useDemoContext } from "@/providers/demo-context";

function getRiskLabel(score: number) {
  if (score <= 15) return "LOW RISK";
  if (score <= 45) return "MEDIUM RISK";
  return "HIGH RISK";
}

function getRiskTone(score: number) {
  if (score <= 15) return "low";
  if (score <= 45) return "medium";
  return "high";
}

const VERIFICATION_STEPS = [
  { id: "payment", checkLabel: "Checking payment…", doneLabel: "Payment confirmed" },
  { id: "location", checkLabel: "Checking location…", doneLabel: "Location verified" },
  { id: "identity", checkLabel: "Recording identity signal…", doneLabel: "Identity signal recorded" },
  { id: "fraud", checkLabel: "Analyzing fraud risk…", doneLabel: "" },
  { id: "reward", checkLabel: "Approving reward…", doneLabel: "" },
] as const;

export function AIEvaluationScreen() {
  const { state, dispatch } = useDemoContext();
  const { aiEvaluation } = state;
  const [phase, setPhase] = useState<"scanning" | "verified">("scanning");
  const [revealStep, setRevealStep] = useState(0);

  const evaluation = aiEvaluation ?? {
    fraudScore: 8,
    fraudFlags: ["verified_payment", "world_id_verified", "clean_travel_history"],
    rewardMultiplier: 1.25,
    rewardReasons: ["First-time visit", "Verified payment", "Budget healthy"],
    decision: "APPROVED" as const,
    worldVerified: true,
    paymentVerified: true,
    paymentAmountSol: 0.05,
    locationDistanceMeters: 42,
    gpsAccuracyMeters: 9,
    impossibleTravelClear: true,
    aiSummary: "Verified payment, valid location, and clean travel history cleared the claim for settlement.",
    originalReward: 4,
    adjustedReward: 5,
    adjustedRewardDisplay: "5.00",
    rewardToken: "PIKO",
    merchantBudget: 120,
    dailyEmissionRemaining: 8500,
    budgetCapActive: false,
  };

  const isApproved = evaluation.decision === "APPROVED";
  const locationOk = evaluation.locationDistanceMeters <= 100 && evaluation.gpsAccuracyMeters <= 35;
  const fraudOk = evaluation.fraudScore <= 45 && evaluation.impossibleTravelClear;
  const riskLabel = getRiskLabel(evaluation.fraudScore);
  const riskTone = getRiskTone(evaluation.fraudScore);

  const checks = [
    { ok: evaluation.paymentVerified },
    { ok: locationOk },
    { ok: evaluation.worldVerified },
    { ok: fraudOk },
    { ok: isApproved },
  ];

  // Controlled motion: reveal checks one-by-one during scanning phase
  useEffect(() => {
    if (phase !== "scanning") return;

    if (revealStep >= VERIFICATION_STEPS.length) {
      // All steps scanned — transition to verified
      const doneTimer = window.setTimeout(() => setPhase("verified"), 600);
      return () => window.clearTimeout(doneTimer);
    }

    const delay = revealStep === 0 ? 500 : 700;
    const timer = window.setTimeout(() => {
      setRevealStep((c) => c + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [revealStep, phase]);

  // Auto-advance to reward step
  useEffect(() => {
    if (phase !== "verified") return;
    const timer = window.setTimeout(() => {
      dispatch({ type: "EVALUATION_DONE" });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [phase, dispatch]);

  /* ── Phase 1: Controlled scanning with sequential reveals ── */
  if (phase === "scanning") {
    return (
      <div className="aiEvalScreen receiptScreen" id="ai-evaluation-screen">
        <div className="receiptScanCard" aria-live="polite">
          <div className="receiptScanIcon" aria-hidden="true">
            <span className="receiptScanRing" />
            <span className="receiptScanRing delay" />
            <svg className="receiptScanCheck" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>

          <h2 className="receiptScanTitle">Validating contribution</h2>
          <p className="receiptScanSub">System is checking each signal before reward approval.</p>

          <div className="receiptScanSteps">
            {VERIFICATION_STEPS.map((step, i) => {
              const isRevealed = i < revealStep;
              const isCurrent = i === revealStep;
              const check = checks[i];

              let label: string = step.checkLabel;
              if (isRevealed) {
                if (step.id === "fraud") {
                  label = `Fraud score: ${evaluation.fraudScore}/100 — ${riskLabel}`;
                } else if (step.id === "reward") {
                  label = isApproved ? "Reward approved" : "Reward blocked";
                } else {
                  label = step.doneLabel;
                }
              }

              return (
                <div
                  key={step.id}
                  className={`receiptScanStep ${isRevealed ? "revealed" : ""} ${isCurrent ? "current" : ""} ${isRevealed && check?.ok ? "passed" : ""} ${isRevealed && !check?.ok ? "failed" : ""}`}
                >
                  <span className="receiptScanStepIcon" aria-hidden="true">
                    {isRevealed ? (
                      check?.ok ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      )
                    ) : isCurrent ? (
                      <span className="receiptScanPulse" />
                    ) : (
                      <span className="receiptScanDot" />
                    )}
                  </span>
                  <span className="receiptScanStepLabel">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ── Phase 2: Full verified receipt ── */
  return (
    <div className="aiEvalScreen receiptScreen" id="ai-evaluation-screen">
      <section className={`receiptCard ${isApproved ? "approved" : "rejected"}`} aria-live="polite">

        {/* TOP SECTION — Hero heading */}
        <header className="receiptHero">
          <div className="receiptHeroBadge" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isApproved ? <path d="M20 6L9 17l-5-5" /> : <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>}
            </svg>
          </div>
          <h2 className="receiptHeading">{isApproved ? "Contribution Verified" : "Contribution Rejected"}</h2>
          <p className="receiptSubheading">
            {isApproved
              ? "Reward approved on Solana devnet"
              : "Reward blocked — system enforcement protected the treasury"}
          </p>
        </header>

        {/* MIDDLE SECTION — Verification stack */}
        <ul className="receiptChecklist">
          <li className={evaluation.paymentVerified ? "passed" : "failed"}>
            <span className="receiptCheckIcon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                {evaluation.paymentVerified
                  ? <path d="M3.5 9l4 4L14.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  : <><path d="M4.5 4.5l9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
              </svg>
            </span>
            <span className="receiptCheckLabel">Payment confirmed</span>
          </li>
          <li className={locationOk ? "passed" : "failed"}>
            <span className="receiptCheckIcon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                {locationOk
                  ? <path d="M3.5 9l4 4L14.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  : <><path d="M4.5 4.5l9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
              </svg>
            </span>
            <span className="receiptCheckLabel">Location verified</span>
          </li>
          <li className={evaluation.worldVerified ? "passed" : "failed"}>
            <span className="receiptCheckIcon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                {evaluation.worldVerified
                  ? <path d="M3.5 9l4 4L14.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  : <><path d="M4.5 4.5l9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
              </svg>
            </span>
            <span className="receiptCheckLabel">Identity signal recorded</span>
          </li>
          <li className={fraudOk ? "passed" : "failed"}>
            <span className="receiptCheckIcon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                {fraudOk
                  ? <path d="M3.5 9l4 4L14.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  : <><path d="M4.5 4.5l9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
              </svg>
            </span>
            <span className="receiptCheckLabel">Fraud score: {riskLabel}</span>
          </li>
          <li className={isApproved ? "passed" : "failed"}>
            <span className="receiptCheckIcon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                {isApproved
                  ? <path d="M3.5 9l4 4L14.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  : <><path d="M4.5 4.5l9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
              </svg>
            </span>
            <span className="receiptCheckLabel">{isApproved ? "Reward approved" : "Reward blocked"}</span>
          </li>
        </ul>

        {/* FRAUD SCORE CARD */}
        <div className={`receiptFraudCard ${riskTone}`}>
          <div className="receiptFraudScore">{evaluation.fraudScore}</div>
          <div className="receiptFraudMeta">
            <span className="receiptFraudDenom">/ 100</span>
            <span className={`receiptFraudLabel ${riskTone}`}>{riskLabel}</span>
          </div>
        </div>

        {/* BOTTOM SECTION — Reward + proof outcome */}
        <div className="receiptOutcome">
          <div className="receiptRewardPill">
            <span className="receiptRewardSign">+</span>
            <span className="receiptRewardAmount">{evaluation.adjustedRewardDisplay}</span>
            <span className="receiptRewardToken">{evaluation.rewardToken}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
