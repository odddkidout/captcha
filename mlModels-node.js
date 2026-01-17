const tf = require('@tensorflow/tfjs-node');
const cocoSsd = require('@tensorflow-models/coco-ssd');
const { imageBufferToTensor } = require('./imageProcessor');

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
 * Detects objects in an image buffer
 */
async function detectObjects(imageBuffer) {
  try {
    const model = await loadObjectDetectionModel();
    const tensor = await imageBufferToTensor(imageBuffer);

    const predictions = await model.detect(tensor);

    // Clean up tensor
    tensor.dispose();

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

    const tensor = await imageBufferToTensor(imageBuffer);
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
    'car': ['car', 'vehicle', 'automobile', 'sedan', 'suv', 'truck', 'van'],
    'bus': ['bus', 'coach', 'transit'],
    'bicycle': ['bicycle', 'bike', 'cycle'],
    'motorcycle': ['motorcycle', 'motorbike', 'scooter'],
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

  // Get tiles that contain the object with reasonable confidence
  const matchingTiles = results.filter(r => r.contains && r.confidence > 0.4);

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
