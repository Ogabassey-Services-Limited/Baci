import { describe, expect, it } from 'vitest';
import { builderAiStructuredPropProjectionDetails } from './builder-ai-structured-prop-projection-details';

describe('builderAiStructuredPropProjectionDetails', () => {
  it('describes required nested member contracts independent of current values', () => {
    expect(
      builderAiStructuredPropProjectionDetails['Header.navigationLinks']
    ).toEqual({
      maximumItems: 8,
      members: [
        { name: 'label', required: true, valueType: 'string' },
        { name: 'url', required: true, valueType: 'safe-storefront-url' },
      ],
    });
    expect(
      builderAiStructuredPropProjectionDetails['Header.ctaButton']
    ).toMatchObject({
      members: [
        { name: 'show', required: true, valueType: 'boolean' },
        { name: 'text', required: true, valueType: 'string' },
        { name: 'url', required: true, valueType: 'safe-storefront-url' },
      ],
    });
    expect(
      builderAiStructuredPropProjectionDetails['Features.features']
    ).toMatchObject({
      maximumItems: 8,
      members: expect.arrayContaining([
        expect.objectContaining({ name: 'icon', required: false }),
      ]),
      minimumItems: 1,
    });
  });
});
