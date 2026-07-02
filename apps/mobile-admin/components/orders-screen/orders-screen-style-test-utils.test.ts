import { describe, expect, it } from 'vitest';
import { resolveStyle, testIdProps } from './orders-screen-style-test-utils';

describe('orders-screen-style-test-utils', () => {
  it('normalizes native shorthand styles for DOM assertions', () => {
    const style = resolveStyle([
      {
        marginVertical: 8,
        paddingHorizontal: 12,
        shadowOpacity: 0.2,
        transform: [{ scale: 0.9 }],
      },
      { paddingLeft: 20 },
    ]);

    expect(style).toMatchObject({
      marginBottom: 8,
      marginTop: 8,
      paddingLeft: 20,
      paddingRight: 12,
    });
    expect(style).not.toHaveProperty('shadowOpacity');
    expect(style).not.toHaveProperty('transform');
  });

  it('resolves functional Pressable styles with an unpressed state', () => {
    expect(
      resolveStyle(({ pressed }) => [
        { bottom: 125, position: 'absolute', zIndex: 300 },
        pressed && { opacity: 0.9 },
      ])
    ).toMatchObject({
      bottom: 125,
      position: 'absolute',
      zIndex: 300,
    });
  });

  it('maps native testID to a DOM test id prop', () => {
    expect(testIdProps('orders-list')).toEqual({
      'data-testid': 'orders-list',
    });
    expect(testIdProps()).toEqual({});
  });
});
