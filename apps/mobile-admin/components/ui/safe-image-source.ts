import type { ImageSourcePropType } from 'react-native';

interface SafeImageSourceResolution {
  key: string;
  source: ImageSourcePropType | undefined;
  uri: string | undefined;
}

function normalizeUriSource<T extends object>(source: T): T {
  if (!('uri' in source)) return source;

  const rawUri = source.uri;
  return {
    ...source,
    uri:
      typeof rawUri === 'string' ? rawUri : rawUri ? String(rawUri) : undefined,
  };
}

export function resolveSafeImageSource(
  source: ImageSourcePropType | undefined
): SafeImageSourceResolution {
  if (Array.isArray(source)) {
    const normalizedSource = source.map((entry) =>
      typeof entry === 'object' && entry !== null
        ? normalizeUriSource(entry)
        : entry
    );
    const key = normalizedSource
      .map((entry) =>
        typeof entry === 'object' && entry !== null && 'uri' in entry
          ? String(entry.uri ?? '')
          : String(entry)
      )
      .join('|');

    return { key, source: normalizedSource, uri: undefined };
  }

  if (typeof source === 'object' && source !== null) {
    const normalizedSource = normalizeUriSource(source);
    const uri =
      'uri' in normalizedSource && normalizedSource.uri != null
        ? String(normalizedSource.uri)
        : undefined;
    return { key: uri ?? '', source: normalizedSource, uri };
  }

  return {
    key: String(source ?? ''),
    source,
    uri: undefined,
  };
}
