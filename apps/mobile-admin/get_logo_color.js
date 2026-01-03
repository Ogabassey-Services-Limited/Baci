const sharp = require('sharp');

const imagePath = '/Users/mac/.gemini/antigravity/brain/51b47134-8786-439c-8478-e0627bbe155d/uploaded_image_1_1767368827545.png';

async function getLogoColor() {
  try {
    const { data, info } = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
    
    let rBucket = {}, gBucket = {}, bBucket = {};
    let colorCounts = {};
    
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = info.channels === 4 ? data[i + 3] : 255;
      
      if (alpha < 50) continue; // Skip transparent
      
      // Skip Yellowish background (High R and G, Low B) e.g. EBC25E => 235, 194, 94
      if (r > 200 && g > 150 && b < 150) continue; 
      
      // Skip White/Light
      if (r > 220 && g > 220 && b > 220) continue;
      
      // Quantize to reduce noise
      const key = `${Math.round(r/10)*10},${Math.round(g/10)*10},${Math.round(b/10)*10}`;
      colorCounts[key] = (colorCounts[key] || 0) + 1;
    }
    
    // Find most common
    let maxCount = 0;
    let maxKey = '';
    for (const key in colorCounts) {
      if (colorCounts[key] > maxCount) {
        maxCount = colorCounts[key];
        maxKey = key;
      }
    }
    
    if (maxKey) {
      const [r, g, b] = maxKey.split(',').map(Number);
      const hex = '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
      console.log('Dominant Logo Color:', hex);
    } else {
      console.log('No dominant color found');
    }
    
  } catch (err) {
    console.error(err);
  }
}

getLogoColor();
