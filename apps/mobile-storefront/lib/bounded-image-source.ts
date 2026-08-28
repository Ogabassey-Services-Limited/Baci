import { PixelRatio } from 'react-native';

interface BoundedImageSourceOptions {
  height: number;
  pixelRatio?: number;
  uri: string;
  width: number;
}

export function createBoundedImageSource({
  height,
  pixelRatio = PixelRatio.get(),
  uri,
  width,
}: BoundedImageSourceOptions) {
  return {
    height: Math.max(1, Math.ceil(height * pixelRatio)),
    uri,
    width: Math.max(1, Math.ceil(width * pixelRatio)),
  };
}
