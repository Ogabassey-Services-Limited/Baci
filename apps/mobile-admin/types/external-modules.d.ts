declare module 'qrcode' {
  interface QRCodeToStringOptions {
    type?: 'svg' | 'terminal' | 'utf8';
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }

  const QRCode: {
    toString(input: string, options?: QRCodeToStringOptions): Promise<string>;
  };

  export default QRCode;
}

declare module '*.png' {
  const asset: import('react-native').ImageSourcePropType;
  export default asset;
}

declare module 'react-native-image-colors' {
  type IOSColorResult = {
    platform: 'ios';
    primary: string;
    secondary: string;
  };

  type AndroidColorResult = {
    platform: 'android';
    dominant: string;
    vibrant?: string;
    lightVibrant?: string;
    muted?: string;
  };

  type WebColorResult = {
    platform: 'web';
    dominant: string;
    vibrant?: string;
    lightVibrant?: string;
    muted?: string;
  };

  export type ImageColorsResult =
    | IOSColorResult
    | AndroidColorResult
    | WebColorResult;

  export function getColors(
    uri: string,
    options?: {
      fallback?: string;
      cache?: boolean;
      quality?: 'low' | 'high';
    }
  ): Promise<ImageColorsResult>;
}
