'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, GYM_ID } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gymName, setGymName] = useState('GymApp');
  const [gymLogo, setGymLogo] = useState('');

  useEffect(() => {
    supabase.from('gyms').select('name,logo_url').eq('id', GYM_ID).single()
      .then(({ data }) => { if (data) { setGymName(data.name || 'GymApp'); setGymLogo(data.logo_url || ''); } });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (err || !data.user) {
      setError(err?.message || 'Email o password non corretti');
      setLoading(false); return;
    }
    router.replace('/home');
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 28, gap: 24, background: 'var(--bg)',
    }}>
      {/* Logo */}
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,107,53,.1)', overflow: 'hidden',
      }}>
        {gymLogo
          ? <img src={gymLogo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)' }}>{gymName[0]}</span>
        }
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 800, fontStyle: 'italic', color: 'var(--text)' }}>{gymName}</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>Solo per clienti autorizzati</div>
      </div>

      <form onSubmit={handleLogin} style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 20, padding: 24, width: '100%', maxWidth: 420,
        display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,.08)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-sub)' }}>Email</label>
          <input className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="cliente@email.it" autoComplete="email" required />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-sub)' }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input className="inp" type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" required style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShowPw(!showPw)} style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)',
            }}>👁</button>
          </div>
        </div>
        {error && (
          <div style={{
            background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
            borderRadius: 10, padding: '12px 14px', color: '#e53935', fontSize: 13,
          }}>{error}</div>
        )}
        <button className="btn-accent" type="submit" disabled={loading}>
          {loading ? 'Accesso in corso...' : '→ Accedi'}
        </button>
      </form>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
        Solo per clienti autorizzati della palestra
      </div>
    </div>
  );
}
