import { beforeEach, describe, expect, it } from 'vitest';
import {
  getActionMocks,
  makeFormData,
  prevState,
  setupActionMocks,
  setupChainedMock,
  submitOnboarding,
  validFields,
} from './actions.test-support';

const mocks = getActionMocks();

describe('onboarding action palette persistence', () => {
  beforeEach(setupActionMocks);

  function newMerchant() {
    mocks.adminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });
  }

  function incompleteMerchant(palette: Record<string, string>) {
    mocks.adminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: 'existing-1', business_name: null, slug: 'teststore' },
        error: null,
      });
    setupChainedMock({
      id: 'existing-1',
      slug: 'teststore',
      brand_colors: palette,
    });
    mocks.isAiStorefrontGenerationEnabled.mockReturnValue(true);
  }

  it('persists the parsed brand_colors palette when the payload is valid JSON', async () => {
    newMerchant();

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mocks.adminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_colors: {
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        },
      })
    );
  });

  it.each([
    '{not-valid-json',
    'null',
    '{}',
  ])('omits brand_colors entirely on a new merchant for %s', async (brandColors) => {
    newMerchant();

    const result = await submitOnboarding(
      prevState,
      makeFormData({ ...validFields, brandColors })
    );

    expect(result.success).toBe(true);
    const insertPayload = mocks.adminInsert.mock.calls[0]?.[0];
    expect(insertPayload).not.toHaveProperty('brand_colors');
    expect(mocks.adminInsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ brand_colors: null })
    );
  });

  it('preserves the original secondary palette color for a null-shaped payload', async () => {
    const preservedPalette = {
      primary: '#123456',
      background: '#abcdef',
      accent: '#fedcba',
      secondary: '#654321',
    };
    incompleteMerchant(preservedPalette);

    const result = await submitOnboarding(
      prevState,
      makeFormData({ ...validFields, brandColors: 'null' })
    );

    expect(result.success).toBe(true);
    expect(preservedPalette).toMatchObject({ secondary: '#654321' });
    expect(mocks.adminInsert).not.toHaveBeenCalled();
    const updatePayload = mocks.adminUpdate.mock.calls[0]?.[0];
    expect(updatePayload).not.toHaveProperty('brand_colors');
    expect(mocks.adminUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ brand_colors: null })
    );
    expect(mocks.generateInitialTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ brandColors: preservedPalette })
    );
    expect(mocks.aiJobsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ brandColors: preservedPalette }),
      })
    );
  });

  it.each([
    'NOT JSON',
    '{}',
  ])('preserves the established palette for incomplete merchants with %s', async (brandColors) => {
    const preservedPalette = {
      primary: '#123456',
      background: '#abcdef',
      accent: '#fedcba',
    };
    incompleteMerchant(preservedPalette);

    const result = await submitOnboarding(
      prevState,
      makeFormData({ ...validFields, brandColors })
    );

    expect(result.success).toBe(true);
    expect(mocks.adminInsert).not.toHaveBeenCalled();
    const updatePayload = mocks.adminUpdate.mock.calls[0]?.[0];
    expect(updatePayload).not.toHaveProperty('brand_colors');
    expect(mocks.adminUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ brand_colors: null })
    );
    expect(mocks.generateInitialTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ brandColors: preservedPalette })
    );
    expect(mocks.aiJobsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ brandColors: preservedPalette }),
      })
    );
  });

  it('still writes brand_colors when valid while completing an incomplete merchant', async () => {
    mocks.adminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: 'existing-1', business_name: null, slug: 'teststore' },
        error: null,
      });
    setupChainedMock({ id: 'existing-1', slug: 'teststore' });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mocks.adminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_colors: {
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        },
      })
    );
  });
});
