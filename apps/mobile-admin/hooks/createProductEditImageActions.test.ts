import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductEditFormData } from '@/components/product/product-edit.types';
import { createInitialProductEditFormData } from '@/components/product/product-edit.defaults';

const mocks = vi.hoisted(() => ({
  getPublicUrl: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: mocks.launchImageLibraryAsync,
  requestCameraPermissionsAsync: vi.fn(),
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
    mocks.upload.mockResolvedValue({ error: null });
  });

  it('uploads the selected image and appends the public URL', async () => {
    let nextFormData: ProductEditFormData = createInitialProductEditFormData();
    const setFormData = vi.fn(
      (
        updater:
          | ProductEditFormData
          | ((previous: ProductEditFormData) => ProductEditFormData)
      ) => {
        nextFormData =
          typeof updater === 'function' ? updater(nextFormData) : updater;
      }
    );
    const setIsUploading = vi.fn();
    const actions = createProductEditImageActions({
      merchantId: 'merchant-1',
      setFormData,
      setIsUploading,
    });

    actions.handleImagePick();
    const alertArgs = vi.mocked(Alert.alert).mock.calls[0];
    const chooseLibraryButton = alertArgs?.[2]?.find(
      (button) => button.text === 'Choose from Library'
    );

    expect(chooseLibraryButton).toBeDefined();
    await chooseLibraryButton?.onPress?.();

    expect(mocks.upload).toHaveBeenCalled();
    expect(nextFormData.images).toEqual(['https://example.com/product.jpg']);
    expect(setIsUploading).toHaveBeenNthCalledWith(1, true);
    expect(setIsUploading).toHaveBeenLastCalledWith(false);
  });
});
