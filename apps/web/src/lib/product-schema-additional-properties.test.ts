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

  it('ignores empty and unsupported property values', () => {
    const collector = createProductSchemaAdditionalPropertyCollector();

    collector.add('', 'value');
    collector.add('Battery', Number.NaN);
    collector.add('Battery', { value: 5000 });

    expect(collector.getProperties()).toEqual([]);
  });
});
