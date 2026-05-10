"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren, useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { usePwa } from "@/hooks/use-pwa";
import { appendDemoQuery } from "@/lib/demo-mode";

const NAV_ITEMS = [
  { href: "/", match: "/", label: "Map", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> },
  { href: "/quest", match: "/quest", label: "Incentives", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg> },
  { href: "/demo-flow", match: "/demo-flow", label: "Demo", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> },
  { href: "/demo", match: "/demo", label: "System Reveal", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 8h10M7 12h7M7 16h5"></path></svg> },
  { href: "/wallet", match: "/wallet", label: "Wallet", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg> },
  { href: "/leaderboard", match: "/leaderboard", label: "Leaderboard", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg> },
];

function isActive(pathname: string, match: string) {
  if (match === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(match);
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const demoMode = useDemoMode();
  const { canInstall, notificationsEnabled, promptInstall, enableNotifications } = usePwa();
  const [mounted, setMounted] = useState(false);
  const standaloneRoute = pathname.startsWith("/demo-flow");
  const showNavigation = !standaloneRoute && !demoMode;
  const showWalletAction = !standaloneRoute && (!demoMode || pathname !== "/");
  const brandHref = appendDemoQuery("/", demoMode);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (standaloneRoute) {
    return <main>{children}</main>;
  }

  return (
    <div className="appFrame">
      <header className="topbar">
        <Link href={brandHref} className="brandCluster">
          <span className="brandBeacon" aria-hidden="true" />
          <span>
            <span className="brandMark">PIKO Protocol</span>
            <span className="brandTag">{demoMode ? "Focused demo mode" : "Contributor intelligence infrastructure"}</span>
          </span>
        </Link>

        <div className="topbarActions">
          {!demoMode && canInstall ? (
            <button className="ghostButton" type="button" onClick={() => void promptInstall()}>
              Install PWA
            </button>
          ) : null}
          {!demoMode ? (
            <button
              className={`ghostButton notificationButton ${notificationsEnabled ? "active" : ""}`}
              type="button"
              onClick={() =>
                void enableNotifications(
                  "Nearby incentive available. A verified merchant offer is ready within walking distance."
                )
              }
            >
              {notificationsEnabled ? "Alerts armed" : "Enable alerts"}
              {notificationsEnabled ? null : <span className="notificationDot" />}
            </button>
          ) : (
            <span className="ghostButton demoModeBadge">Demo mode</span>
          )}
          {showWalletAction ? (
            mounted ? (
              <WalletMultiButton />
            ) : (
              <div className="walletButtonPlaceholder" aria-hidden="true" />
            )
          ) : null}
        </div>
      </header>

      {showNavigation ? (
        <nav className="subnav">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.match);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
              >
                <span className="subnavIcon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <main>{children}</main>

      {showNavigation ? (
        <nav className="bottomNav">
          <div className="bottomNavInner bottomNavRail">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.match);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`bottomNavLink bottomNavLinkFill ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="bottomNavIcon">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
