"use client";

import { createContext, useContext, useReducer, type PropsWithChildren } from "react";
import { demoMerchants, demoQuests } from "@/lib/demo-data";
import type { MerchantPinType, QuestDetail } from "@/lib/types";

export type DemoStep = "discover" | "pay" | "evaluating" | "reward";

export type AIEvaluationData = {
  fraudScore: number;
  fraudFlags: string[];
  rewardMultiplier: number;
  rewardReasons: string[];
  decision: "APPROVED" | "REJECTED";
  worldVerified: boolean;
  aiSummary: string;
  originalReward: number;
  adjustedReward: number;
  adjustedRewardDisplay: string;
  rewardToken: string;
};

export type DemoRewardResult = {
  txSignature: string | null;
  rewardToken: string;
  rewardAmount: number;
  xpEarned: number;
  newLevel: number;
  aiSummary: string | null;
  badgeReward: string;
  nftMint?: string | null;
};

export type DemoState = {
  step: DemoStep;
  quest: QuestDetail;
  merchant: MerchantPinType;
  worldVerified: boolean;
  verifyPending: boolean;
  rewardResult: DemoRewardResult | null;
  aiEvaluation: AIEvaluationData | null;
};

type DemoAction =
  | { type: "START_QUEST" }
  | { type: "VERIFY_START" }
  | { type: "VERIFY_COMPLETE"; payload: { worldVerified: boolean } }
  | {
      type: "PAYMENT_COMPLETE";
      payload: {
        rewardResult: DemoRewardResult;
        aiEvaluation: AIEvaluationData;
      };
    }
  | { type: "EVALUATION_DONE" }
  | { type: "RESET" };

const DEFAULT_QUEST = demoQuests[0];
const DEFAULT_MERCHANT = demoMerchants[0];

const initialState: DemoState = {
  step: "discover",
  quest: DEFAULT_QUEST,
  merchant: DEFAULT_MERCHANT,
  worldVerified: false,
  verifyPending: false,
  rewardResult: null,
  aiEvaluation: null,
};

function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "START_QUEST":
      return { ...state, step: "pay", rewardResult: null, aiEvaluation: null };
    case "VERIFY_START":
      return { ...state, verifyPending: true };
    case "VERIFY_COMPLETE":
      return {
        ...state,
        worldVerified: action.payload.worldVerified,
        verifyPending: false,
      };
    case "PAYMENT_COMPLETE":
      return {
        ...state,
        step: "evaluating",
        rewardResult: action.payload.rewardResult,
        aiEvaluation: action.payload.aiEvaluation,
      };
    case "EVALUATION_DONE":
      return { ...state, step: "reward" };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

const STEP_MAP: Record<DemoStep, number> = {
  discover: 0,
  pay: 1,
  evaluating: 2,
  reward: 3,
};

type DemoContextValue = {
  state: DemoState;
  dispatch: React.Dispatch<DemoAction>;
  stepIndex: number;
  isComplete: boolean;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoContextProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(demoReducer, initialState);
  const stepIndex = STEP_MAP[state.step];
  const isComplete = state.step === "reward";

  return (
    <DemoContext.Provider value={{ state, dispatch, stepIndex, isComplete }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoContext() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemoContext must be used within DemoContextProvider");
  return ctx;
}
