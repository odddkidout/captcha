const express = require('express');
const cors = require('cors');
const { solveCaptcha } = require('./captchaSolver');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/solve-captcha', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    console.log(`Received request to solve CAPTCHA for: ${url}`);

    const result = await solveCaptcha(url);

    res.json(result);
  } catch (error) {
    console.error('Error solving CAPTCHA:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'captcha-solver' });
});

app.listen(PORT, () => {
  console.log(`CAPTCHA Solver Service running on port ${PORT}`);
  console.log(`POST /solve-captcha - Submit URL to solve CAPTCHA`);
  console.log(`GET /health - Health check`);
});
