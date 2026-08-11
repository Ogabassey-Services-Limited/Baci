import { builderDesignCapabilities } from './builder-design-capabilities';

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
const text = 'text';
const number = 'number';
const rendererColorPattern = /^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})$/;

type ThemeShape =
  | typeof text
  | typeof number
  | { readonly [key: string]: ThemeShape };

const staticThemeShape = {
  animations: {
    duration: { fast: text, normal: text, slow: text },
    easing: { easeIn: text, easeInOut: text, easeOut: text, linear: text },
  },
  borders: {
    radius: {
      '2xl': text,
      full: text,
      lg: text,
      md: text,
      none: text,
      sm: text,
      xl: text,
    },
    style: { dashed: text, dotted: text, solid: text },
    width: { none: text, normal: text, thick: text, thin: text },
  },
  colors: {
    border: text,
    muted: text,
    mutedForeground: text,
    button: {
      accent: { background: text, hover: text, text },
      primary: { background: text, hover: text, text },
      secondary: { background: text, hover: text, text },
    },
    card: { background: text, border: text, text },
    footer: { background: text, linkColor: text, linkHoverColor: text, text },
    header: {
      background: text,
      iconColor: text,
      searchBackground: text,
      searchBorder: text,
      text,
    },
    input: {
      background: text,
      border: text,
      focusBorder: text,
      placeholder: text,
      text,
    },
  },
  layout: {
    breakpoints: { '2xl': text, lg: text, md: text, sm: text, xl: text },
    zIndex: {
      dropdown: number,
      fixed: number,
      modal: number,
      modalBackdrop: number,
      popover: number,
      sticky: number,
      tooltip: number,
    },
  },
  shadows: {
    '2xl': text,
    inner: text,
    lg: text,
    md: text,
    none: text,
    sm: text,
    xl: text,
  },
  spacing: {
    '2xl': text,
    '3xl': text,
    lg: text,
    md: text,
    sm: text,
    xl: text,
    xs: text,
    container: { maxWidth: text, paddingX: text },
    footer: { paddingX: text, paddingY: text },
    header: { height: text, paddingX: text, paddingY: text },
    section: { paddingX: text, paddingY: text },
  },
  typography: {
    fontFamily: { body: text, heading: text, mono: text },
    fontSize: {
      '2xl': text,
      '3xl': text,
      '4xl': text,
      '5xl': text,
      '6xl': text,
      base: text,
      lg: text,
      sm: text,
      xl: text,
      xs: text,
    },
    fontWeight: {
      bold: number,
      extrabold: number,
      light: number,
      medium: number,
      normal: number,
      semibold: number,
    },
    letterSpacing: { normal: text, tight: text, wide: text },
    lineHeight: {
      loose: number,
      normal: number,
      relaxed: number,
      tight: number,
    },
  },
} as const;

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

function isSafeThemeText(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    themeStringPattern.test(value) &&
    [...value].every((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    }) &&
    [...value.matchAll(themeFunctionPattern)].every(([, name]) =>
      safeThemeFunctionNames.has(name.toLowerCase())
    )
  );
}

function matchesThemeShape(
  value: unknown,
  shape: ThemeShape,
  colorContext = false
): boolean {
  if (shape === text)
    return (
      isSafeThemeText(value) &&
      (!colorContext ||
        (typeof value === 'string' && rendererColorPattern.test(value)))
    );
  if (shape === number)
    return typeof value === 'number' && Number.isFinite(value);
  if (!isRecord(value) || !hasOnlyKnownKeys(value, Object.keys(shape)))
    return false;
  return Object.entries(value).every(([key, child]) => {
    const expected = shape[key];
    return (
      expected !== undefined &&
      matchesThemeShape(child, expected, key === 'colors' || colorContext)
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
    ...staticThemeShape,
    colors: {
      ...Object.fromEntries(
        builderDesignCapabilities.themeTokenKeys.map(
          (key): [string, typeof text] => [key, text]
        )
      ),
      ...staticThemeShape.colors,
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
