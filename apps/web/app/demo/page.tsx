"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { formatPiko } from "@depokemongo/common";
import {
  bootstrapDemoSession,
  buildDemoStreamUrl,
  createDemoIncentive,
  settleDemoReward,
  simulateDemoAction,
  verifyWorldId,
  type DemoBootstrapData,
  type DemoCreateIncentiveData,
  type DemoLogEvent,
  type DemoSettlementData,
  type DemoSimulationData,
  type WorldIdProofPayload,
  type WorldIdVerificationData,
} from "@/lib/api";
import { AIDecisionPanel } from "@/components/ai-decision-panel";
import { AIApprovalCard } from "@/components/ai-approval-card";
import { VerificationGate } from "@/components/verification-gate";


const INTRO_TEXT =
  "Before rewards settle, users provide a human-verification signal. Then AI-assisted scoring evaluates behavioral risk and reward economics. Finally, the protocol executes on-chain and issues tokens and proof NFTs.";

const STEPS = [
  { id: 0, label: "Opening narration", layer: "Protocol intro" },
  { id: 1, label: "Merchant creates incentive", layer: "Layer 3 - API" },
  { id: 2, label: "Identity verification", layer: "Layer 4 -> 3" },
  { id: 3, label: "Claim incentive", layer: "Layer 3 - API" },
  { id: 4, label: "AI evaluation", layer: "Layer 2 - AI" },
  { id: 5, label: "Blockchain output", layer: "Layer 1 - Solana" },
] as const;

type DemoFormState = {
  title: string;
  description: string;
  condition: string;
  rewardAmount: string;
  minSpend: string;
  lat: string;
  lng: string;
};

type WorldVerificationState = {
  worldVerified: boolean;
  nullifierHash: string | null;
  merkleRoot: string | null;
  verificationLevel: string | null;
};

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `demo-${Date.now().toString(36)}`;
}

function truncateAddress(value: string, chars = 4) {
  if (value.length <= chars * 2 + 3) {
    return value;
  }

  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function mergeLogEvents(previous: DemoLogEvent[], incoming: DemoLogEvent) {
  if (previous.some((entry) => entry.id === incoming.id)) {
    return previous;
  }

  return [...previous, incoming].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function getMaxReachableStep(
  bootstrap: DemoBootstrapData | null,
  createData: DemoCreateIncentiveData | null,
  worldVerification: WorldVerificationState | null,
  simulationData: DemoSimulationData | null,
  settlementData: DemoSettlementData | null,
) {
  if (settlementData) {
    return 5;
  }

  if (simulationData) {
    return 4;
  }

  if (worldVerification?.worldVerified) {
    return 3;
  }

  if (createData) {
    return 2;
  }

  if (bootstrap) {
    return 1;
  }

  return 0;
}

function ProtocolBadge({
  tone,
  children,
}: {
  tone: "live" | "simulated" | "good" | "warn" | "neutral";
  children: React.ReactNode;
}) {
  return <span className={`demoBadge ${tone}`}>{children}</span>;
}

function JsonCard({
  title,
  data,
  caption,
}: {
  title: string;
  data: unknown;
  caption?: string;
}) {
  return (
    <div className="demoJsonCard">
      <div className="demoJsonHeader">
        <div>
          <p className="eyebrow">Live payload</p>
          <h3>{title}</h3>
        </div>
        {caption ? <span className="supportText">{caption}</span> : null}
      </div>
      <pre>{formatJson(data)}</pre>
    </div>
  );
}

export default function DemoPage() {
  const [sessionId, setSessionId] = useState("demo-session-pending");
  const [demoKey, setDemoKey] = useState<string | undefined>(undefined);
  const [searchReady, setSearchReady] = useState(false);

  const [bootstrap, setBootstrap] = useState<DemoBootstrapData | null>(null);
  const [createData, setCreateData] = useState<DemoCreateIncentiveData | null>(null);
  const [worldVerification, setWorldVerification] = useState<WorldVerificationState | null>(null);
  const [simulationData, setSimulationData] = useState<DemoSimulationData | null>(null);
  const [settlementData, setSettlementData] = useState<DemoSettlementData | null>(null);

  const [form, setForm] = useState<DemoFormState>({
    title: "Visit the signal zone",
    description:
      "Enter the merchant geofence, complete the check-in, and let PIKO settle the reward on Solana.",
    condition: "Arrive within 40m and hold location for 15 seconds",
    rewardAmount: "1.25",
    minSpend: "0",
    lat: "28.6139",
    lng: "77.2090",
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [introText, setIntroText] = useState("");
  const [forceReject, setForceReject] = useState(false);
  const [simulationRejectMode, setSimulationRejectMode] = useState(false);

  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [createPending, setCreatePending] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const [simulatePending, setSimulatePending] = useState(false);
  const [settlePending, setSettlePending] = useState(false);

  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<"connecting" | "live" | "error">("connecting");
  const [logs, setLogs] = useState<DemoLogEvent[]>([]);

  const openedExplorerRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionId(createSessionId());
    setDemoKey(params.get("key") ?? undefined);
    setSearchReady(true);
  }, []);

  useEffect(() => {
    if (!searchReady) {
      return;
    }

    const stream = new EventSource(buildDemoStreamUrl({ sessionId, key: demoKey }));

    stream.onopen = () => {
      setStreamState("live");
    };

    stream.onmessage = (event) => {
      try {
        const record = JSON.parse(event.data) as DemoLogEvent;
        setLogs((previous) => mergeLogEvents(previous, record));
      } catch {
        setStreamState("error");
      }
    };

    stream.onerror = () => {
      setStreamState("error");
    };

    return () => {
      stream.close();
    };
  }, [demoKey, searchReady, sessionId]);

  function appendLocalLog(
    step: number,
    layer: DemoLogEvent["layer"],
    level: DemoLogEvent["level"],
    title: string,
    detail?: string,
    payload?: unknown,
  ) {
    const event: DemoLogEvent = {
      id: `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      step,
      layer,
      level,
      title,
      detail,
      payload,
      timestamp: new Date().toISOString(),
    };

    setLogs((previous) => mergeLogEvents(previous, event));
  }

  useEffect(() => {
    if (!searchReady) {
      return;
    }

    let cancelled = false;

    async function loadBootstrap() {
      setBootstrapLoading(true);
      setBootstrapError(null);

      try {
        const data = await bootstrapDemoSession({ sessionId, key: demoKey });

        if (cancelled) {
          return;
        }

        setBootstrap(data);
        setWorldVerification({
          worldVerified: data.user.worldVerified,
          nullifierHash: data.user.worldNullifier,
          merkleRoot: null,
          verificationLevel: null,
        });
        setForm({
          title: data.defaults.title,
          description: data.defaults.description,
          condition: data.defaults.condition,
          rewardAmount: data.defaults.rewardAmount.toString(),
          minSpend: data.defaults.minSpend.toString(),
          lat: data.defaults.lat.toString(),
          lng: data.defaults.lng.toString(),
        });
      } catch (error) {
        if (!cancelled) {
          setBootstrapError(error instanceof Error ? error.message : "Failed to prepare the demo session.");
        }
      } finally {
        if (!cancelled) {
          setBootstrapLoading(false);
        }
      }
    }

    void loadBootstrap();

    return () => {
      cancelled = true;
    };
  }, [demoKey, searchReady, sessionId]);

  useEffect(() => {
    if (currentStep !== 0) {
      return;
    }

    setIntroText("");
    let index = 0;

    const timer = window.setInterval(() => {
      index += 1;
      setIntroText(INTRO_TEXT.slice(0, index));

      if (index >= INTRO_TEXT.length) {
        window.clearInterval(timer);
      }
    }, 14);

    return () => {
      window.clearInterval(timer);
    };
  }, [currentStep]);

  useEffect(() => {
    if (!simulationData || settlementData || settlePending || !createData || !bootstrap) {
      return;
    }

    const activeQuestId = createData.quest.id;
    const activeWallet = bootstrap.demoWallet;
    const activeLat = createData.merchant.lat;
    const activeLng = createData.merchant.lng;

    async function runSettlement() {
      setSettlePending(true);
      setActionError(null);
      appendLocalLog(5, "solana", "info", "Settlement request sent", "Protocol execution is moving on-chain.");

      try {
        const data = await settleDemoReward({
          sessionId,
          key: demoKey,
          questId: activeQuestId,
          wallet: activeWallet,
          lat: activeLat,
          lng: activeLng,
          gpsAccuracy: simulationRejectMode ? 500 : 12,
          forceReject: simulationRejectMode,
        });

        setSettlementData(data);
        setCurrentStep(5);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Settlement failed.");
        appendLocalLog(5, "solana", "error", "Settlement request failed", error instanceof Error ? error.message : undefined);
      } finally {
        setSettlePending(false);
      }
    }

    void runSettlement();
  }, [bootstrap, createData, demoKey, sessionId, settlementData, settlePending, simulationData, simulationRejectMode]);

  useEffect(() => {
    const explorerUrl = settlementData?.blockchain.explorerUrl;

    if (!explorerUrl || openedExplorerRef.current === explorerUrl) {
      return;
    }

    openedExplorerRef.current = explorerUrl;
    window.open(explorerUrl, "_blank", "noopener,noreferrer");
  }, [settlementData?.blockchain.explorerUrl]);

  const maxReachableStep = getMaxReachableStep(
    bootstrap,
    createData,
    worldVerification,
    simulationData,
    settlementData,
  );

  async function handleCreateIncentive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!bootstrap) {
      return;
    }

    setCreatePending(true);
    setActionError(null);
    appendLocalLog(1, "api", "info", "Create incentive request sent", "Merchant is creating a live reward.", form);

    try {
      const data = await createDemoIncentive({
        sessionId,
        key: demoKey,
        title: form.title,
        description: form.description,
        condition: form.condition,
        rewardAmount: Number(form.rewardAmount),
        minSpend: Number(form.minSpend),
        rewardToken: bootstrap.defaults.rewardToken,
        lat: Number(form.lat),
        lng: Number(form.lng),
      });

      setCreateData(data);
      setSimulationData(null);
      setSettlementData(null);
      setSimulationRejectMode(false);
      setCurrentStep(2);
      openedExplorerRef.current = null;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create the incentive.");
      appendLocalLog(1, "api", "error", "Create incentive request failed", error instanceof Error ? error.message : undefined);
    } finally {
      setCreatePending(false);
    }
  }

  async function handleVerifyWorldId(payload: WorldIdProofPayload) {
    setVerifyPending(true);
    setActionError(null);
    appendLocalLog(2, "api", "info", "Identity proof submitted", "User is providing a human-verification signal before claim.", payload);

    try {
      const data: WorldIdVerificationData = await verifyWorldId(payload);
      setWorldVerification({
        worldVerified: data.worldVerified,
        nullifierHash: data.nullifierHash,
        merkleRoot: data.merkleRoot,
        verificationLevel: data.verificationLevel,
      });
      setCurrentStep(3);
      appendLocalLog(2, "api", "success", "Identity signal recorded", "Human-verification signal stored for the demo wallet.", data);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Identity verification failed.");
      appendLocalLog(2, "api", "error", "Identity verification failed", error instanceof Error ? error.message : undefined);
    } finally {
      setVerifyPending(false);
    }
  }

  async function handleClaimIncentive() {
    if (!bootstrap || !createData || !worldVerification?.worldVerified) {
      return;
    }

    setSimulatePending(true);
    setActionError(null);
    appendLocalLog(
      3,
      "api",
      "info",
      "Claim request sent",
      forceReject ? "Claim will continue through the reject scenario." : "Claim passed the identity gate and is moving to AI.",
      {
        questId: createData.quest.id,
        wallet: bootstrap.demoWallet,
        worldVerified: worldVerification.worldVerified,
        gpsAccuracy: forceReject ? 500 : 12,
      },
    );

    try {
      const data = await simulateDemoAction({
        sessionId,
        key: demoKey,
        questId: createData.quest.id,
        wallet: bootstrap.demoWallet,
        lat: createData.merchant.lat,
        lng: createData.merchant.lng,
        gpsAccuracy: forceReject ? 500 : 12,
        forceReject,
      });

      setSimulationData(data);
      setSettlementData(null);
      setSimulationRejectMode(forceReject);
      setCurrentStep(4);
      openedExplorerRef.current = null;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to claim the incentive.");
      appendLocalLog(3, "api", "error", "Claim request failed", error instanceof Error ? error.message : undefined);
    } finally {
      setSimulatePending(false);
    }
  }

  function renderDashboard() {
    const fraudScore = settlementData?.settlement.fraudScore ?? simulationData?.review.fraud.decision.score ?? null;
    const multiplier = settlementData?.settlement.rewardMultiplier ?? simulationData?.review.reward.decision.multiplier ?? null;
    const fraudFlags = settlementData?.settlement.fraudFlags ?? simulationData?.review.fraud.decision.flags ?? [];
    const rewardReasons = settlementData?.settlement.rewardReasons ?? simulationData?.review.reward.decision.reasons ?? [];
    const decision = settlementData?.settlement.decision ?? (simulationData ? (simulationData.review.approved ? "APPROVED" as const : "REJECTED" as const) : null);

    return (
      <div className="demoStageStack">
        {/* Protocol status header */}
        <div className="demoNarrationCard">
          <p className="eyebrow">Protocol dashboard</p>
          <h2>AI controls real-world economic incentives on-chain.</h2>
          <p className="heroCopy">
            Every reward passes through fraud detection, dynamic pricing, and human verification before settlement.
            Nothing mints without AI approval.
          </p>
          <div className="demoMetricGrid">
            <div className="demoMetricCard">
              <span>Identity</span>
              <strong style={{ color: worldVerification?.worldVerified ? "var(--solana-green)" : "#ff6b6b" }}>
                {worldVerification?.worldVerified ? "✔ Human" : "🔒 Required"}
              </strong>
            </div>
            <div className="demoMetricCard">
              <span>AI Decision</span>
              <strong style={{ color: decision === "APPROVED" ? "var(--solana-green)" : decision === "REJECTED" ? "#ff6b6b" : "var(--ink-muted)" }}>
                {decision ?? "Pending"}
              </strong>
            </div>
            <div className="demoMetricCard">
              <span>Multiplier</span>
              <strong style={{ color: multiplier && multiplier > 1 ? "var(--solana-green)" : "var(--ink)" }}>
                {multiplier ? `${multiplier.toFixed(2)}x` : "--"}
              </strong>
            </div>
          </div>
        </div>

        {/* Section 1: Verification Gate */}
        {bootstrap ? (
          <VerificationGate
            worldVerified={worldVerification?.worldVerified ?? false}
            wallet={bootstrap.demoWallet}
            sessionId={sessionId}
            pending={verifyPending}
            onVerify={handleVerifyWorldId}
          />
        ) : null}

        {/* Section 2: AI Decision Panel (shows when data available) */}
        {fraudScore !== null && multiplier !== null ? (
          <AIDecisionPanel
            fraudScore={fraudScore}
            fraudFlags={fraudFlags}
            rewardMultiplier={multiplier}
            rewardReasons={rewardReasons}
            decision={decision}
            worldVerified={worldVerification?.worldVerified ?? false}
            compact
          />
        ) : null}

        {/* Section 3: Settlement result */}
        {settlementData ? (
          <AIApprovalCard
            settlement={settlementData.settlement}
            blockchain={settlementData.blockchain}
            rewardReadout={settlementData.rewardReadout}
          />
        ) : null}
      </div>
    );

  }

  function renderStepContent() {
    if (bootstrapLoading && !bootstrap) {
      return (
        <div className="demoStageStack">
          <div className="demoNarrationCard skeleton" style={{ minHeight: 220 }} />
          <div className="demoJsonCard skeleton" style={{ minHeight: 320 }} />
        </div>
      );
    }

    if (!bootstrap) {
      return (
        <div className="demoEmptyState">
          <p className="eyebrow">Session blocked</p>
          <h2>We could not prepare the reveal environment.</h2>
          <p className="heroCopy">
            {bootstrapError || "Check the server logs, database connection, and optional demo key."}
          </p>
        </div>
      );
    }

    switch (currentStep) {
      case 0:
        return (
          <div className="demoStageStack">
            <div className="demoNarrationCard">
              <p className="eyebrow">Demo script</p>
              <h2>PIKO Protocol, narrated live.</h2>
              <p className="heroCopy demoTypewriter">
                {introText}
                {introText.length < INTRO_TEXT.length ? <span className="demoCaret" aria-hidden="true" /> : null}
              </p>
              <div className="demoChipRow">
                <ProtocolBadge tone="neutral">{bootstrap.network.cluster}</ProtocolBadge>
                <ProtocolBadge tone={bootstrap.capabilities.pikoMint.mode}>
                  PIKO mint {bootstrap.capabilities.pikoMint.mode}
                </ProtocolBadge>
                <ProtocolBadge tone={bootstrap.capabilities.nft.mode}>
                  NFT {bootstrap.capabilities.nft.mode}
                </ProtocolBadge>
              </div>
              <button className="primaryButton demoStageAction" type="button" onClick={() => setCurrentStep(1)}>
                Start protocol
              </button>
            </div>

            <JsonCard
              title="Bootstrap"
              data={{
                merchant: bootstrap.merchant,
                demoWallet: bootstrap.demoWallet,
                worldVerified: bootstrap.user.worldVerified,
                capabilities: bootstrap.capabilities,
              }}
            />
          </div>
        );

      case 1:
        return (
          <div className="demoStageStack">
            <div className="demoNarrationCard">
              <p className="eyebrow">Layer 3 - API</p>
              <h2>Merchant creates the incentive.</h2>
              <p className="heroCopy">No change here. The protocol still starts by creating a quest on the API layer.</p>

              <form className="demoForm" onSubmit={(event) => void handleCreateIncentive(event)}>
                <label className="demoField">
                  <span>Quest title</span>
                  <input
                    type="text"
                    autoComplete="off"
                    value={form.title}
                    onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                  />
                </label>

                <label className="demoField demoFieldFull">
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                  />
                </label>

                <label className="demoField demoFieldFull">
                  <span>Condition</span>
                  <input
                    type="text"
                    autoComplete="off"
                    value={form.condition}
                    onChange={(event) => setForm((previous) => ({ ...previous, condition: event.target.value }))}
                  />
                </label>

                <label className="demoField">
                  <span>Reward (PIKO)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={form.rewardAmount}
                    onChange={(event) => setForm((previous) => ({ ...previous, rewardAmount: event.target.value }))}
                  />
                </label>

                <label className="demoField">
                  <span>Minimum spend</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={form.minSpend}
                    onChange={(event) => setForm((previous) => ({ ...previous, minSpend: event.target.value }))}
                  />
                </label>

                <label className="demoField">
                  <span>Latitude</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.0001"
                    value={form.lat}
                    onChange={(event) => setForm((previous) => ({ ...previous, lat: event.target.value }))}
                  />
                </label>

                <label className="demoField">
                  <span>Longitude</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.0001"
                    value={form.lng}
                    onChange={(event) => setForm((previous) => ({ ...previous, lng: event.target.value }))}
                  />
                </label>

                <div className="demoFormFooter">
                  <div className="demoInlineMeta">
                    <span>Merchant wallet</span>
                    <strong>{truncateAddress(bootstrap.merchant.wallet, 6)}</strong>
                  </div>
                  <button className="primaryButton demoStageAction" type="submit" disabled={createPending}>
                    {createPending ? "Creating incentive..." : "Create incentive"}
                  </button>
                </div>
              </form>
            </div>

            <JsonCard title="Create quest payload" data={createData ?? form} />
          </div>
        );

      case 2:
        return (
          <div className="demoStageStack">
            <div className="demoNarrationCard">
              <p className="eyebrow">Layer 4 to 3</p>
              <h2>Identity layer gates the reward path.</h2>
              <p className="heroCopy">
                Rewards are locked until the wallet proves it belongs to a real human.
                No manual bypass — the protocol enforces this cryptographically.
              </p>
            </div>

            <VerificationGate
              worldVerified={worldVerification?.worldVerified ?? false}
              wallet={bootstrap.demoWallet}
              sessionId={sessionId}
              pending={verifyPending}
              onVerify={handleVerifyWorldId}
            />

            <JsonCard
              title="Identity signal record"
              data={
                worldVerification?.worldVerified
                  ? worldVerification
                  : {
                      userWallet: bootstrap.demoWallet,
                      worldVerified: false,
                      status: "Awaiting proof",
                    }
              }
            />
          </div>
        );

      case 3:
        return (
          <div className="demoStageStack">
            <div className="demoNarrationCard">
              <p className="eyebrow">Layer 3 - API</p>
              <h2>Claim stays disabled until identity is verified.</h2>
              <p className="heroCopy">
                The backend enforces the same rule as the UI: if <code>worldVerified</code> is false, claim is rejected
                before AI review starts.
              </p>

              <div className="demoChipRow">
                <ProtocolBadge tone={worldVerification?.worldVerified ? "good" : "warn"}>
                  {worldVerification?.worldVerified ? "Claim enabled" : "Claim blocked"}
                </ProtocolBadge>
                <ProtocolBadge tone={forceReject ? "warn" : "good"}>
                  {forceReject ? "Fraud reject demo" : "Approval demo"}
                </ProtocolBadge>
              </div>

              <button
                className="primaryButton demoStageAction"
                type="button"
                disabled={!createData || !worldVerification?.worldVerified || simulatePending}
                onClick={() => void handleClaimIncentive()}
              >
                {simulatePending ? "Claiming incentive..." : "Claim incentive"}
              </button>

              <label className="demoSwitch">
                <input type="checkbox" checked={forceReject} onChange={(event) => setForceReject(event.target.checked)} />
                <span className="demoSwitchTrack" aria-hidden="true" />
                <span>Force reject path</span>
              </label>
            </div>

            {/* Show AI Decision Panel immediately after claim */}
            {simulationData ? (
              <AIDecisionPanel
                fraudScore={simulationData.review.fraud.decision.score}
                fraudFlags={simulationData.review.fraud.decision.flags ?? []}
                rewardMultiplier={simulationData.review.reward.decision.multiplier}
                rewardReasons={simulationData.review.reward.decision.reasons ?? []}
                decision={simulationData.review.approved ? "APPROVED" : "REJECTED"}
                worldVerified={worldVerification?.worldVerified ?? false}
                animated
              />
            ) : null}

            <JsonCard
              title="Claim gate"
              data={{
                questId: createData?.quest.id,
                worldVerified: worldVerification?.worldVerified ?? false,
                rule: "if (!user.worldVerified) throw new Error('Identity verification required')",
              }}
            />
          </div>
        );

      case 4:
        return (
          <div className="demoStageStack">
            <div className="demoNarrationCard">
              <p className="eyebrow">Layer 2 - AI Decision Engine</p>
              <h2>AI evaluates every claim in real-time.</h2>
              <p className="heroCopy">
                Three agents work together: Fraud detection scores risk, Reward optimization calculates the multiplier,
                and the identity-layer signal is factored into the final decision.
              </p>
            </div>

            {/* Hero: AI Decision Panel */}
            {simulationData ? (
              <AIDecisionPanel
                fraudScore={simulationData.review.fraud.decision.score}
                fraudFlags={simulationData.review.fraud.decision.flags ?? []}
                rewardMultiplier={simulationData.review.reward.decision.multiplier}
                rewardReasons={simulationData.review.reward.decision.reasons ?? []}
                decision={simulationData.review.approved ? "APPROVED" : "REJECTED"}
                worldVerified={worldVerification?.worldVerified ?? false}
                animated
              />
            ) : (
              <div className="demoEmptyState">
                <h3>Waiting for claim</h3>
                <p className="supportText">Complete Step 3 to see the AI decision engine in action.</p>
              </div>
            )}

            <JsonCard
              title="AI review payload"
              data={
                simulationData
                  ? {
                      worldVerified: worldVerification?.worldVerified ?? false,
                      fraudScore: simulationData.review.fraud.decision.score,
                      decision: simulationData.review.approved ? "APPROVED" : "REJECTED",
                      review: simulationData.review,
                    }
                  : { status: "Waiting for claim" }
              }
            />
          </div>
        );

      case 5:
        return (
          <div className="demoStageStack">
            <div className="demoNarrationCard">
              <p className="eyebrow">Layer 1 - Solana</p>
              <h2>AI-approved settlement on-chain.</h2>
              <p className="heroCopy">
                The protocol executes the AI&apos;s decision on Solana — minting tokens, issuing NFT badges,
                and recording the full audit trail.
              </p>
            </div>

            {/* Hero: AI Approval Card */}
            {settlementData ? (
              <AIApprovalCard
                settlement={settlementData.settlement}
                blockchain={settlementData.blockchain}
                rewardReadout={settlementData.rewardReadout}
              />
            ) : (
              <div className="demoEmptyState">
                <h3>Waiting for settlement</h3>
                <p className="supportText">The AI decision from Step 4 will trigger on-chain execution here.</p>
              </div>
            )}

            <JsonCard
              title="Settlement payload"
              data={
                settlementData?.settlement ?? {
                  verified: true,
                  txSignature: null,
                  rewardAmount: null,
                  nftMint: null,
                  fraudScore: simulationData?.review.fraud.decision.score ?? null,
                }
              }
            />
          </div>
        );


      default:
        return null;
    }
  }

  return (
    <div className="pageStack demoPage">
      <section className="heroPanel demoHero">
        <div>
          <p className="eyebrow">System reveal demo</p>
          <h1>PIKO Protocol — System Reveal.</h1>
          <p className="heroCopy">
            Frontend, API, AI, and Solana are all visible in one judge-facing console, with the identity layer sitting
            in the middle of the reward path.
          </p>
        </div>

        <div className="heroStats">
          <div className="statChip">
            <span>4</span>
            <p>Protocol layers</p>
          </div>
          <div className="statChip">
            <span>1</span>
            <p>Human gate</p>
          </div>
          <div className="statChip">
            <span>{streamState === "live" ? "Live" : streamState === "error" ? "Retry" : "Boot"}</span>
            <p>Log stream</p>
          </div>
        </div>
      </section>

      <section className="demoLayout">
        <aside className="demoPanel demoSidebar">
          <div className="demoPanelHeader">
            <div>
              <p className="eyebrow">Step navigator</p>
              <h2>Execution flow</h2>
            </div>
            <ProtocolBadge tone={worldVerification?.worldVerified ? "good" : "warn"}>
              {worldVerification?.worldVerified ? "Human verified" : "Identity pending"}
            </ProtocolBadge>
          </div>

          <div className="demoStepList">
            {STEPS.map((step) => {
              const unlocked = step.id <= maxReachableStep;
              const status =
                step.id === currentStep ? "active" : step.id < currentStep ? "done" : unlocked ? "ready" : "pending";

              return (
                <button
                  key={step.id}
                  className={`demoStepButton ${status}`}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => setCurrentStep(step.id)}
                >
                  <span className="demoStepDot" aria-hidden="true" />
                  <span>
                    <strong>
                      {step.id}. {step.label}
                    </strong>
                    <span>{step.layer}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="demoSidebarFooter">
            <div className="demoSidebarMetric">
              <span>Demo wallet</span>
              <strong>{bootstrap ? truncateAddress(bootstrap.demoWallet, 6) : "Waiting..."}</strong>
            </div>
            <div className="demoSidebarMetric">
              <span>Session</span>
              <strong>{truncateAddress(sessionId, 6)}</strong>
            </div>
          </div>
        </aside>

        <section className="demoPanel demoStage" aria-live="polite">
          <div className="demoPanelHeader">
            <div>
              <p className="eyebrow">{STEPS[currentStep].layer}</p>
              <h2>{STEPS[currentStep].label}</h2>
            </div>
          </div>

          {actionError ? (
            <div className="demoErrorBanner">
              <strong>Request failed</strong>
              <p>{actionError}</p>
            </div>
          ) : null}

          {bootstrapError && !bootstrap ? (
            <div className="demoErrorBanner">
              <strong>Bootstrap failed</strong>
              <p>{bootstrapError}</p>
            </div>
          ) : null}

          {renderDashboard()}
          {renderStepContent()}
        </section>

        <aside className="demoPanel demoLogPanel">
          <div className="demoPanelHeader">
            <div>
              <p className="eyebrow">Live protocol log</p>
              <h2>Streamed events</h2>
            </div>
            <ProtocolBadge tone={streamState === "live" ? "good" : streamState === "error" ? "warn" : "neutral"}>
              {streamState === "live" ? "SSE live" : streamState === "error" ? "Stream error" : "Connecting"}
            </ProtocolBadge>
          </div>

          {logs.length === 0 ? (
            <div className="demoEmptyState compact">
              <h3>No events yet</h3>
              <p className="supportText">The log panel will fill as soon as the protocol starts emitting step events.</p>
            </div>
          ) : (
            <div className="demoLogList">
              {logs.map((entry) => (
                <article key={entry.id} className={`demoLogEntry ${entry.level}`}>
                  <div className="demoLogMeta">
                    <span>
                      Step {entry.step} · {entry.layer.toUpperCase()}
                    </span>
                    <strong>{formatTimestamp(entry.timestamp)}</strong>
                  </div>
                  <h3>{entry.title}</h3>
                  {entry.detail ? <p>{entry.detail}</p> : null}
                  {entry.payload ? <pre>{formatJson(entry.payload)}</pre> : null}
                </article>
              ))}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
