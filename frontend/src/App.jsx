import React from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminDashboard from './pages/AdminDashboard';
import PartnerDashboard from './pages/PartnerDashboard';
import LoginPage from './pages/LoginPage';
import ReportsPage from './pages/ReportsPage';
import PartnerAddonPage from './pages/PartnerAddonPage';
import PartnerReportsPage from './pages/PartnerReportsPage';
import NotificationBell from './components/NotificationBell';

function ProtectedRoute({ children, role, allowSuspended = false }) {
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
  if (user.role === 'partner' && user.suspended && !allowSuspended) {
    return <Navigate to="/partner/reports" replace />;
  }
  return children;
}

export default function App() {
  const { user, logout, isAuthReady } = useAuth();
  const location = useLocation();
  const isLogin = location.pathname === '/login';
  const isSuspendedPartner = user?.role === 'partner' && !!user.suspended;

  return (
    <div
      className={`app-root${isLogin ? ' is-login' : ''}${user?.role === 'admin' ? ' is-admin' : ''}${
        isSuspendedPartner ? ' is-suspended-partner' : ''
      }`}
    >
      {!isLogin && (
        <header className="app-header">
          <div className="header-brand">
            <img className="header-logo" src="/northblomst-logo-light.png" alt="" />
            <div className="logo">
              <span className="logo-name">Northblomst</span>
              <span className="logo-tag">Portal</span>
            </div>
          </div>
          <nav className="nav">
            {isAuthReady && user?.role === 'admin' && (
              <Link to="/admin" className={location.pathname === '/admin' ? 'nav-active' : undefined}>
                Admin
              </Link>
            )}
            {isAuthReady && user?.role === 'admin' && (
              <Link to="/reports" className={location.pathname === '/reports' ? 'nav-active' : undefined}>
                Rapporter
              </Link>
            )}
            {isAuthReady && user?.role === 'admin' && (
              <Link
                to="/partner-addon"
                className={location.pathname === '/partner-addon' ? 'nav-active' : undefined}
              >
                Partner addon
              </Link>
            )}
            {isAuthReady && user?.role === 'admin' && (
              <Link to="/admin" state={{ openManualCard: true }}>
                Print kort
              </Link>
            )}
            {isAuthReady && user?.role === 'partner' && !isSuspendedPartner && (
              <Link to="/partner" className={location.pathname === '/partner' ? 'nav-active' : undefined}>
                Mine ordrer
              </Link>
            )}
            {isAuthReady && user?.role === 'partner' && (
              <Link
                to="/partner/reports"
                className={location.pathname === '/partner/reports' ? 'nav-active' : undefined}
              >
                Reports
              </Link>
            )}
            {isAuthReady && user?.role === 'partner' && !isSuspendedPartner && <NotificationBell />}
            {isAuthReady && !user && <Link to="/login">Login</Link>}
            {isAuthReady && user && (
              <button onClick={logout} className="btn-link btn-logout" type="button">
                Log ud
              </button>
            )}
          </nav>
        </header>
      )}
      <main className={`app-main${isLogin ? ' app-main-login' : ''}`}>
        <Routes>
          <Route
            path="/"
            element={
              !isAuthReady ? (
                <div className="auth-loading">Indlæser…</div>
              ) : user ? (
                <Navigate
                  to={
                    user.role === 'admin'
                      ? '/admin'
                      : user.suspended
                        ? '/partner/reports'
                        : '/partner'
                  }
                  replace
                />
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
            path="/partner/reports"
            element={
              <ProtectedRoute role="partner" allowSuspended>
                <PartnerReportsPage />
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
          <Route
            path="/partner-addon"
            element={
              <ProtectedRoute role="admin">
                <PartnerAddonPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
