import { describe, expect, it } from 'vitest';
import {
  buildPlatformFeaturesMarkdown,
  buildPlatformHomeMarkdown,
  buildPlatformOnboardingMarkdown,
  buildPlatformPricingMarkdown,
} from './llms-markdown-platform';

describe('llms markdown platform builders', () => {
  it('builds the platform home mirror with canonical routes', () => {
    const result = buildPlatformHomeMarkdown('https://usebaci.com');

    expect(result).toContain('# Baci');
    expect(result).toContain('https://usebaci.com/onboarding');
    expect(result).toContain('/openapi.json');
  });

  it('builds the platform pricing mirror', () => {
    const result = buildPlatformPricingMarkdown('https://usebaci.com');

    expect(result).toContain('Pro: NGN 5,000 per month');
  });

  it('builds the platform features mirror', () => {
    const result = buildPlatformFeaturesMarkdown('https://usebaci.com');

    expect(result).toContain('AI-powered store generation');
  });

  it('builds the platform onboarding mirror', () => {
    const result = buildPlatformOnboardingMarkdown('https://usebaci.com');

    expect(result).toContain('https://usebaci.com/dashboard');
  });
});
