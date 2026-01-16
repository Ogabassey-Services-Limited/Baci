const sharp = require('sharp');

const imagePath =
  '/Users/mac/.gemini/antigravity/brain/51b47134-8786-439c-8478-e0627bbe155d/uploaded_image_1_1767368827545.png';

async function getBlue() {
  try {
    const { data, info } = await sharp(imagePath)
      .raw()
      .toBuffer({ resolveWithObject: true });

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Look for "Blue" pixels: Blue is dominant and significantly stronger than Red/Green
      if (b > r + 30 && b > g + 30 && b < 200) {
        // < 200 to avoid overly light blues if any, though logo seems dark
        rSum += r;
        gSum += g;
        bSum += b;
        count++;
      }
    }

    if (count > 0) {
      const rAvg = Math.round(rSum / count);
      const gAvg = Math.round(gSum / count);
      const bAvg = Math.round(bSum / count);
      const hex =
        '#' +
        [rAvg, gAvg, bAvg]
          .map((x) => {
            const hex = x.toString(16);
            return hex.length === 1 ? `0${hex}` : hex;
          })
          .join('');
      console.log('Average Blue Color:', hex);
    } else {
      console.log('No blue found');
    }
  } catch (err) {
    console.error(err);
  }
}

getBlue();
