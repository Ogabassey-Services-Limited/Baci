import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CarouselPlayToggle } from './carousel-play-toggle';

describe('CarouselPlayToggle', () => {
  it('labels itself as Pause while playing and calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<CarouselPlayToggle isPlaying onToggle={onToggle} />);

    const button = screen.getByRole('button', { name: 'Pause auto-rotation' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('labels itself as Play while paused', () => {
    render(<CarouselPlayToggle isPlaying={false} onToggle={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Play auto-rotation' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
});
