import { describe, expect, it } from 'vitest';
import { isValidBuilderAiJsonTransportSmokeResult } from './run-builder-ai-json-transport-smoke';

const requestedPlan = {
  operations: [
    {
      componentId: 'smoke-hero',
      kind: 'update_component',
      patch: { componentType: 'Hero', title: 'Smoke checked' },
    },
  ],
  status: 'proposed',
  summary: 'Update the smoke hero title',
};

describe('isValidBuilderAiJsonTransportSmokeResult', () => {
  it('accepts the one exact transport edit applied by the worker', () => {
    expect(isValidBuilderAiJsonTransportSmokeResult(requestedPlan)).toBe(true);
  });

  it('rejects a valid schema payload that targets a different component', () => {
    expect(
      isValidBuilderAiJsonTransportSmokeResult({
        ...requestedPlan,
        operations: [
          { ...requestedPlan.operations[0], componentId: 'other-hero' },
        ],
      })
    ).toBe(false);
  });

  it.each([
    ['a refusal', { operations: [], reason: 'no', status: 'refused' }],
    ['an invalid schema', { status: 'proposed' }],
    ['a non-proposed status', { ...requestedPlan, status: 'applied' }],
    [
      'multiple operations',
      {
        ...requestedPlan,
        operations: [
          requestedPlan.operations[0],
          { kind: 'update_root', title: 'Unexpected' },
        ],
      },
    ],
    [
      'an extra patch field',
      {
        ...requestedPlan,
        operations: [
          {
            ...requestedPlan.operations[0],
            patch: {
              componentType: 'Hero',
              subtitle: 'unexpected',
              title: 'Smoke checked',
            },
          },
        ],
      },
    ],
  ])('rejects %s', (_description, output) => {
    expect(isValidBuilderAiJsonTransportSmokeResult(output)).toBe(false);
  });
});
