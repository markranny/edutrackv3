import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
  'https://dcepfndjsmktrfcelvgs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZXBmbmRqc21rdHJmY2VsdmdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTAwMDkxNiwiZXhwIjoyMDY2NTc2OTE2fQ.uSduSDirvbRdz5_2ySrVTp_sYPGcg6ddP6_XfMDZZKQ',
);

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: '92f59b001@smtp-brevo.com', // e.g. 92f59b001@smtp-brevo.com
    pass: 'HOApx5mCz6714YKZ', // SMTP password, not API key
  },
});

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

app.get('/api/protected-data', authenticateToken, (req, res) => {
  res.json({ message: '🔐 Protected route accessed!', user: req.user });
});
// ✅ All your route handlers stay the same from here down...

// ✅ User Signup (No Email Sending)
app.post('/api/signup', async (req, res) => {
  console.log('📦 Body received:', req.body);
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      console.error('❌ Supabase signup error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Signup successful',
      user: data.user,
    });
  } catch (err) {
    console.error('❌ Server error during signup:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/send-verification', async (req, res) => {
  const { toEmail, subject, html } = req.body;

  if (!toEmail || !subject || !html) {
    return res.status(400).json({ error: 'Missing email content fields' });
  }

  try {
    await transporter.sendMail({
      from: '"EduRetrieve" <noreply@yourdomain.com>', // you can verify a sender domain in Brevo
      to: toEmail,
      subject,
      html,
    });

    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('❌ Email send error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.get('/api/test-email', async (req, res) => {
  try {
    await resend.emails.send({
      from: 'EduRetrieve <onboarding@resend.dev>',
      to: 'your_email@gmail.com', // Replace with your real email
      subject: 'Test Email from Resend',
      html: '<strong>This is a test.</strong>',
    });
    res.send('✅ Email sent');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Failed to send test email');
  }
});

// =========================
// 📤 MODULE UPLOAD
// =========================
app.post('/upload-module', authenticateToken, upload.single('file'), async (req, res) => {
  const { title, description } = req.body;
  const file = req.file;
  const supabaseUid = req.user.id; // Supabase UID
  const userEmail = req.user.email;

  if (!title || !description) {
    return res.status(400).json({ error: 'Missing title or description' });
  }

  let fileUrl = null;
  let filePath = null;

  try {
    if (file) {
      // ✅ Only allow PDF, DOC, DOCX
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: 'Invalid file type. Only PDF, DOC, and DOCX allowed.' });
      }

      const fileExt = path.extname(file.originalname);
      filePath = `${supabaseUid}/${Date.now()}${fileExt}`;

      // 🔼 Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('eduretrieve')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        console.error('❌ Upload to storage failed:', uploadError.message);
        return res.status(500).json({ error: uploadError.message });
      }

      const { data: publicData, error: publicUrlError } = supabase.storage
        .from('eduretrieve')
        .getPublicUrl(filePath);

      if (publicUrlError) {
        console.error('❌ Public URL generation failed:', publicUrlError.message);
        return res.status(500).json({ error: publicUrlError.message });
      }

      fileUrl = publicData.publicUrl;
    }

    const moduleData = {
      title,
      description,
      uploadedBy: userEmail,
      uploadedAt: new Date().toISOString(),
      user_id: supabaseUid,
      file_url: fileUrl,
      file_path: filePath,
      file_size: file?.size || null,
    };

    const { data, error: insertError } = await supabase
      .from('modules')
      .insert([moduleData])
      .select(); // ✅ Force Supabase to return inserted rows

    if (insertError) {
      console.error('❌ Failed to insert module:', insertError.message);

      // 🧹 Clean up uploaded file if database insert fails
      if (filePath) {
        await supabase.storage.from('eduretrieve').remove([filePath]);
      }

      return res.status(500).json({ error: insertError.message });
    }

    return res.status(200).json({ message: '✅ Module uploaded successfully', data });
  } catch (err) {
    console.error('❌ Upload failed:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// =========================
// 💾 SAVE MODULE 
// =========================
app.post('/save-module', authenticateToken, async (req, res) => {
  const { module_id, title } = req.body;
  const supabaseUid = req.user.id;

  if (!module_id || !title) {
    return res.status(400).json({ error: 'Missing module_id or title' });
  }

  try {
    const { error } = await supabase.from('save_modules').insert([
      {
        user_id: supabaseUid,
        module_id,
        title,
      },
    ]);

    if (error) {
      console.error('❌ Supabase insert error (save_modules):', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json({ message: 'Module saved successfully' });
  } catch (err) {
    console.error('❌ Exception during save:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =========================
// 🗑️ UNSAVE MODULE
// =========================
app.post('/unsave-module', authenticateToken, async (req, res) => {
  const { module_id } = req.body;
  const supabaseUid = req.user?.id;

  if (!module_id) {
    return res.status(400).json({ error: 'Missing module_id' });
  }

  if (!supabaseUid) {
    return res.status(401).json({ error: 'Unauthorized user' });
  }

  try {
    const { data, error } = await supabase
      .from('save_modules')
      .delete()
      .eq('user_id', supabaseUid)
      .eq('module_id', module_id)
      .select();

    if (error) {
      console.error('❌ Supabase delete error (unsave_modules):', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Saved module not found' });
    }

    console.log(`🗑️ Unsave successful for user ${supabaseUid}, module ${module_id}`);
    res.status(200).json({ message: 'Module unsaved successfully', unsaved: data[0] });
  } catch (err) {
    console.error('❌ Exception during unsave:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =========================
// 📥 GET SAVED MODULES
// =========================
app.get('/get-saved-modules', authenticateToken, async (req, res) => {
  const supabaseUid = req.user.id;

  try {
    // Get saved module IDs for the user
    const { data: savedRows, error: fetchError } = await supabase
      .from('save_modules')
      .select('module_id')
      .eq('user_id', supabaseUid);

    if (fetchError) {
      console.error('❌ Supabase fetch error (save_modules):', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    const moduleIds = savedRows.map(row => row.module_id);

    if (moduleIds.length === 0) {
      return res.status(200).json({ modules: [] });
    }

    // Fetch full module data
    const { data: modules, error: modulesError } = await supabase
      .from('modules')
      .select('*')
      .in('id', moduleIds)
      .order('uploadedAt', { ascending: false });

    if (modulesError) {
      console.error('❌ Supabase module fetch error (modules):', modulesError);
      return res.status(500).json({ error: modulesError.message });
    }

    res.status(200).json({ modules });
  } catch (err) {
    console.error('❌ Exception in /get-saved-modules:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ DELETE MODULE + file + saved entries
app.delete('/delete-module/:id', authenticateToken, async (req, res) => {
  const moduleId = req.params.id;
  const supabaseUid = req.user?.id;

  if (!supabaseUid || !moduleId) {
    return res.status(400).json({ error: 'Missing user or module ID' });
  }

  try {
    // Step 1: Get file_path (if any)
    const { data: moduleData, error: fetchError } = await supabase
      .from('modules')
      .select('file_path')
      .eq('id', moduleId)
      .eq('user_id', supabaseUid)
      .single();

    if (fetchError) {
      console.error('❌ Module fetch failed:', fetchError.message);
      return res.status(404).json({ error: 'Module not found or unauthorized' });
    }

    const filePath = moduleData?.file_path;

    // Step 2: Delete from save_modules
    const { error: saveDeleteError } = await supabase
      .from('save_modules')
      .delete()
      .eq('module_id', moduleId)
      .eq('user_id', supabaseUid);

    if (saveDeleteError) {
      console.warn('⚠️ Failed to delete related save_modules:', saveDeleteError.message);
    }

    // Step 3: Delete from modules table
    const { error: moduleDeleteError } = await supabase
      .from('modules')
      .delete()
      .eq('id', moduleId)
      .eq('user_id', supabaseUid);

    if (moduleDeleteError) {
      throw new Error(`Failed to delete module: ${moduleDeleteError.message}`);
    }

    // Step 4: Delete file from Supabase Storage
    if (filePath) {
      const { error: storageError } = await supabase
        .storage
        .from('eduretrieve') // 🛠️ Replace with correct bucket if different
        .remove([filePath]);

      if (storageError) {
        console.warn('⚠️ Failed to delete file from storage:', storageError.message);
      }
    }

    res.status(200).json({ message: '✅ Module, saves, and file deleted successfully' });
  } catch (err) {
    console.error('❌ Delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update user profile
// ⬅ Middleware must already decode the Supabase token
// 🔐 POST /sync-user-profile
app.post('/sync-user-profile', authenticateToken, async (req, res) => {
  const supabaseUser = req.user;
  const { username = '', fullName = '', pfpUrl = '' } = req.body;

  if (!supabaseUser?.id || !supabaseUser?.email) {
    return res.status(400).json({ error: 'Missing user ID or email' });
  }

  try {
    // 🔍 Check if user profile already exists
    const { data: existing, error: fetchError } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', supabaseUser.id)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Fetch error:', fetchError.message);
      return res.status(500).json({ error: 'Error checking existing profile' });
    }

    if (!existing) {
      // ➕ Insert new user profile
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          user_id: supabaseUser.id,
          email: supabaseUser.email,
          username,
          fullName,
          pfpUrl,
        }]);

      if (insertError) {
        console.error('❌ Insert error:', insertError.message);
        return res.status(500).json({ error: 'Failed to create profile' });
      }

      return res.status(201).json({ message: '✅ Profile created successfully' });
    } else {
      // 🔁 Update existing profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          username,
          fullName,
          pfpUrl,
        })
        .eq('user_id', supabaseUser.id);

      if (updateError) {
        console.error('❌ Update error:', updateError.message);
        return res.status(500).json({ error: 'Failed to update profile' });
      }

      return res.status(200).json({ message: '✅ Profile updated successfully' });
    }
  } catch (err) {
    console.error('❌ Server error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 🔍 GET /get-user-profile
app.get('/get-user-profile', authenticateToken, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(400).json({ error: 'Missing user ID' });
  }

  try {
    const { data: profile, error } = await supabase
      .from('users')
      .select('username, fullName, pfpUrl')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('❌ Fetch error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    return res.status(200).json({ profile });
  } catch (err) {
    console.error('❌ Server error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// =========================
// 📊 USER ANALYTICS ROUTE
// =========================
app.get('/api/analytics/:uid', async (req, res) => {
  const { uid } = req.params;
  if (!uid) return res.status(400).json({ error: 'Missing user ID' });

  try {
    // Fetch uploaded and saved counts in parallel
    const [
      { count: uploadedCount, error: uploadError },
      { count: savedCount, error: savedError }
    ] = await Promise.all([
      supabase.from('modules').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('save_modules').select('*', { count: 'exact', head: true }).eq('user_id', uid)
    ]);

    if (uploadError || savedError) {
      console.error('❌ Count error:', uploadError?.message || savedError?.message);
      return res.status(500).json({ error: 'Failed to retrieve analytics counts.' });
    }

    return res.status(200).json({
      modulesUploaded: uploadedCount || 0,
      modulesSaved: savedCount || 0
    });
  } catch (err) {
    console.error('❌ Analytics fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve analytics data.' });
  }
});

app.post('/api/generate-content', authenticateToken, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt.' });

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // ✅ latest valid model
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    res.json({ generatedContent: text });
  } catch (err) {
    console.error('❌ Gemini error:', err.message);
    res.status(500).json({ error: 'AI failed to generate a response.' });
    console.log('📩 Prompt received from frontend:', prompt);
  }
});

app.post('/api/track-session', async (req, res) => {
  const { userId, durationMinutes } = req.body;
  const today = new Date().toISOString().split('T')[0];

  if (!userId || !durationMinutes) {
    return res.status(400).json({ error: 'Missing userId or duration.' });
  }

  const { data, error } = await supabase
    .from('user_sessions')
    .upsert({
      user_id: userId,
      date: today,
      duration_minutes: durationMinutes,
    }, { onConflict: ['user_id', 'date'], merge: true });

  if (error) {
    console.error('[Session Tracking Error]', error);
    return res.status(500).json({ error: 'Failed to track session.' });
  }

  res.status(200).json({ success: true });
});


// =========================
// 🏁 ROOT ROUTE
// =========================
app.get('/', (req, res) => {
  res.send('✅ EduRetrieve backend is running with Supabase Auth!');
});

// =========================
// 🚀 START SERVER
// =========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});

