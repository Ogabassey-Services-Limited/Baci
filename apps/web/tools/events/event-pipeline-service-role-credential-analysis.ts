import { createHash } from 'node:crypto';
import ts from '@typescript/typescript6';
import { parseEventPipelineTypeScriptSource } from '../../src/lib/events/event-pipeline-typescript-source';
import { resolveLexicalString } from './analytics-delivery-static-string';
import { isTestSourcePath } from './event-pipeline-source-path';

type CredentialReaderLedgers = {
  approvedTask6ReaderHashes: Readonly<Record<string, string>>;
  preExistingReaderHashes: Readonly<Record<string, string>>;
  testSupportReaderHashes: Readonly<Record<string, string>>;
};

const defaultLedgers: CredentialReaderLedgers = {
  approvedTask6ReaderHashes: {
    'apps/web/src/lib/supabase/service.ts':
      '13e10a25092e1a53c8f091b3576e804f6e1268f55d63393d2a2231ddc46cc5bc',
  },
  // These are pre-existing factory, worker, or route readers. They are not part
  // of the temporary three-edge Task 6 analytics exception.
  preExistingReaderHashes: {
    'apps/web/mcp-server/migrate_images.ts':
      'bd69a87ccb7c68ecef2a49eaaf059465cef2b0a5de45a2dab9bc988381615bd7',
    'apps/web/mcp-server/server.ts':
      'b616e48f8a83fd45ae7d12337398a2755d04b4abe929276ac3df2ebfb16b76fe',
    'apps/web/src/app/api/ai-jobs/worker/route.ts':
      '3cd51c9f0c4aeba362afd3d37e1a4b2d29107bedb6bdf2f75c9860cdc28fa42a',
    'apps/web/src/app/api/shipping/self-fulfill/route.ts':
      'cb7a3220da0b16017bd9d56c5d1aeeb87438088a0603e03f88bd10958b0209da',
    'apps/web/src/app/api/shipping/webhooks/[provider]/route.ts':
      '2a2713042ae099e9deb7ac4be9e05631fbf72d18789689a26fa0e4896f2189d5',
    'apps/web/src/env.ts':
      'e39e64517d7126da3ffcc80a72a8db34b1d231209af923e470cd7ac4d4d35657',
    'apps/web/src/scripts/process-ai-storefront-jobs.ts':
      '47bea3bc3ac77a939febb07b99c4ec4edf6f16f33f310dddd23ec2a4cbe2c0ad',
    'vps-workers/jobs/cleanup-agentic-request-records.mjs':
      '29d02f20900fe0d476d57b2620dd324a4830ff200a66fc3b4454aaf48047dd19',
    'vps-workers/jobs/cleanup-import-uploads.mjs':
      '00c9de97809d2ba2280276f875506f62a56fea4c4cf89d09ade132df3105a385',
    'vps-workers/jobs/cleanup-push-tokens.mjs':
      'db221f22d082dc352b274edd04445f5f7c1cf03f21c207483dc8d1dfb90b677c',
    'vps-workers/jobs/push-receipts.mjs':
      '53fdf8d8b8b3b897c533d150ddbdbfa8c250df465cca6f8eea7fbe8806a4b96c',
    'vps-workers/jobs/supabase-retention-cleanup.mjs':
      'fd260d7c9e8fa080ed938d659e009402554bbcf2915ad26823daa97b3d0f9595',
    'vps-workers/jobs/sync-gigl-service-centres.mjs':
      'f25ef9f60e7297033e1d8b42f71ceba82cee4fe42c7cbce1b201f5ff8f8e72e8',
  },
  testSupportReaderHashes: {
    'apps/web/src/lib/events/event-pipeline-service-role-test-client.ts':
      '7c4706a553218e97f1d150f4ee9ea6f82dd19678c9036f2de3aae5687e866b84',
  },
};

function readsCredential(path: string, source: string): boolean {
  const file = parseEventPipelineTypeScriptSource(path, source);
  const key = (expression: ts.Expression | undefined, at: ts.Node) =>
    resolveLexicalString(expression, file, at) === 'SUPABASE_SERVICE_ROLE_KEY';
  let found = false;
  function visit(node: ts.Node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'SUPABASE_SERVICE_ROLE_KEY'
    ) {
      found = true;
    } else if (
      ts.isElementAccessExpression(node) &&
      key(node.argumentExpression, node)
    ) {
      found = true;
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Reflect' &&
      node.expression.name.text === 'get' &&
      key(node.arguments[1], node)
    ) {
      found = true;
    } else if (ts.isBindingElement(node)) {
      const property = node.propertyName ?? node.name;
      if (
        (ts.isIdentifier(property) &&
          property.text === 'SUPABASE_SERVICE_ROLE_KEY') ||
        (ts.isComputedPropertyName(property) && key(property.expression, node))
      )
        found = true;
    }
    if (!found) ts.forEachChild(node, visit);
  }
  visit(file);
  return found;
}

function findings(
  sources: ReadonlyMap<string, string>,
  ledgers: CredentialReaderLedgers = defaultLedgers
): string[] {
  const results: string[] = [];
  const categories = [
    ['Task 6 approved', ledgers.approvedTask6ReaderHashes],
    ['pre-existing', ledgers.preExistingReaderHashes],
    ['test-support', ledgers.testSupportReaderHashes],
  ] as const;
  const classified = new Map<string, { category: string; hash: string }>();
  for (const [category, ledger] of categories)
    for (const [path, hash] of Object.entries(ledger))
      classified.set(path, { category, hash });
  for (const [path, source] of sources) {
    if (isTestSourcePath(path) || !readsCredential(path, source)) continue;
    const record = classified.get(path);
    if (!record) {
      results.push(
        `${path}: unclassified production service-role credential read`
      );
      continue;
    }
    const actual = createHash('sha256').update(source).digest('hex');
    if (actual !== record.hash)
      results.push(
        `${path}: ${record.category} service-role credential reader hash drift`
      );
  }
  for (const [path, record] of classified) {
    const source = sources.get(path);
    if (!source) {
      results.push(
        `${path}: classified service-role credential reader is missing`
      );
    } else if (!readsCredential(path, source)) {
      results.push(
        `${path}: classified service-role credential read was removed; retire its ledger entry`
      );
    } else {
      const actual = createHash('sha256').update(source).digest('hex');
      if (actual !== record.hash)
        results.push(
          `${path}: ${record.category} service-role credential reader hash drift`
        );
    }
  }
  return [...new Set(results)].sort();
}

export const serviceRoleCredentialAuthority = {
  findings,
  ledgers: defaultLedgers,
  readsCredential,
} as const;
