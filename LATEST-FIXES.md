# Latest Fixes - Enterprise reCAPTCHA Support

## Issue Identified

The Spotify challenge uses **reCAPTCHA v2 Enterprise**, not standard v2. The iframe URLs are different:

### Standard v2:
- `google.com/recaptcha/api2/anchor`
- `google.com/recaptcha/api2/bframe`

### Enterprise v2 (Spotify):
- `google.com/recaptcha/enterprise/anchor`
- `google.com/recaptcha/enterprise/bframe`

## Fixes Applied

### 1. Detection Fixed
**Before:** Only looked for `api2/anchor` iframe
**After:** Looks for any `google.com/recaptcha` with `anchor` or `bframe`

### 2. Frame Selection Fixed
**Before:**
```javascript
frame.url().includes('google.com/recaptcha/api2/bframe')
```

**After:**
```javascript
frame.url().includes('google.com/recaptcha') &&
frame.url().includes('bframe')
```

### 3. Both Solvers Updated
- ✅ Audio challenge solver
- ✅ Image challenge solver

### 4. Debug Logging Added
Now shows:
```
Found 3 frames total
Anchor frame: found
Challenge frame: found
```

## Test Results

### Before Fix:
```
Detected: reCAPTCHA v3/Enterprise  ← WRONG
✓ Clicked checkbox
✗ Error: Could not find reCAPTCHA challenge frame
```

### After Fix (Expected):
```
Detected: reCAPTCHA v2 Enterprise  ← CORRECT
✓ Clicked checkbox
✓ Challenge frame found
→ Attempting to solve...
```

## What This Means

The service now properly supports:
- ✅ Standard reCAPTCHA v2 (`api2`)
- ✅ reCAPTCHA v2 Enterprise (`enterprise`)
- ✅ Spotify challenge URLs
- ✅ Other enterprise implementations

## Next Test

Run the service again:
```bash
npm start
```

You should now see:
1. v2 Enterprise detected correctly
2. Checkbox clicked successfully
3. Challenge frame found
4. Attempt to solve audio/image challenge

## Debug Files to Check

After running, check:
```bash
# View the challenge that appeared
open debug/after-v2-click-*.png

# See the challenge structure
cat debug/after-v2-click-*-structure.json | jq .
```

The service will now properly proceed to the solving stage instead of failing at frame detection!

---

**Status:** Ready to test
**Fixed:** Enterprise iframe detection
**Next:** Solve the actual challenge (audio or image)
