# ML Detection Analysis

## Current Status: TILES FIXED ✓, DETECTION NEEDS IMPROVEMENT

### What's Working Now

✅ **Tile extraction fixed** - Tiles are now properly extracted with correct colors
✅ **Models are loading** - COCO-SSD and MobileNet both operational
✅ **Object detection working** - Detected "person(68%)" in tile 1
✅ **Challenge parsing fixed** - Correctly extracts "bicycles" from challenge text

### What's Not Working

❌ **Bicycle detection** - Models not detecting bicycles in tiles that contain them
❌ **Low confidence** - All classifications very low (30-33%)
❌ **Generic results** - Everything classified as "spotlight, spot"

## Analysis of Saved Tiles

### Full Challenge Image
- **File**: `full-challenge-1768644445031.png`
- **Content**: Clear image showing person riding a bicycle
- **Quality**: Excellent - sharp and colorful

### Individual Tiles (from bicycle challenge)

| Tile | Content | COCO-SSD Result | MobileNet Result | Should Match? |
|------|---------|----------------|------------------|---------------|
| 0 | Trees/background | None | spotlight(31%) | ❌ No |
| 1 | Person (upper body) | person(68%) ✓ | spotlight(31%) | ❌ No |
| 2 | Trees/sky | None | spotlight(31%) | ❌ No |
| 3 | Ground/pavement | None | spotlight(32%) | ❌ No |
| 4 | **Bicycle wheel** | **None** ❌ | spotlight(31%) | ✅ **YES!** |
| 5 | Ground/pavement | None | spotlight(32%) | ❌ No |
| 6 | Trees/ground | None | spotlight(32%) | ❌ No |
| 7 | Ground/pavement | None | spotlight(31%) | ❌ No |
| 8 | Ground/pavement | None | spotlight(32%) | ❌ No |

**Critical Finding**: Tile 4 clearly shows a bicycle wheel, but COCO-SSD is NOT detecting it!

## Why Bicycle Detection is Failing

### Issue 1: Partial Objects
- reCAPTCHA tiles often show **partial objects** (just a wheel, not full bicycle)
- COCO-SSD trained on full bicycles, struggles with fragments
- Tile 4 has bicycle wheel but no handlebars/frame visible

### Issue 2: Image Resizing Quality Loss
The detection pipeline resizes images twice:
1. **Screenshot** → Original tile size (~100x100px)
2. **COCO-SSD resize** → 300x300px
3. **Sharp raw decode** → Loses quality

Small objects become even smaller and harder to detect.

### Issue 3: Detection Threshold
COCO-SSD might be detecting bicycle with low confidence (<50%) which we're filtering out.

### Issue 4: Wrong Model Expectations
- COCO-SSD expects **full, centered objects**
- CAPTCHA tiles have **partial, off-center objects**
- Model confidence drops dramatically for fragments

## Possible Solutions

### Solution 1: Skip Object Detection, Use Classification Only ⭐
**Why**: MobileNet might classify bicycle parts better than COCO-SSD detects them

```javascript
// In tileContainsObject, prioritize classification
const classifications = await classifyImage(imageBuffer);
// Check top 10 instead of top 3
const top10 = classifications.slice(0, 10);
```

### Solution 2: Lower Detection Confidence Threshold
**Current**: Only accept detections with >50% confidence (COCO-SSD default)
**Try**: Accept >30% or even >20% for bicycles

```javascript
const predictions = await model.detect(imageTensor);
// Filter to include lower confidence
return predictions.filter(p => p.score > 0.2);
```

### Solution 3: Don't Resize for Detection
**Current**: Resize to 300x300
**Try**: Keep original tile size or use larger size

```javascript
// Don't resize, or use larger size
.resize(600, 600) // Double the size
```

### Solution 4: Use Better Model for CAPTCHA
**Current**: COCO-SSD (general object detection)
**Alternative**: YOLOv5 or specialized CAPTCHA solver models

### Solution 5: Accept "wheel" as "bicycle"
The model might detect "wheel" but we're only looking for "bicycle":

```javascript
'bicycle': ['bicycle', 'bike', 'cycle', 'wheel', 'tire', 'spoke'],
```

### Solution 6: Use Multiple Passes with Different Sizes
Run detection at multiple scales:
```javascript
const sizes = [224, 300, 416, 512];
for (const size of sizes) {
  // Try detection at each size
}
```

## Recommended Next Steps

### Quick Wins (Try First)

1. **Expand bicycle mappings** to include "wheel", "tire", "spoke"
2. **Check top 10 classifications** instead of top 3
3. **Lower confidence threshold** to 0.2 or 0.3
4. **Log ALL detections** regardless of confidence to see what's being found

### Medium Effort

5. **Skip resizing** for COCO-SSD or use larger size (600x600)
6. **Try classification-first** approach instead of detection-first
7. **Multi-scale detection** - try multiple image sizes

### Long Term

8. **Use specialized CAPTCHA solver model** (like those used by 2Captcha)
9. **Train custom model** on CAPTCHA images specifically
10. **Use external API** for difficult cases

## Test Results Summary

### Before Fix
- Tiles: ❌ Corrupted (all black/dark)
- Detection: ❌ Not working (garbage input)
- Classification: ❌ All "spotlight" (garbage input)

### After Fix
- Tiles: ✅ Perfect extraction
- Detection: ⚠️ Partial (finds person, misses bicycle)
- Classification: ⚠️ Low confidence, generic results

## Code Changes to Try

### Change 1: Add "wheel" to bicycle mappings
**File**: `mlModels.js:216`
```javascript
'bicycle': ['bicycle', 'bike', 'cycle', 'mountain bike', 'unicycle', 'tandem', 'velocipede', 'wheel', 'tire'],
```

### Change 2: Check top 10 classifications
**File**: `mlModels.js:180`
```javascript
const top10 = classifications.slice(0, 10);
console.log(`  Top classifications: ${top10.map(c => `${c.className}(${(c.probability*100).toFixed(0)}%)`).join(', ')}`);
```

### Change 3: Log all COCO-SSD detections
**File**: `mlModels.js:123`
```javascript
const predictions = await model.detect(imageTensor);
console.log(`  ALL detections: ${predictions.map(p => `${p.class}(${(p.score*100).toFixed(0)}%)`).join(', ')}`);
```

### Change 4: Try larger resize
**File**: `mlModels.js:111`
```javascript
.resize(600, 600) // Larger size for better detection
```

## Expected Outcomes

With these changes:
- **Optimistic**: 40-60% success rate on bicycle CAPTCHAs
- **Realistic**: 20-40% success rate
- **Why not higher**: Partial objects + bot detection limits

## Conclusion

**Good News:**
- ✅ Infrastructure is working
- ✅ Tiles are perfect quality
- ✅ Models are functional
- ✅ Detection works for some objects (person)

**Bad News:**
- ❌ COCO-SSD not optimized for CAPTCHA fragments
- ❌ MobileNet giving very generic classifications
- ❌ May need specialized models for higher accuracy

**Reality Check:**
Pre-trained models like COCO-SSD and MobileNet were trained on full, centered objects in natural photos. CAPTCHA tiles are deliberately cropped, partial, and difficult. This is by design - Google doesn't want automated solvers to work well!

**Recommendation:**
For educational purposes, the current setup demonstrates how CAPTCHA solving works. For production use with higher success rates, consider:
1. External solving services (2Captcha, Anti-Captcha)
2. Specialized CAPTCHA-trained models
3. Hybrid approach: easy cases with ML, hard cases with external API

---

**Status**: Tile extraction fixed, detection working but needs tuning
**Next**: Try the 4 code changes above to improve bicycle detection
