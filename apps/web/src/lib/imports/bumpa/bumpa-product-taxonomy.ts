import { sanitizeText } from '@/lib/sanitize-core';

function productKind(value: string) {
  const text = sanitizeText(value).toLowerCase();
  if (/\b(vat|tax)\b/.test(text)) return 'tax_fee';
  if (/\b(delivery|dispatch|shipping)\b/.test(text)) return 'delivery_fee';
  if (/\b(insurance|warranty)\b/.test(text)) return 'protection';
  if (
    // "screengaurd" preserves a Bumpa CSV misspelling seen in exports.
    /\b(screen guard|screen protector|screengaurd|pouch|case|charger|cable|adapter)\b/.test(
      text
    )
  ) {
    return 'accessory';
  }
  if (/\b(airpods|watch)\b/.test(text)) return 'accessory_device';
  if (/\b(repair|service|activation|balance)\b/.test(text)) {
    return 'service_or_adjustment';
  }
  return 'device';
}

function inferBrandFamily(value: string) {
  const text = sanitizeText(value).toLowerCase();
  if (text.includes('iphone')) return { brand: 'Apple', family: 'iPhone' };
  if (text.includes('ipad')) return { brand: 'Apple', family: 'iPad' };
  if (text.includes('macbook')) return { brand: 'Apple', family: 'MacBook' };
  if (text.includes('airpods')) return { brand: 'Apple', family: 'AirPods' };
  if (text.includes('google pixel')) {
    return { brand: 'Google', family: 'Google Pixel' };
  }
  if (text.includes('samsung')) return { brand: 'Samsung', family: 'Samsung' };
  if (text.includes('redmi')) {
    return { brand: 'Xiaomi', family: 'Redmi' };
  }
  if (text.includes('xiaomi')) {
    return { brand: 'Xiaomi', family: 'Xiaomi' };
  }
  if (text.includes('tecno')) return { brand: 'Tecno', family: 'Tecno' };
  if (text.includes('infinix')) return { brand: 'Infinix', family: 'Infinix' };
  if (text.includes('dell')) return { brand: 'Dell', family: 'Dell' };
  if (text.includes('lenovo')) return { brand: 'Lenovo', family: 'Lenovo' };
  if (text.startsWith('hp ') || text.includes(' hp ')) {
    return { brand: 'HP', family: 'HP' };
  }
  if (text.includes('ps5') || text.includes('playstation')) {
    return { brand: 'Sony', family: 'PlayStation' };
  }
  return { brand: null, family: null };
}

export function classifyBumpaProductProfile(value: string) {
  const { brand, family } = inferBrandFamily(value);

  return {
    productKind: productKind(value),
    brand,
    family,
  };
}
