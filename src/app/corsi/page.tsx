'use client';
import { useEffect, useState } from 'react';
import { supabase, GYM_ID } from '@/lib/supabase';

const DAYS_IT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function getWeekDays(base: Date) {
  const days: Date[] = [];
  const d = new Date(base);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  for (let i = 0; i < 7; i++) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return days;
}

export default function CorsiPage() {
  const [tab, setTab] = useState<'lezioni'|'prenotazioni'>('lezioni');
  const [sessioni, setSessioni] = useState<any[]>([]);
  const [bookings, setBookings] = useState<string[]>([]);
  const [prenotazioni, setPrenotazioni] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekBase, setWeekBase] = useState(new Date());
  const [userId, setUserId] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const from = new Date(); from.setDate(from.getDate() - 7);
    const to = new Date(); to.setDate(to.getDate() + 35);
    const [{ data: sess }, { data: bk }] = await Promise.all([
      supabase.from('course_sessions').select('*,courses(name,color,max_capacity)').eq('gym_id', GYM_ID).eq('is_cancelled', false).gte('start_time', from.toISOString()).lte('start_time', to.toISOString()).order('start_time', { ascending: true }),
      supabase.from('course_bookings').select('session_id,id,status,booked_at,course_sessions(start_time,courses(name,color))').eq('client_id', user.id).eq('status', 'confirmed'),
    ]);
    setSessioni(sess || []);
    setBookings((bk || []).map((b: any) => b.session_id));
    setPrenotazioni(bk || []);
    setLoading(false);
  }

  async function bookSession(sid: string) {
    await supabase.from('course_bookings').insert({ session_id: sid, client_id: userId, gym_id: GYM_ID, status: 'confirmed', booked_at: new Date().toISOString() });
    loadData();
  }

  async function cancelBooking(sid: string) {
    await supabase.from('course_bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('session_id', sid).eq('client_id', userId);
    loadData();
  }

  const weekDays = getWeekDays(weekBase);
  const todayStr = new Date().toISOString().split('T')[0];
  const selStr = selectedDate.toISOString().split('T')[0];
  const first = weekDays[0], last = weekDays[6];
  const weekLabel = first.getMonth() === last.getMonth()
    ? `${first.getDate()}–${last.getDate()} ${MONTHS_IT[first.getMonth()]} ${first.getFullYear()}`
    : `${first.getDate()} ${MONTHS_IT[first.getMonth()]} – ${last.getDate()} ${MONTHS_IT[last.getMonth()]}`;

  const daySessioni = sessioni.filter(s => s.start_time?.startsWith(selStr));
  const futureBk = prenotazioni.filter((b: any) => { const st = b.course_sessions?.start_time; return st && new Date(st).getTime() + 90*60*1000 > Date.now(); });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', paddingTop: 'max(env(safe-area-inset-top,16px),16px)', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Corsi</div>
        <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
          {(['lezioni','prenotazioni'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: 8, borderRadius: 9, border: 'none', cursor: 'pointer',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-sub)', fontSize: 14, fontWeight: 600,
            }}>
              {t === 'lezioni' ? 'Lezioni' : `Prenotazioni${futureBk.length > 0 ? ` (${futureBk.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'lezioni' ? (
        <>
          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', padding: 8, borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate()-7); setWeekBase(d); }} style={{ background: 'none', border: 'none', fontSize: 24, color: 'var(--accent)', cursor: 'pointer', padding: 8 }}>‹</button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-sub)' }}>{weekLabel}</div>
            <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate()+7); setWeekBase(d); }} style={{ background: 'none', border: 'none', fontSize: 24, color: 'var(--accent)', cursor: 'pointer', padding: 8 }}>›</button>
          </div>
          {/* Day strip */}
          <div style={{ display: 'flex', padding: '10px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            {weekDays.map((d, i) => {
              const ds = d.toISOString().split('T')[0];
              const isSel = ds === selStr, isToday = ds === todayStr;
              const hasSess = sessioni.some(s => s.start_time?.startsWith(ds));
              return (
                <div key={i} onClick={() => setSelectedDate(new Date(ds + 'T12:00:00'))} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: isSel ? 'var(--accent)' : 'var(--text-muted)' }}>{DAYS_IT[d.getDay()]}</span>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, background: isSel ? 'var(--accent)' : 'transparent', color: isSel ? '#fff' : 'var(--text)', border: isToday && !isSel ? '1px solid var(--accent)' : 'none' }}>{d.getDate()}</div>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: hasSess ? 'var(--accent)' : 'transparent' }} />
                </div>
              );
            })}
          </div>
          {/* Sessions */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-sub)', textTransform: 'capitalize', marginBottom: 4 }}>
                {selectedDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              {loading ? <div style={{ color: 'var(--text-sub)', textAlign: 'center', padding: 40 }}>Caricamento...</div>
                : daySessioni.length === 0
                  ? <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 20 }}>
                      <div style={{ fontSize: 40 }}>📅</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Nessuna lezione</div>
                      <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>Non ci sono lezioni in questo giorno</div>
                    </div>
                  : daySessioni.map((s: any) => {
                      const booked = bookings.includes(s.id);
                      const time = s.start_time ? new Date(s.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
                      return (
                        <div key={s.id} style={{ background: 'var(--bg-card)', border: `1px solid ${booked ? 'rgba(255,107,53,.4)' : 'var(--border)'}`, borderRadius: 14, display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
                          <div style={{ width: 5, background: s.courses?.color || 'var(--accent)', flexShrink: 0 }} />
                          <div style={{ padding: 14, flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{s.courses?.name}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 3 }}>🕐 {time}</div>
                            {s.courses?.max_capacity && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>👥 Max {s.courses.max_capacity} posti</div>}
                          </div>
                          <button onClick={() => booked ? cancelBooking(s.id) : bookSession(s.id)} style={{
                            margin: 12, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, alignSelf: 'center',
                            background: booked ? 'rgba(255,107,53,.12)' : 'var(--accent)',
                            color: booked ? 'var(--accent)' : '#fff',
                          }}>{booked ? '✓' : 'Prenota'}</button>
                        </div>
                      );
                    })
              }
              <div style={{ height: 20 }} />
            </div>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {futureBk.length === 0
              ? <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 20 }}>
                  <div style={{ fontSize: 40 }}>🎫</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Nessuna prenotazione</div>
                  <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>Vai su Lezioni per prenotare un corso</div>
                </div>
              : futureBk.map((bk: any) => {
                  const s = bk.course_sessions;
                  const dt = s?.start_time ? new Date(s.start_time) : null;
                  return (
                    <div key={bk.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
                      <div style={{ width: 5, background: s?.courses?.color || 'var(--accent)', flexShrink: 0 }} />
                      <div style={{ padding: 14, flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{s?.courses?.name}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 3 }}>
                          📅 {dt?.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} · {dt?.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <button onClick={() => cancelBooking(bk.session_id)} style={{ margin: 12, width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.08)', color: '#ef4444', cursor: 'pointer', fontSize: 14, fontWeight: 700, alignSelf: 'center', flexShrink: 0 }}>✕</button>
                    </div>
                  );
                })
            }
            <div style={{ height: 20 }} />
          </div>
        </div>
      )}
    </div>
  );
}
