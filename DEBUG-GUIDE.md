# Debug Guide - CAPTCHA Solver

## New Debugging Features Added

The service now includes comprehensive debugging capabilities to help understand and solve CAPTCHAs.

### What's New

1. **Page HTML Dumping** - Saves complete HTML to `debug/` folder
2. **Screenshot Capture** - Takes screenshots at key moments
3. **Element Analysis** - Identifies all interactive elements
4. **Structure JSON** - Exports page structure as JSON
5. **Better v2 Enterprise Detection** - Correctly identifies Spotify-style CAPTCHAs

### Debug Output Location

All debug files are saved to: `/Users/odddkidout/Desktop/captcha/debug/`

## How to Use Debugging

### Run the Service

```bash
npm start
```

### Make a Request

The service will automatically create debug files:

```bash
curl -X POST http://localhost:3000/solve-captcha \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-captcha-url"}'
```

### Check Debug Output

```bash
ls -la debug/
```

You'll see files like:
- `initial-load-1768628200000.html` - Page HTML at load
- `initial-load-1768628200000.png` - Screenshot at load
- `initial-load-1768628200000-structure.json` - Element structure
- `before-v2-click-*.html` - Before clicking checkbox
- `after-v2-click-*.html` - After clicking checkbox

### Analyze the Output

#### HTML Files
Open in browser to see the exact page state:
```bash
open debug/initial-load-*.html
```

#### Screenshots
View what the page looked like:
```bash
open debug/initial-load-*.png
```

#### Structure JSON
See all interactive elements:
```bash
cat debug/initial-load-*-structure.json | jq .
```

## What the Structure JSON Contains

```json
{
  "buttons": [
    {
      "tag": "button",
      "type": "submit",
      "text": "Verify",
      "id": "verify-btn",
      "className": "btn-primary",
      "visible": true
    }
  ],
  "inputs": [...],
  "iframes": [...],
  "forms": [...],
  "recaptchaElements": [...]
}
```

## Understanding CAPTCHA Detection

### Spotify Challenge Detection

The Spotify URL shows:
```json
{
  "hasGrecaptcha": true,
  "hasEnterprise": true,
  "iframes": [
    "...anchor...",  // <- v2 checkbox iframe
    "...bframe..."   // <- v2 challenge iframe
  ]
}
```

This is **reCAPTCHA v2 Enterprise**, not v3!

### Detection Flow

1. Check for v2 anchor iframe → Found! ✓
2. Classify as v2 Enterprise
3. Attempt to click checkbox
4. Handle challenge if needed

## Common Debug Scenarios

### Scenario 1: CAPTCHA Not Detected

**Symptoms:**
```json
{"success": false, "error": "No CAPTCHA detected"}
```

**Debug Steps:**
1. Check `initial-load-*.html` - Is there actually a CAPTCHA?
2. Check `*-structure.json` - Are there `recaptchaElements`?
3. Look for unusual CAPTCHA implementations

### Scenario 2: CAPTCHA Detected But Not Solved

**Symptoms:**
```json
{"success": false, "captchaType": "v2", "error": "Failed to solve"}
```

**Debug Steps:**
1. Check `before-v2-click-*.png` - Is checkbox visible?
2. Check `after-v2-click-*.png` - Did challenge appear?
3. Review console logs for specific errors

### Scenario 3: Challenge Appears But Can't Solve

**Symptoms:**
- Checkbox clicked
- Challenge frame loaded
- But solving fails

**Debug Steps:**
1. Look at screenshots to see challenge type (audio/image)
2. Check if audio URL was found
3. Verify ML models loaded for image challenges

## Manual Analysis Workflow

### Step 1: Capture Debug Files

Run the solver and let it create debug files.

### Step 2: Review Initial State

```bash
# View HTML
open debug/initial-load-*.html

# View screenshot
open debug/initial-load-*.png

# Check structure
cat debug/initial-load-*-structure.json | jq '.recaptchaElements'
```

### Step 3: Find Clickable Elements

```bash
# See all buttons
cat debug/*-structure.json | jq '.buttons'

# See all iframes
cat debug/*-structure.json | jq '.iframes'
```

### Step 4: Identify Issues

Common issues:
- **No checkbox visible** → CAPTCHA loaded but hidden
- **Wrong iframe detected** → Need better selectors
- **Challenge doesn't appear** → Bot detection blocked
- **Audio URL not found** → Challenge structure changed

## Improving Success Rate

### Based on Debug Output

1. **If checkbox not found:**
   - Add more selector patterns
   - Wait longer for page load
   - Check for shadow DOM

2. **If challenge doesn't appear:**
   - Bot detection is strong
   - Need better stealth
   - Try different timing

3. **If solving fails:**
   - Audio: Check transcription quality
   - Image: Check ML model confidence
   - Both: May need retries

## Testing with Debug Mode

### Test 1: Basic Load
```bash
# Just see what's on the page
node -e "
const { solveCaptcha } = require('./captchaSolver');
solveCaptcha('https://your-url').then(r => console.log(r));
"
```

Check `debug/` folder for output.

### Test 2: Analyze Structure
```bash
# Look at what elements exist
cat debug/initial-load-*-structure.json | jq '{
  buttons: .buttons | length,
  iframes: .iframes | length,
  recaptcha: .recaptchaElements | length
}'
```

### Test 3: Compare Before/After
```bash
# See what changed after clicking
diff <(cat debug/before-*-structure.json) <(cat debug/after-*-structure.json)
```

## Pro Tips

### Tip 1: Keep Debug Files Organized
```bash
# Clean old debug files
rm debug/*

# Or organize by date
mkdir debug/$(date +%Y-%m-%d)
mv debug/*.html debug/$(date +%Y-%m-%d)/
```

### Tip 2: Quick Screenshot Review
```bash
# View all screenshots in sequence
open debug/*.png
```

### Tip 3: Extract Specific Info
```bash
# Get all button texts
cat debug/*-structure.json | jq '.buttons[].text'

# Get all iframe URLs
cat debug/*-structure.json | jq '.iframes[].src'
```

### Tip 4: Monitor Live
```bash
# Watch debug folder for new files
watch -n 1 'ls -lt debug/ | head -10'
```

## Next Steps for Spotify Challenge

Based on debug output:

1. ✅ Detection working - identifies v2 Enterprise
2. ✅ Iframe found - anchor and bframe present
3. 🔧 Need to click checkbox
4. 🔧 Need to handle challenge
5. 🔧 Need to solve (audio or image)

The debug files will show exactly:
- Where the checkbox is
- What challenge appears
- Why solving might fail

## Automated Analysis Script

Create `analyze-debug.sh`:

```bash
#!/bin/bash

echo "=== Latest Debug Session ==="
echo ""

echo "HTML files:"
ls -lt debug/*.html | head -3

echo ""
echo "Screenshots:"
ls -lt debug/*.png | head -3

echo ""
echo "Page Structure:"
cat debug/*-structure.json | tail -1 | jq '{
  buttons: .buttons | length,
  inputs: .inputs | length,
  iframes: .iframes | length,
  recaptchaElements: .recaptchaElements | length
}'

echo ""
echo "reCAPTCHA Elements Found:"
cat debug/*-structure.json | tail -1 | jq '.recaptchaElements[]'
```

```bash
chmod +x analyze-debug.sh
./analyze-debug.sh
```

---

## Summary

The debug features give you:
- ✅ Complete page HTML at each step
- ✅ Visual screenshots
- ✅ Structured element analysis
- ✅ JSON exports for automation

Use these to understand:
- What the CAPTCHA actually looks like
- Where elements are located
- Why solving might fail
- How to improve success rate

All output is in `/Users/odddkidout/Desktop/captcha/debug/`
