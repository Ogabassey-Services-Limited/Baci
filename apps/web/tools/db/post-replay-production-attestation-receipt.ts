import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';

const appliedEntries = supabaseHistoryReplayManifest.postReplaySources.map(
  ({ repositoryPath }) => {
    const match = repositoryPath.match(/\/(\d{14})_([a-z0-9_]+)[.]sql$/);
    if (!match) throw new Error('Invalid post-replay manifest source');
    return { name: match[2] as string, version: match[1] as string };
  }
);

export const postReplayProductionAttestationReceipt = {
  schemaVersion: 1,
  deployment: {
    appliedEntries,
    databaseJob: { conclusion: 'success', id: 88164086530 },
    mergeSha: 'fb6c7570ac1a0897efb9890db6b9992410c5eb7a',
    run: {
      conclusion: 'success',
      headSha: 'fb6c7570ac1a0897efb9890db6b9992410c5eb7a',
      id: 29676236659,
    },
    semanticLogSha256:
      '9c91aeab90841c40970f18a4d37a988f85a9204a6fde36daa4a07bdea5438ffa',
    summary: { applied: 12, skipped: 427 },
  },
  ledger: {
    frozenPrefix: {
      inventorySha256:
        '1ddb8497e4d0cc692a4f8fd5c5dec7f5da16d49b4c45c0511d4f19e7646b8ffc',
      rowCount: 442,
      tailVersion: '20260714225503',
    },
    live: {
      inventorySha256:
        'ce47c285538cd31047888b4b68c3e4291ace8774e3c29a1bed9735508e5c8832',
      rowCount: 454,
      tailVersion: '20260718070011',
    },
    postReplaySourceCount: 12,
  },
  effects: {
    baseSha: '9e3d1b14b1931a5e441fc23f0e5417c188056e47',
    changedComponents: [
      {
        category: 'constraint',
        frozenSha256:
          'e8c7feafd3d4249f19bdabadb9d38075dc303ec4b0c5e0dad579698500fb7906',
        identity:
          'public.reconciliation_review.reconciliation_review_issue_type_check',
        liveSha256:
          'b8162359116ec9a8565e08b8050a9646f711d081878f21c56a05f9963ff0c229',
      },
    ],
    componentCount: 76,
    domainEventRpcCount: 19,
    frozenEffectSha256:
      '71cba5629959c75352726e26cafcbfec8de99b1b52d10e6ad70fd85f07e4d253',
    liveEffectSha256:
      'dd1f3d2e2b84fd1fe866eb3bd1baa44fc5edcf67aa97a53d1984e5d0b312bc70',
    querySha256:
      '2b555af09c8a9cb7e8026b028c014b304de146a9f50a2c2f2a896a6626dfacbc',
    scopeManifestSha256:
      'a216397b8fcc2cd0cac6f7a66023582f43b0c5e348501a94d00d771da1084245',
    scopeVersion: 'baci-p0-effects-v3',
    serverVersionNum: 170006,
    sourceKind: 'supabase-management-api-read-only',
  },
} as const;
