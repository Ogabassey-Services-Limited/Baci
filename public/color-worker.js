
/* globals ColorThief */

/**
 * Web Worker for extracting dominant colors from an image.
 * This runs in a separate thread to avoid blocking the main UI thread.
 */

// Import the ColorThief library
// Note: In a real project, you might bundle this or use a more modern import mechanism if your setup supports it.
self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.0/color-thief.umd.js');

/**
 * Converts an RGB color array to a hex string.
 * @param {number[]} rgb - [r, g, b]
 * @returns {string} - #RRGGBB
 */
function rgbToHex(rgb) {
  return '#' + rgb.map(val => {
    const hex = val.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Calculates the luminance of an RGB color.
 * @param {number[]} rgb - [r, g, b]
 * @returns {number} - Luminance value
 */
function getLuminance([r, g, b]) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}


self.onmessage = (event) => {
  const { imageDataUri } = event.data;

  if (!imageDataUri) {
    self.postMessage({ success: false, error: 'No image data URI provided.' });
    return;
  }
  
  const img = new Image();
  img.crossOrigin = 'Anonymous';

  img.onload = () => {
    try {
      const colorThief = new ColorThief();
      const palette = colorThief.getPalette(img, 5); // Get 5 colors

      if (!palette || palette.length < 3) {
        throw new Error('Could not extract a sufficient color palette.');
      }
      
      // Sort colors by luminance (darkest to lightest)
      const sortedPalette = palette
        .map(rgb => ({ rgb, luminance: getLuminance(rgb) }))
        .sort((a, b) => a.luminance - b.luminance);

      // Assign roles based on luminance and saturation
      const primary = sortedPalette[2].rgb; // Middle color as primary
      const secondary = sortedPalette[1].rgb; // A darker shade as secondary
      const accent = sortedPalette[sortedPalette.length - 1].rgb; // Lightest as accent

      const colors = {
        primary: rgbToHex(primary),
        secondary: rgbToHex(secondary),
        accent: rgbToHex(accent),
      };

      self.postMessage({ success: true, colors });

    } catch (e) {
      self.postMessage({ success: false, error: e.message || 'Failed to process image with ColorThief.' });
    }
  };

  img.onerror = () => {
    self.postMessage({ success: false, error: 'Failed to load image data in worker.' });
  };

  img.src = imageDataUri;
};
