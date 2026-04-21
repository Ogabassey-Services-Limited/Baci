import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProductEditFormData } from '@/components/product/product-edit.defaults';
import type { ProductEditFormData } from '@/components/product/product-edit.types';

const mocks = vi.hoisted(() => ({
  getPublicUrl: vi.fn(),
  launchCameraAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
  requestCameraPermissionsAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

vi.mock('expo-image-picker', () => ({
  launchCameraAsync: mocks.launchCameraAsync,
  launchImageLibraryAsync: mocks.launchImageLibraryAsync,
  requestCameraPermissionsAsync: mocks.requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync:
    mocks.requestMediaLibraryPermissionsAsync,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: mocks.getPublicUrl,
        upload: mocks.upload,
      }),
    },
  },
}));

import { createProductEditImageActions } from './createProductEditImageActions';

type SetFormDataUpdater =
  | ProductEditFormData
  | ((previous: ProductEditFormData) => ProductEditFormData);

function createFormDataSetter() {
  let nextFormData: ProductEditFormData = createInitialProductEditFormData();
  const setFormData = vi.fn((updater: SetFormDataUpdater) => {
    nextFormData =
      typeof updater === 'function' ? updater(nextFormData) : updater;
  });
  return {
    get formData() {
      return nextFormData;
    },
    setFormData,
  };
}

async function triggerLibraryFlow() {
  const alertArgs = vi.mocked(Alert.alert).mock.calls[0];
  const button = alertArgs?.[2]?.find(
    (entry) => entry.text === 'Choose from Library'
  );
  expect(button).toBeDefined();
  await button?.onPress?.();
}

async function triggerCameraFlow() {
  const alertArgs = vi.mocked(Alert.alert).mock.calls[0];
  const button = alertArgs?.[2]?.find((entry) => entry.text === 'Take Photo');
  expect(button).toBeDefined();
  await button?.onPress?.();
}

describe('createProductEditImageActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://example.com/product.jpg' },
    });
    mocks.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///product.jpg' }],
      canceled: false,
    });
    mocks.launchCameraAsync.mockResolvedValue({
      assets: [{ uri: 'file:///camera.jpg' }],
      canceled: false,
    });
    mocks.requestCameraPermissionsAsync.mockResolvedValue({
      status: 'granted',
    });
    mocks.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'granted',
    });
    mocks.upload.mockResolvedValue({ error: null });
  });

  it('uploads the selected image and appends the public URL', async () => {
    const store = createFormDataSetter();
    const setIsUploading = vi.fn();
    const actions = createProductEditImageActions({
      merchantId: 'merchant-1',
      setFormData: store.setFormData,
      setIsUploading,
    });

    actions.handleImagePick();
    await triggerLibraryFlow();

    expect(mocks.upload).toHaveBeenCalled();
    expect(store.formData.images).toEqual(['https://example.com/product.jpg']);
    expect(setIsUploading).toHaveBeenNthCalledWith(1, true);
    expect(setIsUploading).toHaveBeenLastCalledWith(false);
  });

  it('alerts and clears uploading state when the upload fails', async () => {
    mocks.upload.mockResolvedValueOnce({ error: new Error('boom') });

    const store = createFormDataSetter();
    const setIsUploading = vi.fn();
    const actions = createProductEditImageActions({
      merchantId: 'merchant-1',
      setFormData: store.setFormData,
      setIsUploading,
    });

    actions.handleImagePick();
    await triggerLibraryFlow();

    expect(mocks.upload).toHaveBeenCalled();
    expect(store.formData.images).toEqual([]);
    expect(setIsUploading).toHaveBeenLastCalledWith(false);
    const errorCall = vi
      .mocked(Alert.alert)
      .mock.calls.find(([title]) => title === 'Error');
    expect(errorCall).toBeDefined();
  });

  it('does not upload when the user cancels the library picker', async () => {
    mocks.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true });

    const store = createFormDataSetter();
    const setIsUploading = vi.fn();
    const actions = createProductEditImageActions({
      merchantId: 'merchant-1',
      setFormData: store.setFormData,
      setIsUploading,
    });

    actions.handleImagePick();
    await triggerLibraryFlow();

    expect(mocks.upload).not.toHaveBeenCalled();
    expect(store.setFormData).not.toHaveBeenCalled();
    expect(setIsUploading).not.toHaveBeenCalled();
  });

  it('alerts and skips uploading when camera permission is denied', async () => {
    mocks.requestCameraPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
    });

    const store = createFormDataSetter();
    const setIsUploading = vi.fn();
    const actions = createProductEditImageActions({
      merchantId: 'merchant-1',
      setFormData: store.setFormData,
      setIsUploading,
    });

    actions.handleImagePick();
    await triggerCameraFlow();

    expect(mocks.launchCameraAsync).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(setIsUploading).not.toHaveBeenCalled();
    const denialCall = vi
      .mocked(Alert.alert)
      .mock.calls.find(([title]) => title === 'Permission Denied');
    expect(denialCall).toBeDefined();
  });

  it('alerts and skips uploading when media library permission is denied', async () => {
    mocks.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
    });

    const store = createFormDataSetter();
    const setIsUploading = vi.fn();
    const actions = createProductEditImageActions({
      merchantId: 'merchant-1',
      setFormData: store.setFormData,
      setIsUploading,
    });

    actions.handleImagePick();
    await triggerLibraryFlow();

    expect(mocks.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(setIsUploading).not.toHaveBeenCalled();
    const denialCall = vi
      .mocked(Alert.alert)
      .mock.calls.find(([title]) => title === 'Permission Denied');
    expect(denialCall).toBeDefined();
  });
});
