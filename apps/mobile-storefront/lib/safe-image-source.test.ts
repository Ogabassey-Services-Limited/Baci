import { resolveSafeImageSource } from './safe-image-source';

describe('resolveSafeImageSource', () => {
  it('leaves arbitrary Supabase URLs unchanged', () => {
    const uri =
      'https://project.supabase.co/storage/v1/object/public/products/phone.avif';

    expect(resolveSafeImageSource({ height: 120, uri, width: 100 })).toEqual({
      height: 120,
      uri,
      width: 100,
    });
  });
});
