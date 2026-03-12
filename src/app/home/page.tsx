'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, GYM_ID } from '@/lib/supabase';

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [gymName, setGymName] = useState('');
  const [gymLogo, setGymLogo] = useState('');
  const [schede, setSchede] = useState<any[]>([]);
  const [lezioni, setLezioni] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: prof }, { data: gym }, { data: asgn }, { data: bk }] = await Promise.all([
      supabase.from('profiles').select('first_name,last_name').eq('id', user.id).single(),
      supabase.from('gyms').select('name,logo_url').eq('id', GYM_ID).single(),
      supabase.from('workout_assignments').select('*,workout_templates(id,name,goal,level)').eq('client_id', user.id).eq('is_active', true).limit(3),
      supabase.from('course_bookings').select('session_id,course_sessions(start_time,courses(name,color))').eq('client_id', user.id).eq('status', 'confirmed').limit(10),
    ]);
    setProfile(prof);
    setGymName(gym?.name || '');
    setGymLogo(gym?.logo_url || '');
    setSchede(asgn || []);
    const future = (bk || [])
      .filter((b: any) => b.course_sessions?.start_time && new Date(b.course_sessions.start_time) > new Date())
      .sort((a: any, b: any) => new Date(a.course_sessions.start_time).getTime() - new Date(b.course_sessions.start_time).getTime())
      .slice(0, 3);
    setLezioni(future);
    setLoading(false);
  }

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';

  return (
    <div style={{ padding: 20, paddingTop: 'max(env(safe-area-inset-top, 20px), 20px)', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Gym header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 10 }}>
        <div style={{ width: 72, height: 72, borderRadius: 16, overflow: 'hidden', background: 'rgba(255,107,53,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {gymLogo
            ? <img src={gymLogo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)' }}>{gymName?.[0]}</span>
          }
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', color: 'var(--text)' }}>{gymName}</div>
      </div>

      {/* Greeting */}
      <div>
        <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>{greeting} 👋</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
          {profile?.first_name} {profile?.last_name}
        </div>
      </div>

      {/* Prossime lezioni */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>📅 Prossime lezioni</div>
          <button onClick={() => router.push('/corsi')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Vedi tutte →</button>
        </div>
        {loading ? <div style={{ color: 'var(--text-sub)', fontSize: 14 }}>Caricamento...</div>
          : lezioni.length === 0
            ? <div onClick={() => router.push('/corsi')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, cursor: 'pointer' }}>
                <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>Nessuna lezione prenotata</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginTop: 4 }}>Prenota ora →</div>
              </div>
            : lezioni.map((bk: any) => {
                const s = bk.course_sessions;
                const dt = s?.start_time ? new Date(s.start_time) : null;
                return (
                  <div key={bk.session_id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', overflow: 'hidden' }}>
                    <div style={{ width: 5, background: s?.courses?.color || 'var(--accent)', flexShrink: 0 }} />
                    <div style={{ padding: 14, flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{s?.courses?.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 3 }}>
                        {dt?.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} · {dt?.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })
        }
      </div>

      {/* Schede */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>💪 Le tue schede</div>
          <button onClick={() => router.push('/schede')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Vedi tutte →</button>
        </div>
        {loading ? <div style={{ color: 'var(--text-sub)', fontSize: 14 }}>Caricamento...</div>
          : schede.length === 0
            ? <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>Nessuna scheda assegnata</div>
              </div>
            : schede.map((a: any) => {
                const t = a.workout_templates;
                return (
                  <div key={a.id} onClick={() => router.push('/schede')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t?.name}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        {t?.goal && <span className="tag" style={{ background: 'rgba(255,107,53,.12)', color: 'var(--accent)' }}>{t.goal}</span>}
                        {t?.level && <span className="tag" style={{ background: 'rgba(59,130,246,.12)', color: '#3b82f6' }}>{t.level}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 24, color: 'var(--accent)' }}>›</span>
                  </div>
                );
              })
        }
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}
