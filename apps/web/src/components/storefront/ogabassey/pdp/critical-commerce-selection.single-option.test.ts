import { describe, expect, it } from 'vitest';
import { pickInitialSelectedAttributes } from './critical-commerce-selection';

describe('critical commerce single-option metadata selection', () => {
  it('preselects single metadata options when no variant selection exists', () => {
    expect(
      pickInitialSelectedAttributes({
        fallbackAxisOptions: {
          ram: ['8GB'],
          storage: ['128GB', '256GB'],
        },
        renderableVariantAxes: ['ram', 'storage'],
        selection: null,
      })
    ).toEqual({ ram: '8GB' });
  });
});
