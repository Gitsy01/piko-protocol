"use client";

import { useEffect, useState } from "react";
import { LeaderboardWidget } from "@/components/leaderboard-widget";
import { getLeaderboard } from "@/lib/api";
import { demoLeaderboard } from "@/lib/demo-data";
import { LeaderboardEntry } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";

type Period = "weekly" | "monthly" | "alltime";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(demoLeaderboard);
  const [period, setPeriod] = useState<Period>("weekly");

  useEffect(() => {
    getLeaderboard(period)
      .then((data) => setEntries(data.entries))
      .catch(() => undefined);
  }, [period]);

  const top3 = entries.slice(0, 3);
  const currentUser = entries.find((entry) => entry.isCurrentUser);

  return (
    <div className="pageStack leaderboardPage">
      <section className="heroPanel leaderboardHero">
        <div>
          <p className="eyebrow">Leaderboard</p>
          <h1>XP races, podium energy, and live rank pressure.</h1>
          <p className="heroCopy">
            Weekly, monthly, and all-time ladders all feed the same loop: route smarter, complete quests faster, and turn streaks into leaderboard momentum.
          </p>
        </div>

        {currentUser ? (
          <div className="rankUpCard">
            <p className="eyebrow">Your position</p>
            <strong>#{currentUser.rank}</strong>
            <span>{currentUser.xp.toLocaleString()} XP</span>
            <small>{currentUser.delta > 0 ? `Up ${currentUser.delta} places` : "Holding position"}</small>
          </div>
        ) : null}
      </section>

      <div className="periodTabs">
        {(["weekly", "monthly", "alltime"] as Period[]).map((value) => (
          <button
            key={value}
            className={`periodTab ${period === value ? "active" : ""}`}
            onClick={() => setPeriod(value)}
            type="button"
          >
            {value === "alltime" ? "All-time" : value.charAt(0).toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      {top3.length >= 3 ? (
        <div className="podium">
          {[top3[1], top3[0], top3[2]].map((entry, index) => {
            const tone = index === 1 ? "first" : index === 0 ? "second" : "third";

            return (
              <article
                className={`podiumCard ${tone} fancyHover`}
                key={entry.wallet}
              >
                <div className="podiumAvatar">{entry.avatar}</div>
                <span className="podiumMedal">{tone === "first" ? "🥇" : tone === "second" ? "🥈" : "🥉"}</span>
                <strong>{shortenAddress(entry.wallet)}</strong>
                <span className="podiumWallet">{entry.title}</span>
                <span className="podiumXp">{entry.xp.toLocaleString()} XP</span>
              </article>
            );
          })}
        </div>
      ) : null}

      <LeaderboardWidget
        entries={entries}
        title={`${period === "alltime" ? "All-time" : period.charAt(0).toUpperCase() + period.slice(1)} XP race`}
        highlightWallet="Demo...User"
      />
    </div>
  );
}
