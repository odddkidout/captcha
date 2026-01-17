/**
 * Test the CAPTCHA solver API
 */

const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000';
const CAPTCHA_URL = process.argv[2] || 'https://www.google.com/recaptcha/api2/demo';

async function testAPI() {
  console.log('Testing CAPTCHA Solver API...\n');

  // Test health endpoint
  console.log('1. Testing health endpoint...');
  try {
    const healthResponse = await fetch(`${API_URL}/health`);
    const health = await healthResponse.json();
    console.log('✓ Health check:', health);
  } catch (error) {
    console.error('✗ Health check failed:', error.message);
    console.log('\nMake sure the server is running: npm start');
    process.exit(1);
  }

  // Test solve-captcha endpoint
  console.log('\n2. Testing solve-captcha endpoint...');
  console.log(`URL: ${CAPTCHA_URL}\n`);

  try {
    const startTime = Date.now();

    const response = await fetch(`${API_URL}/solve-captcha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: CAPTCHA_URL })
    });

    const result = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`Time: ${duration}s`);
    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ CAPTCHA solved successfully!');
    } else {
      console.log('\n⚠️  CAPTCHA solving failed (this is normal, success rate is not 100%)');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('\n✗ API request failed:', error.message);
    process.exit(1);
  }
}

testAPI().catch(console.error);
