import { createMerchantImageUpload } from './image-upload-transport';
import { createImageUploader } from './image-uploader';

export function createMerchantImageUploader(merchantId: string) {
  return createImageUploader(createMerchantImageUpload(merchantId));
}
