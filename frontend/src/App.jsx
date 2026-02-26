import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
// Fixed import path for AuthContext by Cursor.
import { useAuth } from './context/AuthContext';
import AdminDashboard from './pages/AdminDashboard';
import PartnerDashboard from './pages/PartnerDashboard';
import LoginPage from './pages/LoginPage';
import ReportsPage from './pages/ReportsPage';

function ProtectedRoute({ children, role }) {
  const { user, isAuthReady } = useAuth();
  if (!isAuthReady) {
    return <div className="auth-loading">Indlæser…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const { user, logout, isAuthReady } = useAuth();

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="logo">Northblomst Portal</div>
        <nav className="nav">
          {isAuthReady && user?.role === 'admin' && <Link to="/admin">Admin</Link>}
          {isAuthReady && user?.role === 'admin' && <Link to="/reports">Rapporter</Link>}
          {isAuthReady && user?.role === 'partner' && <Link to="/partner">Mine ordrer</Link>}
          {isAuthReady && !user && <Link to="/login">Login</Link>}
          {isAuthReady && user && (
            <button onClick={logout} className="btn-link">
              Log ud
            </button>
          )}
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={
              !isAuthReady ? (
                <div className="auth-loading">Indlæser…</div>
              ) : user ? (
                <Navigate to={user.role === 'admin' ? '/admin' : '/partner'} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/partner"
            element={
              <ProtectedRoute role="partner">
                <PartnerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute role="admin">
                <ReportsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

