import { describe, expect, it } from 'vitest';
import { builderDesignCapabilityAdapter } from './builder-design-capability-adapter';
import { builderPreviewCandidateConfigSchema } from './builder-preview-candidate-config';

describe('saved Footer preview compatibility', () => {
  it('preserves bounded Footer colors only at the preview boundary', () => {
    const result = builderPreviewCandidateConfigSchema.safeParse({
      content: [
        {
          props: {
            backgroundColor: '#171717',
            id: 'footer-1',
            textColor: 'var(--theme-footer-text)',
          },
          type: 'Footer',
        },
      ],
      root: { props: { title: 'Home' } },
    });

    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.content[0]?.props).toMatchObject({
        backgroundColor: '#171717',
        textColor: 'var(--theme-footer-text)',
      });
    expect(
      builderDesignCapabilityAdapter.isPropValue(
        'Footer',
        'backgroundColor',
        '#171717'
      )
    ).toBe(false);
    expect(
      builderDesignCapabilityAdapter.isPropValue(
        'Footer',
        'textColor',
        'var(--theme-footer-text)'
      )
    ).toBe(false);
  });

  it('rejects unsafe persisted Footer colors', () => {
    expect(
      builderPreviewCandidateConfigSchema.safeParse({
        content: [
          {
            props: {
              backgroundColor: 'url(https://bad.test/pixel)',
              id: 'footer-1',
            },
            type: 'Footer',
          },
        ],
        root: { props: { title: 'Home' } },
      }).success
    ).toBe(false);
  });

  it('accepts bounded social links and rejects unknown or unsafe platforms', () => {
    expect(
      builderPreviewCandidateConfigSchema.safeParse({
        content: [
          {
            props: {
              id: 'footer-1',
              socialLinks: { instagram: 'https://instagram.com/store' },
            },
            type: 'Footer',
          },
        ],
        root: { props: { title: 'Home' } },
      }).success
    ).toBe(true);
    expect(
      builderPreviewCandidateConfigSchema.safeParse({
        content: [
          {
            props: {
              id: 'footer-1',
              socialLinks: { tracking: 'https://evil.test' },
            },
            type: 'Footer',
          },
        ],
        root: { props: { title: 'Home' } },
      }).success
    ).toBe(false);
  });
});
