declare module 'colorthief' {
  export type RGBColor = [number, number, number];

  export default class ColorThief {
    getColor(
      sourceImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
      quality?: number
    ): RGBColor;

    getPalette(
      sourceImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
      colorCount?: number,
      quality?: number
    ): RGBColor[];

    getColorFromUrl(
      imageUrl: string,
      callback: (color: RGBColor, imageUrl: string) => void,
      quality?: number
    ): void;

    getPaletteFromUrl(
      imageUrl: string,
      callback: (palette: RGBColor[], imageUrl: string) => void,
      colorCount?: number,
      quality?: number
    ): void;

    getImageData(
      image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
      quality?: number
    ): { data: Uint8ClampedArray; width: number; height: number };
  }
}
