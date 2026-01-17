const sharp = require('sharp');
const axios = require('axios');

/**
 * Downloads an image from a URL and returns a buffer
 */
async function downloadImage(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error downloading image:', error.message);
    throw error;
  }
}

/**
 * Preprocesses image for ML model input
 */
async function preprocessImage(imageBuffer, targetSize = 224) {
  try {
    const processed = await sharp(imageBuffer)
      .resize(targetSize, targetSize, {
        fit: 'cover',
        position: 'center'
      })
      .removeAlpha()
      .toFormat('jpeg')
      .toBuffer();

    return processed;
  } catch (error) {
    console.error('Error preprocessing image:', error.message);
    throw error;
  }
}

/**
 * Splits a CAPTCHA grid image into individual tiles
 * reCAPTCHA v2 typically uses 3x3 or 4x4 grids
 */
async function splitCaptchaGrid(imageBuffer, gridSize = 3) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    const tileWidth = Math.floor(width / gridSize);
    const tileHeight = Math.floor(height / gridSize);

    const tiles = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // Extract and ensure proper format
        const tile = await sharp(imageBuffer)
          .extract({
            left: col * tileWidth,
            top: row * tileHeight,
            width: tileWidth,
            height: tileHeight
          })
          .ensureAlpha()  // Ensure alpha channel
          .toFormat('png')  // Force PNG format
          .toBuffer();

        tiles.push({
          row,
          col,
          index: row * gridSize + col,
          buffer: tile
        });
      }
    }

    return tiles;
  } catch (error) {
    console.error('Error splitting grid:', error.message);
    throw error;
  }
}

/**
 * Converts image buffer to tensor for TensorFlow
 */
async function imageBufferToTensor(imageBuffer) {
  const tf = require('@tensorflow/tfjs-node');

  try {
    // Decode image
    const tensor = tf.node.decodeImage(imageBuffer, 3);

    // Normalize pixel values to [0, 1]
    const normalized = tensor.div(255.0);

    return normalized;
  } catch (error) {
    console.error('Error converting to tensor:', error.message);
    throw error;
  }
}

/**
 * Takes a screenshot of a specific element in Puppeteer
 */
async function screenshotElement(page, selector) {
  try {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const screenshot = await element.screenshot();
    return screenshot;
  } catch (error) {
    console.error('Error taking screenshot:', error.message);
    throw error;
  }
}

/**
 * Gets image from iframe element
 */
async function getImageFromIframe(page, frameSelector, imageSelector) {
  try {
    const frames = page.frames();
    const targetFrame = frames.find(frame => frame.url().includes(frameSelector));

    if (!targetFrame) {
      throw new Error(`Frame not found: ${frameSelector}`);
    }

    const element = await targetFrame.$(imageSelector);
    if (!element) {
      throw new Error(`Element not found in frame: ${imageSelector}`);
    }

    const screenshot = await element.screenshot();
    return screenshot;
  } catch (error) {
    console.error('Error getting image from iframe:', error.message);
    throw error;
  }
}

/**
 * Detects if image contains a specific object using basic analysis
 * This is a fallback for when ML models are not confident
 */
async function basicImageAnalysis(imageBuffer) {
  try {
    const image = sharp(imageBuffer);
    const stats = await image.stats();

    // Get dominant colors, edges, etc.
    // This can be used as a heuristic

    return {
      brightness: stats.channels[0].mean,
      contrast: stats.channels[0].stdev,
      dominant: stats.dominant
    };
  } catch (error) {
    console.error('Error in basic analysis:', error.message);
    return null;
  }
}

module.exports = {
  downloadImage,
  preprocessImage,
  splitCaptchaGrid,
  imageBufferToTensor,
  screenshotElement,
  getImageFromIframe,
  basicImageAnalysis
};
