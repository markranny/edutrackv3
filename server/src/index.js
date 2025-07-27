require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authenticateToken = require('./middleware/authMiddleware');
const uploadController = require('./controllers/uploadController');
const moduleModel = require('./model/moduleModel');
const { generateContent } = require('./model/Model.js');
const chatRoutes = require('./routes/chatRoutes');
const checkEmailRoute = require('./routes/authRoutes.js');
const analyticsRoutes = require('./routes/analyticsRoute.js');

const app = express();
const PORT = process.env.PORT || 5000;

// =======================
// 🔧 Middleware
// =======================
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// 🤖 AI Generation Endpoint
// =======================
app.post('/api/generate-content', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  try {
    const content = await generateContent(prompt);
    res.status(200).json({ generatedContent: content });
  } catch (error) {
    console.error('❌ Gemini API Error:', error);
    res.status(503).json({ error: 'Failed to generate content. Please try again later.' });
  }
});

// =======================
// 🔐 Protected Test Route
// =======================
app.get('/api/protected-data', authenticateToken, (req, res) => {
  res.status(200).json({
    message: 'Welcome to the protected area!',
    userEmail: req.user.email,
    userId: req.user.uid,
  });
});

// =======================
// 📤 Module Upload
// =======================
app.post('/api/upload-module', authenticateToken, uploadController.uploadModule);

// =======================
// 📚 Fetch All Modules
// =======================
app.get('/api/modules', authenticateToken, async (req, res) => {
  try {
    const modules = await moduleModel.getAllModules();
    res.status(200).json(modules);
  } catch (error) {
    console.error('❌ Fetch Modules Error:', error);
    res.status(500).json({ error: 'Error fetching modules.' });
  }
});

// =======================
// 📦 Routes
// =======================
app.use('/api/chat', chatRoutes);
app.use('/api/reset-password', checkEmailRoute);
app.use('/api/analytics', analyticsRoutes);

// =======================
// 🏁 Root Route
// =======================
app.get('/', (req, res) => {
  res.send('✅ EduRetrieve backend is up and running!');
});

// =======================
// 🚀 Start Server
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
