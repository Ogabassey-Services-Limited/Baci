interface CacVerificationUploadInput {
  approvedName: string;
  file: File;
  merchantId: string;
  rcNumber: string;
}

export function createCacVerificationFormData({
  approvedName,
  file,
  merchantId,
  rcNumber,
}: CacVerificationUploadInput): FormData {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('rcNumber', rcNumber);
  formData.append('approvedName', approvedName);
  formData.append('merchantId', merchantId);
  return formData;
}
