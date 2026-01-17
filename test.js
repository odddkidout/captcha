/**
 * Simple test to verify the CAPTCHA solver components work
 */

console.log('Testing CAPTCHA Solver Components...\n');

// Test 1: Load ML Models
console.log('1. Testing ML Models...');
(async () => {
  try {
    const { loadObjectDetectionModel, loadImageClassificationModel } = require('./mlModels');

    console.log('   Loading COCO-SSD...');
    await loadObjectDetectionModel();
    console.log('   ✓ COCO-SSD loaded successfully');

    console.log('   Loading MobileNet...');
    await loadImageClassificationModel();
    console.log('   ✓ MobileNet loaded successfully');

    console.log('\n2. Testing Image Processor...');
    const { preprocessImage } = require('./imageProcessor');
    const testBuffer = Buffer.alloc(100);
    console.log('   ✓ Image processor module loaded');

    console.log('\n3. Testing Audio Solver...');
    const { loadWhisperModel } = require('./audioSolver');
    console.log('   Note: Whisper model will download on first use (~40MB)');
    console.log('   ✓ Audio solver module loaded');

    console.log('\n4. Testing CAPTCHA Solver...');
    const { solveCaptcha } = require('./captchaSolver');
    console.log('   ✓ CAPTCHA solver module loaded');

    console.log('\n5. Testing Server...');
    const server = require('./server');
    console.log('   ✓ Server module loaded');

    console.log('\n✓ All components loaded successfully!');
    console.log('\nYou can now start the service with: npm start');
    console.log('Then test with a POST request to http://localhost:3000/solve-captcha');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
