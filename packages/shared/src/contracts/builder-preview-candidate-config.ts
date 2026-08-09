import { z } from 'zod';
import { type BuilderData, builderDataSchema } from './builder-ai-edit';
import { validateBuilderAiEditComplexity } from './builder-ai-edit/complexity-validator';
import { previewRenderPolicy } from './builder-preview-render-policy';

const candidateKeys = ['content', 'root', 'theme', 'zones'];
const sensitiveKeyPattern =
  /(?:api[-_]?key|authorization|credential|password|private[-_]?key|secret|token)/i;
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
const text = 'text';
const number = 'number';
const themeShape = {
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
    accent: text,
    background: text,
    border: text,
    foreground: text,
    muted: text,
    mutedForeground: text,
    primary: text,
    secondary: text,
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

type ThemeShape =
  | typeof text
  | typeof number
  | { readonly [key: string]: ThemeShape };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[]
): boolean {
  const valueKeys = Object.keys(value);
  return (
    valueKeys.length === keys.length &&
    valueKeys.every((key) => keys.includes(key))
  );
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

function matchesThemeShape(value: unknown, shape: ThemeShape): boolean {
  if (shape === text) return isSafeThemeText(value);
  if (shape === number)
    return typeof value === 'number' && Number.isFinite(value);
  if (!isRecord(value) || !hasOnlyKnownKeys(value, Object.keys(shape)))
    return false;
  return Object.entries(value).every(([key, child]) => {
    const expected = shape[key];
    return expected !== undefined && matchesThemeShape(child, expected);
  });
}

function hasRoot(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['props']) &&
    isRecord(value.props) &&
    hasOnlyKeys(value.props, ['title']) &&
    typeof value.props.title === 'string' &&
    value.props.title.length <= 120
  );
}

function normalizePreviewRoot(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.root)) return value;
  const root = value.root;
  if (
    hasOnlyKeys(root, []) ||
    (hasOnlyKeys(root, ['props']) &&
      isRecord(root.props) &&
      hasOnlyKeys(root.props, []))
  )
    return { ...value, root: { props: { title: 'Home' } } };
  if (
    !hasOnlyKeys(root, ['title']) ||
    typeof root.title !== 'string' ||
    root.title.length > 120
  )
    return value;
  return { ...value, root: { props: { title: root.title } } };
}

function hasValidPuckCollections(value: unknown): boolean {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !candidateKeys.includes(key)) ||
    !Array.isArray(value.content) ||
    !hasRoot(value.root) ||
    (value.theme !== undefined && !matchesThemeShape(value.theme, themeShape))
  )
    return false;
  const components = [...value.content];
  if (value.zones !== undefined) {
    if (!isRecord(value.zones)) return false;
    for (const collection of Object.values(value.zones)) {
      if (!Array.isArray(collection)) return false;
      components.push(...collection);
    }
  }
  const ids = new Map<string, string>();
  for (const component of components) {
    const identity = previewRenderPolicy.getPuckComponentIdentity(component);
    if (!identity || ids.has(identity.id)) return false;
    ids.set(identity.id, identity.type);
  }
  if (value.zones === undefined) return true;
  return Object.keys(value.zones).every((zone) => {
    const parsed = previewRenderPolicy.parsePuckZoneKey(zone);
    const type = parsed ? ids.get(parsed.parentId) : undefined;
    return (
      parsed !== undefined &&
      type !== undefined &&
      previewRenderPolicy.allowsPuckZoneSlot(type, parsed.slot)
    );
  });
}

function hasSensitiveField(value: unknown): boolean {
  const visited = new WeakSet<object>();
  const pending = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== 'object' || visited.has(current))
      continue;
    visited.add(current);
    for (const [key, entry] of Object.entries(current)) {
      if (sensitiveKeyPattern.test(key)) return true;
      pending.push(entry);
    }
  }
  return false;
}

function isPreviewCandidate(value: unknown): value is BuilderData {
  return (
    hasValidPuckCollections(value) &&
    builderDataSchema.safeParse(value).success &&
    validateBuilderAiEditComplexity(value).success &&
    !hasSensitiveField(value)
  );
}

export const builderPreviewCandidateConfigSchema = z.preprocess(
  normalizePreviewRoot,
  z
    .custom<BuilderData>(
      isPreviewCandidate,
      'Expected a bounded render-safe Puck configuration'
    )
    .transform(previewRenderPolicy.projectPreviewCandidate)
);
