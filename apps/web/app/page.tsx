"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { DemoKioskHome } from "@/components/demo-kiosk-home";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { useMerchantMap } from "@/hooks/use-merchant-map";
import { classifyPin, formatCountdownLabel, formatDistance, formatReward } from "@/lib/utils";
import { MerchantPinType } from "@/lib/types";

const DynamicMapView = dynamic(
  () => import("@/components/map-view").then((mod) => mod.MapView),
  {
    ssr: false,
    loading: () => <div className="mapFallback">Loading immersive map...</div>,
  }
);

type FilterType = "all" | "reward" | "sponsored" | "trending" | "nearest";

const FILTERS: { key: FilterType; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "Grid" },
  { key: "reward", label: "Reward Active", icon: "Fire" },
  { key: "sponsored", label: "Sponsored", icon: "Star" },
  { key: "trending", label: "Trending", icon: "Bolt" },
  { key: "nearest", label: "Nearest", icon: "Radar" },
];

const SHEET_SNAP_POINTS = [38, 56, 78];

function formatCoordinate(value: number) {
  return value.toFixed(5);
}

export default function HomePage() {
  const demoMode = useDemoMode();
  const {
    merchants,
    heatmapData,
    location,
    accuracy,
    locationStatus,
    locationLabel,
    lastUpdatedAt,
    suggestions,
    featured,
    loading,
  } = useMerchantMap();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sheetHeight, setSheetHeight] = useState(56);
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null);
  const sheetHeightRef = useRef(sheetHeight);

  const filteredMerchants = useMemo(() => {
    const base = [...merchants];

    if (filter === "reward") {
      return base.filter((merchant) => merchant.rewardMultiplier >= 1.9);
    }

    if (filter === "sponsored") {
      return base.filter((merchant) => merchant.isSponsored);
    }

    if (filter === "trending") {
      return base.filter((merchant) => merchant.isTrending);
    }

    if (filter === "nearest") {
      return base.sort(
        (left, right) => (left.distance ?? Number.MAX_SAFE_INTEGER) - (right.distance ?? Number.MAX_SAFE_INTEGER)
      );
    }

    return base.sort((left, right) => right.hotspotScore - left.hotspotScore);
  }, [filter, merchants]);

  const deferredMerchants = useDeferredValue(filteredMerchants);

  // Animated counters and mount state
  const [isMounted, setIsMounted] = useState(false);
  const [currentMerchants, setCurrentMerchants] = useState(0);
  const [currentQuests, setCurrentQuests] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    if (deferredMerchants.length === 0) return;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setCurrentMerchants(prev => Math.min(prev + 1, deferredMerchants.length));
      setCurrentQuests(prev => Math.min(prev + 2, deferredMerchants.reduce((sum, m) => sum + m.quests.length, 0)));
      if (step > 60) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [deferredMerchants]);

  const selectedMerchant = useMemo(
    () =>
      deferredMerchants.find((merchant) => merchant.id === selectedId) ??
      deferredMerchants[0] ??
      featured ??
      null,
    [deferredMerchants, featured, selectedId]
  );

  const totalActiveQuests = deferredMerchants.reduce((sum, merchant) => sum + merchant.quests.length, 0);
  const averageBoost =
    deferredMerchants.length > 0
      ? (
          deferredMerchants.reduce((sum, merchant) => sum + merchant.rewardMultiplier, 0) / deferredMerchants.length
        ).toFixed(1)
      : "0.0";
  const topSuggestion = suggestions[0];
  const selectedMapMerchant = useMemo(
    () => deferredMerchants.find((merchant) => merchant.id === selectedId) ?? null,
    [deferredMerchants, selectedId]
  );
  const locationTimestamp = useMemo(() => {
    if (!lastUpdatedAt) return "Waiting for GPS";
    return `Updated ${new Date(lastUpdatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }, [lastUpdatedAt]);

  function snapDrawer(nextHeight: number) {
    const closest = SHEET_SNAP_POINTS.reduce((best, point) =>
      Math.abs(point - nextHeight) < Math.abs(best - nextHeight) ? point : best
    );
    setSheetHeight(closest);
  }

  sheetHeightRef.current = sheetHeight;

  function handleDrawerDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    dragState.current = { startY: event.clientY, startHeight: sheetHeight };

    const move = (moveEvent: PointerEvent) => {
      const start = dragState.current;
      if (!start) {
        return;
      }

      const viewportHeight = window.innerHeight || 1;
      const delta = ((start.startY - moveEvent.clientY) / viewportHeight) * 100;
      const nextHeight = Math.max(34, Math.min(86, start.startHeight + delta));
      setSheetHeight(nextHeight);
    };

    const up = () => {
      const latest = dragState.current;
      dragState.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (latest) {
        snapDrawer(sheetHeightRef.current);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const drawerStyle = { ["--sheet-height" as string]: `${sheetHeight}%` } as CSSProperties;
  const focusLocation = selectedMapMerchant
    ? { lat: selectedMapMerchant.lat, lng: selectedMapMerchant.lng }
    : location;
  const particleStyles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => ({
        id: `pt${index}`,
        style: {
          ["--particle-left" as string]: `${Math.random() * 100}%`,
          ["--particle-bottom" as string]: `${-20 + Math.random() * 50}%`,
          ["--particle-duration" as string]: `${4 + Math.random() * 6}s`,
          ["--particle-delay" as string]: `${Math.random() * 5}s`,
          ["--particle-color" as string]: index % 2 === 0 ? "var(--solana-green)" : "var(--brand)",
        } as CSSProperties,
      })),
    []
  );

  if (demoMode) {
    return <DemoKioskHome />;
  }

  return (
    <div className="pageStack mapPage">
      <section className="mapExperience">
        <div className="mapWrapper immersiveMap">
          <div className="mapChromeTop">
            {topSuggestion ? (
              <div className="aiBanner topGlow">
                <div className="aiBannerOrb">AI</div>
                <div>
                  <p className="eyebrow">Contextual route</p>
                  <strong>{topSuggestion.reasoning}</strong>
                </div>
                <span className="aiBannerConfidence">{Math.round(topSuggestion.confidence * 100)}%</span>
              </div>
            ) : null}

            <div className="statsTicker">
              <div className="tickerChip fancyHover">
                <span className="tickerLabel">Nearby merchants</span>
                <strong>{currentMerchants}</strong>
              </div>
              <div className="tickerChip fancyHover">
                <span className="tickerLabel">Active incentives</span>
                <strong>{currentQuests}</strong>
              </div>
              <div className="tickerChip fancyHover">
                <span className="tickerLabel">Heatmap nodes</span>
                <strong>{heatmapData.length}</strong>
              </div>
              <div className="tickerChip fancyHover">
                <span className="tickerLabel">Avg boost</span>
                <strong>{averageBoost}x</strong>
              </div>
            </div>
          </div>

          <div className="filterBar mapFilters">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                className={`filterChip ${filter === item.key ? "active" : ""}`}
                onClick={() => setFilter(item.key)}
                type="button"
              >
                <span className="filterChipEmoji">{item.icon}</span>
                {item.label}
              </button>
            ))}
            <span className="filterSummary">
              {loading ? "Locating live merchants..." : `${deferredMerchants.length} live markers`}
            </span>
          </div>

          <div className="mapLocationHud" aria-live="polite">
            <div className={`locationStatusCard ${locationStatus}`}>
              <div className="locationStatusCopy">
                <span className="locationStatusEyebrow">Current location</span>
                <strong>{locationLabel}</strong>
                <p>
                  {formatCoordinate(location.lat)}, {formatCoordinate(location.lng)}
                  {accuracy ? ` • ±${Math.round(accuracy)}m` : ""}
                </p>
                <small>{locationTimestamp}</small>
              </div>
              <button
                className="locationRecenterButton"
                onClick={() => setSelectedId(null)}
                type="button"
              >
                Follow me
              </button>
            </div>
          </div>

          <DynamicMapView
            center={location}
            focusLocation={focusLocation}
            userAccuracy={accuracy}
            merchants={deferredMerchants}
            heatmapData={heatmapData}
            selectedMerchantId={selectedMerchant?.id ?? null}
            onSelectMerchant={(merchant) => setSelectedId(merchant.id)}
          />

          <div className="mapParticles" aria-hidden="true">
            {isMounted &&
              particleStyles.map((particle) => (
                <div className="mapParticle" key={particle.id} style={particle.style} />
              ))}
          </div>

          <div className="mapGradientMask" />

          <section className="merchantDrawer" style={drawerStyle}>
            <div className="drawerHandleArea" onPointerDown={handleDrawerDragStart} role="presentation">
              <span className="drawerHandle" />
            </div>

            <div className="drawerHeader">
              <div>
                <p className="eyebrow">Merchant network</p>
                <h2>Scan the live incentive field</h2>
              </div>
              <div className="drawerSnapButtons">
                {SHEET_SNAP_POINTS.map((point) => (
                  <button
                    key={point}
                    className={`drawerSnapButton ${Math.round(sheetHeight) === point ? "active" : ""}`}
                    onClick={() => setSheetHeight(point)}
                    type="button"
                  >
                {point === 38 ? "Peek" : point === 56 ? "Focus" : "Expand"}
                  </button>
                ))}
              </div>
            </div>

            <div className="discoveryRail">
              {deferredMerchants.map((merchant, i) => {
                const topQuest = merchant.quests[0];

                return (
                  <button
                    key={merchant.id}
                    className={`merchantRailCard ${merchant.id === selectedMerchant?.id ? "active" : ""}`}
                    onClick={() => setSelectedId(merchant.id)}
                    type="button"
                    style={{ ["--entry-delay" as string]: `${i * 0.05}s` }}
                  >
                    <div className="merchantRailAvatar">{merchant.avatar}</div>
                    <div>
                      <strong>{merchant.name}</strong>
                      <p>{merchant.vibe}</p>
                    </div>
                    <div className="merchantRailMeta">
                      <span>{merchant.rewardMultiplier.toFixed(1)}x</span>
                      {topQuest ? <small>{formatReward(topQuest.rewardAmount, topQuest.rewardToken)}</small> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedMerchant ? <MerchantSheet merchant={selectedMerchant} /> : null}
          </section>
        </div>
      </section>
    </div>
  );
}

function MerchantSheet({ merchant }: { merchant: MerchantPinType }) {
  const pin = classifyPin(merchant.rewardMultiplier, merchant.isSponsored, merchant.isTrending);

  return (
    <div className="merchantSheet immersiveSheet">
      <div className="merchantSheetHero">
        <div className={`merchantToneBadge ${pin.tone}`}>{pin.label}</div>
        <div className="merchantSheetMain">
          <div className="merchantSheetIdentity">
            <div className="merchantAvatar">{merchant.avatar}</div>
            <div>
              <h3>{merchant.name}</h3>
              <p>
                {merchant.category} · {merchant.district}
              </p>
            </div>
          </div>
          <div className="merchantChipRow">
            <span>{formatDistance(merchant.distance)}</span>
            <span>{merchant.rewardPool.toFixed(0)} PIKO pool</span>
            <span>{merchant.hotspotScore} demand score</span>
          </div>
        </div>
      </div>

      <div className="merchantInsightGrid">
        <div className="merchantInsightCard">
          <span className="metricLabel">Reward boost</span>
          <strong>{merchant.rewardMultiplier.toFixed(1)}x</strong>
          <p>{merchant.vibe}</p>
        </div>
        <div className="merchantInsightCard">
          <span className="metricLabel">Foot traffic</span>
          <strong>{merchant.totalVisits ?? 0}</strong>
          <p>Verified visits in the last 24h</p>
        </div>
        <div className="merchantInsightCard">
          <span className="metricLabel">Incentive density</span>
          <strong>{merchant.quests.length}</strong>
          <p>Active merchant-funded programs right now</p>
        </div>
      </div>

      <div className="questPreviewList discoveryQuestList">
        {merchant.quests.map((quest) => (
          <Link className="questPreview immersiveQuestPreview" key={quest.id} href={`/quest/${quest.id}`}>
            <div>
              <span>{quest.questType}</span>
              <strong>{quest.title}</strong>
            </div>
            <div className="questPreviewMetrics">
              <small>{formatCountdownLabel(quest.expiresAt ?? new Date().toISOString())}</small>
              <b>{formatReward(quest.rewardAmount, quest.rewardToken)}</b>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
