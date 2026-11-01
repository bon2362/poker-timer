'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type AdminAuth = {
  isAdmin: boolean;
  checking: boolean;
  login(password: string): Promise<boolean>;
};

const AdminAuthContext = createContext<AdminAuth | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const requestVersion = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const version = requestVersion.current;
    async function checkSession() {
      try {
        const response = await fetch('/api/admin/session', { cache: 'no-store', credentials: 'same-origin' });
        const data = response.ok ? await response.json() : null;
        if (!cancelled && version === requestVersion.current) setIsAdmin(data?.authenticated === true);
      } catch {
        if (!cancelled && version === requestVersion.current) setIsAdmin(false);
      } finally {
        if (!cancelled && version === requestVersion.current) setChecking(false);
      }
    }
    void checkSession();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (password: string) => {
    requestVersion.current += 1;
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      });
      const authenticated = response.ok && (await response.json()).authenticated === true;
      setIsAdmin(authenticated);
      return authenticated;
    } catch (error) {
      setIsAdmin(false);
      throw error;
    } finally {
      setChecking(false);
    }
  }, []);

  return <AdminAuthContext.Provider value={{ isAdmin, checking, login }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuth {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return context;
}
