import { describe, expect, it } from 'vitest';
import { getProductSchemaSpecKeyForLabel } from './product-schema-spec-vocabulary';

describe('getProductSchemaSpecKeyForLabel', () => {
  it('maps formatted schema labels to their canonical keys', () => {
    expect(getProductSchemaSpecKeyForLabel(' Network Technology ')).toBe(
      'network_technology'
    );
    expect(getProductSchemaSpecKeyForLabel('Technology')).toBe(
      'network_technology'
    );
    expect(getProductSchemaSpecKeyForLabel('Selfie Camera')).toBe(
      'front_camera_mp'
    );
  });

  it('leaves product-specific labels available to the legacy label path', () => {
    expect(getProductSchemaSpecKeyForLabel('Sensor')).toBeUndefined();
    expect(getProductSchemaSpecKeyForLabel('Focal Length')).toBeUndefined();
  });
});
