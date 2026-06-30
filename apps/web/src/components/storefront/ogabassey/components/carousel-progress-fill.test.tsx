import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarouselProgressFill } from './carousel-progress-fill';

type FakeAnimation = {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
};

const hadAnimate = 'animate' in HTMLSpanElement.prototype;
const originalAnimate = HTMLSpanElement.prototype.animate;
afterEach(() => {
  // Restore the prototype's `animate` to exactly its original shape so a mock
  // installed by one test can't leak. If it was absent originally (jsdom),
  // delete it rather than leaving an own `undefined` that shadows later mocks.
  if (hadAnimate) {
    HTMLSpanElement.prototype.animate = originalAnimate;
  } else {
    delete (HTMLSpanElement.prototype as { animate?: unknown }).animate;
  }
});

// jsdom does not implement the Web Animations API, so these tests exercise the
// non-WAAPI fallback path (the bar must read as filled, never stuck empty).

describe('CarouselProgressFill', () => {
  it('renders statically filled when animation is disabled', () => {
    const { container } = render(
      <CarouselProgressFill
        animate={false}
        cycleKey={0}
        durationMs={6000}
        isPaused={false}
      />
    );

    const fill = container.querySelector('span');
    expect(fill).not.toBeNull();
    expect(fill?.style.transform).toBe('scaleX(1)');
  });

  it('falls back to a filled bar (not stuck empty) when the Web Animations API is unavailable', () => {
    const { container } = render(
      <CarouselProgressFill
        animate={true}
        cycleKey={1}
        durationMs={6000}
        isPaused={false}
      />
    );

    const fill = container.querySelector('span');
    // Without WAAPI the effect promotes the bar to fully filled instead of
    // leaving it at the initial scaleX(0).
    expect(fill?.style.transform).toBe('scaleX(1)');
  });

  it('keeps a restarted animation paused while the carousel is paused (WAAPI)', () => {
    const animations: FakeAnimation[] = [];
    const animateMock = vi.fn(() => {
      const animation: FakeAnimation = {
        play: vi.fn(),
        pause: vi.fn(),
        cancel: vi.fn(),
      };
      animations.push(animation);
      return animation as unknown as Animation;
    });
    (HTMLSpanElement.prototype as { animate?: unknown }).animate = animateMock;

    const { rerender } = render(
      <CarouselProgressFill
        animate={true}
        cycleKey={0}
        durationMs={6000}
        isPaused={true}
      />
    );
    // Restart (new cycleKey) while still paused — `isPaused` is unchanged, so the
    // pause/play effect does not re-run; the create effect must pause the fresh
    // animation itself.
    rerender(
      <CarouselProgressFill
        animate={true}
        cycleKey={1}
        durationMs={6000}
        isPaused={true}
      />
    );

    const latest = animations.at(-1);
    expect(latest?.pause).toHaveBeenCalled();
    expect(latest?.play).not.toHaveBeenCalled();
  });
});
