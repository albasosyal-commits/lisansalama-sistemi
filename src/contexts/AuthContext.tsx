import React, { createContext, useContext, useState, ReactNode } from 'react';

const AUTH_KEY = 'lisansama_auth_v1';
const USERNAME_KEY = 'lisansama_username_v1';
const PASSWORD_KEY = 'lisansama_password_v1';
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = '100712';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => { success: boolean; message: string };
  changeUsername: (currentPassword: string, newUsername: string) => { success: boolean; message: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStoredUsername(): string {
  try {
    return localStorage.getItem(USERNAME_KEY) || DEFAULT_USERNAME;
  } catch {
    return DEFAULT_USERNAME;
  }
}

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
  const [username, setUsername] = useState<string>(() => getStoredUsername());

  const login = (usernameInput: string, password: string): boolean => {
    const storedUsername = getStoredUsername();
    const storedPassword = getStoredPassword();
    if (
      usernameInput.trim().toLowerCase() === storedUsername.toLowerCase() &&
      password === storedPassword
    ) {
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

  const changeUsername = (currentPassword: string, newUsername: string) => {
    const storedPassword = getStoredPassword();
    if (currentPassword !== storedPassword) {
      return { success: false, message: 'Mevcut şifre yanlış.' };
    }
    const cleanUsername = newUsername.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, message: 'Kullanıcı adı en az 3 karakter olmalıdır.' };
    }
    try {
      localStorage.setItem(USERNAME_KEY, cleanUsername);
    } catch {
      return { success: false, message: 'Kullanıcı adı kaydedilirken bir hata oluştu.' };
    }
    setUsername(cleanUsername);
    return { success: true, message: 'Kullanıcı adı başarıyla değiştirildi.' };
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, username, login, logout, changePassword, changeUsername }}
    >
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
