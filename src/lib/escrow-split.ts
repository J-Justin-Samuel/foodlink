/** How a captured payment is divided. Percentages are whole numbers that add up to 100. */
export const SPLIT_PERCENT = {
  donor: 75,
  volunteer: 15,
  platform: 10,
} as const;

export interface Split {
  donorMinor: number;
  volunteerMinor: number;
  platformMinor: number;
}

/**
 * Splits an amount in minor units (paise). Each share is rounded down and the
 * platform takes the remainder, so the three parts always add up to the
 * total exactly: no paisa is created or lost.
 */
export function splitAmount(totalMinor: number): Split {
  if (!Number.isInteger(totalMinor) || totalMinor <= 0)
    throw new Error("Amount must be a positive whole number of minor units.");
  const donorMinor = Math.floor((totalMinor * SPLIT_PERCENT.donor) / 100);
  const volunteerMinor = Math.floor(
    (totalMinor * SPLIT_PERCENT.volunteer) / 100,
  );
  return {
    donorMinor,
    volunteerMinor,
    platformMinor: totalMinor - donorMinor - volunteerMinor,
  };
}
