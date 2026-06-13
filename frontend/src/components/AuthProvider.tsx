"use client";

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuth = useStore((state) => state.setAuth);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Check localStorage first (Remember Me), then sessionStorage
    let token = localStorage.getItem('vs_auth_token') || sessionStorage.getItem('vs_auth_token');
    let role = localStorage.getItem('vs_auth_role') || sessionStorage.getItem('vs_auth_role');
    let name = localStorage.getItem('vs_auth_name') || sessionStorage.getItem('vs_auth_name');
    let email = localStorage.getItem('vs_auth_email') || sessionStorage.getItem('vs_auth_email');

    // Parse role and restore if exists
    if (token && role) {
      setAuth(token, role as any, name || undefined, email || undefined);
    }
    
    setHydrated(true);
  }, [setAuth]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#04020a] flex items-center justify-center text-purple-400 font-cyber animate-pulse">
        Initializing Command Center...
      </div>
    );
  }

  return <>{children}</>;
}
