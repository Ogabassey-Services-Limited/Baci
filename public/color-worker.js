/* globals ColorThief */

/**
 * Web Worker for extracting dominant colors from an image.
 * This runs in a separate thread to avoid blocking the main UI thread.
 */

// Import the ColorThief library
// Note: In a real project, you might bundle this or use a more modern import mechanism if your setup supports it.
self.importScripts(
  'https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.0/color-thief.umd.js'
);

/**
 * Converts an RGB color array to a hex string.
 * @param {number[]} rgb - [r, g, b]
 * @returns {string} - #RRGGBB
 */
function rgbToHex(rgb) {
  return (
    '#' +
    rgb
      .map((val) => {
        const hex = val.toString(16);
        return hex.length === 1 ? `0${hex}` : hex;
      })
      .join('')
  );
}

/**
 * Calculates the luminance of an RGB color.
 * @param {number[]} rgb - [r, g, b]
 * @returns {number} - Luminance value
 */
function getLuminance([r, g, b]) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * List of allowed origins that can communicate with this worker.
 * This provides defense-in-depth security for the postMessage handler.
 */
const ALLOWED_ORIGINS = [
  self.location.origin,
  // Add additional trusted origins here if needed
];

/**
 * Validates that a message event comes from an allowed origin.
 * @param {MessageEvent} event - The message event to validate
 * @returns {boolean} - True if the origin is allowed
 */
function isAllowedOrigin(event) {
  // For dedicated workers, origin may be empty string (same-origin)
  // We allow empty string as it indicates same-origin communication
  if (event.origin === '' || event.origin === null) {
    return true;
  }
  return ALLOWED_ORIGINS.includes(event.origin);
}

/**
 * Validates the structure and content of incoming message data.
 * @param {unknown} data - The data to validate
 * @returns {boolean} - True if the data structure is valid
 */
function isValidMessageData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  // Only accept messages with the expected imageDataUri property
  if (!('imageDataUri' in data)) {
    return false;
  }
  const { imageDataUri } = data;
  // imageDataUri must be a string starting with a valid data URI scheme
  if (typeof imageDataUri !== 'string') {
    return false;
  }
  // Validate it's a proper data URI for images
  if (!imageDataUri.startsWith('data:image/')) {
    return false;
  }
  return true;
}

self.onmessage = (event) => {
  // Security: Verify the message origin
  if (!isAllowedOrigin(event)) {
    self.postMessage({
      success: false,
      error: 'Message rejected: untrusted origin.',
    });
    return;
  }

  // Security: Validate the message data structure
  if (!isValidMessageData(event.data)) {
    self.postMessage({
      success: false,
      error:
        'Invalid message format. Expected { imageDataUri: "data:image/..." }',
    });
    return;
  }

  const { imageDataUri } = event.data;

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
        .map((rgb) => ({ rgb, luminance: getLuminance(rgb) }))
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
      self.postMessage({
        success: false,
        error: e.message || 'Failed to process image with ColorThief.',
      });
    }
  };

  img.onerror = () => {
    self.postMessage({
      success: false,
      error: 'Failed to load image data in worker.',
    });
  };

  img.src = imageDataUri;
};
