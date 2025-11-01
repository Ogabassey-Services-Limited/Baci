/**
 * Web Worker for color extraction using optimized median cut algorithm
 * Runs in background thread to avoid blocking UI
 * Uses custom implementation since colorthief requires DOM access
 */

self.addEventListener('message', async (event) => {
  const { imageDataUri } = event.data;

  try {
    // Decode base64 image data
    const response = await fetch(imageDataUri);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    // Create canvas and get pixel data
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Extract colors using median cut algorithm (simplified version)
    const colors = extractPalette(pixels, 5);

    if (!colors || colors.length < 3) {
      throw new Error('Could not extract enough colors from image');
    }

    // Convert RGB arrays to hex
    const rgbToHex = (rgb) => {
      const [r, g, b] = rgb;
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    // Intelligently assign colors to primary, secondary, and accent roles
    const brandColors = assignColorRoles(colors);

    // Convert to hex format
    const hexColors = {
      primary: rgbToHex(brandColors.primary),
      secondary: rgbToHex(brandColors.secondary),
      accent: rgbToHex(brandColors.accent)
    };

    // Send success response back to main thread
    self.postMessage({
      success: true,
      colors: hexColors
    });

  } catch (error) {
    self.postMessage({
      success: false,
      error: error.message || 'Color extraction failed'
    });
  }
});

/**
 * Extract color palette using median cut algorithm
 * @param {Uint8ClampedArray} pixels - RGBA pixel data
 * @param {number} colorCount - Number of colors to extract
 * @returns {Array<[number, number, number]>} Array of RGB colors
 */
function extractPalette(pixels, colorCount) {
  // Sample pixels (use every 10th pixel for performance)
  const pixelArray = [];
  for (let i = 0; i < pixels.length; i += 40) { // i += 4 * 10 (RGBA * sample rate)
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    // Skip transparent and very light pixels (likely background)
    if (a < 128 || (r > 240 && g > 240 && b > 240)) continue;

    pixelArray.push([r, g, b]);
  }

  if (pixelArray.length === 0) {
    throw new Error('No valid pixels found in image');
  }

  // Apply median cut algorithm
  const boxes = [{ pixels: pixelArray }];

  while (boxes.length < colorCount) {
    // Find box with largest range
    let maxRange = 0;
    let maxBox = null;

    for (const box of boxes) {
      const range = getColorRange(box.pixels);
      if (range > maxRange) {
        maxRange = range;
        maxBox = box;
      }
    }

    if (!maxBox || maxBox.pixels.length < 2) break;

    // Split box and replace with two new boxes
    const [box1, box2] = splitBox(maxBox);
    boxes.splice(boxes.indexOf(maxBox), 1, box1, box2);
  }

  // Get average color from each box
  return boxes.map(box => getAverageColor(box.pixels));
}

/**
 * Get the range of colors in a pixel array
 */
function getColorRange(pixels) {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;

  for (const [r, g, b] of pixels) {
    rMin = Math.min(rMin, r);
    rMax = Math.max(rMax, r);
    gMin = Math.min(gMin, g);
    gMax = Math.max(gMax, g);
    bMin = Math.min(bMin, b);
    bMax = Math.max(bMax, b);
  }

  const rRange = rMax - rMin;
  const gRange = gMax - gMin;
  const bRange = bMax - bMin;

  return Math.max(rRange, gRange, bRange);
}

/**
 * Split a box into two boxes along the widest color channel
 */
function splitBox(box) {
  const pixels = box.pixels;

  // Find widest channel
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;

  for (const [r, g, b] of pixels) {
    rMin = Math.min(rMin, r);
    rMax = Math.max(rMax, r);
    gMin = Math.min(gMin, g);
    gMax = Math.max(gMax, g);
    bMin = Math.min(bMin, b);
    bMax = Math.max(bMax, b);
  }

  const rRange = rMax - rMin;
  const gRange = gMax - gMin;
  const bRange = bMax - bMin;

  // Sort by widest channel
  let channel = 0; // 0=R, 1=G, 2=B
  if (gRange > rRange && gRange > bRange) channel = 1;
  else if (bRange > rRange) channel = 2;

  pixels.sort((a, b) => a[channel] - b[channel]);

  // Split at median
  const mid = Math.floor(pixels.length / 2);
  return [
    { pixels: pixels.slice(0, mid) },
    { pixels: pixels.slice(mid) }
  ];
}

/**
 * Get average color from pixel array
 */
function getAverageColor(pixels) {
  let r = 0, g = 0, b = 0;

  for (const [pr, pg, pb] of pixels) {
    r += pr;
    g += pg;
    b += pb;
  }

  const count = pixels.length;
  return [
    Math.round(r / count),
    Math.round(g / count),
    Math.round(b / count)
  ];
}

/**
 * Intelligently assign colors to primary, secondary, and accent roles
 * Uses color theory principles: saturation, brightness, contrast
 */
function assignColorRoles(colors) {
  if (colors.length < 3) {
    throw new Error('Need at least 3 colors to assign roles');
  }

  // Calculate color properties for each color
  const colorData = colors.map((rgb, index) => {
    const [r, g, b] = rgb;
    const { h, s, l } = rgbToHsl(r, g, b);

    return {
      rgb,
      h,   // Hue (0-360)
      s,   // Saturation (0-100)
      l,   // Lightness (0-100)
      index
    };
  });

  // Score each color for different roles
  const scored = colorData.map(color => {
    // PRIMARY: Should be saturated, medium-to-dark, distinctive
    // High saturation + medium lightness = good primary
    let primaryScore = 0;
    if (color.s > 30) primaryScore += color.s * 2; // Prefer saturated colors
    if (color.l >= 30 && color.l <= 60) primaryScore += 50; // Medium lightness
    if (color.l < 30 || color.l > 80) primaryScore -= 30; // Penalize too dark or too light

    // SECONDARY: Should be neutral or complementary, good for text/backgrounds
    // Lower saturation OR very dark (like black for text)
    let secondaryScore = 0;
    if (color.l < 20 || color.l > 80) secondaryScore += 60; // Very dark or very light (black/white)
    if (color.s < 30) secondaryScore += 40; // Low saturation (neutral)
    if (color.l >= 20 && color.l <= 80 && color.s >= 20) secondaryScore += 20; // Can be colorful too

    // ACCENT: Should be bright, vibrant, attention-grabbing
    // High saturation + bright = good accent
    let accentScore = 0;
    if (color.s > 50) accentScore += color.s * 1.5; // Very saturated
    if (color.l >= 45 && color.l <= 75) accentScore += 40; // Medium-bright
    if (color.s < 30) accentScore -= 30; // Penalize dull colors

    return {
      ...color,
      primaryScore,
      secondaryScore,
      accentScore
    };
  });

  // Find best color for each role (ensuring no duplicates)
  const roles = { primary: null, secondary: null, accent: null };
  const used = new Set();

  // Assign primary first (most important)
  const primaryCandidates = [...scored].sort((a, b) => b.primaryScore - a.primaryScore);
  roles.primary = primaryCandidates[0].rgb;
  used.add(primaryCandidates[0].index);

  // Assign secondary (avoiding primary)
  const secondaryCandidates = scored
    .filter(c => !used.has(c.index))
    .sort((a, b) => b.secondaryScore - a.secondaryScore);
  roles.secondary = secondaryCandidates[0].rgb;
  used.add(secondaryCandidates[0].index);

  // Assign accent (avoiding primary and secondary)
  const accentCandidates = scored
    .filter(c => !used.has(c.index))
    .sort((a, b) => b.accentScore - a.accentScore);
  roles.accent = accentCandidates[0].rgb;

  return roles;
}

/**
 * Convert RGB to HSL (Hue, Saturation, Lightness)
 * Returns { h: 0-360, s: 0-100, l: 0-100 }
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      case b:
        h = ((r - g) / delta + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}
