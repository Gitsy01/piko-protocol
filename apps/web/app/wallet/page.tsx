"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getUser } from "@/lib/api";
import { demoUser } from "@/lib/demo-data";
import { UserProfile } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";

export default function WalletPage() {
  const { publicKey, connected } = useWallet();
  const [profile, setProfile] = useState<UserProfile>(demoUser);

  useEffect(() => {
    if (!publicKey) {
      return;
    }

    getUser(publicKey.toBase58())
      .then((data) => setProfile(data.user))
      .catch(() => undefined);
  }, [publicKey]);

  const [displayXp, setDisplayXp] = useState(0);
  const [displayPiko, setDisplayPiko] = useState(0);

  useEffect(() => {
    let frame: number;
    let start: number;
    const duration = 1500;

    const animate = (time: number) => {
      if (!start) start = time;
      const progress = Math.min((time - start) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayXp(Math.round(ease * profile.xp));
      setDisplayPiko(ease * profile.pikoBalance);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [profile.xp, profile.pikoBalance]);

  const xpProgress = Math.min(100, (displayXp / profile.nextLevelXp) * 100);

  return (
    <div className="pageStack walletPage">
      <section className="heroPanel walletHero">
        <div>
          <p className="eyebrow">Wallet command center</p>
          <h1>Balances, proofs, and settlement history.</h1>
          <p className="heroCopy">
            This is your protocol profile, with live balances, reward velocity, proof artifacts, and the activity trail behind rank.
          </p>
          <span className={`walletState ${connected ? "connected" : ""}`}>
            {connected && publicKey ? shortenAddress(publicKey.toBase58(), 6) : "Wallet disconnected"}
          </span>
        </div>
        <WalletMultiButton />
      </section>

      <section className="walletStatGrid">
        <article className="walletCard featureCard fancyHover">
          <p className="eyebrow">SOL balance</p>
          <h2>{profile.solBalance.toFixed(2)} SOL</h2>
          <p className="supportText">Ready for transactions and on-chain settlement actions.</p>
        </article>
        <article className="walletCard featureCard fancyHover">
          <p className="eyebrow">PIKO balance</p>
          <h2>{displayPiko.toFixed(2)} PIKO</h2>
          <p className="supportText">{profile.totalRewards.toFixed(2)} total PIKO settled.</p>
        </article>
        <article className="walletCard featureCard fancyHover">
          <p className="eyebrow">PIKO this week</p>
          <h2>{profile.rewardsThisWeek.toFixed(2)} PIKO</h2>
          <p className="supportText">Track current-week issuance across live merchant programs.</p>
        </article>
        <article className="walletCard featureCard fancyHover">
          <p className="eyebrow">Program completions</p>
          <h2>{profile.questsCompleted}</h2>
          <p className="supportText">Repeat visits and chained programs both count toward protocol reputation.</p>
        </article>
      </section>

      <section className="walletOverviewGrid">
        <article className="walletCard levelPanel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Tier progress</p>
              <h2>
                Level {profile.level} <span className="levelTitle">{profile.levelTitle}</span>
              </h2>
            </div>
            <div className="streakCluster">
              <span className="streakFlame">Signal</span>
              <strong>{profile.streak}-day streak</strong>
            </div>
          </div>

          <div className="xpBar largeXpBar">
            <div className="xpBarFill" style={{ width: `${xpProgress}%` }} />
          </div>
          <p className="supportText">
            {displayXp} / {profile.nextLevelXp} XP until the next protocol tier.
          </p>

          <div className="streakMeter">
            {Array.from({ length: 7 }).map((_, index) => (
              <span key={index} className={index < profile.streak ? "active" : ""}>
                {index + 1}
              </span>
            ))}
          </div>
        </article>

        <article className="walletCard activityTimelineCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h2>Settlement feed</h2>
            </div>
          </div>

          <div className="activityList">
            {profile.recentActivity.map((item) => (
              <div className="activityCard" key={item.id}>
                <span className={`activityDot ${item.type}`} />
                <div style={{ flex: 1 }}>
                  <strong>{item.title}</strong>
                  <p className="supportText">{item.detail}</p>
                </div>
                <span className="activityTime">{item.timestamp}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section>
        <div className="sectionHeader" style={{ marginBottom: "12px" }}>
          <div>
            <p className="eyebrow">Proof gallery</p>
            <h2>NFT proof artifacts</h2>
          </div>
        </div>

        <div className="badgeGrid">
          {profile.badges?.map((badge) => (
            <article className="badgeCard premiumBadgeCard" key={badge.id}>
              <div className="badgeIcon">{badge.icon}</div>
              <span className="badgeRarity">{badge.rarity}</span>
              <h3>{badge.name}</h3>
              <p>{badge.description}</p>
              <small>Recorded {new Date(badge.earnedAt).toLocaleDateString()}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
