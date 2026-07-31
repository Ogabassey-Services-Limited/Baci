import './builder-client.test-support';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuilderCanvas } from './builder-canvas';

describe('BuilderCanvas', () => {
  it('changes the preview viewport from its controls', () => {
    const onViewportWidthChange = vi.fn();
    render(
      <BuilderCanvas
        canEdit={true}
        isAiDraftPreview={false}
        isAiLoading={false}
        onAiCommand={vi.fn()}
        onViewportWidthChange={onViewportWidthChange}
        viewportWidth="100%"
      />
    );

    fireEvent.click(screen.getByTitle('Mobile (375px)'));
    expect(onViewportWidthChange).toHaveBeenCalledWith(375);
    expect(screen.getByTestId('cart-provider')).toContainElement(
      screen.getByTestId('puck-preview')
    );
  });
});
