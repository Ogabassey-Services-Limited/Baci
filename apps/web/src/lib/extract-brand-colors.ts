import type { BrandColors } from '@/types';

const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: '#000000',
  background: '#FFFFFF',
  accent: '#666666',
};

const MAX_CANVAS_DIMENSION = 64;
const ALPHA_THRESHOLD = 128;
const QUANTIZATION_STEP = 32;
const MIN_COLOR_DISTANCE = 48;

type RgbColor = [number, number, number];

interface ColorBucket {
  count: number;
  redTotal: number;
  greenTotal: number;
  blueTotal: number;
}

function toHex([red, green, blue]: RgbColor): string {
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function getBrightness([red, green, blue]: RgbColor): number {
  return (red + green + blue) / 3;
}

function getSaturation([red, green, blue]: RgbColor): number {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  return max === 0 ? 0 : delta / max;
}

function isNeutral(color: RgbColor): boolean {
  const [red, green, blue] = color;
  const brightness = getBrightness(color);
  const maxDiff = Math.max(
    Math.abs(red - green),
    Math.abs(green - blue),
    Math.abs(red - blue)
  );

  return brightness > 240 || brightness < 20 || maxDiff < 15;
}

function getColorDistance(first: RgbColor, second: RgbColor): number {
  const redDifference = first[0] - second[0];
  const greenDifference = first[1] - second[1];
  const blueDifference = first[2] - second[2];

  return Math.sqrt(
    redDifference * redDifference +
      greenDifference * greenDifference +
      blueDifference * blueDifference
  );
}

function getBucketKey([red, green, blue]: RgbColor): string {
  const normalize = (value: number) =>
    Math.min(255, Math.floor(value / QUANTIZATION_STEP) * QUANTIZATION_STEP);

  return `${normalize(red)}-${normalize(green)}-${normalize(blue)}`;
}

function getRankedPalette(data: Uint8ClampedArray): RgbColor[] {
  const buckets = new Map<string, ColorBucket>();

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];

    if (alpha < ALPHA_THRESHOLD) {
      continue;
    }

    const color: RgbColor = [data[index], data[index + 1], data[index + 2]];
    const key = getBucketKey(color);
    const existingBucket = buckets.get(key);

    if (existingBucket) {
      existingBucket.count += 1;
      existingBucket.redTotal += color[0];
      existingBucket.greenTotal += color[1];
      existingBucket.blueTotal += color[2];
      continue;
    }

    buckets.set(key, {
      count: 1,
      redTotal: color[0],
      greenTotal: color[1],
      blueTotal: color[2],
    });
  }

  return [...buckets.values()]
    .map((bucket) => {
      const color: RgbColor = [
        Math.round(bucket.redTotal / bucket.count),
        Math.round(bucket.greenTotal / bucket.count),
        Math.round(bucket.blueTotal / bucket.count),
      ];

      return {
        color,
        score: bucket.count * (1 + getSaturation(color)),
      };
    })
    .sort((first, second) => second.score - first.score)
    .map(({ color }) => color);
}

export function extractBrandColorsFromImage(
  imageDataUri: string
): Promise<BrandColors> {
  return new Promise((resolve, reject) => {
    const image = document.createElement('img');
    image.crossOrigin = 'Anonymous';

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const width = Math.max(
          1,
          Math.min(
            MAX_CANVAS_DIMENSION,
            image.naturalWidth || image.width || MAX_CANVAS_DIMENSION
          )
        );
        const height = Math.max(
          1,
          Math.min(
            MAX_CANVAS_DIMENSION,
            image.naturalHeight || image.height || MAX_CANVAS_DIMENSION
          )
        );

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d', {
          willReadFrequently: true,
        });

        if (!context) {
          resolve(DEFAULT_BRAND_COLORS);
          return;
        }

        context.drawImage(image, 0, 0, width, height);

        const palette = getRankedPalette(
          context.getImageData(0, 0, width, height).data
        );

        const primaryColor = palette.find((color) => !isNeutral(color)) ??
          palette[0] ?? [0, 0, 0];

        const accentColor =
          palette.find(
            (color) =>
              !isNeutral(color) &&
              getColorDistance(color, primaryColor) >= MIN_COLOR_DISTANCE
          ) ??
          palette.find(
            (color) =>
              getColorDistance(color, primaryColor) >= MIN_COLOR_DISTANCE
          ) ??
          primaryColor;

        resolve({
          primary: toHex(primaryColor),
          background: DEFAULT_BRAND_COLORS.background,
          accent: toHex(accentColor),
        });
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error('Unable to extract colors from image.')
        );
      }
    };

    image.onerror = () => {
      reject(new Error('Image could not be loaded for color extraction.'));
    };

    image.src = imageDataUri;
  });
}
