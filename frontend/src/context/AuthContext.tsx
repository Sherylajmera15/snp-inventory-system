"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export type Role = "admin" | "operator";

export interface User {
  id: number;
  username: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, keepLoggedIn?: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "snp_token";
const USER_KEY = "snp_user";

function readStorage(): { token: string | null; userData: User | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
    return { token, userData: raw ? JSON.parse(raw) : null };
  } catch {
    return { token: null, userData: null };
  }
}

function clearStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const { token, userData } = readStorage();
    if (token && userData) {
      setUser(userData);
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string, keepLoggedIn = false) => {
    const res = await api.post("/api/auth/login", { username, password });
    const { access_token, user_id, username: uname, role } = res.data;
    const userData: User = { id: user_id, username: uname, role };
    const store = keepLoggedIn ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, access_token);
    store.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
    router.push("/dashboard");
  };

  const logout = () => {
    clearStorage();
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
