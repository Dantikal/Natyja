import { createContext, useContext, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved && localStorage.getItem('token') ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      return null;
    }
  });

  function applySession(data) {
    localStorage.setItem('token', data.token);
    const userData = {
      id: data.id, role: data.role, fullName: data.fullName, email: data.email,
      soldierId: data.soldierId, unitId: data.unitId, mustChangePassword: data.mustChangePassword,
    };
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }
  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    applySession(res.data); return res.data;
  }
  async function changePassword(currentPassword, newPassword) {
    const res = await api.post('/auth/change-password', { currentPassword, newPassword });
    applySession(res.data); return res.data;
  }

  // register принимает FormData (с фото и всеми полями)
  async function register(formData, captcha) {
    const res = await api.post('/auth/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data', 'X-Captcha-Id': captcha?.id || '', 'X-Captcha-Answer': captcha?.answer || '' },
    });
    return res.data;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
