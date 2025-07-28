import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

function EnhancedSignup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Multi-step state management
  const [currentStep, setCurrentStep] = useState('email'); // 'email', 'google-auth', 'verification', 'password'
  const [googleVerified, setGoogleVerified] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const navigate = useNavigate();

  // Timer for verification code expiry
  useEffect(() => {
    let timer;
    if (timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1000) {
            setCurrentStep('email');
            setMessage('Verification code expired. Please start over.');
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Format time remaining
  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Step 1: Handle email submission and Google OAuth initiation
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      // Initiate Google OAuth signup
      const response = await fetch('http://localhost:5000/api/auth/google/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to initiate Google OAuth');
      }

      // Redirect to Google OAuth
      setMessage('Redirecting to Google for verification...');
      window.location.href = result.authUrl;

    } catch (err) {
      console.error('❌ Email submit error:', err);
      setError(err.message || 'Failed to start signup process');
    } finally {
      setLoading(false);
    }
  };

  // Check for OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      handleGoogleCallback(code, state);
    }
  }, []);

  // Step 2: Handle Google OAuth callback
  const handleGoogleCallback = async (code, state) => {
    setLoading(true);
    setMessage('Processing Google verification...');

    try {
      const response = await fetch('http://localhost:5000/api/auth/google/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Google verification failed');
      }

      // Google verification successful
      setGoogleVerified(true);
      setUserInfo({ email: result.email, name: result.name });
      setEmail(result.email);
      setCurrentStep('verification');
      setTimeRemaining(10 * 60 * 1000); // 10 minutes
      setMessage(`Verification code sent to ${result.email}. Please check your inbox.`);

      // Clear URL parameters
      window.history.replaceState({}, document.title, '/signup');

    } catch (err) {
      console.error('❌ Google callback error:', err);
      setError(err.message || 'Google verification failed');
      setCurrentStep('email');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Handle verification code submission
  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      setLoading(false);
      return;
    }

    try {
      // Check verification status first
      const statusResponse = await fetch('http://localhost:5000/api/auth/check-verification-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!statusResponse.ok) {
        throw new Error('Verification session expired. Please start over.');
      }

      setCurrentStep('password');
      setMessage('Verification successful! Please set your password.');

    } catch (err) {
      console.error('❌ Verification error:', err);
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Handle final signup with password
  const handleFinalSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate passwords
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // Complete signup with verification code and password
      const response = await fetch('http://localhost:5000/api/auth/verify-signup-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: verificationCode,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Signup failed');
      }

      setMessage('Signup successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      console.error('❌ Final signup error:', err);
      setError(err.message || 'Failed to complete signup');
    } finally {
      setLoading(false);
    }
  };

  // Reset to start over
  const handleStartOver = () => {
    setCurrentStep('email');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setError('');
    setMessage('');
    setGoogleVerified(false);
    setUserInfo(null);
    setTimeRemaining(0);
  };

  return (
    <div className="auth-container">
      <img src="/assets/eduretrieve-logo.png" alt="logo" className="auth-container-img" />
      <div className="auth-form-card">
        <div className="auth-header-flex">
          <h2>Sign Up</h2>
          <img src="/assets/eduretrieve-logo.png" alt="logo" className="auth-header-flex-img" />
        </div>

        {/* Step 1: Email Input */}
        {currentStep === 'email' && (
          <form onSubmit={handleEmailSubmit}>
            <div className="form-group">
              <label>Email Address:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Continue with Google'}
            </button>
            <p style={{ fontSize: '0.9em', color: '#666', marginTop: '10px' }}>
              You'll be redirected to Google to verify your email address
            </p>
          </form>
        )}

        {/* Step 2: Verification Code Input */}
        {currentStep === 'verification' && (
          <form onSubmit={handleVerificationSubmit}>
            <div className="verification-box">
              <p>✅ Google verification successful!</p>
              <p><strong>Name:</strong> {userInfo?.name}</p>
              <p><strong>Email:</strong> {userInfo?.email}</p>
            </div>
            
            <div className="form-group">
              <label>Enter Verification Code:</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                maxLength="6"
                required
                disabled={loading}
                style={{ 
                  textAlign: 'center', 
                  fontSize: '1.2em', 
                  letterSpacing: '0.2em',
                  fontWeight: 'bold'
                }}
              />
            </div>
            
            {timeRemaining > 0 && (
              <p style={{ color: '#666', fontSize: '0.9em' }}>
                Code expires in: <strong>{formatTime(timeRemaining)}</strong>
              </p>
            )}
            
            <button type="submit" disabled={loading || verificationCode.length !== 6}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            
            <button type="button" onClick={handleStartOver} className="cancel-button">
              Start Over
            </button>
          </form>
        )}

        {/* Step 3: Password Setup */}
        {currentStep === 'password' && (
          <form onSubmit={handleFinalSignup}>
            <div className="verification-box">
              <p>✅ Email verified successfully!</p>
              <p><strong>Name:</strong> {userInfo?.name}</p>
              <p><strong>Email:</strong> {userInfo?.email}</p>
            </div>

            <div className="form-group">
              <label>Create Password:</label>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min 6 characters)"
                  required
                  disabled={loading}
                />
                <span
                  className="eye-icon"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label>Confirm Password:</label>
              <div className="password-field">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  disabled={loading}
                />
                <span
                  className="eye-icon"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Creating Account...' : 'Complete Signup'}
            </button>
            
            <button type="button" onClick={handleStartOver} className="cancel-button">
              Start Over
            </button>
          </form>
        )}

        {/* Messages */}
        {error && <p className="auth-message error">❌ {error}</p>}
        {message && <p className="auth-message success">✅ {message}</p>}

        <p>Already have an account? <Link to="/login">Login here</Link></p>
      </div>
    </div>
  );
}

export default EnhancedSignup;