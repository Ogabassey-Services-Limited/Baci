import { File as ExpoFile } from 'expo-file-system';
import type { RNFile } from '@/types/upload';

/**
 * Builds a multipart body that Expo's Winter fetch can serialize.
 *
 * React Native URI descriptors and Blob constructors backed by ArrayBuffers
 * are not supported by the native fetch bridge. Expo File implements the
 * native `bytes()` contract consumed by Winter fetch without copying the file
 * into a JS Blob first.
 */
export function createUploadFormData(file: RNFile): FormData {
  const formData = new FormData();
  const nativeFile = new ExpoFile(file.uri);
  formData.append('file', nativeFile, file.name);
  return formData;
}
