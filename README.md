# CAPTCHA Solver Service with ML

A Node.js service that automatically detects and solves reCAPTCHA v2 and v3 challenges using machine learning models (COCO-SSD, MobileNet) for image recognition and Whisper for audio transcription.

## Features

- **Automatic Detection**: Detects reCAPTCHA v2 (checkbox and invisible) and v3
- **ML-Powered Image Solving**: Uses TensorFlow.js with COCO-SSD and MobileNet models for object detection and image classification
- **Audio Transcription**: Whisper model for speech-to-text on audio challenges
- **Browser Automation**: Puppeteer with stealth plugins to avoid detection
- **RESTful API**: Easy-to-use API endpoint for integration

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Express Server                        │
│                   (server.js)                            │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │   CAPTCHA Solver             │
        │   (captchaSolver.js)         │
        └──┬────────────────────────┬──┘
           │                        │
           ▼                        ▼
    ┌──────────────┐        ┌──────────────┐
    │ Image Solver │        │ Audio Solver │
    │              │        │              │
    │ - mlModels   │        │ - Whisper    │
    │ - COCO-SSD   │        │ - STT        │
    │ - MobileNet  │        │              │
    └──────────────┘        └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ Image Utils  │
    │              │
    │ - Sharp      │
    │ - Canvas     │
    └──────────────┘
```

## Prerequisites

- Node.js 16+ (recommended: 18+)
- npm or yarn
- At least 2GB RAM (for ML models)
- Chromium/Chrome (installed automatically by Puppeteer)

## Installation

```bash
# Install dependencies
npm install
```

**Note**: First run will download ML models (~100MB) which may take a few minutes.

## Usage

### Start the Service

```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

The service runs on `http://localhost:3000` by default.

### API Endpoint

**POST /solve-captcha**

Request:
```json
{
  "url": "https://example.com/page-with-captcha"
}
```

Success Response:
```json
{
  "success": true,
  "captchaType": "v2",
  "message": "CAPTCHA solved and submitted successfully"
}
```

Failure Response:
```json
{
  "success": false,
  "captchaType": "v2",
  "error": "Failed to solve CAPTCHA"
}
```

### Example Usage

**Using curl:**
```bash
curl -X POST http://localhost:3000/solve-captcha \
  -H "Content-Type: application/json" \
  -d '{"url": "https://challenge.spotify.com/c/..."}'
```

**Using JavaScript/Node.js:**
```javascript
const response = await fetch('http://localhost:3000/solve-captcha', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://challenge.spotify.com/c/...'
  })
});

const result = await response.json();
console.log(result);
// { success: true, captchaType: 'v2', message: '...' }
```

**Using Python:**
```python
import requests

response = requests.post('http://localhost:3000/solve-captcha', json={
    'url': 'https://challenge.spotify.com/c/...'
})

result = response.json()
print(result)
```

## How It Works

### 1. CAPTCHA Detection

The service automatically detects the CAPTCHA type by inspecting the page:
- **v2 Checkbox**: iframe with `recaptcha/api2/anchor`
- **v2 Invisible**: iframe with `recaptcha/api2/bframe`
- **v3**: Checks for `grecaptcha` object

### 2. Solving Strategy

**For v2 CAPTCHAs:**

**Audio Challenge (Primary):**
1. Clicks the audio challenge button
2. Downloads the audio file
3. Transcribes using Whisper model
4. Submits the transcription

**Image Challenge (Fallback):**
1. Reads the challenge instruction (e.g., "Select all images with traffic lights")
2. Takes a screenshot of the CAPTCHA grid
3. Splits the image into individual tiles (3x3 or 4x4)
4. Analyzes each tile using:
   - **COCO-SSD** for object detection
   - **MobileNet** for image classification
5. Clicks tiles that match the target object
6. Submits the selection

**For v3 CAPTCHAs:**
- Usually automatic - just waits for token generation
- Can trigger execution if needed

### 3. ML Models Used

| Model | Purpose | Accuracy |
|-------|---------|----------|
| **COCO-SSD** | Object detection (cars, traffic lights, etc.) | ~70-80% |
| **MobileNet** | Image classification | ~60-70% |
| **Whisper Tiny** | Audio transcription | ~85-95% |

## Configuration

### Environment Variables

Create a `.env` file:
```env
PORT=3000
HEADLESS=false  # Set to true to run browser in background
```

### Headless Mode

Edit `captchaSolver.js` to run in headless mode:
```javascript
browser = await puppeteer.launch({
  headless: true, // Change this line
  // ...
});
```

### Model Configuration

You can change the models in `mlModels.js`:

```javascript
// Use different COCO-SSD base model
objectDetectionModel = await cocoSsd.load({
  base: 'lite_mobilenet_v2' // Faster but less accurate
});

// Use different MobileNet version
imageClassificationModel = await mobilenet.load({
  version: 1, // or 2
  alpha: 0.5  // 0.25, 0.5, 0.75, or 1.0
});
```

## Project Structure

```
captcha/
├── server.js              # Express API server
├── captchaSolver.js       # Main CAPTCHA solving logic
├── mlModels.js            # ML model loading and inference
├── imageProcessor.js      # Image manipulation utilities
├── audioSolver.js         # Audio transcription with Whisper
├── package.json           # Dependencies
├── .env                   # Configuration (create this)
└── temp/                  # Temporary files (auto-created)
```

## Performance & Accuracy

### Success Rates

- **v3 CAPTCHA**: ~95% (mostly automatic)
- **v2 Audio**: ~85-95% (depends on audio quality)
- **v2 Image**: ~60-75% (depends on object type)

### Common Objects Detected

Works well with:
- Traffic lights
- Cars, buses, bicycles
- Crosswalks
- Fire hydrants
- Boats
- Mountains

Less accurate with:
- Chimneys
- Stairs
- Palm trees
- Parking meters

### Speed

- Average time per CAPTCHA: 10-30 seconds
- Image challenge: 15-25 seconds
- Audio challenge: 8-15 seconds
- v3: 3-5 seconds

## Limitations

1. **Success Rate**: Not 100% - some CAPTCHAs may require multiple attempts
2. **Detection Evasion**: Google may detect automated solving attempts
3. **Model Limitations**: Pre-trained models may not recognize all object types
4. **Audio Quality**: Noisy audio can lead to transcription errors
5. **Rate Limiting**: Google may temporarily block after many solve attempts
6. **Multi-Round Challenges**: Some CAPTCHAs require multiple rounds (not fully implemented)

## Troubleshooting

### Models Not Loading

**Issue**: TensorFlow models fail to load

**Solution**:
```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Browser Won't Launch

**Issue**: Puppeteer can't launch Chrome

**Solution**:
```bash
# Manually install Chromium
node node_modules/puppeteer/install.js

# Or use system Chrome
browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});
```

### Low Accuracy

**Issue**: ML models frequently fail to detect objects

**Solutions**:
- Lower confidence threshold in `mlModels.js` (line 91)
- Try different model bases
- Add custom object mappings for your specific use case
- Consider fine-tuning models on CAPTCHA-specific datasets

### Memory Issues

**Issue**: Node.js runs out of memory

**Solution**:
```bash
# Increase Node memory limit
node --max-old-space-size=4096 server.js
```

### Audio Transcription Fails

**Issue**: Whisper model errors or slow

**Solutions**:
- Check internet connection (first download)
- Ensure sufficient disk space for model cache
- Try different Whisper model size:
  - `Xenova/whisper-tiny.en` (fastest, current)
  - `Xenova/whisper-base.en` (more accurate, slower)
  - `Xenova/whisper-small.en` (most accurate, slowest)

## Security & Legal Considerations

### Important Warnings

This tool is for **educational and authorized testing purposes only**.

**Authorized Use Cases:**
- Testing your own websites
- Authorized penetration testing with written permission
- Security research in controlled environments
- Educational demonstrations
- CTF competitions

**Prohibited Uses:**
- Bypassing CAPTCHAs on sites you don't own
- Violating terms of service
- Automated abuse, spam, or scraping
- Credential stuffing or brute force attacks
- Any unauthorized access

### Legal Risks

Automated CAPTCHA solving may violate:
- Computer Fraud and Abuse Act (CFAA) in the US
- Similar laws in other jurisdictions
- Website terms of service
- Anti-bot detection policies

**You are responsible for ensuring your use complies with applicable laws.**

## Improving Accuracy

### 1. Fine-Tune Models

Train models specifically on CAPTCHA images:
```bash
# Collect CAPTCHA dataset
# Train custom model using TensorFlow
# Replace models in mlModels.js
```

### 2. Add Custom Object Mappings

Edit `objectMatches()` in `mlModels.js`:
```javascript
const objectMappings = {
  'custom_object': ['synonym1', 'synonym2', 'variation'],
  // Add more...
};
```

### 3. Adjust Confidence Thresholds

In `mlModels.js`, line 91:
```javascript
const matchingTiles = results.filter(r =>
  r.contains && r.confidence > 0.3  // Lower = more lenient
);
```

### 4. Implement Multi-Round Logic

CAPTCHAs often require multiple rounds. Add recursive solving in `captchaSolver.js`.

## Advanced Configuration

### Use External Speech-to-Text API

If Whisper is too slow, integrate external APIs in `audioSolver.js`:

```javascript
async function transcribeWithExternalAPI(audioUrl, apiKey) {
  // Integrate Google Cloud Speech-to-Text
  // Or AssemblyAI, Deepgram, etc.
}
```

### Add Proxy Support

To avoid rate limiting:
```javascript
browser = await puppeteer.launch({
  args: [
    '--proxy-server=http://proxy.example.com:8080'
  ]
});
```

### Enable Logging

Add detailed logging for debugging:
```javascript
// In server.js
const morgan = require('morgan');
app.use(morgan('combined'));
```

## API Reference

### POST /solve-captcha

Solves a CAPTCHA at the given URL.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | Yes | Full URL of page with CAPTCHA |

**Response:**
| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Whether CAPTCHA was solved |
| captchaType | string | Type detected (v2, v2-invisible, v3) |
| message | string | Success message (if solved) |
| error | string | Error message (if failed) |

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "captcha-solver"
}
```

## Performance Optimization

### 1. Model Caching

Models are cached in memory after first load. For multiple requests, keep the service running.

### 2. Parallel Processing

For multiple URLs, send parallel requests:
```javascript
const urls = [...];
const results = await Promise.all(
  urls.map(url => fetch('/solve-captcha', {
    method: 'POST',
    body: JSON.stringify({ url })
  }))
);
```

### 3. Resource Management

Clean up models periodically:
```javascript
const { cleanupModels } = require('./mlModels');
// Call after batch processing
cleanupModels();
```

## Contributing

To improve this project:

1. **Improve model accuracy**: Train on CAPTCHA-specific datasets
2. **Add more object types**: Expand object mappings
3. **Handle edge cases**: Multi-round challenges, new CAPTCHA types
4. **Optimize performance**: Faster inference, better preprocessing
5. **Add tests**: Unit tests for ML models and solver logic

## License

ISC

## Disclaimer

This software is provided for educational and authorized testing purposes only. The developers assume no liability for misuse. Users are solely responsible for ensuring their use complies with applicable laws, regulations, and terms of service. Automated CAPTCHA solving may be illegal or violate terms of service in many contexts. Use at your own risk.

## Support

For issues or questions:
- Check troubleshooting section above
- Review code comments in source files
- Test with `headless: false` to see browser behavior
- Check console logs for detailed error messages

---

**Remember**: Always use responsibly and only on systems you own or have explicit permission to test.
