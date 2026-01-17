const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { pipeline } = require('@xenova/transformers');

// Cache for the Whisper model
let whisperModel = null;

/**
 * Loads the Whisper model for speech recognition
 */
async function loadWhisperModel() {
  if (whisperModel) {
    return whisperModel;
  }

  try {
    console.log('Loading Whisper model (this may take a while on first run)...');

    // Use the Xenova Transformers library for Whisper
    whisperModel = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en'
    );

    console.log('Whisper model loaded successfully');
    return whisperModel;
  } catch (error) {
    console.error('Error loading Whisper model:', error);
    throw error;
  }
}

/**
 * Downloads audio file from URL
 */
async function downloadAudio(url, outputPath) {
  try {
    console.log(`Downloading audio from: ${url}`);

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    await fs.writeFile(outputPath, Buffer.from(response.data));
    console.log(`Audio saved to: ${outputPath}`);

    return outputPath;
  } catch (error) {
    console.error('Error downloading audio:', error.message);
    throw error;
  }
}

/**
 * Transcribes audio file using Whisper
 */
async function transcribeAudio(audioPath) {
  try {
    const model = await loadWhisperModel();

    console.log('Transcribing audio...');
    const result = await model(audioPath);

    const transcription = result.text.trim();
    console.log(`Transcription: "${transcription}"`);

    return transcription;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

/**
 * Downloads and transcribes audio from URL
 */
async function transcribeAudioFromUrl(audioUrl) {
  const tempDir = path.join(__dirname, 'temp');
  const audioPath = path.join(tempDir, `audio_${Date.now()}.mp3`);

  try {
    // Create temp directory if it doesn't exist
    await fs.mkdir(tempDir, { recursive: true });

    // Download audio
    await downloadAudio(audioUrl, audioPath);

    // Transcribe
    const transcription = await transcribeAudio(audioPath);

    // Clean up
    try {
      await fs.unlink(audioPath);
    } catch (cleanupError) {
      console.warn('Failed to clean up audio file:', cleanupError.message);
    }

    return transcription;
  } catch (error) {
    // Clean up on error
    try {
      await fs.unlink(audioPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    throw error;
  }
}

/**
 * Cleans up transcription text for CAPTCHA submission
 * Removes punctuation, extra spaces, etc.
 */
function cleanTranscription(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Normalize spaces
    .trim();
}

/**
 * Alternative: Transcribe using external API (if Whisper fails)
 * This is a fallback option
 */
async function transcribeWithExternalAPI(audioUrl, apiKey, service = 'google') {
  // Placeholder for external API integration
  // You can integrate Google Speech-to-Text, AssemblyAI, etc.

  console.log(`External API transcription not implemented. Service: ${service}`);
  throw new Error('External API transcription not implemented');
}

module.exports = {
  loadWhisperModel,
  downloadAudio,
  transcribeAudio,
  transcribeAudioFromUrl,
  cleanTranscription,
  transcribeWithExternalAPI
};
