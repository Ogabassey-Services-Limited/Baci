/**
 * BILLER_INITIAL_TOKENS keeps provider placeholder avatars visually aligned
 * with the utility provider grid; the fixed size prevents cards from shifting
 * while logos load or when a provider has no logo.
 */
export const BILLER_INITIAL_TOKENS = {
  /** avatarFontSize follows the 20px in-avatar typographic scale. */
  avatarFontSize: 20,
  /** avatarRadius is half of avatarSize, keeping the 48px avatar circular. */
  avatarRadius: 24,
  /** avatarSize is the 48px base diameter used by provider logo slots. */
  avatarSize: 48,
} as const;
