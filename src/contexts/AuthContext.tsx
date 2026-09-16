import React, { createContext, useContext, useState, ReactNode } from 'react';

const AUTH_KEY = 'lisansama_auth_v1';
const PASSWORD_KEY = 'lisansama_password_v1';
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = '100712';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => { success: boolean; message: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStoredPassword(): string {
  try {
    return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;
  } catch {
    return DEFAULT_PASSWORD;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTH_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const login = (usernameInput: string, password: string): boolean => {
    const storedPassword = getStoredPassword();
    if (usernameInput.trim().toLowerCase() === DEFAULT_USERNAME && password === storedPassword) {
      try {
        localStorage.setItem(AUTH_KEY, 'true');
      } catch {
        // ignore storage errors
      }
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
  };

  const changePassword = (currentPassword: string, newPassword: string) => {
    const storedPassword = getStoredPassword();
    if (currentPassword !== storedPassword) {
      return { success: false, message: 'Mevcut şifre yanlış.' };
    }
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, message: 'Yeni şifre en az 4 karakter olmalıdır.' };
    }
    try {
      localStorage.setItem(PASSWORD_KEY, newPassword.trim());
    } catch {
      return { success: false, message: 'Şifre kaydedilirken bir hata oluştu.' };
    }
    return { success: true, message: 'Şifre başarıyla değiştirildi.' };
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username: DEFAULT_USERNAME, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
