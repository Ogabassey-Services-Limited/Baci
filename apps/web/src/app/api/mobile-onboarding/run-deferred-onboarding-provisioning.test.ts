import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pageConfigInsert: vi.fn(),
  generateInitialTemplate: vi.fn(),
  assignHeroImagesToMerchant: vi.fn(),
}));

vi.mock('@/lib/initial-template-generator', () => ({
  generateInitialTemplate: mocks.generateInitialTemplate,
}));

vi.mock('@/services/hero-image-generator', () => ({
  assignHeroImagesToMerchant: mocks.assignHeroImagesToMerchant,
}));

import { runDeferredOnboardingProvisioning } from './run-deferred-onboarding-provisioning';

const adminClient = {
  from: () => ({ insert: mocks.pageConfigInsert }),
};

const baseInput = {
  adminClient,
  merchantId: 'merch-1',
  merchantSlug: 'test',
  businessName: 'Test Store',
  businessType: 'Fashion',
  brandColors: null,
  domainRepair: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pageConfigInsert.mockResolvedValue({ error: null });
  mocks.generateInitialTemplate.mockResolvedValue({ root: {} });
  mocks.assignHeroImagesToMerchant.mockResolvedValue({ success: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runDeferredOnboardingProvisioning', () => {
  it('publishes the generated home page config', async () => {
    // Act
    await runDeferredOnboardingProvisioning(baseInput);

    // Assert
    expect(mocks.pageConfigInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merch-1',
        page_slug: 'home',
        is_published: true,
      })
    );
  });

  it('falls back to default brand colours when none were stored', async () => {
    // Act
    await runDeferredOnboardingProvisioning(baseInput);

    // Assert
    expect(mocks.generateInitialTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        brandColors: expect.objectContaining({ primary: '#000000' }),
      })
    );
  });

  it('lowercases the business type for hero image lookup', async () => {
    // Act
    await runDeferredOnboardingProvisioning(baseInput);

    // Assert
    expect(mocks.assignHeroImagesToMerchant).toHaveBeenCalledWith(
      'merch-1',
      'fashion',
      false
    );
  });

  describe('domain repair', () => {
    it('does not touch domains when the in-request insert succeeded', async () => {
      // Arrange — the SAME client is used for both calls below, so the
      // difference between them is attributable to domainRepair alone.
      const insert = vi.fn().mockResolvedValue({ error: null });
      const scopedClient = { from: vi.fn(() => ({ insert })) };
      const repair = {
        client: scopedClient,
        input: {
          merchantId: 'merch-1',
          merchantSlug: 'test',
          rootDomain: 'usebaci.com',
        },
      };

      // Act — control: passing a repair DOES reach the client.
      await runDeferredOnboardingProvisioning({
        ...baseInput,
        domainRepair: repair,
      });
      expect(insert).toHaveBeenCalledTimes(1);
      insert.mockClear();
      scopedClient.from.mockClear();

      // Act — null means the in-request insert already succeeded.
      await runDeferredOnboardingProvisioning({
        ...baseInput,
        domainRepair: null,
      });

      // Assert
      expect(scopedClient.from).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
      // ...and the rest of the deferred work still ran.
      expect(mocks.pageConfigInsert).toHaveBeenCalled();
    });

    it('retries on the caller-scoped client it was handed', async () => {
      // Arrange
      const insert = vi.fn().mockResolvedValue({ error: null });
      const scopedClient = { from: vi.fn(() => ({ insert })) };

      // Act
      await runDeferredOnboardingProvisioning({
        ...baseInput,
        domainRepair: {
          client: scopedClient,
          input: {
            merchantId: 'merch-1',
            merchantSlug: 'test',
            rootDomain: 'usebaci.com',
          },
        },
      });

      // Assert — never a privileged client, so a real policy denial stays one.
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'test.usebaci.com' })
      );
    });

    it('alerts when the retry also fails instead of dropping it', async () => {
      // Arrange
      const insert = vi.fn().mockResolvedValue({ error: { code: '42501' } });
      const scopedClient = { from: vi.fn(() => ({ insert })) };
      const errorSpy = vi.spyOn(console, 'error');

      // Act
      await runDeferredOnboardingProvisioning({
        ...baseInput,
        domainRepair: {
          client: scopedClient,
          input: {
            merchantId: 'merch-1',
            merchantSlug: 'test',
            rootDomain: 'usebaci.com',
          },
        },
      });

      // Assert
      expect(errorSpy).toHaveBeenCalledWith(
        'mobile-onboarding deployment_fault',
        expect.stringContaining('domain_repair_exhausted')
      );
    });

    it('keeps the rest of the deferred work running when the retry throws', async () => {
      // Arrange — a transport-level throw, not a resolved PostgREST error.
      const scopedClient = {
        from: () => ({
          insert: vi.fn().mockRejectedValue(new Error('socket hang up')),
        }),
      };

      // Act
      await runDeferredOnboardingProvisioning({
        ...baseInput,
        domainRepair: {
          client: scopedClient,
          input: {
            merchantId: 'merch-1',
            merchantSlug: 'test',
            rootDomain: 'usebaci.com',
          },
        },
      });

      // Assert — the response already reported success, so a throw here must
      // not cost the merchant their starter content.
      expect(mocks.pageConfigInsert).toHaveBeenCalled();
      expect(mocks.assignHeroImagesToMerchant).toHaveBeenCalled();
    });
  });

  describe('best effort', () => {
    it('still assigns hero images when template generation throws', async () => {
      // Arrange
      mocks.generateInitialTemplate.mockRejectedValue(new Error('Gemini down'));

      // Act
      await runDeferredOnboardingProvisioning(baseInput);

      // Assert — one failing step must not take down the others.
      expect(mocks.assignHeroImagesToMerchant).toHaveBeenCalled();
    });

    it('never throws when every step fails', async () => {
      // Arrange
      mocks.generateInitialTemplate.mockRejectedValue(new Error('Gemini down'));
      mocks.assignHeroImagesToMerchant.mockRejectedValue(
        new Error('no images')
      );

      // Act + Assert — this runs after the response is sent; throwing here
      // would surface as an unhandled rejection, not a client error.
      await expect(
        runDeferredOnboardingProvisioning(baseInput)
      ).resolves.toBeUndefined();
    });
  });

  describe('bugfix: hero-image failures were silently dropped', () => {
    it('logs a resolved { success: false } result, which never throws', async () => {
      // Arrange — assignHeroImagesToMerchant reports most failures by
      // RESOLVING rather than throwing, so a try/catch alone misses them.
      mocks.assignHeroImagesToMerchant.mockResolvedValue({
        success: false,
        error: 'Failed to fetch generated images',
      });
      const errorSpy = vi.spyOn(console, 'error');

      // Act
      await runDeferredOnboardingProvisioning(baseInput);

      // Assert
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('mobile-onboarding'),
        expect.stringContaining('hero_image_assignment')
      );
    });
  });
});
