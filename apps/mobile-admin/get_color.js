const sharp = require('sharp'); // This assumes we run from a place where module is resolvable, defaulting to project root

const imagePath = '/Users/mac/.gemini/antigravity/brain/51b47134-8786-439c-8478-e0627bbe155d/uploaded_image_1_1767368827545.png';

async function getColor() {
  try {
    const { dominant } = await sharp(imagePath).stats();
    const hex = '#' + [dominant.r, dominant.g, dominant.b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
    console.log('Dominant Color:', hex);
  } catch (err) {
    console.error(err);
  }
}

getColor();
