import { shouldRenderGadgetPattern } from './should-render-gadget-pattern';

describe('shouldRenderGadgetPattern', () => {
  it('disables the expensive decoration on Android 9', () => {
    expect(shouldRenderGadgetPattern('android', 28)).toBe(false);
  });

  it('keeps the decoration on Android 10 and iOS', () => {
    expect(shouldRenderGadgetPattern('android', 29)).toBe(true);
    expect(shouldRenderGadgetPattern('ios', '18.0')).toBe(true);
  });
});
