import './builder-client.test-support';
import type { Data } from '@puckeditor/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createBuilderPuckOverrides } from './builder-puck-overrides';

describe('createBuilderPuckOverrides', () => {
  it('renders the component drawer from configured categories', () => {
    const overrides = createBuilderPuckOverrides({
      data: { content: [], root: {}, zones: {} } as Data,
      onDataChange: vi.fn(),
      onEdit: vi.fn(),
    });
    const DrawerOverride = overrides.drawer;

    render(<DrawerOverride>ignored</DrawerOverride>);
    expect(
      screen.getByText('Drag and drop elements anywhere on your page')
    ).toBeInTheDocument();
  });
});
