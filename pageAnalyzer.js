/**
 * Page analysis utilities for understanding CAPTCHA page structure
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Saves page HTML to a file for analysis
 */
async function savePageHTML(page, filename) {
  try {
    const html = await page.content();
    const outputPath = path.join(__dirname, 'debug', `${filename}.html`);

    // Create debug directory if it doesn't exist
    await fs.mkdir(path.join(__dirname, 'debug'), { recursive: true });

    await fs.writeFile(outputPath, html);
    console.log(`Saved page HTML to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error saving HTML:', error.message);
    return null;
  }
}

/**
 * Takes a screenshot of the page
 */
async function saveScreenshot(page, filename) {
  try {
    const outputPath = path.join(__dirname, 'debug', `${filename}.png`);

    await fs.mkdir(path.join(__dirname, 'debug'), { recursive: true });

    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(`Saved screenshot to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error saving screenshot:', error.message);
    return null;
  }
}

/**
 * Analyzes page structure and finds interactive elements
 */
async function analyzePageStructure(page) {
  try {
    const structure = await page.evaluate(() => {
      const elements = {
        buttons: [],
        inputs: [],
        iframes: [],
        forms: [],
        links: [],
        recaptchaElements: []
      };

      // Find all buttons
      document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach(btn => {
        elements.buttons.push({
          tag: btn.tagName.toLowerCase(),
          type: btn.type,
          text: btn.innerText || btn.value,
          id: btn.id,
          className: btn.className,
          visible: btn.offsetParent !== null
        });
      });

      // Find all input fields
      document.querySelectorAll('input:not([type="button"]):not([type="submit"])').forEach(input => {
        elements.inputs.push({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          value: input.value,
          visible: input.offsetParent !== null
        });
      });

      // Find all iframes
      document.querySelectorAll('iframe').forEach(iframe => {
        elements.iframes.push({
          src: iframe.src,
          id: iframe.id,
          title: iframe.title,
          visible: iframe.offsetParent !== null
        });
      });

      // Find all forms
      document.querySelectorAll('form').forEach(form => {
        elements.forms.push({
          action: form.action,
          method: form.method,
          id: form.id,
          className: form.className
        });
      });

      // Find reCAPTCHA specific elements
      document.querySelectorAll('[class*="recaptcha"], [id*="recaptcha"], [data-sitekey]').forEach(elem => {
        elements.recaptchaElements.push({
          tag: elem.tagName.toLowerCase(),
          id: elem.id,
          className: elem.className,
          sitekey: elem.getAttribute('data-sitekey'),
          text: elem.innerText?.substring(0, 100)
        });
      });

      // Find clickable links
      document.querySelectorAll('a[href]').forEach(link => {
        if (link.innerText.toLowerCase().includes('verify') ||
            link.innerText.toLowerCase().includes('continue') ||
            link.innerText.toLowerCase().includes('submit')) {
          elements.links.push({
            href: link.href,
            text: link.innerText,
            id: link.id,
            className: link.className
          });
        }
      });

      return elements;
    });

    console.log('\n=== Page Structure Analysis ===');
    console.log('Buttons found:', structure.buttons.length);
    console.log('Inputs found:', structure.inputs.length);
    console.log('iFrames found:', structure.iframes.length);
    console.log('Forms found:', structure.forms.length);
    console.log('reCAPTCHA elements found:', structure.recaptchaElements.length);
    console.log('Relevant links found:', structure.links.length);

    return structure;
  } catch (error) {
    console.error('Error analyzing page structure:', error.message);
    return null;
  }
}

/**
 * Finds and clicks the reCAPTCHA checkbox (for v2)
 */
async function findAndClickRecaptchaCheckbox(page) {
  try {
    console.log('Looking for reCAPTCHA checkbox...');

    // Wait for iframe to load
    await page.waitForSelector('iframe[src*="recaptcha"]', { timeout: 10000 });

    const frames = page.frames();
    const anchorFrame = frames.find(frame =>
      frame.url().includes('google.com/recaptcha') && frame.url().includes('anchor')
    );

    if (!anchorFrame) {
      console.log('Anchor frame not found');
      return false;
    }

    console.log('Found anchor frame:', anchorFrame.url());

    // Wait for checkbox to be available
    await anchorFrame.waitForSelector('#recaptcha-anchor', { timeout: 5000 });

    // Check if already solved
    const isChecked = await anchorFrame.evaluate(() => {
      const anchor = document.querySelector('#recaptcha-anchor');
      return anchor && anchor.getAttribute('aria-checked') === 'true';
    });

    if (isChecked) {
      console.log('✓ reCAPTCHA already solved!');
      return true;
    }

    // Click the checkbox
    await anchorFrame.click('#recaptcha-anchor');
    console.log('✓ Clicked reCAPTCHA checkbox');

    // Wait to see if challenge appears
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check again if solved
    const isSolvedNow = await anchorFrame.evaluate(() => {
      const anchor = document.querySelector('#recaptcha-anchor');
      return anchor && anchor.getAttribute('aria-checked') === 'true';
    });

    if (isSolvedNow) {
      console.log('✓ reCAPTCHA solved immediately!');
      return true;
    }

    console.log('Challenge appeared, needs solving');
    return false;
  } catch (error) {
    console.error('Error clicking checkbox:', error.message);
    return false;
  }
}

/**
 * Dumps comprehensive page information for debugging
 */
async function dumpPageInfo(page, label = 'page') {
  try {
    console.log(`\n=== Dumping page info: ${label} ===`);

    const timestamp = Date.now();

    // Save HTML
    await savePageHTML(page, `${label}-${timestamp}`);

    // Save screenshot
    await saveScreenshot(page, `${label}-${timestamp}`);

    // Analyze structure
    const structure = await analyzePageStructure(page);

    // Save structure as JSON
    const structurePath = path.join(__dirname, 'debug', `${label}-${timestamp}-structure.json`);
    await fs.writeFile(structurePath, JSON.stringify(structure, null, 2));
    console.log(`Saved structure to: ${structurePath}`);

    // Get page URL and title
    const url = page.url();
    const title = await page.title();
    console.log(`URL: ${url}`);
    console.log(`Title: ${title}`);

    return {
      html: `${label}-${timestamp}.html`,
      screenshot: `${label}-${timestamp}.png`,
      structure,
      url,
      title
    };
  } catch (error) {
    console.error('Error dumping page info:', error.message);
    return null;
  }
}

module.exports = {
  savePageHTML,
  saveScreenshot,
  analyzePageStructure,
  findAndClickRecaptchaCheckbox,
  dumpPageInfo
};
