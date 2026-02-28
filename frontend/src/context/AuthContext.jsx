import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';
const AUTH_TOKEN_KEY = 'nb_token';

function getStoredToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

function setStoredToken(token) {
  try {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('Auth: could not persist token', e);
  }
}

let interceptorsConfigured = false;

if (typeof window !== 'undefined' && !interceptorsConfigured) {
  axios.defaults.withCredentials = true;

  axios.interceptors.request.use((config) => {
    const token = getStoredToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status;
      const data = error?.response?.data;
      const url = error?.config?.url || '';

      if (status === 502 && data?.code === 'SHOPIFY_TOKEN_INVALID') {
        window.dispatchEvent(new CustomEvent('shopify-disconnected', { detail: data }));
        return Promise.reject(error);
      }

      if (status === 401) {
        const isAuthMe = typeof url === 'string' && url.includes('/api/auth/me');
        const isAuthInvalid = data?.code === 'AUTH_INVALID';
        const shouldLogout = isAuthMe || isAuthInvalid;

        if (shouldLogout) {
          if (import.meta.env.DEV) {
            console.warn('Auth: 401 logout', { url, hasToken: !!getStoredToken() });
          }
          setStoredToken(null);
          try {
            window.localStorage.removeItem('nb_user');
            window.localStorage.removeItem('northblomst_auth');
            window.sessionStorage.removeItem('nb_token');
            window.sessionStorage.removeItem('nb_user');
          } catch (e) {
            /* ignore */
          }
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      }
      return Promise.reject(error);
    }
  );

  interceptorsConfigured = true;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    const token = getStoredToken();
    if (import.meta.env.DEV) {
      console.log('Auth init: token from storage', token ? 'present' : 'missing');
    }

    axios
      .get(`${API_BASE}/auth/me`, { withCredentials: true })
      .then((res) => {
        const u = res.data?.user ?? null;
        if (import.meta.env.DEV && u) console.log('Auth: /me success', u.role);
        setUser(u);
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('Auth: /me failed', err?.response?.status, err?.response?.data?.message);
        }
        setUser(null);
      })
      .finally(() => {
        setIsAuthReady(true);
      });
  }, []);

  const login = (data) => {
    if (data?.token) {
      setStoredToken(data.token);
      if (import.meta.env.DEV) console.log('Auth: token stored on login');
    }
    setUser(data?.user ?? null);
  };

  const logout = async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`, {}, { withCredentials: true });
    } catch (e) {
      /* ignore */
    }
    setUser(null);
    setStoredToken(null);
    try {
      window.localStorage.removeItem('nb_user');
      window.sessionStorage.removeItem('nb_token');
      window.sessionStorage.removeItem('nb_user');
    } catch (e) {
      /* ignore */
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
