'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, GYM_ID } from '@/lib/supabase';

export default function ProfiloPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [sub, setSub] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [showPayments, setShowPayments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [changePw, setChangePw] = useState(false);
  const [pwNew, setPwNew] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [theme, setTheme] = useState<'dark'|'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark'|'light' | null;
    setTheme(saved || 'dark');
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: prof }, { data: subscription }, { data: subs }, { data: prods }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('subscriptions').select('*,subscription_plans(name,price)').eq('client_id', user.id).eq('gym_id', GYM_ID).eq('status', 'active').order('end_date', { ascending: false }).limit(1).single(),
      supabase.from('subscriptions').select('*,subscription_plans(name,price)').eq('client_id', user.id).eq('gym_id', GYM_ID).order('start_date', { ascending: false }).limit(20),
      supabase.from('product_sales').select('*').eq('client_id', user.id).eq('gym_id', GYM_ID).order('sold_at', { ascending: false }).limit(20),
    ]);
    setProfile(prof);
    setSub(subscription || null);
    const allPayments = [
      ...(subs || []).map((s: any) => ({ type: 'sub', id: s.id, name: s.subscription_plans?.name || 'Abbonamento', price: s.price_paid ?? s.subscription_plans?.price, date: s.start_date })),
      ...(prods || []).map((p: any) => ({ type: 'prod', id: p.id, name: p.product_name, price: p.price_paid, date: p.sold_at })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setPayments(allPayments);
    setLoading(false);
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setPwMsg(error ? 'Errore: ' + error.message : 'Password cambiata!');
    if (!error) { setPwNew(''); setTimeout(() => { setChangePw(false); setPwMsg(''); }, 2000); }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  // Medical cert warning
  const medExpiry = profile?.medical_certificate_expiry;
  const medDate = medExpiry ? new Date(medExpiry) : null;
  const medDays = medDate ? Math.ceil((medDate.getTime() - Date.now()) / 86400000) : null;
  const medWarn = medDays !== null && medDays <= 30;
  const medExpired = medDays !== null && medDays < 0;

  // Sub days remaining
  const subEnd = sub?.end_date ? new Date(sub.end_date) : null;
  const subDays = subEnd ? Math.ceil((subEnd.getTime() - Date.now()) / 86400000) : null;
  const subWarn = subDays !== null && subDays <= 7;

  const initials = profile ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() : '?';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px', paddingTop: 'max(env(safe-area-inset-top,16px),16px)', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Profilo</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Avatar + Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#fff', flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{profile?.first_name} {profile?.last_name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 2 }}>{profile?.email}</div>
            </div>
          </div>

          {/* Abbonamento */}
          {loading ? null : sub ? (
            <div style={{ background: 'var(--bg-card)', border: `1px solid ${subWarn ? 'rgba(245,158,11,.4)' : 'var(--border)'}`, borderRadius: 18, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, color: 'var(--text-muted)', marginBottom: 4 }}>Abbonamento attivo</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{sub.subscription_plans?.name || 'Abbonamento'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
                    Scade: {subEnd?.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  {subWarn && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,.12)', color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>⚠️ Scade tra {subDays} giorni</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>Rimanenti</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: subWarn ? '#f59e0b' : 'var(--accent)' }}>{subDays}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>giorni</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 18, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: '#ef4444', marginBottom: 4 }}>Nessun abbonamento attivo</div>
              <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>Contatta la palestra per rinnovare</div>
            </div>
          )}

          {/* Certificato medico */}
          {medDate && (
            <div style={{ background: 'var(--bg-card)', border: `1px solid ${medExpired ? 'rgba(239,68,68,.4)' : medWarn ? 'rgba(245,158,11,.4)' : 'var(--border)'}`, borderRadius: 18, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, color: 'var(--text-muted)', marginBottom: 4 }}>Certificato medico</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{medExpired ? '🚨' : medWarn ? '⚠️' : '✅'}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: medExpired ? '#ef4444' : medWarn ? '#f59e0b' : 'var(--text)' }}>
                    {medExpired ? 'Scaduto' : medWarn ? `Scade tra ${medDays} giorni` : 'Valido'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 2 }}>
                    Scadenza: {medDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Storico pagamenti */}
          {payments.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>
              <div onClick={() => setShowPayments(!showPayments)} style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>🧾 Storico pagamenti</div>
                <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>{showPayments ? '▲' : '▼'}</span>
              </div>
              {showPayments && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {payments.map(p => (
                    <div key={p.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                        <span style={{ fontSize: 18 }}>{p.type === 'sub' ? '🏷️' : '🛒'}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(p.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        </div>
                      </div>
                      {p.price != null && (
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', flexShrink: 0 }}>€{Number(p.price).toFixed(2)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Impostazioni */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>
            {/* Theme toggle */}
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, color: 'var(--text)' }}>🌙 Tema {theme === 'dark' ? 'Scuro' : 'Chiaro'}</div>
              <div onClick={toggleTheme} style={{ width: 50, height: 28, borderRadius: 14, background: theme === 'dark' ? 'var(--accent)' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background .2s' }}>
                <div style={{ position: 'absolute', top: 3, left: theme === 'dark' ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </div>
            </div>
            {/* Change pw */}
            <div onClick={() => setChangePw(!changePw)} style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, color: 'var(--text)' }}>🔑 Cambia password</div>
              <span style={{ color: 'var(--text-muted)' }}>{changePw ? '▲' : '›'}</span>
            </div>
            {changePw && (
              <form onSubmit={handleChangePw} style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="inp" type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="Nuova password" required style={{ marginTop: 12 }} />
                {pwMsg && <div style={{ fontSize: 13, color: pwMsg.startsWith('Errore') ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{pwMsg}</div>}
                <button className="btn-accent" type="submit">Aggiorna</button>
              </form>
            )}
            {/* Logout */}
            <div onClick={handleLogout} style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15 }}>🚪</span>
              <span style={{ fontSize: 15, color: '#ef4444', fontWeight: 700 }}>Esci</span>
            </div>
          </div>

          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  );
}
