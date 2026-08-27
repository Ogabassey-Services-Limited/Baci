import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUploadFormData, readUploadBytes } from './upload';

describe('upload transport helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads a picker URI as bytes for native storage uploads', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const arrayBuffer = vi.fn().mockResolvedValue(bytes);
    const fetchMock = vi.fn().mockResolvedValue({ arrayBuffer });
    vi.stubGlobal('fetch', fetchMock);

    await expect(readUploadBytes('file:///picked.jpg')).resolves.toBe(bytes);
    expect(fetchMock).toHaveBeenCalledWith('file:///picked.jpg');
    expect(arrayBuffer).toHaveBeenCalledOnce();
  });

  it('rejects a picker URI when the native file response is not readable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(readUploadBytes('file:///missing.jpg')).rejects.toThrow(
      'Unable to read the selected file'
    );
  });

  it('uses a Blob multipart part instead of an unsupported URI descriptor', async () => {
    const bytes = new Uint8Array([10, 20, 30]).buffer;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ arrayBuffer: vi.fn().mockResolvedValue(bytes) })
    );

    const formData = await createUploadFormData({
      name: 'picked.jpg',
      type: 'image/jpeg',
      uri: 'file:///picked.jpg',
    });
    const part = formData.get('file');

    expect(part).toBeInstanceOf(Blob);
    expect(part).not.toHaveProperty('uri');
    expect((part as File).name).toBe('picked.jpg');
    expect((part as Blob).type).toBe('image/jpeg');
    expect((part as Blob).size).toBe(3);
  });
});
