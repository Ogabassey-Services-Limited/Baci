import type { ConversionEvent } from './ad-platform-conversion-event';

export function toAdPlatformProducts(
  contents: ConversionEvent['custom_data']['contents']
) {
  return (contents ?? []).map((content) => ({
    id: content.id,
    name: content.name || content.id,
    price: content.price || 0,
    quantity: content.quantity,
  }));
}
