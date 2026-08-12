import { describe, expect, it } from 'vitest';
import { createProductSchemaAdditionalPropertyCollector } from './product-schema-additional-properties';

describe('createProductSchemaAdditionalPropertyCollector', () => {
  it('deduplicates aliases and keeps supported scalar values', () => {
    const collector = createProductSchemaAdditionalPropertyCollector();

    collector.add('3.5mm Headphone Jack', 'Yes');
    collector.add('3.5mm jack', 'Yes');
    collector.add('Battery Capacity', 5000);
    collector.add('NFC', false);

    expect(collector.getProperties()).toEqual([
      { '@type': 'PropertyValue', name: '3.5mm Headphone Jack', value: 'Yes' },
      { '@type': 'PropertyValue', name: 'Battery Capacity', value: '5000' },
      { '@type': 'PropertyValue', name: 'NFC', value: 'No' },
    ]);
  });

  it('deduplicates Wi-Fi, WiFi, and WLAN aliases with the same value', () => {
    const collector = createProductSchemaAdditionalPropertyCollector();

    collector.add('WiFi', '802.11 a/b/g/n/ac');
    collector.add('Wi-Fi', '802.11 a/b/g/n/ac');
    collector.add('WLAN', '802.11 a/b/g/n/ac');

    expect(collector.getProperties()).toEqual([
      {
        '@type': 'PropertyValue',
        name: 'WiFi',
        value: '802.11 a/b/g/n/ac',
      },
    ]);
  });

  it('ignores empty and unsupported property values', () => {
    const collector = createProductSchemaAdditionalPropertyCollector();

    collector.add('', 'value');
    collector.add('Battery', Number.NaN);
    collector.add('Battery', { value: 5000 });

    expect(collector.getProperties()).toEqual([]);
  });

  it('preserves valid custom PropertyValue fields and deduplicates scalar overlap', () => {
    const collector = createProductSchemaAdditionalPropertyCollector();

    collector.add('Focal Length', '24mm');
    collector.addCustomProperty({
      '@type': 'PropertyValue',
      name: 'Focal Length',
      value: '24mm',
      unitCode: 'MMT',
      propertyID: 'camera-focal-length',
    });
    collector.addCustomProperty({
      '@type': 'PropertyValue',
      name: 'Sensor Size',
      value: { '@type': 'QuantitativeValue', value: 1, unitCode: 'INH' },
      propertyID: 'sensor-size',
    });

    expect(collector.getProperties()).toEqual([
      { '@type': 'PropertyValue', name: 'Focal Length', value: '24mm' },
      {
        '@type': 'PropertyValue',
        name: 'Sensor Size',
        value: { '@type': 'QuantitativeValue', value: 1, unitCode: 'INH' },
        propertyID: 'sensor-size',
      },
    ]);
  });

  it('accepts a singleton custom PropertyValue and rejects non-PropertyValue types', () => {
    const collector = createProductSchemaAdditionalPropertyCollector();

    collector.addCustomProperty({ name: 'Sensor', value: 'CMOS' });
    collector.addCustomProperty({
      '@type': 'Thing',
      name: 'Ignored',
      value: 'value',
    });

    expect(collector.getProperties()).toEqual([
      { '@type': 'PropertyValue', name: 'Sensor', value: 'CMOS' },
    ]);
  });
  it('preserves propertyID-only custom PropertyValue entries', () => {
    const collector = createProductSchemaAdditionalPropertyCollector();

    collector.addCustomProperty({
      '@type': 'PropertyValue',
      propertyID: 'shipping-weight',
      value: 0.45,
      unitCode: 'KGM',
    });

    expect(collector.getProperties()).toEqual([
      {
        '@type': 'PropertyValue',
        propertyID: 'shipping-weight',
        value: 0.45,
        unitCode: 'KGM',
      },
    ]);
  });

  it('preserves valid range-only custom PropertyValue entries', () => {
    const collector = createProductSchemaAdditionalPropertyCollector();

    collector.addCustomProperty({
      '@type': 'PropertyValue',
      name: 'Operating Temperature',
      minValue: -10,
      maxValue: 45,
      unitCode: 'CEL',
    });

    expect(collector.getProperties()).toEqual([
      {
        '@type': 'PropertyValue',
        name: 'Operating Temperature',
        minValue: -10,
        maxValue: 45,
        unitCode: 'CEL',
      },
    ]);
  });
});
