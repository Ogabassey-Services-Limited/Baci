import { describe, expect, it } from 'vitest';
import { deviceDetail, enabledMerchant } from './repair-page.test-fixtures';

describe('repair-page.test-fixtures', () => {
  it('shapes enabledMerchant as an electronics merchant with the catalogue flag on', () => {
    expect(enabledMerchant.business_type).toBe('electronics');
    expect(enabledMerchant.template_id).toBe('ogabassey');
    expect(enabledMerchant.feature_settings?.repairs_catalog_enabled).toBe(
      true
    );
  });

  it('shapes deviceDetail with an active quote linked to the device', () => {
    expect(deviceDetail.device.slug).toBe('apple-iphone-13-pro-max');
    expect(deviceDetail.quotes).toHaveLength(1);
    expect(deviceDetail.quotes[0]?.isFromPrice).toBe(true);
    expect(deviceDetail.product).toBeNull();
  });
});
