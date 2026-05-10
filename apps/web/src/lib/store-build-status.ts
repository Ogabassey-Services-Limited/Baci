export interface StoreBuildStatus {
  starterStoreReady: boolean;
  aiStatus:
    | 'not_started'
    | 'pending'
    | 'processing'
    | 'ready'
    | 'applied'
    | 'failed';
  latestJobId: string | null;
  canApplyAiDraft: boolean;
  message: string;
}

export interface StorefrontBuildJob {
  id: string;
  status: string;
  result_applied_at: string | null;
}

export function buildStoreBuildStatus(
  starterStoreReady: boolean,
  job: StorefrontBuildJob | null,
  canApplyAiDraft: boolean
): StoreBuildStatus {
  if (!job) {
    return {
      starterStoreReady,
      aiStatus: 'not_started',
      latestJobId: null,
      canApplyAiDraft: false,
      message: starterStoreReady
        ? 'Starter storefront is ready. AI design has not started yet.'
        : 'Starter storefront is being created.',
    };
  }

  if (job.result_applied_at) {
    return {
      starterStoreReady,
      aiStatus: 'applied',
      latestJobId: job.id,
      canApplyAiDraft: false,
      message: 'AI storefront has been applied to your draft.',
    };
  }

  if (job.status === 'completed') {
    return {
      starterStoreReady,
      aiStatus: 'ready',
      latestJobId: job.id,
      canApplyAiDraft,
      message: 'Your AI storefront is ready to preview and apply.',
    };
  }

  if (job.status === 'processing') {
    return {
      starterStoreReady,
      aiStatus: 'processing',
      latestJobId: job.id,
      canApplyAiDraft: false,
      message: 'Your AI storefront is being designed.',
    };
  }

  if (job.status === 'failed') {
    return {
      starterStoreReady,
      aiStatus: 'failed',
      latestJobId: job.id,
      canApplyAiDraft: false,
      message: 'Starter storefront is ready. AI design can be retried.',
    };
  }

  return {
    starterStoreReady,
    aiStatus: 'pending',
    latestJobId: job.id,
    canApplyAiDraft: false,
    message: 'Your AI storefront is queued.',
  };
}
