// ===================================
// BACKEND: Enhanced server.js with Google OAuth
// ===================================

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Google OAuth2 Client Setup
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NEXTAUTH_URL || 'http://localhost:3000/auth/callback'
);

// =========================
// ✅ MIDDLEWARE SETUP
// =========================
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// =========================
// 🧭 SUPABASE INIT
// =========================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dcepfndjsmktrfcelvgs.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZXBmbmRqc21rdHJmY2VsdmdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTAwMDkxNiwiZXhwIjoyMDY2NTc2OTE2fQ.uSduSDirvbRdz5_2ySrVTp_sYPGcg6ddP6_XfMDZZKQ'
);

// =========================
// 📧 EMAIL TRANSPORTER
// =========================
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// In-memory storage for verification codes (use Redis in production)
const verificationCodes = new Map();

// Generate random 6-digit verification code
const generateVerificationCode = () => {
  return crypto.randomInt(100000, 999999).toString();
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
// 🔐 GOOGLE OAUTH ROUTES
// =========================

// Step 1: Initiate Google OAuth signup
app.post('/api/auth/google/signup', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Generate authorization URL
    const authUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      state: JSON.stringify({ email, action: 'signup' }),
      prompt: 'consent'
    });

    res.status(200).json({
      message: 'Redirect to Google for authorization',
      authUrl,
      email
    });
  } catch (error) {
    console.error('❌ Google OAuth URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate Google auth URL' });
  }
});

// Step 2: Handle Google OAuth callback
app.post('/api/auth/google/callback', async (req, res) => {
  const { code, state } = req.body;

  if (!code || !state) {
    return res.status(400).json({ error: 'Missing authorization code or state' });
  }

  try {
    // Parse state to get original email and action
    const { email: originalEmail, action } = JSON.parse(state);

    // Exchange authorization code for tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Get user info from Google
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

    const googleUserInfo = await response.json();
    
    // Verify the email matches
    if (googleUserInfo.email !== originalEmail) {
      return res.status(400).json({
        error: 'Email mismatch. Please use the same email address.'
      });
    }

    if (!googleUserInfo.verified_email) {
      return res.status(400).json({
        error: 'Google email is not verified. Please verify your email with Google first.'
      });
    }

    // Generate verification code for our system
    const verificationCode = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store verification data temporarily
    verificationCodes.set(originalEmail, {
      code: verificationCode,
      expiresAt,
      googleUserInfo,
      action
    });

    // Send verification email with the code
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
          <h1>EduRetrieve</h1>
        </div>
        <div style="padding: 20px; background-color: #f8f9fa;">
          <h2>Complete Your Registration</h2>
          <p>Hi ${googleUserInfo.name}!</p>
          <p>Your Google account has been verified successfully. To complete your EduRetrieve registration, please enter this verification code:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #007bff; color: white; padding: 15px 30px; border-radius: 8px; display: inline-block; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
              ${verificationCode}
            </div>
          </div>
          
          <p><strong>This code will expire in 10 minutes.</strong></p>
          <p>Google Account Details:</p>
          <ul>
            <li>Email: ${googleUserInfo.email}</li>
            <li>Name: ${googleUserInfo.name}</li>
            <li>Verified: ✅</li>
          </ul>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"EduRetrieve" <${process.env.GMAIL_USER}>`,
      to: originalEmail,
      subject: 'Complete Your EduRetrieve Registration',
      html: emailHtml,
    });

    // Clean up expired codes
    setTimeout(() => {
      verificationCodes.delete(originalEmail);
    }, 10 * 60 * 1000);

    res.status(200).json({
      message: 'Google verification successful. Check your email for the final verification code.',
      email: originalEmail,
      name: googleUserInfo.name,
      googleVerified: true,
      codeExpires: new Date(expiresAt).toISOString()
    });

  } catch (error) {
    console.error('❌ Google OAuth callback error:', error);
    res.status(500).json({ 
      error: 'Failed to process Google authentication',
      details: error.message 
    });
  }
});

// Step 3: Verify the final code and complete signup
app.post('/api/auth/verify-signup-code', async (req, res) => {
  const { email, code, password } = req.body;

  if (!email || !code || !password) {
    return res.status(400).json({ 
      error: 'Email, verification code, and password are required' 
    });
  }

  try {
    // Check if verification code exists and is valid
    const verificationData = verificationCodes.get(email);

    if (!verificationData) {
      return res.status(400).json({ 
        error: 'Verification code expired or not found. Please restart the signup process.' 
      });
    }

    if (Date.now() > verificationData.expiresAt) {
      verificationCodes.delete(email);
      return res.status(400).json({ 
        error: 'Verification code has expired. Please restart the signup process.' 
      });
    }

    if (verificationData.code !== code) {
      return res.status(400).json({ 
        error: 'Invalid verification code. Please check and try again.' 
      });
    }

    // Create Supabase user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: verificationData.googleUserInfo.name,
          avatar_url: verificationData.googleUserInfo.picture,
          google_verified: true,
          google_id: verificationData.googleUserInfo.id
        }
      }
    });

    if (authError) {
      console.error('❌ Supabase signup error:', authError.message);
      return res.status(400).json({ error: authError.message });
    }

    // Create user profile in custom users table
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert([{
          user_id: authData.user.id,
          email: email,
          username: verificationData.googleUserInfo.given_name || email.split('@')[0],
          fullName: verificationData.googleUserInfo.name,
          pfpUrl: verificationData.googleUserInfo.picture || '',
          google_verified: true,
          google_id: verificationData.googleUserInfo.id,
          created_at: new Date().toISOString()
        }]);

      if (profileError) {
        console.warn('⚠️ Profile creation warning:', profileError.message);
      }
    }

    // Clean up verification data
    verificationCodes.delete(email);

    res.status(200).json({
      message: 'Signup completed successfully!',
      user: {
        id: authData.user?.id,
        email: authData.user?.email,
        fullName: verificationData.googleUserInfo.name,
        avatar: verificationData.googleUserInfo.picture,
        googleVerified: true
      },
      session: authData.session
    });

  } catch (error) {
    console.error('❌ Signup verification error:', error);
    res.status(500).json({ 
      error: 'Failed to complete signup',
      details: error.message 
    });
  }
});

// =========================
// 🔍 VERIFICATION STATUS CHECK
// =========================
app.post('/api/auth/check-verification-status', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const verificationData = verificationCodes.get(email);

  if (!verificationData) {
    return res.status(404).json({ 
      hasVerification: false,
      message: 'No pending verification found' 
    });
  }

  if (Date.now() > verificationData.expiresAt) {
    verificationCodes.delete(email);
    return res.status(410).json({ 
      hasVerification: false,
      message: 'Verification expired' 
    });
  }

  res.status(200).json({
    hasVerification: true,
    email,
    name: verificationData.googleUserInfo?.name,
    expiresAt: new Date(verificationData.expiresAt).toISOString(),
    timeRemaining: Math.max(0, verificationData.expiresAt - Date.now())
  });
});

// =========================
// 📤 EXISTING ROUTES (keeping your current functionality)
// =========================

// Your existing routes go here...
// [Keep all your existing upload, save, analytics routes as they are]

// =========================
// 🏁 ROOT ROUTE
// =========================
app.get('/', (req, res) => {
  res.json({
    message: '✅ EduRetrieve backend with Google OAuth is running!',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/auth/google/signup - Initiate Google OAuth signup',
      'POST /api/auth/google/callback - Handle Google OAuth callback',
      'POST /api/auth/verify-signup-code - Complete signup with verification code',
      'POST /api/auth/check-verification-status - Check verification status'
    ]
  });
});

// =========================
// 🚀 START SERVER
// =========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🔐 Google OAuth Client ID: ${process.env.GOOGLE_CLIENT_ID ? 'configured' : 'missing'}`);
  console.log(`📧 Gmail configured: ${process.env.GMAIL_USER || 'missing'}`);
  console.log(`🗄️ Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing'}`);
});