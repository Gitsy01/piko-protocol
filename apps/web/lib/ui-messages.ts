const FRIENDLY_MESSAGE_RULES: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /world id verification required/i,
    message: "Verify with World ID before trying to claim this incentive.",
  },
  {
    pattern: /gps accuracy is required/i,
    message: "Wait for the GPS lock to settle before retrying the incentive flow.",
  },
  {
    pattern: /gps accuracy too low/i,
    message: "Move to a clearer outdoor spot and retry once your GPS accuracy improves.",
  },
  {
    pattern: /too far from merchant/i,
    message: "Walk closer to the merchant pin. You need to be within the live merchant zone to continue.",
  },
  {
    pattern: /already claimed/i,
    message: "This wallet already has a live claim for this incentive. Continue with the payment step.",
  },
  {
    pattern: /reward cooldown active/i,
    message: "This wallet just earned a reward. Wait for the cooldown window, then try again.",
  },
  {
    pattern: /payment amount too low/i,
    message: "The payment was below the program minimum. Increase the amount and try again.",
  },
  {
    pattern: /transaction not found for reference/i,
    message: "The payment has not settled on devnet yet. Give it a moment, then verify again.",
  },
  {
    pattern: /payment not found/i,
    message: "We could not match the payment yet. Wait for devnet confirmation and retry.",
  },
];

export function toFriendlyMessage(message: string, fallback: string) {
  const normalized = message.trim();

  for (const rule of FRIENDLY_MESSAGE_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.message;
    }
  }

  return normalized || fallback;
}
