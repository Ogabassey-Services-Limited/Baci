import { render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { builderConfig } from '@/components/builder/config';
import {
  aiEditableComponents,
  createInsertableComponentProps,
  getBuilderAiPropShape,
  isAiEditableComponent,
  isBuilderAiPropValue,
} from './builder-ai-component-catalog';

describe('builder AI component catalog', () => {
  it('keeps every allowlisted component backed by the real Puck config', () => {
    for (const componentType of Object.keys(aiEditableComponents)) {
      expect(builderConfig.components).toHaveProperty(componentType);
      expect(isAiEditableComponent(componentType)).toBe(true);
    }
    expect(isAiEditableComponent('CodeEmbed')).toBe(false);
  });

  it('keeps every editable property aligned with a real Puck field', () => {
    for (const [componentType, definition] of Object.entries(
      aiEditableComponents
    )) {
      const component =
        builderConfig.components[
          componentType as keyof typeof builderConfig.components
        ];
      const fields = component.fields as Record<string, unknown>;

      for (const property of definition.editableProps) {
        expect(fields).toHaveProperty(property);
      }
    }
  });

  it('matches Puck field option values and numeric constraints exactly', () => {
    const fields = builderConfig.components;
    const optionValues = (component: keyof typeof fields, property: string) =>
      (
        (
          fields[component].fields as Record<
            string,
            { options?: { value: unknown }[] }
          >
        )[property]?.options ?? []
      ).map((option) => option.value);
    const numericLimits = (component: keyof typeof fields, property: string) =>
      (
        fields[component].fields as Record<
          string,
          { max?: number; min?: number }
        >
      )[property];

    expect(optionValues('Header', 'layout')).toEqual([
      'logo-left-nav-center',
      'logo-left-nav-right',
      'logo-center',
    ]);
    expect(optionValues('Header', 'paddingY')).toEqual(['sm', 'md', 'lg']);
    expect(optionValues('Header', 'searchRadius')).toEqual([
      'none',
      'sm',
      'md',
      'full',
    ]);
    expect(optionValues('Header', 'searchStyle')).toEqual([
      'outline',
      'filled',
      'minimal',
    ]);
    expect(optionValues('ProductGrid', 'sortBy')).toEqual([
      'newest',
      'price-low',
      'price-high',
      'name',
    ]);
    expect(optionValues('Features', 'columns')).toEqual([2, 3, 4]);
    expect(numericLimits('ProductGrid', 'columns')).toMatchObject({
      max: 4,
      min: 1,
    });
    expect(numericLimits('ProductGrid', 'limit')).toMatchObject({
      max: 24,
      min: 1,
    });
    expect(numericLimits('Testimonial', 'rating')).toMatchObject({
      max: 5,
      min: 0,
    });

    for (const value of optionValues('Header', 'layout')) {
      expect(isBuilderAiPropValue('Header', 'layout', value)).toBe(true);
    }
    for (const value of optionValues('Header', 'paddingY')) {
      expect(isBuilderAiPropValue('Header', 'paddingY', value)).toBe(true);
    }
    for (const value of optionValues('Header', 'searchRadius')) {
      expect(isBuilderAiPropValue('Header', 'searchRadius', value)).toBe(true);
    }
    for (const value of optionValues('Header', 'searchStyle')) {
      expect(isBuilderAiPropValue('Header', 'searchStyle', value)).toBe(true);
    }
    for (const value of optionValues('ProductGrid', 'sortBy')) {
      expect(isBuilderAiPropValue('ProductGrid', 'sortBy', value)).toBe(true);
    }
    for (const value of optionValues('Features', 'columns')) {
      expect(isBuilderAiPropValue('Features', 'columns', value)).toBe(true);
    }
    expect(isBuilderAiPropValue('Features', 'columns', 1)).toBe(false);
    expect(isBuilderAiPropValue('ProductGrid', 'columns', 2.5)).toBe(false);
    expect(isBuilderAiPropValue('ProductGrid', 'limit', 2.5)).toBe(false);
    expect(isBuilderAiPropValue('Testimonial', 'rating', 2.5)).toBe(false);
  });

  it('uses safe insertion defaults and never takes a model supplied id', () => {
    expect(
      createInsertableComponentProps('Hero', {
        id: 'model-picked',
        title: 'Hi',
      })
    ).toMatchObject({ headingLevel: 'h2', title: 'Hi' });
    expect(
      createInsertableComponentProps('Hero', { id: 'model-picked' })
    ).not.toHaveProperty('id');
  });

  it('renders an inserted Testimonial with a neutral zero-star rating', () => {
    const testimonial = createInsertableComponentProps('Testimonial', {});
    const newsletter = createInsertableComponentProps('Newsletter', {});
    const renderTestimonial = builderConfig.components.Testimonial.render as (
      props: Record<string, unknown>
    ) => ReactNode;

    render(createElement('div', {}, renderTestimonial(testimonial)));

    expect(testimonial.rating).toBe(0);
    expect(
      screen.getByRole('img', { name: 'Rating: 0 out of 5 stars' })
    ).toBeInTheDocument();
    expect(JSON.stringify(newsletter)).not.toMatch(/offers?/i);
  });

  it('declares primitive and structured editable field shapes in one catalog', () => {
    expect(getBuilderAiPropShape('Hero', 'ctaLink')).toBe('url');
    expect(getBuilderAiPropShape('Header', 'ctaButton')).toBe('link');
    expect(getBuilderAiPropShape('Features', 'features')).toBe('feature-list');
    expect(getBuilderAiPropShape('Text', 'content')).toBe('primitive');
  });
});
