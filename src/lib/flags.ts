import "server-only";

/**
 * Manually-entered "simulator" readings let you try the scanner without
 * hardware. They are accepted in development, and in production only if
 * ALLOW_SIMULATED_SCANS=true — otherwise anyone could type in a "SAFE" result.
 */
export const simulatorAllowed = () =>
  process.env.NODE_ENV !== "production" ||
  process.env.ALLOW_SIMULATED_SCANS === "true";
