/**
 * React Native File Upload Types
 *
 * React Native image pickers return local URIs. React Native's legacy FormData
 * implementation accepts `{ uri, name, type }` descriptors, but Expo 57's
 * Winter fetch implementation cannot serialize those descriptors. Uploads
 * therefore need to be converted to bytes (Storage) or Blob-backed multipart
 * parts (API routes) before they are sent.
 *
 * This module provides proper TypeScript types for RN file uploads without
 * using unsafe type assertions like `as unknown as Blob`.
 */

/**
 * Describes a picked local file before it is converted for transport.
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
 * Legacy FormData append value type for React Native callers that still use
 * the native XHR implementation. Do not pass RNFile values to Expo's Winter
 * fetch implementation.
 */
export type FormDataValue = string | RNFile;

/**
 * Type alias for the legacy React Native FormData shape.
 * New uploads should use createUploadFormData instead.
 */
export interface RNFormData extends Omit<FormData, 'append'> {
  append(name: string, value: string | Blob | RNFile, fileName?: string): void;
}

/**
 * Creates a type-safe descriptor for legacy React Native upload APIs.
 *
 * Instead of using unsafe casts like `file as unknown as Blob`, this function
 * returns the descriptor in the shape expected by React Native's native XHR.
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
 * Reads a local picker URI into bytes suitable for Supabase Storage uploads.
 * Storage's React Native guidance specifically recommends ArrayBuffer rather
 * than Blob, File, or FormData bodies.
 */
export async function readUploadBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (response.ok === false) {
    throw new Error(
      'Unable to read the selected file. Please choose it again.'
    );
  }
  return response.arrayBuffer();
}

/**
 * Builds a multipart body that Expo's Winter fetch can serialize.
 * React Native URI descriptors are intentionally not appended directly: the
 * Winter fetch converter rejects them as an unsupported FormDataPart.
 */
export async function createUploadFormData(file: RNFile): Promise<FormData> {
  const bytes = await readUploadBytes(file.uri);
  const blob = new Blob([bytes], { type: file.type });
  const formData = new FormData();
  formData.append('file', blob, file.name);
  return formData;
}
