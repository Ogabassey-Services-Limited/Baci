
declare module 'colorthief' {
  export type RGBColor = [number, number, number];

  export default class ColorThief {
    getColor(
      sourceImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | string,
      quality?: number
    ): RGBColor;

    getPalette(
      sourceImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | string,
      colorCount?: number,
      quality?: number
    ): RGBColor[];
  }
}
