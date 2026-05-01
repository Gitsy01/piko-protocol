import { LeaderboardEntry } from "@/lib/types";
import { buildSparklinePath, shortenAddress } from "@/lib/utils";

type LeaderboardWidgetProps = {
  entries: LeaderboardEntry[];
  title?: string;
  highlightWallet?: string;
};

function rankClass(rank: number) {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "normal";
}

function rankMedal(rank: number) {
  if (rank === 1) return "1";
  if (rank === 2) return "2";
  if (rank === 3) return "3";
  return `#${rank}`;
}

export function LeaderboardWidget({
  entries,
  title = "Weekly leaderboard",
  highlightWallet,
}: LeaderboardWidgetProps) {
  const maxXp = Math.max(...entries.map((entry) => entry.xp), 1);

  return (
    <section className="leaderboardWidget" id="leaderboard-widget">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Gamification loop</p>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="leaderboardList richLeaderboardList">
        {entries.map((entry) => {
          const progress = (entry.xp / maxXp) * 100;
          const isHighlighted = entry.wallet === highlightWallet || entry.isCurrentUser;

          return (
            <div
              className={`leaderboardRow richLeaderboardRow ${isHighlighted ? "highlighted" : ""}`}
              key={`${entry.wallet}-${entry.rank}`}
            >
              <div className={`leaderboardRank ${rankClass(entry.rank)}`}>{rankMedal(entry.rank)}</div>

              <div className="leaderboardIdentity">
                <div className="leaderboardAvatar">{entry.avatar}</div>
                <div>
                  <strong>{shortenAddress(entry.wallet)}</strong>
                  <p>{entry.title}</p>
                </div>
              </div>

              <div className="leaderboardTrend">
                <div className="leaderboardMiniBar">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <svg className="sparkline" viewBox="0 0 96 28" preserveAspectRatio="none" aria-hidden="true">
                  <path d={buildSparklinePath(entry.sparkline ?? [])} />
                </svg>
              </div>

              <div className={`rankDelta ${entry.delta > 0 ? "up" : entry.delta < 0 ? "down" : "flat"}`}>
                {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
              </div>

              <strong className="leaderboardXp">{entry.xp.toLocaleString()} XP</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}
