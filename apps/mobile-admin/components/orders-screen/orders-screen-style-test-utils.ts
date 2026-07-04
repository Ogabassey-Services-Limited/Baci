import type { CSSProperties } from 'react';

export type MockNativeStyle =
  | Record<string, unknown>
  | MockNativeStyle[]
  | ((state: { pressed: boolean }) => MockNativeStyle)
  | null
  | undefined
  | false;

function assignBoxAxisStyle(
  target: Record<string, unknown>,
  axis: 'Horizontal' | 'Vertical',
  prefix: 'margin' | 'padding',
  value: unknown
) {
  if (axis === 'Horizontal') {
    target[`${prefix}Left`] = value;
    target[`${prefix}Right`] = value;
    return;
  }

  target[`${prefix}Top`] = value;
  target[`${prefix}Bottom`] = value;
}

function flattenStyle(style: MockNativeStyle): Record<string, unknown> {
  if (!style) return {};
  if (typeof style === 'function') {
    return flattenStyle(style({ pressed: false }));
  }
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, val) => {
      Object.assign(acc, flattenStyle(val));
      return acc;
    }, {});
  }

  return style;
}

export function resolveStyle(style: MockNativeStyle): CSSProperties {
  const flattened = flattenStyle(style);
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flattened)) {
    if (value === undefined || value === null || value === false) continue;

    if (key === 'paddingHorizontal') {
      assignBoxAxisStyle(resolved, 'Horizontal', 'padding', value);
      continue;
    }
    if (key === 'paddingVertical') {
      assignBoxAxisStyle(resolved, 'Vertical', 'padding', value);
      continue;
    }
    if (key === 'marginHorizontal') {
      assignBoxAxisStyle(resolved, 'Horizontal', 'margin', value);
      continue;
    }
    if (key === 'marginVertical') {
      assignBoxAxisStyle(resolved, 'Vertical', 'margin', value);
      continue;
    }
    if (
      key.startsWith('shadow') ||
      key === 'elevation' ||
      key === 'transform'
    ) {
      continue;
    }

    resolved[key] = value;
  }

  return resolved as CSSProperties;
}

export function testIdProps(testID?: string) {
  return testID ? { 'data-testid': testID } : {};
}
