// ═══════════════════════════════════════════════════════════
// @depokemongo/common — Utility Functions
// ═══════════════════════════════════════════════════════════

/**
 * Calculate Haversine distance between two geo points (in meters).
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generate a geohash string from lat/lng (simple implementation).
 */
export function simpleGeohash(lat: number, lng: number, precision = 8): string {
  const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = "";
  let isLng = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }
    isLng = !isLng;
    if (bit < 4) {
      bit++;
    } else {
      hash += base32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

/**
 * Calculate XP level from total XP.
 */
export function xpToLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

/**
 * Format a token amount for display.
 */
export function formatTokenAmount(amount: number, token = "PIKO"): string {
  const formatted = Number.isInteger(amount)
    ? amount.toString()
    : amount.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} ${token}`;
}

/**
 * Format base-unit token amounts without using floating point math.
 */
export function formatPiko(amountBaseUnits: bigint, decimals = 9): string {
  const isNegative = amountBaseUnits < 0n;
  const absoluteValue = isNegative ? -amountBaseUnits : amountBaseUnits;
  const digits = absoluteValue.toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals) || "0";
  const fractional = decimals > 0 ? digits.slice(digits.length - decimals).replace(/0+$/, "") : "";
  const sign = isNegative ? "-" : "";

  return fractional.length > 0 ? `${sign}${whole}.${fractional}` : `${sign}${whole}`;
}

/**
 * Format distance for display.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Shorten a Solana wallet address for display.
 */
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Generate a random reference key for Solana Pay.
 */
export function generateReference(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 32; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
