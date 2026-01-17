/**
 * ML Models using browser-compatible TensorFlow.js
 * This version works around Node 23 compatibility issues
 */

const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-cpu');
const cocoSsd = require('@tensorflow-models/coco-ssd');

// Cache for loaded models
let objectDetectionModel = null;
let imageClassificationModel = null;

/**
 * Loads the COCO-SSD object detection model
 */
async function loadObjectDetectionModel() {
  if (objectDetectionModel) {
    return objectDetectionModel;
  }

  try {
    console.log('Loading object detection model...');
    // Set CPU backend for Node.js environment
    await tf.setBackend('cpu');
    await tf.ready();

    objectDetectionModel = await cocoSsd.load({
      base: 'mobilenet_v2'
    });
    console.log('Object detection model loaded successfully');
    return objectDetectionModel;
  } catch (error) {
    console.error('Error loading object detection model:', error);
    throw error;
  }
}

/**
 * Loads MobileNet for image classification
 */
async function loadImageClassificationModel() {
  if (imageClassificationModel) {
    return imageClassificationModel;
  }

  try {
    console.log('Loading image classification model...');
    await tf.setBackend('cpu');
    await tf.ready();

    const mobilenet = require('@tensorflow-models/mobilenet');
    imageClassificationModel = await mobilenet.load({
      version: 2,
      alpha: 1.0
    });
    console.log('Image classification model loaded successfully');
    return imageClassificationModel;
  } catch (error) {
    console.error('Error loading classification model:', error);
    // Return null if MobileNet is not available
    return null;
  }
}

/**
 * Converts image buffer to tensor for TensorFlow
 * For object detection: returns uint8 tensor (0-255)
 * For classification: returns normalized float32 tensor (0-1)
 */
async function imageBufferToTensor(imageBuffer, normalize = false) {
  try {
    // Decode image using sharp to get raw pixel data
    const sharp = require('sharp');
    const { data, info } = await sharp(imageBuffer)
      .resize(224, 224) // Resize to standard input size
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Create tensor from raw pixel data
    const tensor = tf.tensor3d(
      new Uint8Array(data),
      [info.height, info.width, info.channels]
    );

    // For classification models, normalize to [0, 1]
    if (normalize) {
      const normalized = tensor.div(255.0);
      tensor.dispose();
      return normalized;
    }

    // For object detection, keep as uint8
    return tensor;
  } catch (error) {
    console.error('Error converting to tensor:', error.message);
    throw error;
  }
}

/**
 * Detects objects in an image buffer
 */
async function detectObjects(imageBuffer) {
  try {
    const model = await loadObjectDetectionModel();

    // Decode image using sharp and create a proper tensor
    const sharp = require('sharp');
    const { data, info } = await sharp(imageBuffer)
      .resize(300, 300) // COCO-SSD expects specific sizes
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Create 3D tensor with shape [height, width, channels]
    // COCO-SSD's detect() method handles batching internally
    const imageTensor = tf.tensor3d(
      new Uint8Array(data),
      [info.height, info.width, 3]
    );

    // Call detect directly with 3D tensor - model handles batching
    const predictions = await model.detect(imageTensor);

    // Clean up tensor
    imageTensor.dispose();

    return predictions.map(pred => ({
      class: pred.class,
      score: pred.score,
      bbox: pred.bbox
    }));
  } catch (error) {
    console.error('Error detecting objects:', error);
    return [];
  }
}

/**
 * Classifies what's in an image
 */
async function classifyImage(imageBuffer) {
  try {
    const model = await loadImageClassificationModel();
    if (!model) {
      return [];
    }

    const tensor = await imageBufferToTensor(imageBuffer, true); // normalize for classification
    const predictions = await model.classify(tensor);

    // Clean up tensor
    tensor.dispose();

    return predictions.map(pred => ({
      className: pred.className,
      probability: pred.probability
    }));
  } catch (error) {
    console.error('Error classifying image:', error);
    return [];
  }
}

/**
 * Determines if a tile contains the target object
 * Uses both object detection and classification
 */
async function tileContainsObject(imageBuffer, targetObject) {
  try {
    // Normalize target object name
    const target = targetObject.toLowerCase();

    // Try object detection first
    const objects = await detectObjects(imageBuffer);

    // Debug: log all detected objects
    if (objects.length > 0) {
      console.log(`  Detected objects: ${objects.map(o => `${o.class}(${(o.score*100).toFixed(0)}%)`).join(', ')}`);
    }

    // Check if any detected object matches the target
    for (const obj of objects) {
      if (objectMatches(obj.class.toLowerCase(), target)) {
        console.log(`✓ Found ${obj.class} (${(obj.score * 100).toFixed(1)}% confidence)`);
        return {
          contains: true,
          confidence: obj.score,
          method: 'object_detection',
          detectedClass: obj.class
        };
      }
    }

    // Fallback to image classification
    const classifications = await classifyImage(imageBuffer);

    // Debug: log top 3 classifications
    if (classifications.length > 0) {
      const top3 = classifications.slice(0, 3);
      console.log(`  Top classifications: ${top3.map(c => `${c.className}(${(c.probability*100).toFixed(0)}%)`).join(', ')}`);
    }

    for (const cls of classifications) {
      if (objectMatches(cls.className.toLowerCase(), target)) {
        console.log(`✓ Found ${cls.className} (${(cls.probability * 100).toFixed(1)}% confidence)`);
        return {
          contains: true,
          confidence: cls.probability,
          method: 'classification',
          detectedClass: cls.className
        };
      }
    }

    return {
      contains: false,
      confidence: 0,
      method: 'none',
      detectedClass: null
    };
  } catch (error) {
    console.error('Error analyzing tile:', error);
    return {
      contains: false,
      confidence: 0,
      method: 'error',
      detectedClass: null
    };
  }
}

/**
 * Checks if detected object matches target
 * Handles common CAPTCHA object types and their variations
 */
function objectMatches(detected, target) {
  // Direct match
  if (detected.includes(target) || target.includes(detected)) {
    return true;
  }

  // Common CAPTCHA object mappings
  const objectMappings = {
    'traffic light': ['traffic light', 'traffic signal', 'stoplight', 'street light'],
    'car': ['car', 'vehicle', 'automobile', 'sedan', 'suv', 'truck', 'van', 'minivan', 'sports car', 'racer'],
    'bus': ['bus', 'coach', 'transit', 'school bus'],
    'bicycle': ['bicycle', 'bike', 'cycle', 'mountain bike', 'unicycle', 'tandem', 'velocipede', 'wheel', 'tire', 'spoke', 'pedal'],
    'motorcycle': ['motorcycle', 'motorbike', 'scooter', 'moped'],
    'crosswalk': ['crosswalk', 'zebra crossing', 'pedestrian crossing', 'crosswalks'],
    'stairs': ['stairs', 'staircase', 'steps'],
    'chimney': ['chimney', 'smokestack'],
    'bridge': ['bridge', 'overpass', 'viaduct'],
    'fire hydrant': ['fire hydrant', 'hydrant', 'firehydrant'],
    'parking meter': ['parking meter', 'meter'],
    'boat': ['boat', 'ship', 'vessel', 'sailboat'],
    'mountain': ['mountain', 'mountains', 'peak', 'hill'],
    'palm tree': ['palm', 'palm tree', 'coconut tree'],
    'taxi': ['taxi', 'cab', 'taxicab']
  };

  // Check all mappings
  for (const [key, variations] of Object.entries(objectMappings)) {
    if (variations.includes(target)) {
      if (variations.some(v => detected.includes(v))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Analyzes all tiles in a grid and returns which ones contain the target
 */
async function analyzeCaptchaGrid(tiles, targetObject) {
  console.log(`\nAnalyzing ${tiles.length} tiles for: ${targetObject}`);

  const results = [];

  // Save all tiles for debugging
  if (tiles.length > 0) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const timestamp = Date.now();

      console.log(`Saving all ${tiles.length} tiles to debug folder...`);
      for (const tile of tiles) {
        const debugPath = path.join(__dirname, 'debug', `tile-${tile.index}-${timestamp}.png`);
        await fs.writeFile(debugPath, tile.buffer);
      }
      console.log(`✓ Saved all tiles with timestamp ${timestamp}`);
    } catch (err) {
      console.error('Error saving tiles:', err.message);
    }
  }

  for (const tile of tiles) {
    console.log(`Analyzing tile ${tile.index}...`);
    const analysis = await tileContainsObject(tile.buffer, targetObject);

    results.push({
      index: tile.index,
      row: tile.row,
      col: tile.col,
      ...analysis
    });
  }

  // Get tiles that contain the object with lower confidence threshold (0.3 instead of 0.4)
  const matchingTiles = results.filter(r => r.contains && r.confidence > 0.3);

  console.log(`\nFound ${matchingTiles.length} tiles containing ${targetObject}`);

  return {
    matchingTiles,
    allResults: results
  };
}

/**
 * Clean up loaded models to free memory
 */
function cleanupModels() {
  if (objectDetectionModel) {
    objectDetectionModel.dispose();
    objectDetectionModel = null;
  }
  if (imageClassificationModel) {
    imageClassificationModel.dispose();
    imageClassificationModel = null;
  }
  console.log('ML models cleaned up');
}

module.exports = {
  loadObjectDetectionModel,
  loadImageClassificationModel,
  detectObjects,
  classifyImage,
  tileContainsObject,
  analyzeCaptchaGrid,
  cleanupModels
};
