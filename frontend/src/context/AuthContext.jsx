import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';

let interceptorsConfigured = false;

if (typeof window !== 'undefined' && !interceptorsConfigured) {
  axios.defaults.withCredentials = true;

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401) {
        try {
          window.localStorage.removeItem('nb_token');
          window.localStorage.removeItem('nb_user');
          window.localStorage.removeItem('northblomst_auth');
          window.sessionStorage.removeItem('nb_token');
          window.sessionStorage.removeItem('nb_user');
        } catch (e) {
          // Ignore
        }
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
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

  useEffect(() => {
    axios
      .get(`${API_BASE}/auth/me`, { withCredentials: true })
      .then((res) => {
        setUser(res.data?.user ?? null);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsAuthReady(true);
      });
  }, []);

  const login = (data) => {
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`, {}, { withCredentials: true });
    } catch (e) {
      // Ignore
    }
    setUser(null);
    try {
      window.localStorage.removeItem('nb_token');
      window.localStorage.removeItem('nb_user');
      window.sessionStorage.removeItem('nb_token');
      window.sessionStorage.removeItem('nb_user');
    } catch (e) {
      // Ignore
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
