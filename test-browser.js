/**
 * Quick test to verify browser launches correctly
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
  let browser;
  try {
    console.log('Testing browser launch...');

    browser = await puppeteer.launch({
      headless: false,
      protocolTimeout: 180000,
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

    console.log('✓ Browser launched successfully');

    const page = await browser.newPage();
    console.log('✓ New page created');

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    console.log('✓ User agent set');

    await page.goto('https://www.google.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    console.log('✓ Successfully navigated to Google');

    await new Promise(resolve => setTimeout(resolve, 2000));

    await browser.close();
    console.log('✓ Browser closed successfully');

    console.log('\n✅ Browser test passed! Puppeteer is working correctly.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Browser test failed:', error.message);
    console.error(error.stack);

    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore
      }
    }

    process.exit(1);
  }
})();
