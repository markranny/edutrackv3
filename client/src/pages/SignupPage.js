import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function SignupPage() {
  const navigate = useNavigate();

  // Form fields
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('signup');

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    // Basic validations
    if (!username.trim()) return setError('❗ Username is required.');
    if (password !== confirmPassword) return setError('❗ Passwords do not match.');
    if (password.length < 6) return setError('❗ Password must be at least 6 characters.');

    setLoading(true);

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signupError) throw signupError;
      const user = data?.user;
      if (!user) throw new Error('Signup failed. Please try again.');

      const { error: profileError } = await supabase.from('users').insert([
        {
          id: user.id,
          email: user.email,
          username: username.trim(),
          role: 'Student',
          created_at: new Date().toISOString(),
        },
      ]);

      if (profileError) throw profileError;

      setStep('check-email');
    } catch (err) {
      console.error('❌ Signup error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <img src="/assets/eduretrieve-logo.png" alt="logo" className="auth-container-img" />

      <div className="auth-form-card">
        <div className="auth-header-flex">
          <h2>{step === 'signup' ? 'Sign Up' : 'Verify Your Email'}</h2>
          <img src="/assets/eduretrieve-logo.png" alt="logo" className="auth-header-flex-img" />
        </div>

        {step === 'signup' ? (
          <form onSubmit={handleSignup} autoComplete="off">

            <div className="form-group">
              <label>Username:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

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

            <div className="form-group">
              <label>Confirm Password:</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="auth-message error">{error}</p>}

            <button type="submit" disabled={loading}>
              {loading ? 'Signing up...' : 'Sign Up'}
            </button>

            <p className="auth-footer">
              Already have an account? <Link to="/login">Login here</Link>
            </p>
          </form>
        ) : (
          <div className="check-email-section">
            <p className="auth-message success">✅ Signup successful!</p>
            <p className="auth-message">
              📩 Please check your email and click the verification link before logging in.
            </p>
            <button onClick={() => navigate('/login')}>Go to Login</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SignupPage;
