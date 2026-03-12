'use client';
import './globals.css';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import BottomNav from '@/components/BottomNav';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [ready, setReady] = useState(false);

  const isLogin = pathname === '/' || pathname === '/login';

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const t = saved || 'dark';
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);

    // Listen for theme changes from other pages
    const onStorage = () => {
      const cur = localStorage.getItem('theme') as 'dark' | 'light' | null;
      if (cur) { setTheme(cur); document.documentElement.setAttribute('data-theme', cur); }
    };
    window.addEventListener('storage', onStorage);

    // Also poll every 300ms for same-tab changes
    const interval = setInterval(() => {
      const cur = localStorage.getItem('theme') as 'dark' | 'light' | null || 'dark';
      setTheme(prev => { if (prev !== cur) document.documentElement.setAttribute('data-theme', cur); return cur; });
    }, 300);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && !isLogin) router.replace('/login');
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login');
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  if (!ready) return (
    <html lang="it" data-theme={theme}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FF6B35" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Caricamento...
        </div>
      </body>
    </html>
  );

  return (
    <html lang="it" data-theme={theme}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FF6B35" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <title>GymApp</title>
      </head>
      <body>
        <div style={{
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg)',
        }}>
          <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {children}
          </main>
          {!isLogin && <BottomNav />}
        </div>
      </body>
    </html>
  );
}
