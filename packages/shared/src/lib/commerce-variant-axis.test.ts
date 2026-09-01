import { describe, expect, it } from 'vitest';
import {
  canonicalizeCommerceVariantAxis,
  getCommerceVariantAxes,
  normalizeCommerceVariantOption,
} from './commerce-variant-axis';

describe('commerce variant axis contract', () => {
  it('keeps purchasable dimensions and rejects descriptive specifications', () => {
    expect(
      getCommerceVariantAxes({
        camera: ['Webcam'],
        condition: ['used'],
        display_type: ['16-inch display'],
        gpu: ['RTX 4070'],
        graphics: ['RTX 4070'],
        keyboard: ['Backlit keyboard'],
        model_number: ['DYMSR54'],
        operating_system: ['Windows 11 Pro'],
        processor: ['Intel Core Ultra 7 155H'],
        ram: ['64GB RAM'],
        screen_size: ['16-inch'],
        storage: ['1TB SSD'],
        wireless: ['Wi-Fi 7'],
      })
    ).toEqual(['condition', 'graphics', 'processor', 'ram', 'storage']);
  });

  it('canonicalizes legacy commerce aliases without exposing metadata aliases', () => {
    expect(canonicalizeCommerceVariantAxis('Colour')).toBe('color');
    expect(canonicalizeCommerceVariantAxis('GPU')).toBe('graphics');
    expect(canonicalizeCommerceVariantAxis('Display Size')).toBeNull();
    expect(canonicalizeCommerceVariantAxis('RAM Options')).toBe('ram');
    expect(canonicalizeCommerceVariantAxis('Operating System')).toBeNull();
    expect(canonicalizeCommerceVariantAxis('Color Hex')).toBeNull();
    expect(canonicalizeCommerceVariantAxis('Warranty')).toBe('warranty');
  });

  it('normalizes equivalent laptop option labels before matrix matching', () => {
    expect(
      normalizeCommerceVariantOption(
        'graphics',
        '8GB NVIDIA GeForce RTX 4070 Graphics'
      )
    ).toBe('NVIDIA GeForce RTX 4070 8GB');
    expect(normalizeCommerceVariantOption('gpu', '8GB RTX 4070 Graphics')).toBe(
      'NVIDIA GeForce RTX 4070 8GB'
    );
    expect(
      normalizeCommerceVariantOption('processor', 'Intel Ultra 7 155H')
    ).toBe('Intel Core Ultra 7 155H');
    expect(normalizeCommerceVariantOption('ram', '64GB RAM')).toBe('64GB');
    expect(normalizeCommerceVariantOption('storage', '1TB SSD')).toBe('1TB');
  });

  it('uses safe variant-backed axes only when a parent declaration is absent', () => {
    expect(
      getCommerceVariantAxes(null, ['storage', 'camera', 'model', 'processor'])
    ).toEqual(['storage', 'processor']);
  });

  it('adds safe live axes that are missing from a stale parent declaration', () => {
    expect(
      getCommerceVariantAxes({ storage: ['256GB'] }, [
        'storage',
        'ram',
        'operating_system',
      ])
    ).toEqual(['storage', 'ram']);
  });
});
