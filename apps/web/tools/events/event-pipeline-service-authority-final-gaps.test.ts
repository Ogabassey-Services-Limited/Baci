import { describe, expect, it } from 'vitest';
import { serviceAuthorityGraphFindings } from './event-pipeline-service-authority-graph';

const path = 'apps/web/src/lib/events/inherited-service-importer.ts';
const service = 'apps/web/src/lib/supabase/service.ts';
const importFactory =
  "import { createServiceClient } from '@/lib/supabase/service';";
const serviceSource = 'export const createServiceClient = () => null;';

function findingsForMove(frozenBody: string, currentBody: string): string[] {
  const frozen = new Map([
    [path, `${importFactory} ${frozenBody}`],
    [service, serviceSource],
  ]);
  const current = new Map(frozen);
  current.set(path, `${importFactory} ${currentBody}`);
  return serviceAuthorityGraphFindings(current, [path], frozen);
}

function expectNewAuthority(frozenBody: string, currentBody: string): void {
  expect(findingsForMove(frozenBody, currentBody)).toContain(
    `${path}: unauthorized service factory importer`
  );
}

describe('event pipeline service authority final gaps', () => {
  it.each([
    [
      'callee owner',
      'left.send(createServiceClient);',
      'right.send(createServiceClient);',
    ],
    [
      'constructor owner',
      'new Left(createServiceClient);',
      'new Right(createServiceClient);',
    ],
    [
      'argument index',
      'external(createServiceClient, safe);',
      'external(safe, createServiceClient);',
    ],
    [
      'destination binding',
      'const first = createServiceClient;',
      'const second = createServiceClient;',
    ],
    [
      'array slot',
      'const values = [createServiceClient, safe];',
      'const values = [safe, createServiceClient];',
    ],
    [
      'object owner',
      'const first = { make: createServiceClient };',
      'const second = { make: createServiceClient };',
    ],
    [
      'class owner',
      'class First { static make = createServiceClient; }',
      'class Second { static make = createServiceClient; }',
    ],
    [
      'class slot',
      'class Holder { first = createServiceClient; }',
      'class Holder { second = createServiceClient; }',
    ],
    [
      'control owner',
      'if (flag) external(createServiceClient); if (flag) safe();',
      'if (flag) safe(); if (flag) external(createServiceClient);',
    ],
  ])('rejects moving inherited authority to a new %s', (_, frozen, current) => {
    expectNewAuthority(frozen, current);
  });

  it.each([
    [
      'unknown passthrough result',
      'const make = passthrough(createServiceClient);',
      'const make = passthrough(createServiceClient); make();',
    ],
    [
      'Promise.resolve callback',
      'const promised = Promise.resolve(createServiceClient);',
      'const promised = Promise.resolve(createServiceClient); promised.then((make) => make());',
    ],
    [
      'Promise.then result',
      'const promised = Promise.resolve(createServiceClient).then((make) => make);',
      'const promised = Promise.resolve(createServiceClient).then((make) => make); promised.then((make) => make());',
    ],
    [
      'dynamic-import namespace callback',
      "import('@/lib/supabase/service').then(() => null);",
      "import('@/lib/supabase/service').then((namespace) => namespace.createServiceClient('event-pipeline'));",
    ],
    [
      'dynamic-import destructured callback',
      "import('@/lib/supabase/service').then(() => null);",
      "import('@/lib/supabase/service').then(({ createServiceClient }) => createServiceClient('event-pipeline'));",
    ],
  ])('propagates authority through %s', (_, frozen, current) => {
    expectNewAuthority(frozen, current);
  });

  it('propagates a TypeScript import-equals namespace', () => {
    const frozenSource = "import service = require('@/lib/supabase/service');";
    const frozen = new Map([
      [path, frozenSource],
      [service, serviceSource],
    ]);
    const current = new Map(frozen);
    current.set(
      path,
      `${frozenSource} service.createServiceClient('event-pipeline');`
    );

    expect(serviceAuthorityGraphFindings(current, [path], frozen)).toContain(
      `${path}: unauthorized service factory importer`
    );
  });

  it('propagates an aliased require namespace', () => {
    const frozen = new Map([
      [path, 'const load = require;'],
      [service, serviceSource],
    ]);
    const current = new Map(frozen);
    current.set(
      path,
      "const load = require; const namespace = load('@/lib/supabase/service'); namespace.createServiceClient('event-pipeline');"
    );

    expect(serviceAuthorityGraphFindings(current, [path], frozen)).toContain(
      `${path}: unauthorized service factory importer`
    );
  });

  it.each([
    [
      'class property merely named createServiceClient',
      '',
      'class Safe { createServiceClient = () => null; } new Safe().createServiceClient();',
    ],
    [
      'safe array-destructured member',
      'const safe = () => null; const values = [createServiceClient, safe];',
      'const safe = () => null; const values = [createServiceClient, safe]; const [, read] = values; read();',
    ],
    [
      'safe object-destructured member',
      'const safe = () => null; const values = { make: createServiceClient, safe };',
      'const safe = () => null; const values = { make: createServiceClient, safe }; const { safe: read } = values; read();',
    ],
    [
      'known safe passthrough result',
      'const safe = () => null; function discard(factory) { return safe; } const make = discard(createServiceClient);',
      'const safe = () => null; function discard(factory) { return safe; } const make = discard(createServiceClient); make();',
    ],
    [
      'known safe Promise projection',
      'const safe = () => null; const promised = Promise.resolve(createServiceClient).then(() => safe);',
      'const safe = () => null; const promised = Promise.resolve(createServiceClient).then(() => safe); promised.then((make) => make());',
    ],
  ])('does not taint a %s', (_, frozenBody, currentBody) => {
    const frozen = new Map([
      [path, `${importFactory} ${frozenBody}`],
      [service, serviceSource],
    ]);
    const current = new Map(frozen);
    current.set(path, `${importFactory} ${currentBody}`);

    expect(serviceAuthorityGraphFindings(current, [path], frozen)).toEqual([]);
  });
});
