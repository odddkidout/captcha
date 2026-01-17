# TensorFlow Tensor dtype Fix

## Issue

When trying to detect objects in CAPTCHA tiles, the COCO-SSD model threw an error:

```
Error: The dtype of dict['image_tensor'] provided in model.execute(dict) must be int32, but was float32
```

## Root Cause

The `imageBufferToTensor()` function was:
1. Normalizing all tensors to float32 (dividing by 255.0)
2. Not adding the required batch dimension
3. Using inconsistent image sizes

COCO-SSD object detection expects:
- **uint8 tensor** (values 0-255), not float32
- **Batch dimension** added: shape [1, height, width, 3]
- **Specific input size**: 300x300 pixels

## Fix Applied

### mlModels.js changes:

**1. Made `imageBufferToTensor()` flexible:**
```javascript
async function imageBufferToTensor(imageBuffer, normalize = false) {
  // ... decode with sharp ...

  const tensor = tf.tensor3d(
    new Uint8Array(data),
    [info.height, info.width, info.channels]
  );

  // Only normalize for classification, not object detection
  if (normalize) {
    const normalized = tensor.div(255.0);
    tensor.dispose();
    return normalized;
  }

  return tensor; // uint8 for object detection
}
```

**2. Fixed `detectObjects()` to handle tensor properly:**
```javascript
async function detectObjects(imageBuffer) {
  const sharp = require('sharp');
  const { data, info } = await sharp(imageBuffer)
    .resize(300, 300) // COCO-SSD expects this size
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Create 3D tensor [height, width, channels]
  const imageTensor = tf.tensor3d(
    new Uint8Array(data),
    [info.height, info.width, 3]
  );

  // Add batch dimension: [1, height, width, channels]
  const batchedTensor = imageTensor.expandDims(0);

  const predictions = await model.detect(batchedTensor);

  // Clean up
  imageTensor.dispose();
  batchedTensor.dispose();

  return predictions;
}
```

**3. Updated `classifyImage()` to use normalization:**
```javascript
const tensor = await imageBufferToTensor(imageBuffer, true); // normalize = true
```

## Why This Works

| Model | Input Type | Shape | Values |
|-------|-----------|-------|--------|
| **COCO-SSD** | uint8 | [1, 300, 300, 3] | 0-255 |
| **MobileNet** | float32 | [224, 224, 3] | 0-1 (normalized) |

Different ML models have different input requirements. Object detection models typically work with raw pixel values, while classification models expect normalized inputs.

## Expected Behavior After Fix

```
Analyzing tile 0...
✓ Found fire hydrant (89.3% confidence)

Analyzing tile 1...
(no match)

Analyzing tile 2...
✓ Found fire hydrant (91.7% confidence)

Found 2 tiles containing fire hydrant
Clicking 2 tiles...
```

## Testing

Run the service again:

```bash
npm start
```

Then test with the Spotify URL. The ML models should now correctly detect objects in the CAPTCHA tiles.

## Technical Details

### Tensor Shapes

**Before (broken):**
```
float32 [224, 224, 3]  → model expects uint8 with batch dim
```

**After (fixed):**
```
uint8 [1, 300, 300, 3]  → correct!
```

### Why expandDims?

TensorFlow models expect batched input (multiple images at once). Even when processing a single image, we need shape `[1, H, W, C]` where the first dimension is batch size.

```javascript
tensor.shape            // [300, 300, 3]
tensor.expandDims(0)    // [1, 300, 300, 3] ← batch dimension added
```

---

**Status**: Fixed
**Test**: Restart npm start and try again
**Expected**: Object detection should work without dtype errors
