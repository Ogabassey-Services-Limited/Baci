/**
 * React Native File Upload Types
 *
 * In React Native, file uploads via FormData require a specific object shape
 * that differs from web's File/Blob APIs. React Native's polyfill for FormData
 * expects an object with uri, name, and type properties.
 *
 * This module provides proper TypeScript types for RN file uploads without
 * using unsafe type assertions like `as unknown as Blob`.
 */

/**
 * Represents a file object compatible with React Native's FormData implementation.
 * This shape is what RN's FormData polyfill expects when appending files.
 */
export interface RNFile {
  /** Local file URI (e.g., file://, content://, or ph:// on iOS) */
  uri: string;
  /** File name with extension */
  name: string;
  /** MIME type (e.g., 'image/jpeg', 'image/png') */
  type: string;
}

/**
 * FormData append value type for React Native.
 * React Native's FormData accepts either strings or RNFile objects.
 */
export type FormDataValue = string | RNFile;

/**
 * Type alias for FormData in React Native context.
 * React Native's FormData polyfill accepts RNFile objects at runtime,
 * but TypeScript's FormData types expect Blob/string.
 * Use this type with type assertions when working with file uploads.
 */
export type RNFormData = FormData;

/**
 * Creates a type-safe file object for FormData upload in React Native.
 *
 * Instead of using unsafe casts like `file as unknown as Blob`, this function
 * returns the file object in the correct shape for RN's FormData polyfill.
 *
 * @example
 * ```ts
 * const formData = new FormData() as RNFormData;
 * formData.append('file', createUploadFile({
 *   uri: asset.uri,
 *   name: 'image.jpg',
 *   type: 'image/jpeg'
 * }));
 * ```
 */
export function createUploadFile(file: RNFile): RNFile {
  return {
    uri: file.uri,
    name: file.name,
    type: file.type,
  };
}

/**
 * @deprecated Use createUploadFile instead. This function exists for backwards
 * compatibility but uses a type cast that bypasses TypeScript's type safety.
 *
 * Converts an RNFile to a Blob-compatible type for legacy code.
 * React Native's FormData polyfill accepts RNFile objects but TypeScript's
 * FormData types expect Blob. This function bridges that gap.
 */
export function asUploadFile(file: RNFile): Blob {
  // React Native's FormData polyfill handles RNFile objects correctly at runtime.
  // The cast is safe because we're following RN's expected contract.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return file as any;
}
