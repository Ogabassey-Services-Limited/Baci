import { describe, expect, it } from 'vitest';
import { guideBusinessOnboardingInputSchema } from './ai-guide-business-onboarding';

const VALID_INPUT = {
  businessName: 'Baci Style',
  businessType: 'fashion',
  brandPreferences: 'rose and gold',
  task: 'generate_logos',
} as const;

describe('guideBusinessOnboardingInputSchema', () => {
  it('accepts a minimal logo generation input', () => {
    const result = guideBusinessOnboardingInputSchema.safeParse(VALID_INPUT);

    expect(result.success).toBe(true);
  });

  it('accepts optional logoUrl, description, and tone fields', () => {
    const result = guideBusinessOnboardingInputSchema.safeParse({
      ...VALID_INPUT,
      task: 'generate_names',
      logoUrl: 'https://example.com/logo.png',
      description: 'A beauty shop focused on clean skincare',
      tone: 'Premium',
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown tasks', () => {
    const result = guideBusinessOnboardingInputSchema.safeParse({
      ...VALID_INPUT,
      task: 'drop_tables',
    });

    expect(result.success).toBe(false);
  });

  it('rejects over-long business names', () => {
    const result = guideBusinessOnboardingInputSchema.safeParse({
      ...VALID_INPUT,
      businessName: 'a'.repeat(201),
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid logo URLs', () => {
    const result = guideBusinessOnboardingInputSchema.safeParse({
      ...VALID_INPUT,
      logoUrl: 'not-a-url',
    });

    expect(result.success).toBe(false);
  });

  it('rejects over-long descriptions', () => {
    const result = guideBusinessOnboardingInputSchema.safeParse({
      ...VALID_INPUT,
      task: 'generate_names',
      description: 'a'.repeat(2001),
    });

    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = guideBusinessOnboardingInputSchema.safeParse({
      task: 'generate_logos',
    });

    expect(result.success).toBe(false);
  });
});
