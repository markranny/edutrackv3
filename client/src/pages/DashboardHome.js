import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FaRegBookmark } from 'react-icons/fa';
import useAuthStatus from '../hooks/useAuthStatus';
import { toast } from 'react-toastify';

function Dashboard() {
  const { user, authLoading } = useAuthStatus();
  const [modules, setModules] = useState([]); 
  const [savedModuleIds, setSavedModuleIds] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;
    console.log('✅ User ready:', user.id);
  }, [authLoading, user]);

  useEffect(() => {
    const fetchModules = async () => {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .order('uploadedAt', { ascending: false });

      if (error) {
        console.error('❌ Module fetch error:', error.message);
      } else {
        setModules(data || []);
      }
    };

    fetchModules();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchSaved = async () => {
      const { data, error } = await supabase
        .from('save_modules')
        .select('module_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Saved fetch error:', error.message);
      } else {
        setSavedModuleIds(new Set(data.map(row => row.module_id)));
      }
    };

    fetchSaved();
  }, [user]);

  const handleToggleSave = async (moduleId, moduleTitle) => {
    if (!user) {
      toast.warning('⚠️ You must be logged in to save modules.');
      return;
    }

    const isSaved = savedModuleIds.has(moduleId);
    if (isSaved) {
      toast.info('⚠️ Module already saved.');
      return;
    }

    try {
      const { error } = await supabase.from('save_modules').insert({
        module_id: moduleId,
        user_id: user.id,
        title: moduleTitle,
      });

      if (error) throw new Error(error.message);

      setSavedModuleIds(prev => new Set(prev).add(moduleId));
      window.dispatchEvent(new Event('saved-modules-updated'));
      toast.success('✅ Module saved!');
    } catch (err) {
      console.error('❌ Save error:', err.message);
      toast.error(`❌ Save failed: ${err.message}`);
    }
  };

  const handleDeleteClick = (id) => {
    setModuleToDelete(id);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!moduleToDelete) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) throw new Error('Missing token');

      const res = await fetch(`http://localhost:5000/delete-module/${moduleToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');

      setModules(prev => prev.filter(m => m.id !== moduleToDelete));
      const updatedSaved = new Set(savedModuleIds);
      updatedSaved.delete(moduleToDelete);
      setSavedModuleIds(updatedSaved);

      toast.success('🗑️ Module deleted!');
    } catch (err) {
      console.error('❌ Delete error:', err.message);
      alert(`Delete failed: ${err.message}`);
    } finally {
      setShowDeleteModal(false);
      setModuleToDelete(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    if (!title || !description) {
      setMessage('❌ Title and description are required.');
      setIsSubmitting(false);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) throw new Error('Missing auth token');

      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      if (file) formData.append('file', file);

      const res = await fetch('http://localhost:5000/upload-module', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Upload failed');

      setModules(prev => [result.data[0], ...prev]); // insert returns array
      toast.success('✅ Module uploaded!');
      setShowUploadModal(false);
      setTitle('');
      setDescription('');
      setFile(null);
    } catch (err) {
      console.error('❌ Upload error:', err.message);
      setMessage(`❌ Upload failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="dashboard-page">
      <h2>Available Modules</h2>
      <div className="scrollable-module-area"></div>
      <div className="module-list">
        {modules.map((module) => (
          <div key={module.id} className="module-card">
            <div className="module-card-header">
              <h3>{module.title}</h3>
              <button
                onClick={() => handleToggleSave(module.id, module.title)}
                className="save-module-button"
              >
                <FaRegBookmark
                  className={`save-icon ${savedModuleIds.has(module.id) ? 'saved' : 'unsaved'}`}
                />
              </button>
            </div>

            <div className="module-card-content">
              <p><strong>Outline:</strong></p>
              <p>{module.description}</p>

              {module.file_url && (
                <button
                  className="view-file-button"
                  onClick={() => window.open(module.file_url, '_blank')}
                >
                  📄 View File
                </button>
              )}
              <p>
                Uploaded by: {module.uploadedBy} <br />
                at {new Date(module.uploadedAt).toLocaleString()}
              </p>
            </div>

            <div className="module-card-footer">
              <button
                onClick={() => handleDeleteClick(module.id)}
                className="delete-module-button"
              >
                🗑️ Delete Module
              </button>
            </div>
          </div>
        ))}
      </div>

                {/* ✅ Floating Upload Button */}
    <button onClick={() => setShowUploadModal(true)} className="floating-upload-button">
      ＋Upload New Module
    </button>
    
      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modals-overlay">
          <div className="modals-box">
            <h3>Upload Module</h3>
            <form onSubmit={handleUpload}>
              <label>Module Title:</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required 
              placeholder="e.g., Introduction to Calculus"/>
              <label>Module Outline/Description:</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows="6" required
                placeholder="Provide a detailed outline of the module topics, learning objectives, etc."></textarea>
              <label>Attach a file (optional):</label>
              <input type="file" accept=".pdf,.doc,.docx" onChange={e => setFile(e.target.files[0])} />
              <div className="modals-buttons">
                <button type="button" onClick={() => setShowUploadModal(false)}>Cancel</button>
                <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Module Outline'}</button>
              </div>
              {message && <p>{message}</p>}
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <p>Are you sure you want to delete?</p>
            <div className="modal-buttons">
              <button className="modal-logout-btn" onClick={handleConfirmDelete}>
                Delete
              </button>
              <button className="modal-cancel-btn" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;