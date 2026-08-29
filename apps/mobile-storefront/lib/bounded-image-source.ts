import { PixelRatio } from 'react-native';

interface BoundedImageSourceOptions {
  height: number;
  pixelRatio?: number;
  uri: string;
  width: number;
}

const MAX_DECODE_DIMENSION = 3840;

export function createBoundedImageSource({
  height,
  pixelRatio = PixelRatio.get(),
  uri,
  width,
}: BoundedImageSourceOptions) {
  return {
    height: clampDecodeDimension(height * pixelRatio),
    uri,
    width: clampDecodeDimension(width * pixelRatio),
  };
}

function clampDecodeDimension(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(MAX_DECODE_DIMENSION, Math.ceil(value)));
}
