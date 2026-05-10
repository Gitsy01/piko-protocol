"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  cafeBloomProfile,
  cafeBloomMenu,
  buildMerchantSimulationSnapshot,
  generateHourlyTraffic,
  computeEconomics,
  formatInr,
  formatTimeAgo,
  formatHour,
  type TransactionRecord,
  type MenuItem,
} from "@/lib/merchant-simulation";

// ── Tabs ─────────────────────────────────────────────────
type MerchantTab = "overview" | "menu" | "transactions" | "economics" | "network";

const TABS: { key: MerchantTab; label: string; icon: string }[] = [
  { key: "overview", label: "Profile", icon: "◉" },
  { key: "menu", label: "Menu", icon: "☰" },
  { key: "transactions", label: "Transactions", icon: "⇄" },
  { key: "economics", label: "Economics", icon: "◈" },
  { key: "network", label: "Network", icon: "⬡" },
];

// ── Animated Counter ─────────────────────────────────────
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    const from = display;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * ease);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
}

// ── Budget Ring ──────────────────────────────────────────
function BudgetRing({ spent, total }: { spent: number; total: number }) {
  const pct = Math.min(spent / total, 1);
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const color = pct > 0.85 ? "var(--danger)" : pct > 0.6 ? "var(--brand)" : "var(--solana-green)";

  return (
    <svg className="merchantBudgetRing" viewBox="0 0 120 120" width="120" height="120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1), stroke 0.5s" }}
      />
      <text x="60" y="54" textAnchor="middle" fill="var(--ink)" fontSize="18" fontWeight="700" fontFamily="var(--font-display), Syne, sans-serif">
        {Math.round(pct * 100)}%
      </text>
      <text x="60" y="72" textAnchor="middle" fill="var(--ink-muted)" fontSize="10">
        used today
      </text>
    </svg>
  );
}

// ── Traffic Mini Chart ───────────────────────────────────
function TrafficChart() {
  const traffic = useMemo(() => generateHourlyTraffic(), []);
  const maxVisitors = Math.max(...traffic.map((t) => t.visitors));

  return (
    <div className="merchantTrafficChart" id="merchant-traffic-chart">
      <div className="merchantTrafficBars">
        {traffic.map((point) => {
          const height = (point.visitors / maxVisitors) * 100;
          return (
            <div key={point.hour} className="merchantTrafficBar" title={`${formatHour(point.hour)}: ${point.visitors} visitors`}>
              <div
                className={`merchantTrafficBarFill ${point.isSlowHour ? "slowHour" : ""}`}
                style={{ height: `${height}%` }}
              />
              <span className="merchantTrafficBarLabel">
                {point.hour % 2 === 0 ? formatHour(point.hour).replace(" AM", "a").replace(" PM", "p") : ""}
              </span>
            </div>
          );
        })}
      </div>
      <div className="merchantTrafficLegend">
        <span className="merchantTrafficLegendDot" style={{ background: "var(--solana-purple)" }} /> Normal hours
        <span className="merchantTrafficLegendDot slowHourDot" style={{ background: "var(--brand)" }} /> Slow hours (1.4× multiplier)
      </div>
    </div>
  );
}

// ── Menu Category Filter ─────────────────────────────────
function MenuSection() {
  const [filter, setFilter] = useState<string>("all");
  const categories = ["all", "coffee", "food", "specialty", "dessert"];

  const filtered = filter === "all" ? cafeBloomMenu : cafeBloomMenu.filter((item) => item.category === filter);

  return (
    <div className="merchantMenuSection" id="merchant-menu-section">
      <div className="merchantMenuFilters">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`merchantMenuFilterBtn ${filter === cat ? "active" : ""}`}
            onClick={() => setFilter(cat)}
            type="button"
          >
            {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="merchantMenuPhoto">
        <Image
          src={cafeBloomProfile.menuPhotoUrl}
          alt="Cafe Bloom menu spread"
          width={800}
          height={450}
          className="merchantMenuImage"
          priority
        />
      </div>

      <div className="merchantMenuGrid">
        {filtered.map((item) => (
          <MenuCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function MenuCard({ item }: { item: MenuItem }) {
  return (
    <div className={`merchantMenuCard ${item.popular ? "popular" : ""}`} id={`menu-${item.id}`}>
      <div className="merchantMenuCardTop">
        <span className="merchantMenuItemName">{item.name}</span>
        {item.popular && <span className="merchantMenuPopularBadge">Popular</span>}
      </div>
      <div className="merchantMenuCardBottom">
        <span className="merchantMenuPrice">{formatInr(item.price)}</span>
        <span className="merchantMenuPriceUsd">≈ ${item.priceUsd.toFixed(2)}</span>
        {item.pikoEligible && (
          <span className="merchantMenuPikoBadge">
            +{(item.priceUsd * 0.08).toFixed(2)} PIKO
          </span>
        )}
      </div>
    </div>
  );
}

// ── Network Effect Panel ─────────────────────────────────
const NETWORK_MERCHANTS = [
  { name: "Cafe Bloom", category: "Cafe", piko: 500, active: true, distance: "120m" },
  { name: "Pixel Pizza", category: "Restaurant", piko: 380, active: true, distance: "250m" },
  { name: "Green Bowl", category: "Restaurant", piko: 420, active: true, distance: "560m" },
  { name: "Neon Threads", category: "Retail", piko: 210, active: false, distance: "410m" },
  { name: "Arcade Orbit", category: "Entertainment", piko: 310, active: true, distance: "320m" },
  { name: "Chai Circuit", category: "Cafe", piko: 490, active: true, distance: "680m" },
  { name: "Fit Forge", category: "Fitness", piko: 150, active: false, distance: "520m" },
  { name: "Sol Records", category: "Entertainment", piko: 95, active: false, distance: "390m" },
  { name: "Lumen Lanes", category: "Entertainment", piko: 280, active: true, distance: "790m" },
  { name: "Spice Route", category: "Restaurant", piko: 340, active: true, distance: "920m" },
  { name: "The Roastery", category: "Cafe", piko: 460, active: true, distance: "1.1km" },
  { name: "BookNook", category: "Retail", piko: 120, active: false, distance: "1.3km" },
];

function NetworkEffectPanel() {
  const activeMerchants = NETWORK_MERCHANTS.filter((m) => m.active);
  const totalPiko = NETWORK_MERCHANTS.reduce((s, m) => s + m.piko, 0);
  const activePiko = activeMerchants.reduce((s, m) => s + m.piko, 0);

  return (
    <div className="merchantNetworkPanel" id="merchant-network-panel">
      <div className="merchantNetworkHeader">
        <div>
          <p className="eyebrow">PIKO Network · Connaught Place</p>
          <h3>City-Level Network Effect</h3>
          <p className="supportText">
            Each new merchant increases route density, which increases per-user reward discovery, which increases merchant ROI. This is the flywheel.
          </p>
        </div>
      </div>

      <div className="merchantNetworkStats">
        <div className="merchantNetworkStat">
          <span className="merchantNetworkStatValue">{NETWORK_MERCHANTS.length}</span>
          <span className="merchantNetworkStatLabel">Merchants enrolled</span>
        </div>
        <div className="merchantNetworkStat">
          <span className="merchantNetworkStatValue">{activeMerchants.length}</span>
          <span className="merchantNetworkStatLabel">Active campaigns</span>
        </div>
        <div className="merchantNetworkStat">
          <span className="merchantNetworkStatValue">{totalPiko.toLocaleString("en-IN")}</span>
          <span className="merchantNetworkStatLabel">PIKO budgeted today</span>
        </div>
        <div className="merchantNetworkStat">
          <span className="merchantNetworkStatValue">{activePiko.toLocaleString("en-IN")}</span>
          <span className="merchantNetworkStatLabel">PIKO live now</span>
        </div>
      </div>

      <div className="merchantNetworkList">
        {NETWORK_MERCHANTS.map((m) => (
          <div key={m.name} className={`merchantNetworkRow ${m.active ? "active" : "inactive"}`}>
            <span className={`merchantNetworkDot ${m.active ? "active" : ""}`} />
            <span className="merchantNetworkName">{m.name}</span>
            <span className="merchantNetworkCat">{m.category}</span>
            <span className="merchantNetworkDist">{m.distance}</span>
            <span className="merchantNetworkPiko">{m.piko} PIKO</span>
            <span className={`merchantNetworkStatus ${m.active ? "active" : ""}`}>
              {m.active ? "Live" : "Paused"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Transaction Feed ─────────────────────────────────────
function TransactionFeed({ transactions }: { transactions: TransactionRecord[] }) {
  const [visibleCount, setVisibleCount] = useState(10);
  const visible = transactions.slice(0, visibleCount);

  return (
    <div className="merchantTxFeed" id="merchant-tx-feed">
      <div className="merchantTxHeader">
        <h3>Recent Transactions</h3>
        <span className="merchantTxCount">{transactions.length} today</span>
      </div>
      <div className="merchantTxList">
        {visible.map((tx) => (
          <div key={tx.id} className={`merchantTxRow ${tx.status}`} id={`tx-${tx.id}`}>
            <div className="merchantTxLeft">
              <span className={`merchantTxStatusDot ${tx.status}`} />
              <div>
                <span className="merchantTxItem">{tx.menuItem}</span>
                <span className="merchantTxWallet">{tx.customerWallet}</span>
              </div>
            </div>
            <div className="merchantTxRight">
              <span className="merchantTxAmount">{formatInr(tx.amountInr)}</span>
              {tx.status === "settled" ? (
                <span className="merchantTxPiko">+{tx.pikoRewarded} PIKO</span>
              ) : (
                <span className="merchantTxRejected">Rejected</span>
              )}
              <span className="merchantTxTime">{formatTimeAgo(tx.timestamp)}</span>
            </div>
            {tx.multiplierApplied > 1 && (
              <span className="merchantTxMultiplier">{tx.multiplierApplied}×</span>
            )}
            {tx.status === "rejected" && (
              <div className="merchantTxRejectExpanded">
                <div className="merchantTxRejectHeader">
                  <span className="merchantTxRejectIcon">✕</span>
                  <span className="merchantTxRejectTitle">Rejected by risk policy · Fraud score {tx.fraudScore}/100</span>
                </div>
                {tx.rejectReasons?.map((reason, i) => (
                  <div key={i} className="merchantTxRejectFlag">
                    <span className="merchantTxRejectFlagDot" /> {reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {visibleCount < transactions.length && (
        <button
          className="merchantTxLoadMore"
          onClick={() => setVisibleCount((c) => c + 10)}
          type="button"
        >
          Load more ({transactions.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}

// ── Economics Dashboard ──────────────────────────────────
function EconomicsDashboard({ transactions }: { transactions: TransactionRecord[] }) {
  const economics = useMemo(() => computeEconomics(transactions), [transactions]);
  const traffic = useMemo(() => generateHourlyTraffic(), []);

  return (
    <div className="merchantEconDash" id="merchant-economics-dashboard">
      <div className="merchantEconHeader">
        <div>
          <p className="eyebrow">Reward Economics</p>
          <h3>Budget & Demand Dashboard</h3>
          <p className="supportText">
            Real-time view of how PIKO incentives drive foot traffic at Cafe Bloom
          </p>
        </div>
        {economics.isSlowHourNow && (
          <div className="merchantEconSlowHourBadge">
            <span className="merchantEconSlowHourPulse" />
            Slow Hour Active · {economics.slowHourMultiplier}× Multiplier
          </div>
        )}
      </div>

      {/* Budget Ring + Key Metrics */}
      <div className="merchantEconBudgetRow">
        <BudgetRing spent={economics.budgetSpentToday} total={economics.dailyBudgetPiko} />
        <div className="merchantEconBudgetMetrics">
          <div className="merchantEconMetric">
            <span className="merchantEconMetricLabel">Daily Budget</span>
            <span className="merchantEconMetricValue brand">
              <AnimatedNumber value={economics.dailyBudgetPiko} /> PIKO
            </span>
          </div>
          <div className="merchantEconMetric">
            <span className="merchantEconMetricLabel">Spent Today</span>
            <span className="merchantEconMetricValue">
              <AnimatedNumber value={economics.budgetSpentToday} decimals={1} /> PIKO
            </span>
          </div>
          <div className="merchantEconMetric">
            <span className="merchantEconMetricLabel">Remaining</span>
            <span className="merchantEconMetricValue green">
              <AnimatedNumber value={economics.budgetRemaining} decimals={1} /> PIKO
            </span>
          </div>
          <div className="merchantEconMetric">
            <span className="merchantEconMetricLabel">Projected Exhaustion</span>
            <span className="merchantEconMetricValue">{economics.projectedBudgetExhaustion}</span>
          </div>
        </div>
      </div>

      {/* Multiplier Timeline */}
      <div className="merchantEconMultiplierSection">
        <h4>Reward Multiplier Schedule</h4>
        <div className="merchantEconMultiplierTimeline">
          <div className="merchantEconMultiplierBlock normal">
            <span>8 AM – 2 PM</span>
            <strong>1.0×</strong>
            <small>Base rate</small>
          </div>
          <div className="merchantEconMultiplierBlock slow">
            <span>2 PM – 5 PM</span>
            <strong>1.4×</strong>
            <small>Slow hour boost</small>
          </div>
          <div className="merchantEconMultiplierBlock normal">
            <span>5 PM – 10 PM</span>
            <strong>1.0×</strong>
            <small>Base rate</small>
          </div>
        </div>
      </div>

      {/* ROI Panel */}
      <div className="merchantEconRoiPanel" id="merchant-roi-panel">
        <div className="merchantEconRoiHeader">
          <p className="eyebrow">Why Merchants Pay For This</p>
          <h4>Return on Incentive Investment</h4>
        </div>
        <div className="merchantEconRoiGrid">
          <div className="merchantEconRoiCard highlight">
            <span className="merchantEconRoiValue">₹{economics.revenueGeneratedInr.toLocaleString("en-IN")}</span>
            <span className="merchantEconRoiLabel">Revenue attributed to PIKO campaigns</span>
          </div>
          <div className="merchantEconRoiCard">
            <span className="merchantEconRoiValue">₹{economics.cacInr.toLocaleString("en-IN")}</span>
            <span className="merchantEconRoiLabel">Cost per acquired customer</span>
          </div>
          <div className="merchantEconRoiCard">
            <span className="merchantEconRoiValue">₹{economics.lifetimeValueInr.toLocaleString("en-IN")}</span>
            <span className="merchantEconRoiLabel">Est. LTV per repeat customer</span>
          </div>
          <div className="merchantEconRoiCard highlight">
            <span className="merchantEconRoiValue">{economics.networkRoiX}×</span>
            <span className="merchantEconRoiLabel">Revenue per ₹1 of reward spend</span>
          </div>
          <div className="merchantEconRoiCard danger">
            <span className="merchantEconRoiValue">{economics.fraudRejectedCount}</span>
            <span className="merchantEconRoiLabel">Fraud attempts blocked today</span>
          </div>
          <div className="merchantEconRoiCard danger">
            <span className="merchantEconRoiValue">{economics.fraudSavedPiko} PIKO</span>
            <span className="merchantEconRoiLabel">Saved by risk guard</span>
          </div>
        </div>
      </div>

      {/* Acquisition KPIs */}
      <div className="merchantEconKpiGrid">
        <div className="merchantEconKpi">
          <span className="merchantEconKpiValue">
            <AnimatedNumber value={economics.totalCustomersToday} />
          </span>
          <span className="merchantEconKpiLabel">Total Transactions</span>
        </div>
        <div className="merchantEconKpi">
          <span className="merchantEconKpiValue">
            <AnimatedNumber value={economics.uniqueCustomersToday} />
          </span>
          <span className="merchantEconKpiLabel">Unique Wallets</span>
        </div>
        <div className="merchantEconKpi">
          <span className="merchantEconKpiValue">
            <AnimatedNumber value={economics.avgCostPerAcquisition} decimals={2} />
          </span>
          <span className="merchantEconKpiLabel">Avg CPA (PIKO)</span>
        </div>
        <div className="merchantEconKpi">
          <span className="merchantEconKpiValue">{economics.repeatVisitRate}%</span>
          <span className="merchantEconKpiLabel">Repeat Visit Rate</span>
        </div>
        <div className="merchantEconKpi">
          <span className="merchantEconKpiValue">{(economics.rewardToRevenueRatio * 100).toFixed(1)}%</span>
          <span className="merchantEconKpiLabel">Reward-to-Revenue</span>
        </div>
        <div className="merchantEconKpi">
          <span className="merchantEconKpiValue">{economics.currentMultiplier}×</span>
          <span className="merchantEconKpiLabel">Current Multiplier</span>
        </div>
      </div>

      {/* Traffic Chart */}
      <div className="merchantEconTrafficSection">
        <h4>Hourly Traffic & Reward Claims</h4>
        <TrafficChart />
      </div>

      {/* Reward Drain Curve */}
      <div className="merchantEconDrainSection">
        <h4>Budget Drain Curve</h4>
        <p className="supportText">
          Shows cumulative PIKO spend through the day. Slow-hour multipliers accelerate the drain to attract off-peak traffic.
        </p>
        <DrainCurve traffic={traffic} dailyBudget={economics.dailyBudgetPiko} />
      </div>
    </div>
  );
}

// ── Drain Curve SVG ──────────────────────────────────────
function DrainCurve({ traffic, dailyBudget }: { traffic: ReturnType<typeof generateHourlyTraffic>; dailyBudget: number }) {
  const points = useMemo(() => {
    let cumulative = 0;
    return traffic.map((t) => {
      const pikoThisHour = t.rewardsClaimed * (t.avgSpend / 100) * 0.08 * t.multiplier;
      cumulative += pikoThisHour;
      return { hour: t.hour, cumulative: Math.min(cumulative, dailyBudget) };
    });
  }, [traffic, dailyBudget]);

  const maxY = dailyBudget;
  const w = 360;
  const h = 120;
  const padX = 30;
  const padY = 10;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;

  const pathPoints = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * chartW;
    const y = padY + chartH - (p.cumulative / maxY) * chartH;
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  });

  const areaPath = [...pathPoints, `L${padX + chartW},${padY + chartH}`, `L${padX},${padY + chartH}`, "Z"].join(" ");

  return (
    <svg className="merchantDrainCurve" viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="xMidYMid meet">
      {/* Budget line */}
      <line x1={padX} y1={padY} x2={padX + chartW} y2={padY} stroke="rgba(239,68,68,0.3)" strokeWidth="1" strokeDasharray="4 4" />
      <text x={padX - 4} y={padY + 4} textAnchor="end" fill="var(--danger)" fontSize="8">500</text>

      {/* Slow hour highlight */}
      {(() => {
        const slowStart = points.findIndex((p) => p.hour === 14);
        const slowEnd = points.findIndex((p) => p.hour === 17);
        if (slowStart < 0) return null;
        const x1 = padX + (slowStart / (points.length - 1)) * chartW;
        const x2 = padX + ((slowEnd >= 0 ? slowEnd : slowStart + 3) / (points.length - 1)) * chartW;
        return (
          <rect x={x1} y={padY} width={x2 - x1} height={chartH} fill="rgba(255,107,44,0.08)" rx="4" />
        );
      })()}

      {/* Area fill */}
      <path d={areaPath} fill="url(#drainGrad)" opacity="0.5" />

      {/* Line */}
      <path d={pathPoints.join(" ")} fill="none" stroke="var(--solana-green)" strokeWidth="2" strokeLinecap="round" />

      {/* X-axis labels */}
      {points.filter((_, i) => i % 2 === 0).map((p, i) => {
        const x = padX + ((points.indexOf(p)) / (points.length - 1)) * chartW;
        return (
          <text key={p.hour} x={x} y={h - 2} textAnchor="middle" fill="var(--ink-dim)" fontSize="7">
            {formatHour(p.hour).replace(" AM", "a").replace(" PM", "p")}
          </text>
        );
      })}

      {/* Gradient def */}
      <defs>
        <linearGradient id="drainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--solana-green)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--solana-green)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════

export default function CafeBloomPage() {
  const [activeTab, setActiveTab] = useState<MerchantTab>("overview");
  const { transactions, economics } = useMemo(() => buildMerchantSimulationSnapshot(24), []);

  const profile = cafeBloomProfile;

  // Simulated live transaction ticker
  const [liveCount, setLiveCount] = useState(transactions.length);
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveCount((c) => c + 1);
    }, 12_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="merchantPage" id="cafe-bloom-page">
      {/* ─ Header ─ */}
      <header className="merchantPageTopbar">
        <Link href="/demo-flow" className="merchantBackLink">
          ← Back to Demo
        </Link>
        <div className="merchantPageBrand">
          <span className="brandBeacon" aria-hidden="true" />
          <span className="brandMark">PIKO Protocol</span>
        </div>
        <span className="merchantLiveDot" title="Simulation running">
          <span className="merchantLivePulse" /> Live
        </span>
      </header>

      {/* ─ Hero ─ */}
      <div className="merchantHero" id="merchant-hero">
        <div className="merchantHeroBg">
          <Image
            src={profile.interiorUrl}
            alt={`${profile.name} interior`}
            fill
            className="merchantHeroBgImg"
            priority
          />
          <div className="merchantHeroOverlay" />
        </div>
        <div className="merchantHeroContent">
          <div className="merchantHeroLogo">
            <Image src={profile.logoUrl} alt={`${profile.name} logo`} width={72} height={72} className="merchantLogoImg" />
          </div>
          <div className="merchantHeroInfo">
            <h1 className="merchantHeroName">{profile.name}</h1>
            <p className="merchantHeroTagline">{profile.tagline}</p>
            <div className="merchantHeroChips">
              <span className="merchantHeroRating">★ {profile.rating} ({profile.reviewCount})</span>
              <span className="merchantHeroHours">{profile.operatingHours}</span>
              {economics.isSlowHourNow && (
                <span className="merchantHeroSlowBadge">1.4× Slow Hour Active</span>
              )}
            </div>
          </div>
          <div className="merchantHeroEconPreview">
            <div className="merchantHeroEconItem">
              <span className="merchantHeroEconValue">{economics.budgetRemaining.toFixed(0)}</span>
              <span className="merchantHeroEconLabel">PIKO remaining</span>
            </div>
            <div className="merchantHeroEconItem">
              <span className="merchantHeroEconValue">{economics.currentMultiplier}×</span>
              <span className="merchantHeroEconLabel">Multiplier</span>
            </div>
            <div className="merchantHeroEconItem">
              <span className="merchantHeroEconValue">{liveCount}</span>
              <span className="merchantHeroEconLabel">Tx today</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─ Tab Navigation ─ */}
      <nav className="merchantTabs" id="merchant-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.key}
            className={`merchantTab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            id={`tab-${tab.key}`}
          >
            <span className="merchantTabIcon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ─ Tab Content ─ */}
      <main className="merchantTabContent" id="merchant-tab-content">
        {activeTab === "overview" && (
          <div className="merchantOverview">
            <section className="merchantAboutCard">
              <h3>About</h3>
              <p>{profile.description}</p>
              <div className="merchantTagList">
                {profile.tags.map((tag) => (
                  <span key={tag} className="merchantTag">{tag}</span>
                ))}
              </div>
            </section>

            <section className="merchantDetailsCard">
              <h3>Details</h3>
              <div className="merchantDetailRow">
                <span>Address</span>
                <strong>{profile.address}</strong>
              </div>
              <div className="merchantDetailRow">
                <span>District</span>
                <strong>{profile.district}, {profile.city}</strong>
              </div>
              <div className="merchantDetailRow">
                <span>Hours</span>
                <strong>{profile.operatingHours}</strong>
              </div>
              <div className="merchantDetailRow">
                <span>Wallet</span>
                <strong className="merchantDetailWallet">{profile.wallet.slice(0, 8)}...{profile.wallet.slice(-6)}</strong>
              </div>
              <div className="merchantDetailRow">
                <span>PIKO Budget</span>
                <strong>{economics.dailyBudgetPiko} PIKO / day</strong>
              </div>
              <div className="merchantDetailRow">
                <span>Slow Hours</span>
                <strong>2:00 PM – 5:00 PM (1.4× multiplier)</strong>
              </div>
            </section>

            <section className="merchantQuickEcon">
              <h3>Today&apos;s Performance</h3>
              <div className="merchantQuickEconGrid">
                <div className="merchantQuickEconCard">
                  <span className="merchantQuickEconValue green">{economics.budgetRemaining.toFixed(1)}</span>
                  <span className="merchantQuickEconLabel">PIKO remaining</span>
                </div>
                <div className="merchantQuickEconCard">
                  <span className="merchantQuickEconValue">{economics.totalCustomersToday}</span>
                  <span className="merchantQuickEconLabel">Transactions</span>
                </div>
                <div className="merchantQuickEconCard">
                  <span className="merchantQuickEconValue brand">{economics.avgCostPerAcquisition}</span>
                  <span className="merchantQuickEconLabel">Avg CPA (PIKO)</span>
                </div>
                <div className="merchantQuickEconCard">
                  <span className="merchantQuickEconValue">{economics.repeatVisitRate}%</span>
                  <span className="merchantQuickEconLabel">Repeat rate</span>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "menu" && <MenuSection />}
        {activeTab === "transactions" && <TransactionFeed transactions={transactions} />}
        {activeTab === "economics" && <EconomicsDashboard transactions={transactions} />}
        {activeTab === "network" && <NetworkEffectPanel />}
      </main>
    </div>
  );
}
