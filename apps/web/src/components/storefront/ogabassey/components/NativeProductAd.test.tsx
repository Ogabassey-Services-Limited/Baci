import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeProductAd } from './NativeProductAd';

vi.mock('./ProductGridItem', () => ({
  ProductGridItem: () => <div data-testid="product-grid-item" />,
}));

describe('NativeProductAd', () => {
  let commandQueue: Array<() => void>;
  let defineSlot: ReturnType<typeof vi.fn>;
  let destroySlots: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    commandQueue = [];
    defineSlot = vi.fn(() => ({ addService: vi.fn() }));
    destroySlots = vi.fn();

    window.googletag = {
      cmd: commandQueue,
      defineSlot,
      destroySlots,
      display: vi.fn(),
      enableServices: vi.fn(),
      pubads: vi.fn(() => ({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    } as unknown as typeof window.googletag;
  });

  it('keeps the native slot guard when duplicate setup is skipped', () => {
    const firstRender = render(<NativeProductAd slotId="native-slot" />);
    const secondRender = render(<NativeProductAd slotId="native-slot" />);

    act(() => {
      commandQueue.shift()?.();
      commandQueue.shift()?.();
    });

    expect(defineSlot).toHaveBeenCalledTimes(1);

    secondRender.unmount();

    act(() => {
      commandQueue.shift()?.();
    });

    expect(destroySlots).not.toHaveBeenCalled();

    const thirdRender = render(<NativeProductAd slotId="native-slot" />);

    act(() => {
      commandQueue.shift()?.();
    });

    expect(defineSlot).toHaveBeenCalledTimes(1);

    thirdRender.unmount();
    firstRender.unmount();

    act(() => {
      commandQueue.shift()?.();
      commandQueue.shift()?.();
    });

    expect(destroySlots).toHaveBeenCalledTimes(1);
  });
});
