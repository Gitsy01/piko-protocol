import test from "node:test";
import assert from "node:assert/strict";
import { addRewardToTotals } from "../src/lib/rewardLedger";

test("addRewardToTotals keeps totals exact in base units", () => {
  const result = addRewardToTotals(
    {
      totalRewardsBaseUnits: 1_002_387_500_000n,
      totalRewards: 1002.3875,
    },
    12_500_000n,
    9,
  );

  assert.equal(result.totalRewardsBaseUnits, 1_002_400_000_000n);
  assert.equal(result.totalRewards, 1002.4);
  assert.equal(result.totalRewardsDisplay, "1002.4");
});
