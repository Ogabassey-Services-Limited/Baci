export function createReadinessPayload(canApplyAiDraft = false) {
  return {
    merchantId: '11111111-1111-4111-8111-111111111111',
    surface: 'web' as const,
    isReady: false,
    isPublished: false,
    completedRequired: 0,
    totalRequired: 1,
    completedRecommended: 0,
    totalRecommended: 0,
    overallProgress: 0,
    items: [
      {
        id: 'first_product' as const,
        label: 'Publish your first product',
        description: 'You need at least one published product to start selling',
        completed: false,
        priority: 'required' as const,
        category: 'products' as const,
      },
    ],
    storeBuild: {
      starterStoreReady: true,
      aiStatus: 'ready' as const,
      latestJobId: '5c0a0676-bd3f-495e-9f98-589f208c0d79',
      canApplyAiDraft,
      message: 'Your AI storefront is ready to preview and apply.',
    },
  };
}

export function createMobileReadinessPayload() {
  return {
    ...createReadinessPayload(),
    surface: 'mobile' as const,
  };
}
