export const builderAiPlanOutputBudget = {
  // The shared 4,096-byte aggregate plan cap supports this provider-safe
  // ceiling while retaining 2,048 bytes of response headroom.
  maxOutputTokens: 6_144,
  isApproved: (value: unknown): value is number => value === 6_144,
  routeResponseMarginMs: 1_000,
};
