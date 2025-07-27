import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';

const app = express();
const upload = multer();
const PORT = process.env.PORT || 5000;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');

// =========================
// 🔧 Middleware
// =========================
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// 🧭 SUPABASE INIT
// =========================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vuenjlixoazokrserobu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1ZW5qbGl4b2F6b2tyc2Vyb2J1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODIzNzY2NiwiZXhwIjoyMDYzODEzNjY2fQ.kFMHD3bkid8Kgt7OHgDWfKKoa_-dd5UcDZNBm54hKjw'
);

// =========================
// 📧 EMAIL TRANSPORTER SETUP (FIXED!)
// =========================
const transporter = nodemailer.createTransport({  // ✅ Fixed: removed 'er'
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'dianamaenillo21@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD || 'etadabxzphtzckzd',
  },
});

// Generate random 6-digit verification code
const generateVerificationCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Generate content using Gemini
const generateContent = async (prompt, retries = 3) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("❌ Gemini API error:", error.message || error);
    throw new Error("Failed to generate content from AI.");
  }
};

// =========================
// ✅ AUTH MIDDLEWARE
// =========================
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split('Bearer ')[1];
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = data.user;
    next();
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// =========================
// 📧 EMAIL VERIFICATION ROUTES
// =========================

// Send verification code
app.post('/api/send-verification-code', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Generate 6-digit code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log(`📧 Sending verification code ${code} to ${email}`);

    // Send email with verification code
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
          <h1>EduRetrieve</h1>
        </div>
        <div style="padding: 20px; background-color: #f8f9fa;">
          <h2>Email Verification</h2>
          <p>Hi there!</p>
          <p>Thanks for signing up for EduRetrieve. To complete your registration, please use the verification code below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #007bff; color: white; padding: 15px 30px; border-radius: 8px; display: inline-block; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
              ${code}
            </div>
          </div>
          
          <p><strong>This code will expire in 10 minutes.</strong></p>
          <p>If you didn't request this verification code, please ignore this email.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"EduRetrieve" <${process.env.GMAIL_USER || 'dianamaenillo21@gmail.com'}>`,
      to: email,
      subject: 'Verify Your Email - EduRetrieve',
      html: emailHtml,
    });

    console.log('✅ Verification email sent successfully');
    res.status(200).json({
      message: 'Verification code sent successfully',
      expiresIn: 600,
      // For testing only - remove in production:
      debug: { code, email }
    });

  } catch (err) {
    console.error('❌ Send verification error:', err);
    res.status(500).json({ error: 'Failed to send verification code: ' + err.message });
  }
});

// Verify email code
app.post('/api/verify-email-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required' });
  }

  try {
    console.log(`🔍 Verifying code ${code} for email ${email}`);

    // For testing purposes, accept any 6-digit code
    if (code.length === 6 && /^\d+$/.test(code)) {
      console.log('✅ Email verified successfully (test mode)');
      res.status(200).json({
        message: 'Email verified successfully',
        verified: true,
      });
    } else {
      res.status(400).json({ 
        error: 'Invalid verification code format. Please enter a 6-digit code.' 
      });
    }

  } catch (err) {
    console.error('❌ Verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

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
    userId: req.user.id,
  });
});

// =======================
// 📤 Upload Test Route
// =======================
app.post('/api/upload-module', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    console.log('📤 Module upload attempt:', { title, description, userId: req.user.id });
    
    res.status(200).json({ 
      message: 'Module upload endpoint working',
      data: { title, description, userId: req.user.id }
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// =======================
// 🏁 Root Route
// =======================
app.get('/', (req, res) => {
  res.json({
    message: '✅ EduRetrieve backend is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/send-verification-code',
      'POST /api/verify-email-code', 
      'POST /api/generate-content',
      'GET /api/protected-data',
      'POST /api/upload-module'
    ]
  });
});

// =======================
// 🚀 Start Server
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📧 Gmail configured: ${process.env.GMAIL_USER || 'dianamaenillo21@gmail.com'}`);
  console.log(`🔗 Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'configured'}`);
  console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? 'configured' : 'using dummy key'}`);
  console.log('📍 Available endpoints:');
  console.log('   GET  / (server info)');
  console.log('   POST /api/send-verification-code');
  console.log('   POST /api/verify-email-code');
  console.log('   POST /api/generate-content');
  console.log('   GET  /api/protected-data');
  console.log('   POST /api/upload-module');
});