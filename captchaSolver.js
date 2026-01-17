const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const { transcribeAudioFromUrl, cleanTranscription } = require('./audioSolver');
const { splitCaptchaGrid } = require('./imageProcessor');
const { analyzeCaptchaGrid } = require('./mlModels');
const { dumpPageInfo, findAndClickRecaptchaCheckbox } = require('./pageAnalyzer');

puppeteer.use(StealthPlugin());
puppeteer.use(
  RecaptchaPlugin({
    visualFeedback: true,
    throwOnError: false
  })
);

/**
 * Modern sleep function to replace deprecated page.waitForTimeout
 */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Detects the type of CAPTCHA present on the page
 */
async function detectCaptchaType(page) {
  try {
    // Wait a bit for dynamic content to load
    await sleep(1000);

    // Check for reCAPTCHA v2 checkbox
    const v2Checkbox = await page.$('iframe[src*="google.com/recaptcha/api2/anchor"]');
    if (v2Checkbox) {
      console.log('Detected: reCAPTCHA v2 (checkbox)');
      return 'v2';
    }

    // Check for reCAPTCHA v2 invisible
    const v2Invisible = await page.$('iframe[src*="google.com/recaptcha/api2/bframe"]');
    if (v2Invisible) {
      console.log('Detected: reCAPTCHA v2 (invisible)');
      return 'v2-invisible';
    }

    // Check for reCAPTCHA v3/Enterprise (multiple checks)
    const captchaInfo = await page.evaluate(() => {
      const info = {
        hasGrecaptcha: typeof grecaptcha !== 'undefined',
        hasEnterprise: typeof grecaptcha !== 'undefined' && grecaptcha.enterprise !== undefined,
        hasExecute: typeof grecaptcha !== 'undefined' && typeof grecaptcha.execute === 'function',
        hasReady: typeof grecaptcha !== 'undefined' && typeof grecaptcha.ready === 'function',
        iframes: Array.from(document.querySelectorAll('iframe')).map(f => f.src).filter(s => s.includes('recaptcha')),
        recaptchaDivs: document.querySelectorAll('[class*="recaptcha"]').length,
        recaptchaScripts: Array.from(document.querySelectorAll('script')).filter(s =>
          s.src && s.src.includes('recaptcha')
        ).map(s => s.src)
      };
      return info;
    });

    console.log('CAPTCHA detection info:', JSON.stringify(captchaInfo, null, 2));

    // Check if iframes indicate v2 (anchor + bframe = v2 Enterprise)
    const hasAnchor = captchaInfo.iframes.some(url => url.includes('anchor'));
    const hasBframe = captchaInfo.iframes.some(url => url.includes('bframe'));

    if (hasAnchor || hasBframe) {
      console.log('Detected: reCAPTCHA v2 Enterprise (via iframe detection)');
      return 'v2';
    }

    if (captchaInfo.hasGrecaptcha || captchaInfo.hasEnterprise || captchaInfo.recaptchaScripts.length > 0) {
      console.log('Detected: reCAPTCHA v3/Enterprise');
      return 'v3';
    }

    // Check for any recaptcha divs
    if (captchaInfo.recaptchaDivs > 0) {
      console.log('Detected: Generic reCAPTCHA element');
      return 'unknown';
    }

    return null;
  } catch (error) {
    console.error('Error detecting CAPTCHA type:', error);
    return null;
  }
}

/**
 * Solves reCAPTCHA v2 using audio challenge method with Whisper
 */
async function solveV2AudioChallenge(page) {
  try {
    console.log('Attempting to solve v2 CAPTCHA via audio challenge...');

    // Dump page state before clicking
    await dumpPageInfo(page, 'before-v2-click');

    // Use the helper to click checkbox
    const checkboxClicked = await findAndClickRecaptchaCheckbox(page);

    if (checkboxClicked) {
      console.log('✓ reCAPTCHA solved without challenge!');
      return true;
    }

    // Wait for challenge frame to appear
    await sleep(3000);

    // Dump page after clicking
    await dumpPageInfo(page, 'after-v2-click');

    // Get frames (support both api2 and enterprise)
    let frames = page.frames();
    const recaptchaFrame = frames.find(frame =>
      frame.url().includes('google.com/recaptcha') &&
      frame.url().includes('anchor')
    );
    const challengeFrame = frames.find(frame =>
      frame.url().includes('google.com/recaptcha') &&
      frame.url().includes('bframe')
    );

    console.log(`Found ${frames.length} frames total`);
    console.log(`Anchor frame: ${recaptchaFrame ? 'found' : 'NOT FOUND'}`);
    console.log(`Challenge frame: ${challengeFrame ? 'found' : 'NOT FOUND'}`);

    if (!challengeFrame) {
      // Check if already solved
      if (recaptchaFrame) {
        const isSolved = await recaptchaFrame.evaluate(() => {
          const anchor = document.querySelector('#recaptcha-anchor');
          return anchor && anchor.getAttribute('aria-checked') === 'true';
        });

        if (isSolved) {
          console.log('CAPTCHA solved immediately (no challenge required)');
          return true;
        }
      }

      throw new Error('Could not find reCAPTCHA challenge frame');
    }

    // Wait for challenge to load
    await sleep(1000);

    // Check if audio button exists
    const hasAudioButton = await challengeFrame.$('#recaptcha-audio-button');
    if (!hasAudioButton) {
      console.log('Audio button not found, might be image-only challenge');
      throw new Error('Audio challenge not available');
    }

    // Click audio challenge button
    await challengeFrame.click('#recaptcha-audio-button');
    console.log('Clicked audio challenge button');
    await sleep(3000); // Give more time for audio to load

    // Dump challenge state to debug
    await dumpPageInfo(page, 'audio-challenge');

    // Get audio URL with multiple selectors
    const audioUrl = await challengeFrame.evaluate(() => {
      // Try multiple selectors
      let audioElement = document.querySelector('#audio-source');
      if (!audioElement) audioElement = document.querySelector('audio source');
      if (!audioElement) audioElement = document.querySelector('audio');
      if (!audioElement) audioElement = document.querySelector('[id*="audio"]');

      if (audioElement) {
        // Try multiple ways to get the URL
        return audioElement.src || audioElement.currentSrc || audioElement.getAttribute('src');
      }

      // Debug: log all audio-related elements
      const audioElements = document.querySelectorAll('audio, source, [id*="audio"], [class*="audio"]');
      console.log('Found audio-related elements:', audioElements.length);
      Array.from(audioElements).forEach(el => {
        console.log('Element:', el.tagName, el.id, el.className, el.src);
      });

      return null;
    });

    if (!audioUrl) {
      console.log('Could not find audio source - checking challenge frame HTML');

      // Get frame HTML for debugging
      const frameHTML = await challengeFrame.evaluate(() => {
        return document.body.innerHTML.substring(0, 1000); // First 1000 chars
      });
      console.log('Challenge frame HTML preview:', frameHTML);

      throw new Error('Could not find audio source');
    }

    console.log('Found audio URL, transcribing...');

    // Transcribe audio using Whisper
    const transcription = await transcribeAudioFromUrl(audioUrl);
    const cleanedText = cleanTranscription(transcription);

    console.log(`Transcribed text: "${cleanedText}"`);

    // Enter the transcription
    await challengeFrame.type('#audio-response', cleanedText);
    await challengeFrame.click('#recaptcha-verify-button');

    await sleep(3000);

    // Verify if solved
    const isSolved = await recaptchaFrame.evaluate(() => {
      const anchor = document.querySelector('#recaptcha-anchor');
      return anchor && anchor.getAttribute('aria-checked') === 'true';
    });

    if (isSolved) {
      console.log('✓ Audio challenge solved successfully!');
    } else {
      console.log('✗ Audio challenge failed');
    }

    return isSolved;
  } catch (error) {
    console.error('Error solving v2 audio challenge:', error.message);
    return false;
  }
}

/**
 * Extracts the target object from CAPTCHA challenge text
 */
function extractTargetObject(challengeText) {
  const text = challengeText.toLowerCase().replace(/\n/g, ' ');

  // Common patterns in reCAPTCHA challenges
  const patterns = [
    /select all (?:images|squares) with (?:a |an |the )?(.+?)(?:\s*click|$)/,
    /click on all images containing (?:a |an |the )?(.+?)(?:\s*click|$)/,
    /select all squares with (?:a |an |the )?(.+?)(?:\s*click|$)/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Remove trailing punctuation and "click verify" text
      return extracted.replace(/[.,\s]*click.*$/, '').trim();
    }
  }

  // Fallback: look for common objects directly
  const commonObjects = [
    'fire hydrant', 'traffic light', 'parking meter',  // Multi-word first
    'car', 'bus', 'bicycle', 'motorcycle',
    'crosswalk', 'stairs', 'chimney', 'bridge',
    'boat', 'mountain', 'palm tree', 'taxi'
  ];

  for (const obj of commonObjects) {
    if (text.includes(obj)) {
      return obj;
    }
  }

  return null;
}

/**
 * Solves reCAPTCHA v2 using image challenge method with ML
 */
async function solveV2ImageChallenge(page) {
  try {
    console.log('Attempting to solve v2 CAPTCHA via image challenge...');

    // Wait for the recaptcha iframe (support both api2 and enterprise)
    await page.waitForSelector('iframe[src*="google.com/recaptcha"]', {
      timeout: 10000
    });

    let frames = page.frames();
    const recaptchaFrame = frames.find(frame =>
      frame.url().includes('google.com/recaptcha') &&
      frame.url().includes('anchor')
    );

    if (!recaptchaFrame) {
      throw new Error('Could not find reCAPTCHA anchor frame');
    }

    // Click the checkbox
    await recaptchaFrame.click('#recaptcha-anchor');
    console.log('Clicked reCAPTCHA checkbox');
    await sleep(3000);

    // Check if solved immediately
    const isSolvedImmediately = await recaptchaFrame.evaluate(() => {
      const anchor = document.querySelector('#recaptcha-anchor');
      return anchor && anchor.getAttribute('aria-checked') === 'true';
    });

    if (isSolvedImmediately) {
      console.log('CAPTCHA solved immediately (no challenge required)');
      return true;
    }

    // Get challenge frame (support both api2 and enterprise)
    frames = page.frames();
    const challengeFrame = frames.find(frame =>
      frame.url().includes('google.com/recaptcha') &&
      frame.url().includes('bframe')
    );

    if (!challengeFrame) {
      throw new Error('Could not find reCAPTCHA challenge frame');
    }

    await sleep(2000);

    // Get challenge text to determine what to look for
    const challengeText = await challengeFrame.evaluate(() => {
      const instruction = document.querySelector('.rc-imageselect-instructions');
      return instruction ? instruction.innerText : '';
    });

    console.log(`Challenge: ${challengeText}`);

    const targetObject = extractTargetObject(challengeText);
    if (!targetObject) {
      throw new Error('Could not determine target object from challenge text');
    }

    console.log(`Target object: ${targetObject}`);

    // Get the CAPTCHA grid size
    const gridSize = await challengeFrame.evaluate(() => {
      const table = document.querySelector('.rc-imageselect-table-3x3');
      if (table) return 3;
      const table4x4 = document.querySelector('.rc-imageselect-table-4x4');
      if (table4x4) return 4;
      return 3; // default
    });

    console.log(`Grid size: ${gridSize}x${gridSize}`);

    // Take screenshot of the challenge image
    const imageElement = await challengeFrame.$('.rc-image-tile-wrapper');
    if (!imageElement) {
      throw new Error('Could not find CAPTCHA image');
    }

    const imageBuffer = await imageElement.screenshot();

    // Save full challenge image for debugging
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const timestamp = Date.now();
      const debugPath = path.join(__dirname, 'debug', `full-challenge-${timestamp}.png`);
      await fs.writeFile(debugPath, imageBuffer);
      console.log(`Saved full challenge image to: ${debugPath}`);
    } catch (err) {
      console.error('Error saving challenge image:', err.message);
    }

    // Split into tiles and analyze with ML
    const tiles = await splitCaptchaGrid(imageBuffer, gridSize);
    const analysis = await analyzeCaptchaGrid(tiles, targetObject);

    if (analysis.matchingTiles.length === 0) {
      console.log('No matching tiles found, clicking verify to skip');
      await challengeFrame.click('#recaptcha-verify-button');
      await sleep(2000);
      return false;
    }

    // Click on matching tiles
    console.log(`Clicking ${analysis.matchingTiles.length} tiles...`);

    for (const tile of analysis.matchingTiles) {
      const tileSelector = `.rc-imageselect-tile[tabindex="${tile.index}"]`;
      try {
        await challengeFrame.click(tileSelector);
        console.log(`Clicked tile ${tile.index} (confidence: ${(tile.confidence * 100).toFixed(1)}%)`);
        await sleep(300);
      } catch (clickError) {
        console.warn(`Failed to click tile ${tile.index}:`, clickError.message);
      }
    }

    // Click verify
    await sleep(1000);
    await challengeFrame.click('#recaptcha-verify-button');
    console.log('Clicked verify button');
    await sleep(3000);

    // Check if solved
    const isSolved = await recaptchaFrame.evaluate(() => {
      const anchor = document.querySelector('#recaptcha-anchor');
      return anchor && anchor.getAttribute('aria-checked') === 'true';
    });

    if (isSolved) {
      console.log('✓ Image challenge solved successfully!');
    } else {
      console.log('✗ Image challenge failed - may need another round');

      // Sometimes CAPTCHA requires multiple rounds
      // You could implement recursive logic here
    }

    return isSolved;
  } catch (error) {
    console.error('Error solving v2 image challenge:', error.message);
    return false;
  }
}

/**
 * Handles reCAPTCHA v3 (usually automatic)
 */
async function handleV3Captcha(page) {
  try {
    console.log('Handling v3 CAPTCHA...');

    // Check multiple times for token generation
    for (let attempt = 0; attempt < 5; attempt++) {
      console.log(`Checking for v3 token (attempt ${attempt + 1}/5)...`);

      const hasToken = await page.evaluate(() => {
        // Check for token in multiple locations
        const token1 = document.querySelector('[name="g-recaptcha-response"]');
        const token2 = document.getElementById('g-recaptcha-response');
        const token3 = document.querySelector('textarea[name="g-recaptcha-response"]');

        return (token1 && token1.value && token1.value.length > 0) ||
               (token2 && token2.value && token2.value.length > 0) ||
               (token3 && token3.value && token3.value.length > 0);
      });

      if (hasToken) {
        console.log('✓ v3 CAPTCHA token generated successfully');
        return true;
      }

      // Try to trigger v3 execution on first attempt
      if (attempt === 0) {
        await page.evaluate(() => {
          try {
            // Try different methods to trigger reCAPTCHA v3
            if (typeof grecaptcha !== 'undefined') {
              // Method 1: Direct execute
              if (grecaptcha.execute) {
                const siteKey = document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey') ||
                                document.querySelector('.g-recaptcha')?.getAttribute('data-sitekey');
                if (siteKey) {
                  console.log('Triggering v3 with sitekey:', siteKey);
                  grecaptcha.execute(siteKey);
                }
              }

              // Method 2: Ready callback
              if (grecaptcha.ready) {
                grecaptcha.ready(() => {
                  const siteKey = document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey');
                  if (siteKey && grecaptcha.execute) {
                    grecaptcha.execute(siteKey);
                  }
                });
              }
            }
          } catch (e) {
            console.log('Error triggering v3:', e);
          }
        });
        console.log('Triggered v3 execution');
      }

      await sleep(2000);
    }

    console.log('✗ v3 token not found after 5 attempts');
    return false;
  } catch (error) {
    console.error('Error handling v3 CAPTCHA:', error);
    return false;
  }
}

/**
 * Main function to solve CAPTCHA
 */
async function solveCaptcha(url) {
  let browser;

  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // Set to true in production
      protocolTimeout: 180000, // Increase timeout to 3 minutes
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      dumpio: false
    });

    const page = await browser.newPage();

    // Increase default timeout
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    // Set user agent to avoid detection
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait a bit for CAPTCHA to load
    await sleep(3000);

    // Dump initial page info for debugging
    console.log('\n=== Dumping initial page state ===');
    await dumpPageInfo(page, 'initial-load');

    // Detect CAPTCHA type
    const captchaType = await detectCaptchaType(page);

    if (!captchaType) {
      await browser.close();
      return {
        success: false,
        error: 'No CAPTCHA detected on the page',
        captchaType: null
      };
    }

    let solved = false;

    // Attempt to solve based on type
    if (captchaType === 'v2' || captchaType === 'v2-invisible') {
      // Try image challenge first (audio challenge triggers bot detection on some sites)
      try {
        solved = await solveV2ImageChallenge(page);
      } catch (imageError) {
        console.log('Image challenge failed, trying audio challenge...');
        console.log('Error:', imageError.message);
        solved = await solveV2AudioChallenge(page);
      }
    } else if (captchaType === 'v3') {
      solved = await handleV3Captcha(page);
    }

    // If solved, try to submit the form
    if (solved) {
      console.log('CAPTCHA solved! Attempting to submit...');

      // Look for submit button and click it
      const submitButton = await page.$('button[type="submit"], input[type="submit"]');
      if (submitButton) {
        await submitButton.click();
        console.log('Clicked submit button');
        await sleep(2000);
      }

      // Wait for navigation or success indicator
      try {
        await page.waitForNavigation({ timeout: 5000, waitUntil: 'networkidle2' });
      } catch (e) {
        // Navigation might not happen, that's okay
      }

      await browser.close();
      return {
        success: true,
        captchaType,
        message: 'CAPTCHA solved and submitted successfully'
      };
    } else {
      await browser.close();
      return {
        success: false,
        captchaType,
        error: 'Failed to solve CAPTCHA'
      };
    }
  } catch (error) {
    console.error('Error in solveCaptcha:', error.message);

    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError.message);
      }
    }

    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      captchaType: null
    };
  }
}

module.exports = { solveCaptcha };
