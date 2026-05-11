"use client";

import { useDemoContext } from "@/providers/demo-context";

const STEPS = [
  { key: "discover", label: "Discover" },
  { key: "pay", label: "Confirm" },
  { key: "evaluating", label: "Validate" },
  { key: "reward", label: "Proof" },
] as const;

export function DemoStepper() {
  const { stepIndex } = useDemoContext();

  return (
    <div className="demoStepper" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemax={4}>
      {STEPS.map((step, index) => {
        const isDone = index < stepIndex;
        const isActive = index === stepIndex;

        return (
          <div
            key={step.key}
            className={`demoStepItem ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}
          >
            <div className="demoStepDot" aria-hidden="true">
              {isDone ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : isActive && step.key === "evaluating" ? (
                <span className="demoStepPulse" />
              ) : (
                <span />
              )}
            </div>
            <span className="demoStepLabel">{step.label}</span>
            {index < STEPS.length - 1 ? (
              <div className={`demoStepConnector ${isDone ? "done" : ""}`} aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
