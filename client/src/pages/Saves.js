import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import useAuthStatus from '../hooks/useAuthStatus';
import { FaBookmark } from 'react-icons/fa';
import { toast } from 'react-toastify';

function Saves() {
  const { user, authLoading } = useAuthStatus();
  const [savedModules, setSavedModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ Debug auth state
  useEffect(() => {
    if (authLoading) {
      console.log('⏳ Waiting for auth...');
      return;
    }
    if (!user) {
      console.warn('⛔ No user is logged in');
      return;
    }
    console.log('✅ Authenticated user ID:', user.id);
  }, [authLoading, user]);

  // ✅ Fetch saved modules from backend
  useEffect(() => {
    if (authLoading || !user) return;

    const controller = new AbortController();

    const fetchSavedModules = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        const token = data?.session?.access_token;

        if (sessionError || !token) {
          throw new Error('⚠️ Unable to get access token');
        }

        const res = await fetch('http://localhost:5000/get-saved-modules', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const result = await res.json();
          throw new Error(result?.message || 'Failed to load saved modules');
        }

        const result = await res.json();
        setSavedModules(result.modules || []);
        setError(null);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('🚨 Fetch error:', err.message);
          setError('Failed to load your saved modules.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSavedModules();
    window.addEventListener('saved-modules-updated', fetchSavedModules);

    return () => {
      controller.abort();
      window.removeEventListener('saved-modules-updated', fetchSavedModules);
    };
  }, [user, authLoading]);

  // ✅ Unsave a module
  const handleUnsaveModule = async (moduleId) => {
  if (!user) {
    alert('You must be logged in to unsave modules.');
    return;
  }

  try {
    const { data, error: sessionError } = await supabase.auth.getSession();
    const token = data?.session?.access_token;

    if (sessionError || !token) {
      throw new Error('⚠️ Unable to get access token');
    }

    const res = await fetch('http://localhost:5000/unsave-module', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ module_id: moduleId }),
    });

    if (!res.ok) {
      const result = await res.json();
      throw new Error(result?.message || 'Failed to unsave module');
    }

    setSavedModules((prev) => prev.filter((m) => m.id !== moduleId));
    setError(null);
    toast.success('✅ Module unsaved!');
    window.dispatchEvent(new Event('saved-modules-updated'));
  } catch (err) {
    console.error('❌ Unsave error:', err.message);
    setError('Failed to unsave module.');
    toast.error(`❌ ${err.message}`);
  }
};

  // ✅ Render UI
  if (authLoading) return <div className="dashboard-loading">Checking authentication...</div>;
  if (!user) return <div className="dashboard-not-logged-in">Please log in to view your saved modules.</div>;

  return (
    <div className="dashboard-content-page">
      <h2>📚 My Saved Modules</h2>

      {loading && <div className="dashboard-loading">Loading modules...</div>}
      {error && <div className="dashboard-error">{error}</div>}
      {!loading && savedModules.length === 0 && (
        <div className="dashboard-empty">You haven't saved any modules yet.</div>
      )}

      <div className="module-list">
        {savedModules.map((module) => (
          <div key={module.id} className="module-card">
            <div className="module-card-header">
              <h3>{module.title}</h3>
              <button
                className="save-module-button saved"
                onClick={() => handleUnsaveModule(module.id)}
                title="Unsave module"
              >
                <FaBookmark className="saved-icon" />
              </button>
            </div>
            <p><strong>Outline:</strong></p>
            <p className="module-description">{module.description}</p>

            {module.file_url && (
              <button
                className="view-file-button"
                onClick={() => window.open(module.file_url, '_blank')}
              >
                📄 View File
              </button>
            )}

            <p className="module-meta">
              Uploaded by: {module.uploadedBy}<br />
              at {module.uploadedAt ? new Date(module.uploadedAt).toLocaleString() : 'N/A'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Saves;
