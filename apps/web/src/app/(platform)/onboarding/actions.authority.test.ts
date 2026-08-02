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
describe('onboarding action palette authority', () => {
  beforeEach(setupActionMocks);
  it('passes the parsed palette only to the authenticated canonical service', async () => {
    mocks.adminMaybeSingle.mockResolvedValue({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });
    await submitOnboarding(prevState, makeFormData(validFields));
    expect(mocks.provisionCuratedHomepage).toHaveBeenCalledWith(
      expect.objectContaining({
        brandColors: {
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        },
      })
    );
  });
  it('preserves the original secondary palette color for a null-shaped payload', async () => {
    const palette = {
      primary: '#123456',
      background: '#abcdef',
      accent: '#fedcba',
      secondary: '#654321',
    };
    mocks.adminMaybeSingle.mockResolvedValue({
      data: {
        id: 'existing-1',
        business_name: null,
        slug: 'teststore',
        brand_colors: palette,
      },
      error: null,
    });
    setupChainedMock({
      id: 'existing-1',
      slug: 'teststore',
      brand_colors: palette,
    });
    await submitOnboarding(
      prevState,
      makeFormData({ ...validFields, brandColors: 'null' })
    );
    expect(palette).toMatchObject({ secondary: '#654321' });
    expect(mocks.adminUpdate.mock.calls[0]?.[0]).not.toHaveProperty(
      'brand_colors'
    );
    expect(mocks.provisionCuratedHomepage).toHaveBeenCalledWith(
      expect.objectContaining({ brandColors: palette })
    );
  });
});
