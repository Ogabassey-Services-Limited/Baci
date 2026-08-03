import { describe, expect, it, vi } from 'vitest';

const { mockGenerateInitialTemplate } = vi.hoisted(() => ({
  mockGenerateInitialTemplate: vi.fn(),
}));

vi.mock('./initial-template-generator', () => ({
  generateInitialTemplate: mockGenerateInitialTemplate,
}));

import { generateDefaultConfig } from './builder-defaults';

describe('generateDefaultConfig', () => {
  it('forwards the exact legacy merchant mapping to the compatibility entry point', async () => {
    const generated = {
      content: [],
      root: { props: { title: 'Home' } },
      zones: {},
      theme: {},
    };
    mockGenerateInitialTemplate.mockResolvedValue(generated);
    const merchant = {
      business_name: 'Baci',
      business_type: 'fashion',
      brand_colors: {
        primary: '#111111',
        background: '#ffffff',
        accent: '#f97316',
      },
    };
    await expect(generateDefaultConfig(merchant)).resolves.toBe(generated);
    expect(mockGenerateInitialTemplate).toHaveBeenCalledWith({
      businessName: 'Baci',
      businessType: 'fashion',
      brandColors: merchant.brand_colors,
      merchant,
    });
  });
});
