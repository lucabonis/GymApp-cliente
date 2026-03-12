'use client';
import { useEffect, useState } from 'react';
import { supabase, GYM_ID } from '@/lib/supabase';

const CACHE_KEY = 'cache_comunicazioni_v2';

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  info: { label: 'Info', color: '#3b82f6', bg: 'rgba(59,130,246,.12)' },
  promo: { label: 'Promo', color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  avviso: { label: 'Avviso', color: '#ef4444', bg: 'rgba(239,68,68,.12)' },
  evento: { label: 'Evento', color: '#8b5cf6', bg: 'rgba(139,92,246,.12)' },
  general: { label: 'Generale', color: '#6b7280', bg: 'rgba(107,114,128,.12)' },
};

export default function ComunicazioniPage() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) { setNotifs(JSON.parse(cached)); setLoading(false); }
    } catch {}

    loadData();

    const onOnline = () => { setOffline(false); loadData(); };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  async function loadData() {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('gym_id', GYM_ID)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data) return;
    setNotifs(data);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px', paddingTop: 'max(env(safe-area-inset-top,16px),16px)', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Comunicazioni</div>
        {offline && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>📵 Offline — dati all'ultima connessione</div>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>Caricamento...</div>
          ) : notifs.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 20 }}>
              <div style={{ fontSize: 44 }}>📢</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Nessuna comunicazione</div>
              <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>Le novità dalla tua palestra appariranno qui</div>
            </div>
          ) : notifs.map(n => {
            const t = TYPE_LABELS[n.type] || TYPE_LABELS.general;
            const date = new Date(n.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
            const isExp = expanded === n.id;
            return (
              <div key={n.id} onClick={() => setExpanded(isExp ? null : n.id)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: t.bg, color: t.color }}>{t.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{date}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: isExp ? 10 : 0 }}>{n.title}</div>
                    {isExp && n.body && (
                      <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{n.body}</div>
                    )}
                    {n.image_url && isExp && (
                      <img src={n.image_url} alt="" style={{ width: '100%', borderRadius: 10, marginTop: 10, objectFit: 'cover' }} />
                    )}
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 18, flexShrink: 0, marginTop: 2 }}>{isExp ? '▲' : '▼'}</span>
                </div>
              </div>
            );
          })}
          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  );
}
