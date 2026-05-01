export function shortenAddress(address: string, visible = 4) {
  if (address.length <= visible * 2) {
    return address;
  }

  return `${address.slice(0, visible)}...${address.slice(-visible)}`;
}

export function formatReward(amount: number, token = "PIKO") {
  const formatted = Number.isInteger(amount)
    ? amount.toString()
    : amount.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} ${token}`;
}

export function formatDistance(distance?: number) {
  if (distance == null) {
    return "Nearby";
  }

  if (distance < 1000) {
    return `${Math.round(distance)}m away`;
  }

  return `${(distance / 1000).toFixed(1)}km away`;
}

export function formatCountdownParts(expiresAt: string) {
  const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds };
}

export function formatCountdownLabel(expiresAt: string) {
  const { hours, minutes } = formatCountdownParts(expiresAt);
  return `${hours}h ${minutes}m remaining`;
}

export function buildSparklinePath(
  points?: readonly number[] | null,
  width = 96,
  height = 28
) {
  const safePoints = (points ?? []).filter((point) => Number.isFinite(point));

  if (safePoints.length === 0) {
    return "";
  }

  const max = Math.max(...safePoints);
  const min = Math.min(...safePoints);
  const xStep = safePoints.length === 1 ? width : width / (safePoints.length - 1);

  return safePoints
    .map((point, index) => {
      const x = index * xStep;
      const ratio = max === min ? 0.5 : (point - min) / (max - min);
      const y = height - ratio * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function classifyPin(multiplier: number, isSponsored: boolean, isTrending: boolean) {
  if (isSponsored) {
    return { label: "Sponsored", emoji: "STAR", tone: "sponsored" as const };
  }

  if (multiplier >= 1.9) {
    return { label: "High Reward", emoji: "FIRE", tone: "reward" as const };
  }

  if (isTrending) {
    return { label: "Trending", emoji: "BOLT", tone: "trending" as const };
  }

  return { label: "Active", emoji: "DOT", tone: "default" as const };
}
