import { createImageUpload } from 'novel';
import type { ImageUploadTransport } from './image-upload-types';
import { validateImageUpload } from './image-upload-validation';

export function createImageUploader(onUpload: ImageUploadTransport) {
  return createImageUpload({ onUpload, validateFn: validateImageUpload });
}
