"use client";

import { useEffect, useState } from "react";
import { QuestCard } from "@/components/quest-card";
import { useMerchantMap } from "@/hooks/use-merchant-map";
import { getNearbyQuests } from "@/lib/api";
import { QuestDetail } from "@/lib/types";

export default function QuestIndexPage() {
  const { location, accuracy, locationLabel } = useMerchantMap();
  const [quests, setQuests] = useState<QuestDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveQuests() {
      setLoading(true);
      setError(null);

      try {
        const nearbyQuests = await getNearbyQuests(location.lat, location.lng);

        if (!cancelled) {
          setQuests(nearbyQuests);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load live incentives");
          setQuests([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLiveQuests();

    return () => {
      cancelled = true;
    };
  }, [location.lat, location.lng]);

  return (
    <div className="pageStack questPage">
      <section className="heroPanel walletHero glassShine">
        <div>
          <p className="eyebrow" style={{ animation: "neonFlicker 3s infinite" }}>Live Incentives</p>
          <h1>Discover and settle active incentive programs</h1>
          <p className="heroCopy">
            Browse live backend incentives near your current GPS position, then complete the Solana Pay settlement loop.
          </p>
          <p className="supportText">
            {locationLabel}
            {accuracy ? ` - GPS accuracy ${Math.round(accuracy)}m` : ""}
          </p>
        </div>
        <div className="heroStats">
          <div className="statChip fancyHover">
            <span>{quests.length}</span>
            <p>Active incentives</p>
          </div>
        </div>
      </section>

      {error ? (
        <section className="merchantMiniCard">
          <p className="eyebrow">Backend required</p>
          <h2>Live incentives unavailable</h2>
          <p className="supportText">{error}</p>
        </section>
      ) : null}

      {loading ? (
        <section className="merchantMiniCard">
          <p className="eyebrow">Loading</p>
          <h2>Fetching nearby incentives</h2>
          <p className="supportText">Reading active incentive programs from the API.</p>
        </section>
      ) : null}

      {!loading && !error && quests.length === 0 ? (
        <section className="merchantMiniCard">
          <p className="eyebrow">No nearby incentives</p>
          <h2>Create or seed a merchant incentive near this location</h2>
          <p className="supportText">The page no longer falls back to demo incentives when the backend has no live data.</p>
        </section>
      ) : null}

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: "16px", alignItems: "start" }}>
        {quests.map((quest, index) => (
          <div key={quest.id} style={{ animation: `fadeInUp 0.4s ease-out ${index * 0.1}s backwards` }}>
            <QuestCard quest={quest} />
          </div>
        ))}
      </section>
    </div>
  );
}
