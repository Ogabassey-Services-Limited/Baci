import { describe, expect, it, vi } from 'vitest';
import { generateInitialTemplate } from './initial-template-generator';

const input = {
  businessName: 'CarePoint',
  businessType: 'pharmaceuticals',
  brandColors: { primary: '#0f766e', background: '#ffffff', accent: '#22c55e' },
  merchant: {
    logo_url: 'https://example.com/logo.png',
    hero_image_ids: ['ignored'],
  },
};

describe('generateInitialTemplate', () => {
  it('does not call configured AI providers while creating a starter', async () => {
    const provider = vi.fn(() => {
      throw new Error('provider must not run');
    });
    vi.stubGlobal('fetch', provider);
    const result = await generateInitialTemplate(input);
    expect(
      result.content.find((block) => block.type === 'Hero')?.props?.headingLevel
    ).toBe('h1');
    expect(provider).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('does not read clocks or random values while creating a starter', async () => {
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('clock must not run');
    });
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('random must not run');
    });

    await expect(generateInitialTemplate(input)).resolves.toEqual(
      await generateInitialTemplate(input)
    );

    expect(clock).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    clock.mockRestore();
    random.mockRestore();
  });
  it.each([
    'fashion',
    'food',
    'electronics',
    'pharmacy',
    'unknown-type',
  ])('returns stable unique scaffold IDs for %s', async (businessType) => {
    const result = await generateInitialTemplate({
      ...input,
      businessType,
      merchant: { logo_url: 'invalid' },
    });
    const ids = result.content.map((block) => block.props?.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      result.content.filter((block) => block.type === 'Header')
    ).toHaveLength(1);
    expect(
      result.content.filter((block) => block.type === 'Footer')
    ).toHaveLength(1);
    expect(
      result.content.filter((block) => block.type === 'ProductGrid')
    ).toHaveLength(1);
    expect(
      result.content.find((block) => block.type === 'Header')?.props?.logoUrl
    ).toBeUndefined();
  });
});
