import { describe, expect, it } from 'vitest';
import { privilegedCallerAnalysis } from './agentic-dva-caller-contract-test-support';

const definitionPath = 'apps/web/src/lib/paystack.ts';
const sourcesByPath = new Map([[definitionPath, '']]);

describe('privilegedCallerAnalysis', () => {
  it('detects a call through an aliased privileged import', () => {
    const file = {
      path: 'apps/web/src/example.ts',
      source:
        "import { generatePaymentAccount as create } from '@/lib/paystack';\ncreate({});",
    };

    const calls = privilegedCallerAnalysis.countCalls({
      definitionPath,
      file,
      functionName: 'generatePaymentAccount',
      sourcesByPath,
    });

    expect(calls).toBe(1);
  });

  it('ignores the same exported name from an unrelated module', () => {
    const file = {
      path: 'apps/web/src/example.ts',
      source:
        "import { generatePaymentAccount as create } from '@/lib/unrelated';\ncreate({});",
    };

    const calls = privilegedCallerAnalysis.countCalls({
      definitionPath,
      file,
      functionName: 'generatePaymentAccount',
      sourcesByPath,
    });

    expect(calls).toBe(0);
  });

  it('detects an awaited dynamic import inside a handler', () => {
    const file = {
      path: 'apps/web/mcp-server/server.ts',
      source:
        "async function handler() { const { generatePaymentAccount: create } = await import('../src/lib/paystack'); return create({}); }",
    };

    const calls = privilegedCallerAnalysis.countCalls({
      definitionPath,
      file,
      functionName: 'generatePaymentAccount',
      sourcesByPath,
    });

    expect(calls).toBe(1);
  });

  it('detects a call through a namespace import', () => {
    const file = {
      path: 'apps/web/src/example.ts',
      source:
        "import * as paystack from '@/lib/paystack';\npaystack.generatePaymentAccount({});",
    };

    const calls = privilegedCallerAnalysis.countCalls({
      definitionPath,
      file,
      functionName: 'generatePaymentAccount',
      sourcesByPath,
    });

    expect(calls).toBe(1);
  });

  it.each([
    [
      'property alias',
      "import * as paystack from '@/lib/paystack'; const create = paystack.generatePaymentAccount; create({});",
    ],
    [
      'destructured namespace alias',
      "import * as paystack from '@/lib/paystack'; const { generatePaymentAccount: create } = paystack; create({});",
    ],
  ])('detects a call through a %s', (_name, source) => {
    const file = { path: 'apps/web/src/unallowlisted.ts', source };

    const calls = privilegedCallerAnalysis.countCalls({
      definitionPath,
      file,
      functionName: 'generatePaymentAccount',
      sourcesByPath,
    });

    expect(calls).toBe(1);
  });

  it('detects a call through a renamed direct re-export', () => {
    const barrelPath = 'apps/web/src/lib/payment-barrel.ts';
    const file = {
      path: 'apps/web/src/example.ts',
      source:
        "import { createPayment } from '@/lib/payment-barrel';\ncreatePayment({});",
    };
    const sources = new Map(sourcesByPath).set(
      barrelPath,
      "export { generatePaymentAccount as createPayment } from '@/lib/paystack';"
    );

    const calls = privilegedCallerAnalysis.countCalls({
      definitionPath,
      file,
      functionName: 'generatePaymentAccount',
      sourcesByPath: sources,
    });

    expect(calls).toBe(1);
  });

  it('detects a call through a star re-export', () => {
    const barrelPath = 'apps/web/src/lib/payment-barrel.ts';
    const file = {
      path: 'apps/web/src/example.ts',
      source:
        "import { generatePaymentAccount } from '@/lib/payment-barrel';\ngeneratePaymentAccount({});",
    };
    const sources = new Map(sourcesByPath).set(
      barrelPath,
      "export * from '@/lib/paystack';"
    );

    const calls = privilegedCallerAnalysis.countCalls({
      definitionPath,
      file,
      functionName: 'generatePaymentAccount',
      sourcesByPath: sources,
    });

    expect(calls).toBe(1);
  });

  it('detects a call through two renamed re-export hops', () => {
    const firstBarrelPath = 'apps/web/src/lib/payment-internal.ts';
    const secondBarrelPath = 'apps/web/src/lib/payment-public.ts';
    const file = {
      path: 'apps/web/src/example.ts',
      source:
        "import { openAccount } from '@/lib/payment-public';\nopenAccount({});",
    };
    const sources = new Map(sourcesByPath)
      .set(
        firstBarrelPath,
        "export { generatePaymentAccount as provisionAccount } from '@/lib/paystack';"
      )
      .set(
        secondBarrelPath,
        "export { provisionAccount as openAccount } from '@/lib/payment-internal';"
      );

    const calls = privilegedCallerAnalysis.countCalls({
      definitionPath,
      file,
      functionName: 'generatePaymentAccount',
      sourcesByPath: sources,
    });

    expect(calls).toBe(1);
  });

  it('detects a call through a locally exported imported binding', () => {
    const barrelPath = 'apps/web/src/lib/payment-barrel.ts';
    const file = {
      path: 'apps/web/src/example.ts',
      source:
        "import { createPayment } from '@/lib/payment-barrel';\ncreatePayment({});",
    };
    const sources = new Map(sourcesByPath).set(
      barrelPath,
      "import { generatePaymentAccount as localCreate } from '@/lib/paystack';\nexport { localCreate as createPayment };"
    );

    const calls = privilegedCallerAnalysis.countCalls({
      definitionPath,
      file,
      functionName: 'generatePaymentAccount',
      sourcesByPath: sources,
    });

    expect(calls).toBe(1);
  });

  it('resolves directory modules through an index.tsx entry point', () => {
    const barrelPath = 'apps/web/src/lib/payment-barrel/index.tsx';
    const file = {
      path: 'apps/web/src/example.ts',
      source:
        "import { createPayment } from '@/lib/payment-barrel';\ncreatePayment({});",
    };
    const sources = new Map(sourcesByPath).set(
      barrelPath,
      "export { generatePaymentAccount as createPayment } from '@/lib/paystack';"
    );

    const calls = privilegedCallerAnalysis.countCalls({
      definitionPath,
      file,
      functionName: 'generatePaymentAccount',
      sourcesByPath: sources,
    });

    expect(calls).toBe(1);
  });

  it.each([
    ['apps/mobile-admin', 'apps/mobile-admin/src/lib/paystack.ts'],
    ['packages/shared', 'packages/shared/src/lib/paystack.ts'],
  ])('resolves @ aliases within %s', (workspaceRoot, targetPath) => {
    const file = {
      path: `${workspaceRoot}/src/example.ts`,
      source:
        "import { generatePaymentAccount } from '@/lib/paystack';\ngeneratePaymentAccount({});",
    };
    const sources = new Map([[targetPath, '']]);

    const calls = privilegedCallerAnalysis.countCalls({
      definitionPath: targetPath,
      file,
      functionName: 'generatePaymentAccount',
      sourcesByPath: sources,
    });

    expect(calls).toBe(1);
  });
});
