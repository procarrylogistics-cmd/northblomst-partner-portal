import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        email,
        password,
        remember: rememberMe
      }, { withCredentials: true });
      login(res.data);
      if (res.data.user.role === 'admin') {
        navigate('/admin');
      } else if (res.data.user.suspended) {
        navigate('/partner/reports');
      } else {
        navigate('/partner');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Login fejlede');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <aside className="login-promo" aria-hidden="true">
        <div className="login-promo-media" />
        <div className="login-promo-overlay" />
        <div className="login-promo-content">
          <p className="login-promo-eyebrow">Partner operations</p>
          <h2 className="login-promo-title">Blomsterlevering med kontrol fra atelier til dør</h2>
          <p className="login-promo-copy">
            Én platform til ordrer, produktion, partnere og tracking — bygget til Northblomst.
          </p>
          <ul className="login-promo-points">
            <li>Shopify-synkronisering i realtid</li>
            <li>Partner-udbetalinger med MOMS</li>
            <li>Produktion &amp; leveringslabels</li>
          </ul>
        </div>
      </aside>

      <section className="login-panel">
        <div className="login-panel-inner">
          <img
            className="login-brand-mark"
            src="/northblomst-logo.png"
            alt="Northblomst"
          />
          <h1 className="login-heading">Northblomst Portal</h1>
          <p className="login-sub">Log ind som administrator eller partner</p>

          <form onSubmit={handleSubmit} className="form login-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Adgangskode
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <div className="remember-row">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember-me">Husk mig på denne enhed</label>
            </div>
            {error && <div className="error">{error}</div>}
            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Logger ind…' : 'Log ind'}
            </button>
          </form>

          <p className="login-foot">northblomst.dk · partner infrastructure</p>
        </div>
      </section>
    </div>
  );
}
