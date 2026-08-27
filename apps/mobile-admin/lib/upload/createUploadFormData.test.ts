import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUploadFormData } from './createUploadFormData';

const mocks = vi.hoisted(() => ({
  append: vi.fn(),
  File: vi.fn(function NativeFile(uri: string) {
    return {
      bytes: vi.fn(),
      name: 'picked.jpg',
      type: 'image/jpeg',
      uri,
    };
  }),
}));

vi.mock('expo-file-system', () => ({ File: mocks.File }));

class NativeFormData {
  append = mocks.append;
}

describe('createUploadFormData', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mocks.append.mockReset();
    mocks.File.mockReset();
  });

  it('uses an Expo File bytes part instead of constructing a Blob from ArrayBuffer', () => {
    vi.stubGlobal('FormData', NativeFormData);

    const formData = createUploadFormData({
      name: 'store-avatar.jpg',
      type: 'image/jpeg',
      uri: 'file:///picked.jpg',
    });

    expect(formData).toBeInstanceOf(NativeFormData);
    expect(mocks.File).toHaveBeenCalledWith('file:///picked.jpg');
    expect(mocks.append).toHaveBeenCalledWith(
      'file',
      expect.objectContaining({
        bytes: expect.any(Function),
        name: 'picked.jpg',
        type: 'image/jpeg',
        uri: 'file:///picked.jpg',
      }),
      'store-avatar.jpg'
    );
  });
});
