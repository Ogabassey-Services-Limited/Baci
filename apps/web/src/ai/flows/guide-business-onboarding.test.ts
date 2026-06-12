import { generateObject, generateText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { guideBusinessOnboarding } from './guide-business-onboarding';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock('@/lib/ensure-action-rate-limit', () => ({
  ensureActionRateLimit: vi.fn(async () => true),
}));

vi.mock('@/ai/provider', () => ({
  activeImageModel: 'test-image-model',
  activeTextModel: 'test-text-model',
  sanitizePromptInput: (input: string, limit: number) => ({
    value: input.slice(0, limit),
    metadata: {
      wasTruncated: input.length > limit,
      originalLength: input.length,
      finalLength: Math.min(input.length, limit),
      limit,
    },
  }),
  withRetry: vi.fn((operation: () => Promise<unknown>) => operation()),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockGenerateText = vi.mocked(generateText);
const mockGenerateObject = vi.mocked(generateObject);
const mockEnsureActionRateLimit = vi.mocked(ensureActionRateLimit);

describe('guideBusinessOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureActionRateLimit.mockResolvedValue(true);
  });

  it('rejects rate-limited callers before invoking any AI model', async () => {
    mockEnsureActionRateLimit.mockResolvedValueOnce(false);

    await expect(
      guideBusinessOnboarding({
        businessName: 'Baci Style',
        businessType: 'fashion',
        brandPreferences: 'rose and gold',
        task: 'generate_logos',
      })
    ).rejects.toThrow('Too many AI onboarding requests');

    expect(mockEnsureActionRateLimit).toHaveBeenCalledWith('ai-onboarding', {
      requests: 10,
      windowMs: 600_000,
    });
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('rejects invalid input before invoking any AI model', async () => {
    await expect(
      guideBusinessOnboarding({
        businessName: 'a'.repeat(201),
        businessType: 'fashion',
        brandPreferences: 'rose and gold',
        task: 'generate_logos',
      })
    ).rejects.toThrow('Invalid onboarding input provided.');

    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('returns a fallback logo and brand colors when AI logo generation is quota exhausted', async () => {
    mockGenerateText.mockRejectedValueOnce(
      new Error('RESOURCE_EXHAUSTED: quota exceeded')
    );

    const result = await guideBusinessOnboarding({
      businessName: 'Baci E2E Food',
      businessType: 'food-beverage',
      brandPreferences: 'fresh green and cream',
      task: 'generate_logos',
    });

    expect(result.logos?.[0]).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(result.brandColors).toMatchObject({
      primary: expect.stringMatching(/^#[0-9A-F]{6}$/i),
      background: expect.stringMatching(/^#[0-9A-F]{6}$/i),
      accent: expect.stringMatching(/^#[0-9A-F]{6}$/i),
    });
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetries: 0 })
    );
  });

  it('returns generated logo data when image generation succeeds', async () => {
    mockGenerateText.mockResolvedValueOnce({
      files: [
        {
          mediaType: 'image/png',
          base64: 'abc123',
        },
      ],
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await guideBusinessOnboarding({
      businessName: 'Baci Style',
      businessType: 'fashion',
      brandPreferences: 'rose and gold',
      task: 'generate_logos',
    });

    expect(result).toEqual({
      logos: ['data:image/png;base64,abc123'],
    });
  });

  it('extracts brand colors from a logo URL', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        primary: '#111111',
        background: '#FFFFFF',
        accent: '#F59E0B',
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await guideBusinessOnboarding({
      businessName: 'Baci Meds',
      businessType: 'pharmaceuticals',
      brandPreferences: 'green',
      logoUrl: 'https://example.com/logo.png',
      task: 'extract_colors',
    });

    expect(result.brandColors).toEqual({
      primary: '#111111',
      background: '#FFFFFF',
      accent: '#F59E0B',
    });
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-text-model',
      })
    );
  });

  it('generates business name suggestions from a description', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        businessNames: [
          'Glow Bar',
          'Velvet Bloom',
          'Aura Supply',
          'Nova Beauty',
          'Lush Desk',
          'Tone Market',
        ],
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await guideBusinessOnboarding({
      businessName: 'Starter',
      businessType: 'health-beauty',
      brandPreferences: 'pink',
      description: 'A beauty shop focused on clean skincare',
      tone: 'Premium',
      task: 'generate_names',
    });

    expect(result.businessNames).toEqual([
      'Glow Bar',
      'Velvet Bloom',
      'Aura Supply',
      'Nova Beauty',
      'Lush Desk',
      'Tone Market',
    ]);
  });

  it('rejects color extraction without a logo URL', async () => {
    await expect(
      guideBusinessOnboarding({
        businessName: 'Baci Meds',
        businessType: 'pharmaceuticals',
        brandPreferences: 'green',
        task: 'extract_colors',
      })
    ).rejects.toThrow('logoUrl is required for color extraction.');
  });
});
