const MULTIPLIER_SCALE_DECIMALS = 6;
const MULTIPLIER_SCALE = 10n ** BigInt(MULTIPLIER_SCALE_DECIMALS);

export function decimalToBaseUnits(value: number | string, decimals: number): bigint {
  const normalized = normalizeDecimalString(value);
  const isNegative = normalized.startsWith("-");

  if (isNegative) {
    throw new Error(`Negative token amounts are not supported: ${value}`);
  }

  const unsigned = normalized.replace(/^[+]/, "");
  const [wholePart, fractionalPart = ""] = unsigned.split(".");
  const wholeDigits = wholePart === "" ? "0" : wholePart;
  const paddedFractional = `${fractionalPart}${"0".repeat(decimals)}`.slice(0, decimals);
  const combined = `${wholeDigits}${paddedFractional}`.replace(/^0+(?=\d)/, "");

  return BigInt(combined === "" ? "0" : combined);
}

export function baseUnitsToDecimalString(value: bigint, decimals: number): string {
  const isNegative = value < 0n;
  const absoluteValue = isNegative ? -value : value;
  const digits = absoluteValue.toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals) || "0";
  const fractional = decimals > 0 ? digits.slice(digits.length - decimals).replace(/0+$/, "") : "";
  const sign = isNegative ? "-" : "";

  return fractional.length > 0 ? `${sign}${whole}.${fractional}` : `${sign}${whole}`;
}

export function baseUnitsToNumber(value: bigint, decimals: number): number {
  return Number(baseUnitsToDecimalString(value, decimals));
}

export function scaleMultiplier(multiplier: number | string): bigint {
  return decimalToBaseUnits(multiplier, MULTIPLIER_SCALE_DECIMALS);
}

export function applyMultiplierToBaseUnits(
  amountBaseUnits: bigint,
  multiplier: number | string,
): bigint {
  return (amountBaseUnits * scaleMultiplier(multiplier)) / MULTIPLIER_SCALE;
}

export function multiplyTokenAmountToBaseUnits(
  amount: number | string,
  multiplier: number | string,
  decimals: number,
): bigint {
  return applyMultiplierToBaseUnits(decimalToBaseUnits(amount, decimals), multiplier);
}

function normalizeDecimalString(value: number | string): string {
  const raw = typeof value === "number" ? value.toString() : value.trim();

  if (raw.length === 0) {
    throw new Error("Empty decimal value");
  }

  const signMatch = raw.match(/^[+-]/);
  const sign = signMatch?.[0] ?? "";
  const unsigned = sign.length > 0 ? raw.slice(1) : raw;

  if (unsigned.length === 0) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const [mantissa, exponentPart] = unsigned.toLowerCase().split("e");

  if (!/^\d+(\.\d+)?$/.test(mantissa) || (exponentPart != null && !/^[+-]?\d+$/.test(exponentPart))) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  if (exponentPart == null) {
    return `${sign}${trimDecimal(mantissa)}`;
  }

  const exponent = Number.parseInt(exponentPart, 10);
  const [wholePart, fractionalPart = ""] = mantissa.split(".");
  const digits = `${wholePart}${fractionalPart}`.replace(/^0+(?=\d)/, "") || "0";
  const decimalIndex = wholePart.length + exponent;

  let expanded: string;
  if (decimalIndex <= 0) {
    expanded = `0.${"0".repeat(Math.abs(decimalIndex))}${digits}`;
  } else if (decimalIndex >= digits.length) {
    expanded = `${digits}${"0".repeat(decimalIndex - digits.length)}`;
  } else {
    expanded = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  }

  return `${sign}${trimDecimal(expanded)}`;
}

function trimDecimal(value: string): string {
  const [wholePart, fractionalPart = ""] = value.split(".");
  const whole = wholePart.replace(/^0+(?=\d)/, "") || "0";
  const fractional = fractionalPart.replace(/0+$/, "");

  return fractional.length > 0 ? `${whole}.${fractional}` : whole;
}
