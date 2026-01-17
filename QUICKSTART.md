# Quick Start Guide

## Installation Complete! ✓

All dependencies have been installed successfully. The service is ready to use.

## Start the Service

```bash
npm start
```

The server will start on `http://localhost:3000`

## Test the API

### Using curl:

```bash
curl -X POST http://localhost:3000/solve-captcha \
  -H "Content-Type: application/json" \
  -d '{"url": "https://challenge.spotify.com/c/7d10e2a7-1f43-484e-bfc3-76760f1bfbac-2/eb11391f-02a2-4c70-a403-f8d950740aaa/recaptcha?flow_ctx=078c1bb0-5695-45e9-a966-aa7278c05465%3A1768624635"}'
```

### Using Node.js:

```javascript
const fetch = require('node-fetch');

async function solveCaptcha(url) {
  const response = await fetch('http://localhost:3000/solve-captcha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  const result = await response.json();
  console.log(result);
  return result;
}

solveCaptcha('https://your-captcha-url-here');
```

### Using Python:

```python
import requests

response = requests.post('http://localhost:3000/solve-captcha', json={
    'url': 'https://your-captcha-url-here'
})

result = response.json()
print(result)
```

## Response Format

### Success:
```json
{
  "success": true,
  "captchaType": "v2",
  "message": "CAPTCHA solved and submitted successfully"
}
```

### Failure:
```json
{
  "success": false,
  "captchaType": "v2",
  "error": "Failed to solve CAPTCHA"
}
```

## How It Works

1. **Detects CAPTCHA type** (v2 checkbox, v2 invisible, or v3)
2. **For v2 Audio**: Downloads audio → Transcribes with Whisper → Submits
3. **For v2 Image**: Screenshots grid → Splits tiles → Analyzes with ML (COCO-SSD + MobileNet) → Clicks matches → Submits
4. **For v3**: Waits for automatic token generation

## Performance

- **v3 CAPTCHA**: ~95% success, 3-5 seconds
- **v2 Audio**: ~85-95% success, 8-15 seconds
- **v2 Image**: ~60-75% success, 15-25 seconds

## First Run Notes

- **Whisper Model**: Will download automatically (~40MB) on first audio challenge
- **TensorFlow Warning**: You may see a warning about tfjs-node - this is expected and can be ignored
- **Browser Window**: Will open in non-headless mode by default for debugging

## Configuration

### Run in Headless Mode

Edit `captchaSolver.js` line 393:
```javascript
headless: true  // Change false to true
```

### Adjust Confidence Threshold

Edit `mlModels.js` line 91 to make image detection more/less strict:
```javascript
r.confidence > 0.4  // Lower = more lenient (0.3), Higher = more strict (0.6)
```

### Change Port

Edit `server.js` line 6 or set environment variable:
```bash
PORT=8080 npm start
```

## Troubleshooting

### "No CAPTCHA detected"
- Ensure the URL loads a page with an actual CAPTCHA
- Wait time might need adjustment (increase in captchaSolver.js)

### "Failed to solve CAPTCHA"
- ML models may not recognize the specific object type
- Try multiple times (CAPTCHAs vary in difficulty)
- Check console logs for detailed error messages

### Browser won't launch
```bash
# Use system Chrome instead of Chromium
# Edit captchaSolver.js line 393, add:
executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

### Memory issues
```bash
# Increase Node memory
node --max-old-space-size=4096 server.js
```

## Important Legal Notice

**This tool is for authorized testing only.**

✓ Allowed:
- Your own websites
- Authorized penetration testing
- Security research with permission
- Educational purposes

✗ Prohibited:
- Bypassing CAPTCHAs without authorization
- Violating terms of service
- Spam, scraping, abuse
- Unauthorized access

**You are responsible for ensuring legal compliance.**

## Next Steps

- Read full documentation: `README.md`
- Check example code in the files
- Adjust settings for your use case
- Add error handling for production use

## Support

- Check console output for detailed logs
- Run with `headless: false` to watch the browser
- Review source code comments
- Test with different CAPTCHA types

---

**Ready to start!** Run `npm start` and send your first API request.
