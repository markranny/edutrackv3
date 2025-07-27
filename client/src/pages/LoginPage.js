import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unverifiedUser, setUnverifiedUser] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setUnverifiedUser(false);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message);
    } else if (!data.user?.email_confirmed_at) {
      setUnverifiedUser(true);
      setError('Please verify your email before logging in.');
    } else {
      console.log('✅ Login successful:', data.user.id);
      navigate('/dashboard/home');
    }
  };

  const handleResendVerification = async () => {
    setError('');

    // This is a workaround since Supabase doesn’t yet provide a direct resend method.
    const { error: resendError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (resendError) {
      setError('Failed to resend verification email: ' + resendError.message);
    } else {
      alert('📧 Verification email resent! Please check your inbox.');
    }
  };

  return (
    <div className="auth-container">
      <img src="/assets/eduretrieve-logo.png" alt="logo" className="auth-container-img" />
      <div className="auth-form-card">
        <div className="auth-header-flex">
          <h2>Login</h2>
          <img src="/assets/eduretrieve-logo.png" alt="logo" className="auth-header-flex-img" />
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <p><Link to="/forgot-password">Forgot password?</Link></p>
          <button type="submit">Login</button>
        </form>

        {error && <p className="auth-message error">❌ {error}</p>}

        {unverifiedUser && (
          <div style={{ marginTop: '1rem' }}>
            <button onClick={handleResendVerification}>
              Resend Verification Email
            </button>
          </div>
        )}

        <p>Don't have an account? <Link to="/signup">Sign up here</Link></p>
      </div>
    </div>
  );
}

export default LoginPage;
