import { describe, expect, it } from 'vitest';
import { manifestBuilderAiCapability } from './validate-manifest-capability';

describe('manifest builder AI capability validation', () => {
  it('rejects props outside the manifest contract', () => {
    expect(
      manifestBuilderAiCapability.isComponentPatch({
        componentType: 'Button',
        link: 'javascript:alert(1)',
      })
    ).toBe(false);
    expect(
      manifestBuilderAiCapability.isComponentPatch({
        componentType: 'FAQ',
        items: Array.from({ length: 13 }, (_, index) => ({
          answer: `Answer ${index}`,
          question: `Question ${index}`,
        })),
      })
    ).toBe(false);
    expect(
      manifestBuilderAiCapability.isComponentPatch({
        componentType: 'LegalSection',
        sections: [
          { content: 'One', heading: 'Privacy' },
          { content: 'Two', heading: 'Privacy' },
        ],
      })
    ).toBe(false);
  });

  it('allows content-zone inserts such as aside but denies fixed placements', () => {
    expect(manifestBuilderAiCapability.isInsertPlacement('Text', 'aside')).toBe(
      true
    );
    expect(
      manifestBuilderAiCapability.isInsertPlacement('Header', 'aside')
    ).toBe(false);
  });
});
