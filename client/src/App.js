import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPassword from './pages/ForgotPassword';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import Chats from './pages/Chats';
import Saves from './pages/Saves';
import HomePageContent from './HomePageContent';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ErrorBoundary from './components/ErrorBoundary';

function AuthWrapper() {
  const [loadingInitialAuth, setLoadingInitialAuth] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (session?.user) {
        const currentPath = window.location.pathname;
        const isOnPublicPage =
          currentPath === '/' || currentPath === '/login' || currentPath === '/signup';

        if (isOnPublicPage) {
          navigate('/dashboard/home', { replace: true });
        }
      }

      setLoadingInitialAuth(false);
    };

    checkAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  if (loadingInitialAuth) {
    return <div className="loading-full-page">Loading application...</div>;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<HomePageContent />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="home" element={<DashboardHome />} />
        <Route path="chats" element={<Chats />} />
        <Route path="saves" element={<Saves />} />
      </Route>

      {/* Catch-all 404 */}
      <Route path="*" element={<div>404 - Page Not Found</div>} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ErrorBoundary>
          <AuthWrapper />
          <ToastContainer position="top-right" autoClose={2000} />
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

export default App;