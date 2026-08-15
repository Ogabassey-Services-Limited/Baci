import { builderDesignCapabilities } from './builder-design-capabilities';
import { builderPreviewThemeStaticShape } from './builder-preview-theme-static-shape';

const themeStringPattern = /^[a-zA-Z0-9\s#%(),./+-]{1,512}$/;
const themeFunctionPattern = /([a-zA-Z][a-zA-Z0-9-]*)\s*\(/g;
const safeThemeFunctionNames = new Set([
  'calc',
  'clamp',
  'cubic-bezier',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'max',
  'min',
  'oklab',
  'oklch',
  'rgb',
  'rgba',
  'steps',
]);
const reservedColorGroups = new Set([
  'button',
  'card',
  'footer',
  'header',
  'input',
]);
const previewStoreColorTokens = new Set([
  'accent',
  'accent-text',
  'background',
  'background-text',
  'border',
  'foreground',
  'on-primary',
  'option-secondary',
  'primary',
  'primary-text',
  'rating',
  'secondary',
  'secondary-text',
]);
const emittedStoreTokensByColorPath: Record<string, readonly string[]> = {
  '.colors.accent': ['accent', 'rating'],
  '.colors.background': ['background'],
  '.colors.border': ['border'],
  '.colors.button.accent.text': ['accent-text'],
  '.colors.button.primary.text': ['on-primary', 'primary-text'],
  '.colors.button.secondary.background': ['option-secondary', 'secondary'],
  '.colors.button.secondary.text': ['secondary-text'],
  '.colors.foreground': ['background-text', 'foreground'],
  '.colors.primary': ['primary'],
};
const text = 'text';
const number = 'number';
const rendererColorPattern = /^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})$/;
const cssLengthPattern =
  /^(?:0|(?:0|[1-9][0-9]{0,3})(?:\.[0-9]{1,3})?(?:px|rem|em|%|vh|vw|vmin|vmax))$/;
const cssDurationPattern = /^(?:0|(?:[0-9]{1,4})(?:\.[0-9]{1,3})?(?:ms|s))$/;
const cssEasingPattern =
  /^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\((?:0|1|(?:0?\.[0-9]+)|(?:1\.0+)),\s*(?:0|1|(?:0?\.[0-9]+)|(?:1\.0+)),\s*(?:0|1|(?:0?\.[0-9]+)|(?:1\.0+)),\s*(?:0|1|(?:0?\.[0-9]+)|(?:1\.0+))\)|steps\([1-9][0-9]{0,2}(?:,\s*(?:jump-start|jump-end|jump-none|jump-both|start|end))?\))$/;

type ThemeShape =
  | typeof text
  | typeof number
  | { readonly [key: string]: ThemeShape };

let cachedThemeShape: ThemeShape | undefined;
let cachedThemeSnapshot: string | undefined;
let cachedThemeError: string | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKnownKeys(
  value: Record<string, unknown>,
  keys: readonly string[]
): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isSafeThemeText(value: unknown, key?: string, path?: string): boolean {
  const allowsThemeVariable = path?.startsWith('.colors.') ?? false;
  const safeText =
    typeof value === 'string' &&
    themeStringPattern.test(value) &&
    [...value].every((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    }) &&
    [...value.matchAll(themeFunctionPattern)].every(
      ([, name]) =>
        safeThemeFunctionNames.has(name.toLowerCase()) ||
        (allowsThemeVariable && name.toLowerCase() === 'var')
    );
  if (!safeText) return false;
  if (
    key?.toLowerCase().includes('padding') ||
    key?.toLowerCase().includes('width') ||
    key?.toLowerCase().includes('height') ||
    key?.toLowerCase().includes('radius') ||
    key?.toLowerCase().includes('maxwidth')
  )
    return cssLengthPattern.test(value as string);
  if (path?.includes('.animations.duration.'))
    return cssDurationPattern.test(value as string);
  if (path?.includes('.animations.easing.'))
    return cssEasingPattern.test(value as string);
  return true;
}

function isDefinedColorToken(value: string, path: string): boolean {
  const match = /^var\(--(store|theme)-([a-z][a-z0-9-]{0,48})\)$/.exec(value);
  if (match === null) return true;
  const [, namespace, token] = match;
  if (namespace === 'theme')
    return builderDesignCapabilities.themeTokenKeys.includes(token);
  return (
    previewStoreColorTokens.has(token) &&
    !emittedStoreTokensByColorPath[path]?.includes(token)
  );
}

function isSafeThemeNumber(value: unknown, path: string): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (path.startsWith('.typography.fontWeight.'))
    return value >= 1 && value <= 1_000;
  if (path.startsWith('.typography.lineHeight.')) return value > 0;
  if (path.startsWith('.layout.zIndex.')) return Number.isInteger(value);
  return false;
}

function matchesThemeShape(
  value: unknown,
  shape: ThemeShape,
  colorContext = false,
  key?: string,
  path = ''
): boolean {
  if (shape === text) {
    if (typeof value !== 'string') return false;
    const pathHint = colorContext ? 'color' : '';
    if (pathHint === 'color')
      return (
        isSafeThemeText(value, key, path) &&
        (rendererColorPattern.test(value) ||
          /^var\(--(?:store|theme)-[a-z][a-z0-9-]{0,48}\)$/.test(value)) &&
        isDefinedColorToken(value, path)
      );
    return isSafeThemeText(value, key, path);
  }
  if (shape === number) return isSafeThemeNumber(value, path);
  if (!isRecord(value) || !hasOnlyKnownKeys(value, Object.keys(shape)))
    return false;
  return Object.entries(value).every(([key, child]) => {
    const expected = shape[key];
    return (
      expected !== undefined &&
      matchesThemeShape(
        child,
        expected,
        key === 'colors' || colorContext,
        key,
        `${path}.${key}`
      )
    );
  });
}

function getThemeTokenSnapshot(): string {
  return JSON.stringify(builderDesignCapabilities.themeTokenKeys);
}

function getCachedThemeShape(): ThemeShape | undefined {
  const snapshot = getThemeTokenSnapshot();
  if (snapshot === cachedThemeSnapshot) return cachedThemeShape;

  cachedThemeSnapshot = snapshot;
  cachedThemeShape = undefined;
  const collision = builderDesignCapabilities.themeTokenKeys.find((token) =>
    reservedColorGroups.has(token)
  );
  cachedThemeError =
    collision === undefined
      ? undefined
      : `Preview theme manifest token "${collision}" collides with a reserved color group.`;
  if (cachedThemeError !== undefined) return;

  cachedThemeShape = {
    ...builderPreviewThemeStaticShape,
    colors: {
      ...Object.fromEntries(
        builderDesignCapabilities.themeTokenKeys.map(
          (key): [string, typeof text] => [key, text]
        )
      ),
      ...builderPreviewThemeStaticShape.colors,
    },
  };
  return cachedThemeShape;
}

function getValidationError(value: unknown): string | undefined {
  const shape = getCachedThemeShape();
  if (shape === undefined)
    return cachedThemeError ?? 'Preview theme manifest is invalid.';
  return matchesThemeShape(value, shape)
    ? undefined
    : 'Expected a bounded render-safe theme';
}

export const previewThemePolicy = { getValidationError };
