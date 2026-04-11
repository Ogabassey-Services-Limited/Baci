import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { showChoiceSheet } from '@/components/ui/showChoiceSheet';
import type { SelectedCacDocument } from './cac-types';

type CertificateSource = 'gallery' | 'files';

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const SUPPORTED_CAC_MIME_TYPES = new Set([
  ...SUPPORTED_IMAGE_MIME_TYPES,
  'application/pdf',
]);

export function chooseCertificateSource(): Promise<CertificateSource | null> {
  return showChoiceSheet<CertificateSource>({
    cancelText: 'Cancel',
    message: 'Choose how to upload your CAC certificate.',
    options: [
      { label: 'Choose from Gallery', value: 'gallery' },
      { label: 'Choose File or PDF', value: 'files' },
    ],
    title: 'Select certificate source',
  });
}

export async function pickCertificateFromGallery(): Promise<SelectedCacDocument | null> {
  const permissionResult =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permissionResult.granted) {
    throw new Error(
      'Please allow photo library access to upload a certificate image.'
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    mediaTypes: ['images'],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const mimeType = asset.mimeType || inferMimeTypeFromName(asset.fileName);

  if (!mimeType || !SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(
      'Use a JPG, PNG, WEBP image, or upload a PDF file instead.'
    );
  }

  return {
    mimeType,
    name: asset.fileName || buildFallbackName(mimeType),
    uri: asset.uri,
  };
}

export async function pickCertificateFromFiles(): Promise<SelectedCacDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const mimeType = asset.mimeType || inferMimeTypeFromName(asset.name);

  if (!mimeType || !SUPPORTED_CAC_MIME_TYPES.has(mimeType)) {
    throw new Error(
      'Use a JPG, PNG, WEBP image, or upload a PDF file instead.'
    );
  }

  return {
    mimeType,
    name: asset.name || buildFallbackName(mimeType),
    uri: asset.uri,
  };
}

function inferMimeTypeFromName(fileName?: string | null): string | null {
  const extension = fileName?.split('.').pop()?.toLowerCase();

  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';

  return null;
}

function buildFallbackName(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'cac-certificate.pdf';
  if (mimeType === 'image/png') return 'cac-certificate.png';
  if (mimeType === 'image/webp') return 'cac-certificate.webp';
  return 'cac-certificate.jpg';
}
