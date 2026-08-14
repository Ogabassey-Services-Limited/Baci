import { describe, expect, it } from 'vitest';
import {
  isRenderableVariantAxis,
  NON_RENDERABLE_VARIANT_AXES,
} from './non-renderable-variant-axes';

describe('non-renderable-variant-axes', () => {
  it('identifies non-renderable metadata and color axes by exact name match', () => {
    expect(NON_RENDERABLE_VARIANT_AXES.has('color')).toBe(true);
    expect(NON_RENDERABLE_VARIANT_AXES.has('colour')).toBe(true);
    expect(NON_RENDERABLE_VARIANT_AXES.has('color_hex')).toBe(true);
    expect(NON_RENDERABLE_VARIANT_AXES.has('availability_note')).toBe(true);
    expect(NON_RENDERABLE_VARIANT_AXES.has('warranty')).toBe(true);
    expect(NON_RENDERABLE_VARIANT_AXES.has('warranty_note')).toBe(true);
    expect(NON_RENDERABLE_VARIANT_AXES.has('disclaimer')).toBe(true);
    expect(NON_RENDERABLE_VARIANT_AXES.has('delivery_notice')).toBe(true);
  });

  it('filters exact non-renderable axes from rendering', () => {
    expect(isRenderableVariantAxis('color', 2)).toBe(false);
    expect(isRenderableVariantAxis('availability_note', 1)).toBe(false);
    expect(isRenderableVariantAxis('warranty', 1)).toBe(false);
    expect(isRenderableVariantAxis('warranty_note', 1)).toBe(false);
    expect(isRenderableVariantAxis('disclaimer', 1)).toBe(false);
    expect(isRenderableVariantAxis('delivery_notice', 1)).toBe(false);
  });

  it('preserves legitimate SKU dimensions that contain substrings of metadata tokens', () => {
    expect(isRenderableVariantAxis('notebook_size', 3)).toBe(true);
    expect(isRenderableVariantAxis('extended_warranty', 2)).toBe(true);
    expect(isRenderableVariantAxis('noticeable_pattern', 1)).toBe(true);
  });

  it('requires multiple options for condition axis', () => {
    expect(isRenderableVariantAxis('condition', 1)).toBe(false);
    expect(isRenderableVariantAxis('condition', 2)).toBe(true);
  });

  it('renders standard axes with at least one option', () => {
    expect(isRenderableVariantAxis('storage', 1)).toBe(true);
    expect(isRenderableVariantAxis('ram', 2)).toBe(true);
    expect(isRenderableVariantAxis('storage', 0)).toBe(false);
    expect(isRenderableVariantAxis('', 1)).toBe(false);
  });
});
