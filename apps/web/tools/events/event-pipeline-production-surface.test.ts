import { describe, expect, it } from 'vitest';
import { eventPipelineProductionSurface } from './event-pipeline-production-surface';

describe('eventPipelineProductionSurface', () => {
  it.each([
    ['apps/web/src/app/api/events/route.ts', 'export function POST() {}'],
    ['apps/web/src/app/products/page.tsx', 'export default function Page() {}'],
    [
      'apps/web/src/pages/api/events.ts',
      'export default function handler() {}',
    ],
    ['apps/web/src/instrumentation.ts', 'export function register() {}'],
    ['apps/web/proxy.ts', 'export function proxy() {}'],
    [
      'apps/web/src/app/dashboard/orders/actions.ts',
      "'use server';\nexport async function save() {}",
    ],
  ])('classifies %s as an independently executable production surface', (path, source) => {
    expect(eventPipelineProductionSurface.isIndependent(path, source)).toBe(
      true
    );
  });

  it.each([
    [
      'apps/web/src/lib/events/ordinary-module.ts',
      'export const ordinary = true;',
    ],
    [
      'apps/web/src/app/api/events/route.test.ts',
      "'use server';\nexport const fixture = true;",
    ],
    [
      'apps/web/src/pages/api/events.spec.ts',
      'export default function fixture() {}',
    ],
  ])('does not classify standalone module %s as a production surface', (path, source) => {
    expect(eventPipelineProductionSurface.isIndependent(path, source)).toBe(
      false
    );
  });
});
