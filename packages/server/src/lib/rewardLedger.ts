import {
  baseUnitsToDecimalString,
  baseUnitsToNumber,
  decimalToBaseUnits,
} from "./tokenMath";

type RewardTotalsSnapshot = {
  totalRewards?: number | null;
  totalRewardsBaseUnits?: bigint | null;
};

export function resolveRewardTotalBaseUnits(
  snapshot: RewardTotalsSnapshot,
  decimals: number,
): bigint {
  const exactBaseUnits = snapshot.totalRewardsBaseUnits ?? 0n;

  if (exactBaseUnits > 0n) {
    return exactBaseUnits;
  }

  const legacyTotalRewards = snapshot.totalRewards ?? 0;
  if (!Number.isFinite(legacyTotalRewards) || legacyTotalRewards <= 0) {
    return 0n;
  }

  return decimalToBaseUnits(legacyTotalRewards, decimals);
}

export function addRewardToTotals(
  snapshot: RewardTotalsSnapshot,
  rewardAmountBaseUnits: bigint,
  decimals: number,
) {
  if (rewardAmountBaseUnits < 0n) {
    throw new Error(`Negative reward amounts are not supported: ${rewardAmountBaseUnits}`);
  }

  const totalRewardsBaseUnits =
    resolveRewardTotalBaseUnits(snapshot, decimals) + rewardAmountBaseUnits;

  return {
    totalRewardsBaseUnits,
    totalRewards: baseUnitsToNumber(totalRewardsBaseUnits, decimals),
    totalRewardsDisplay: baseUnitsToDecimalString(totalRewardsBaseUnits, decimals),
  };
}
