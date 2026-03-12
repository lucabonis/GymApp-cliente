'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase, GYM_ID } from '@/lib/supabase';

type SetLog = { w: string; r: string; done: boolean };

export default function SchedePage() {
  const [tab, setTab] = useState<'routine'|'passati'>('routine');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<'list'|'active'>('list');
  const [userId, setUserId] = useState('');

  // Workout active state
  const [schedaName, setSchedaName] = useState('');
  const [dayName, setDayName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [savedDayId, setSavedDayId] = useState('');
  const [esercizi, setEsercizi] = useState<any[]>([]);
  const [currExIdx, setCurrExIdx] = useState(0);
  const [exLogs, setExLogs] = useState<Record<string, SetLog[]>>({});
  const [sessionNotes, setSessionNotes] = useState<Record<string, string>>({});
  const [activeWorkout, setActiveWorkout] = useState<any>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerVal, setTimerVal] = useState<number|null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [storicoModal, setStoricoModal] = useState(false);
  const [storicoData, setStoricoData] = useState<any[]>([]);
  const [storicoName, setStoricoName] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [editSets, setEditSets] = useState<Record<string, SetLog[]>>({});
  const [exNames, setExNames] = useState<Record<string, string>>({});

  const startTimeRef = useRef(0);
  const elapsedRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => { loadList(); }, []);

  useEffect(() => {
    if (screen === 'active') { elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000); }
    else { clearInterval(elapsedRef.current); }
    return () => clearInterval(elapsedRef.current);
  }, [screen]);

  useEffect(() => {
    if (timerRunning && timerVal !== null) {
      timerRef.current = setInterval(() => {
        setTimerVal(v => { if (v === null || v <= 0) { clearInterval(timerRef.current); setTimerRunning(false); return 0; } return v - 1; });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  async function loadList() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const [{ data: asgn }, { data: wlogs }] = await Promise.all([
      supabase.from('workout_assignments').select('*,workout_templates(id,name,goal,level,workout_days(id,name,day_number,workout_exercises(id,exercises(name,muscle_groups))))').eq('client_id', user.id).eq('is_active', true),
      supabase.from('workout_logs').select('*').eq('client_id', user.id).order('completed_at', { ascending: false }).limit(50),
    ]);
    setAssignments(asgn || []);
    setLogs(wlogs || []);
    setLoading(false);
  }

  const routines: any[] = [];
  assignments.forEach(a => {
    const t = a.workout_templates;
    const days = [...(t?.workout_days || [])].sort((x: any, y: any) => x.day_number - y.day_number);
    days.forEach((day: any) => routines.push({ templateId: t.id, templateName: t.name, dayId: day.id, dayName: day.name || `Giorno ${day.day_number}`, goal: t.goal, level: t.level, exercises: day.workout_exercises || [] }));
  });

  async function avvia(routine: any) {
    const { data: day } = await supabase.from('workout_days').select('*,workout_exercises(*,exercises(name,muscle_groups))').eq('id', routine.dayId).single();
    const exs: any[] = day?.workout_exercises || [];
    const initLogs: Record<string, SetLog[]> = {};
    exs.forEach((ex: any) => { initLogs[ex.id] = Array.from({ length: ex.sets || 3 }, () => ({ w: ex.weight || '', r: ex.reps || '', done: false })); });
    startTimeRef.current = Date.now();
    setSchedaName(routine.templateName); setDayName(routine.dayName);
    setTemplateId(routine.templateId); setSavedDayId(routine.dayId);
    setEsercizi(exs); setExLogs(initLogs); setSessionNotes({});
    setCurrExIdx(0); setElapsed(0); stopTimer(); setConfirmFinish(false);
    setScreen('active');
  }

  function esci() {
    setActiveWorkout({ schedaName, dayName, templateId, dayId: savedDayId, esercizi, currExIdx, exLogs, sessionNotes, startTime: startTimeRef.current });
    stopTimer(); setScreen('list');
  }

  function riprendi() {
    if (!activeWorkout) return;
    setSchedaName(activeWorkout.schedaName); setDayName(activeWorkout.dayName);
    setTemplateId(activeWorkout.templateId); setSavedDayId(activeWorkout.dayId);
    setEsercizi(activeWorkout.esercizi); setExLogs(activeWorkout.exLogs);
    setSessionNotes(activeWorkout.sessionNotes); setCurrExIdx(activeWorkout.currExIdx);
    startTimeRef.current = activeWorkout.startTime;
    setElapsed(Math.floor((Date.now() - activeWorkout.startTime) / 1000));
    stopTimer(); setScreen('active');
  }

  async function doFinish() {
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    await supabase.from('workout_logs').insert({ client_id: userId, gym_id: GYM_ID, template_id: templateId, day_id: savedDayId, template_name: schedaName, day_name: dayName, duration_seconds: duration, logs: exLogs, completed_at: new Date().toISOString() });
    stopTimer(); setActiveWorkout(null); setConfirmFinish(false);
    setScreen('list'); setTab('passati'); loadList();
  }

  function startTimer(secs: number) { clearInterval(timerRef.current); setTimerVal(secs); setTimerRunning(true); }
  function stopTimer() { clearInterval(timerRef.current); setTimerRunning(false); setTimerVal(null); }
  function fmt(sec: number) { return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`; }

  function toggleSet(exId: string, i: number, rest: number) {
    setExLogs(prev => { const c = [...(prev[exId] || [])]; c[i] = { ...c[i], done: !c[i].done }; if (c[i].done) startTimer(rest); return { ...prev, [exId]: c }; });
  }
  function updateLog(exId: string, i: number, field: 'w'|'r', val: string) {
    setExLogs(prev => { const c = [...(prev[exId] || [])]; c[i] = { ...c[i], [field]: val }; return { ...prev, [exId]: c }; });
  }
  function addSet(exId: string) {
    const ex = esercizi.find(e => e.id === exId);
    setExLogs(prev => { const c = [...(prev[exId] || [])]; c.push({ w: ex?.weight || '', r: ex?.reps || '', done: false }); return { ...prev, [exId]: c }; });
  }
  function removeSet(exId: string, i: number) {
    setExLogs(prev => { const c = [...(prev[exId] || [])]; c.splice(i, 1); return { ...prev, [exId]: c }; });
  }

  async function openStorico(exNameStr: string) {
    setStoricoName(exNameStr); setStoricoData([]); setStoricoModal(true);
    const { data: wlogs } = await supabase.from('workout_logs').select('completed_at,day_name,logs').eq('client_id', userId).order('completed_at', { ascending: false }).limit(50);
    const results: any[] = [];
    (wlogs || []).forEach((log: any) => {
      if (!log.logs) return;
      esercizi.forEach((ex: any) => {
        if ((ex.exercises?.name || '').toLowerCase().trim() !== exNameStr.toLowerCase().trim()) return;
        const sets: SetLog[] = (log.logs[ex.id] || []).filter((s: any) => s.done && s.w);
        if (sets.length > 0) results.push({ date: new Date(log.completed_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' }), dayName: log.day_name, sets });
      });
    });
    setStoricoData(results);
  }

  function openEdit(log: any) {
    const map: Record<string, string> = {};
    routines.forEach(r => r.exercises.forEach((ex: any) => { map[ex.id] = ex.exercises?.name || ex.id; }));
    setExNames(map); setEditingLog(log);
    const editable: Record<string, SetLog[]> = {};
    if (log.logs) Object.entries(log.logs as Record<string, any[]>).forEach(([exId, sets]) => { editable[exId] = sets.map((ss: any) => ({ ...ss })); });
    setEditSets(editable); setEditModal(true);
  }
  function updateEditSet(exId: string, si: number, field: 'w'|'r', val: string) {
    setEditSets(prev => { const c = [...(prev[exId] || [])]; c[si] = { ...c[si], [field]: val }; return { ...prev, [exId]: c }; });
  }
  async function saveEdit() {
    if (!editingLog) return;
    await supabase.from('workout_logs').update({ logs: editSets }).eq('id', editingLog.id);
    setEditModal(false); setEditingLog(null); loadList();
  }
  async function deleteLog(logId: string) {
    if (!confirm('Eliminare questo allenamento?')) return;
    await supabase.from('workout_logs').delete().eq('id', logId);
    setLogs(prev => prev.filter(l => l.id !== logId));
  }

  const currentEx = esercizi[currExIdx];
  const currentLogs = currentEx ? (exLogs[currentEx.id] || []) : [];
  const rest = currentEx?.rest_seconds || 60;
  const exName = currentEx?.exercises?.name || 'Esercizio';

  // ── SCHERMATA ALLENAMENTO ATTIVO ──
  if (screen === 'active' && currentEx) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
          <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>{schedaName}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ margin: 15, background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: 18, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)', marginBottom: 5 }}>{schedaName} — {dayName}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', lineHeight: 1.2, marginBottom: 4 }}>{exName}</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{currentEx.sets || 3} serie · {currentEx.reps || ''} rep · Rec {rest}s</div>
                {currentEx.notes && <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--accent)', marginTop: 4 }}>{currentEx.notes}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <button onClick={esci} style={{ border: '2px solid var(--border)', borderRadius: 12, padding: '7px 14px', background: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', color: 'var(--text)' }}>Esci</button>
                <button onClick={() => openStorico(exName)} style={{ border: '2px solid var(--border)', borderRadius: 12, padding: '4px 10px', background: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', color: 'var(--text)' }}>Storico</button>
              </div>
            </div>
            {/* Table */}
            <div style={{ marginTop: 15 }}>
              <div style={{ display: 'flex', paddingBottom: 10 }}>
                <div style={{ width: 32 }} />
                <div style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>KG</div>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>REPS</div>
                <div style={{ width: 52, textAlign: 'center', fontSize: 11, fontWeight: 900, color: 'var(--text-muted)' }}>✓</div>
                <div style={{ width: 44 }} />
              </div>
              {currentLogs.map((log, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid var(--border)', padding: '5px 0' }}>
                  <div style={{ width: 32, textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--text-muted)' }}>{i+1}</div>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    <input value={log.w} onChange={e => updateLog(currentEx.id, i, 'w', e.target.value)} type="number" placeholder="—" style={{ width: '90%', textAlign: 'center', padding: '10px 2px', borderRadius: 12, border: `2px solid ${log.done ? 'var(--accent)' : 'var(--border)'}`, fontWeight: 900, fontSize: 17, background: 'var(--bg-input)', color: 'var(--text)', outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    <input value={log.r} onChange={e => updateLog(currentEx.id, i, 'r', e.target.value)} placeholder="—" style={{ width: '90%', textAlign: 'center', padding: '10px 2px', borderRadius: 12, border: `2px solid ${log.done ? 'var(--accent)' : 'var(--border)'}`, fontWeight: 900, fontSize: 17, background: 'var(--bg-input)', color: 'var(--text)', outline: 'none' }} />
                  </div>
                  <div style={{ width: 52, display: 'flex', justifyContent: 'center' }}>
                    <button onClick={() => toggleSet(currentEx.id, i, rest)} style={{ width: 44, height: 44, borderRadius: 12, border: `2.5px solid ${log.done ? 'var(--accent)' : 'var(--border)'}`, background: log.done ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: 20, fontWeight: 900, cursor: 'pointer' }}>{log.done ? '✓' : ''}</button>
                  </div>
                  <div style={{ width: 44, display: 'flex', justifyContent: 'center' }}>
                    <button onClick={() => removeSet(currentEx.id, i)} style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => addSet(currentEx.id)} style={{ marginTop: 18, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', width: '100%' }}>+ Aggiungi Serie</button>
            <textarea value={sessionNotes[currentEx.id] || ''} onChange={e => setSessionNotes(prev => ({ ...prev, [currentEx.id]: e.target.value }))} placeholder="Note per questa sessione..." rows={2}
              style={{ marginTop: 16, borderRadius: 12, border: '1px solid var(--border)', padding: '12px 14px', fontSize: 14, fontWeight: 600, width: '100%', background: 'var(--bg-input)', color: 'var(--text)', resize: 'none', outline: 'none' }} />
          </div>

          {/* Timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 15px' }}>
            <div onClick={() => { if (!timerRunning) startTimer(rest); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 20px', borderRadius: 50, border: `2px solid ${timerRunning ? 'var(--accent)' : 'var(--border)'}`, background: timerRunning ? 'rgba(255,107,53,.1)' : 'var(--bg-input)', cursor: 'pointer' }}>
              <span>🕐</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: timerRunning ? 'var(--accent)' : 'var(--text-sub)' }}>
                {timerRunning && timerVal !== null ? fmt(timerVal) : 'Recupero'}
              </span>
            </div>
            <button onClick={stopTimer} style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--border)', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text)' }}>■</button>
          </div>

          {/* Nav */}
          <div style={{ display: 'flex', gap: 10, padding: '0 15px', marginBottom: 10 }}>
            <button onClick={() => currExIdx > 0 && setCurrExIdx(i => i-1)} disabled={currExIdx === 0} style={{ flex: 1, border: '2px solid var(--border)', borderRadius: 14, padding: 15, background: 'none', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: 'var(--text)', opacity: currExIdx === 0 ? .3 : 1 }}>←</button>
            <button onClick={() => setConfirmFinish(true)} style={{ flex: 2, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 900, cursor: 'pointer' }}>TERMINA</button>
            <button onClick={() => currExIdx < esercizi.length-1 && setCurrExIdx(i => i+1)} disabled={currExIdx === esercizi.length-1} style={{ flex: 1, border: '2px solid var(--border)', borderRadius: 14, padding: 15, background: 'none', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: 'var(--text)', opacity: currExIdx === esercizi.length-1 ? .3 : 1 }}>→</button>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>{currExIdx+1} / {esercizi.length}  ·  {fmt(elapsed)}</div>
          <div style={{ height: 20 }} />
        </div>

        {/* Confirm overlay */}
        {confirmFinish && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 999 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', color: 'var(--text)' }}>Termina allenamento?</div>
              <div style={{ fontSize: 14, textAlign: 'center', color: 'var(--text-sub)' }}>Il log verrà salvato automaticamente</div>
              <button onClick={doFinish} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>✓  Salva e termina</button>
              <button onClick={() => setConfirmFinish(false)} style={{ border: '1px solid var(--border)', background: 'none', borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text-sub)' }}>Annulla</button>
            </div>
          </div>
        )}

        {/* Storico modal */}
        {storicoModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 25, width: '100%', maxWidth: 450, position: 'relative', maxHeight: '80dvh', overflowY: 'auto' }}>
              <button onClick={() => setStoricoModal(false)} style={{ position: 'absolute', top: 15, right: 15, width: 28, height: 28, borderRadius: '50%', background: 'var(--border)', border: 'none', cursor: 'pointer', fontWeight: 900, color: 'var(--text)' }}>✕</button>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent)', marginBottom: 14, marginRight: 36 }}>Storico: {storicoName}</div>
              {storicoData.length === 0
                ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-sub)' }}>Nessun dato trovato</div>
                : storicoData.map((entry, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>{entry.date} ({entry.dayName}):</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{entry.sets.map((s: SetLog) => `${s.w}kg x ${s.r}`).join(', ')}</div>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LISTA SCHEDE ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px', paddingTop: 'max(env(safe-area-inset-top,16px),16px)', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>Schede</div>
        <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
          {(['routine','passati'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: 10, borderRadius: 9, border: 'none', cursor: 'pointer', background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#fff' : 'var(--text-sub)', fontSize: 13, fontWeight: 800, letterSpacing: .3 }}>
              {t === 'routine' ? 'ROUTINE' : 'PASSATI'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'routine' ? (
            <>
              {activeWorkout && (
                <>
                  <div style={{ background: 'var(--bg-card)', border: '2.5px solid var(--accent)', borderRadius: 18, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)' }}>RIPRENDI: {activeWorkout.schedaName}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-sub)', marginTop: 3 }}>{activeWorkout.dayName}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setActiveWorkout(null)} style={{ border: '2px solid var(--accent)', background: 'none', color: 'var(--accent)', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>ANNULLA</button>
                      <button onClick={riprendi} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>VAI</button>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                </>
              )}
              {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>Caricamento...</div>
                : routines.length === 0
                  ? <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 20 }}>
                      <div style={{ fontSize: 44 }}>💪</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Nessuna scheda assegnata</div>
                      <div style={{ fontSize: 14, color: 'var(--text-sub)', textAlign: 'center' }}>Il tuo coach ti assegnerà una scheda presto</div>
                    </div>
                  : routines.map(r => (
                    <div key={`${r.templateId}-${r.dayId}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, color: 'var(--text-sub)' }}>{r.templateName}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', margin: '3px 0' }}>{r.dayName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{[r.goal, r.level, r.exercises.length > 0 ? r.exercises.length+' es.' : ''].filter(Boolean).join(' · ')}</div>
                      </div>
                      <button onClick={() => avvia(r)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 15, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>AVVIA</button>
                    </div>
                  ))
              }
            </>
          ) : (
            loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>Caricamento...</div>
              : logs.length === 0
                ? <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 20 }}>
                    <div style={{ fontSize: 44 }}>📋</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Nessun allenamento completato</div>
                    <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>Avvia una routine per iniziare</div>
                  </div>
                : logs.map(log => {
                    const date = new Date(log.completed_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
                    const dur = log.duration_seconds ? `${Math.floor(log.duration_seconds/60)} min` : '';
                    return (
                      <div key={log.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent)' }}>{date}{dur ? '  ·  '+dur : ''}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{log.template_name} — {log.day_name}</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => openEdit(log)} style={{ padding: '7px 12px', borderRadius: 10, border: '2px solid #2ecc71', color: '#2ecc71', background: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Modifica</button>
                            <button onClick={() => deleteLog(log.id)} style={{ padding: '7px 12px', borderRadius: 10, border: '2px solid #e53939', color: '#e53939', background: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>X</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
          )}
          <div style={{ height: 20 }} />
        </div>
      </div>

      {/* Edit modal */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 25, width: '100%', maxWidth: 450, position: 'relative', maxHeight: '80dvh', overflowY: 'auto' }}>
            <button onClick={() => setEditModal(false)} style={{ position: 'absolute', top: 15, right: 15, width: 28, height: 28, borderRadius: '50%', background: 'var(--border)', border: 'none', cursor: 'pointer', fontWeight: 900, color: 'var(--text)' }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent)', marginBottom: 4, marginRight: 36 }}>{editingLog?.template_name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 14 }}>{editingLog ? new Date(editingLog.completed_at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</div>
            {Object.entries(editSets).map(([exId, sets]) => {
              if (!sets.some(ss => ss.done)) return null;
              return (
                <div key={exId} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{exNames[exId] || exId}</div>
                  {sets.map((ss, si) => {
                    if (!ss.done) return null;
                    return (
                      <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <input value={ss.w} onChange={e => updateEditSet(exId, si, 'w', e.target.value)} type="number" placeholder="kg" style={{ width: 70, borderRadius: 10, border: '1.5px solid var(--border)', padding: 10, textAlign: 'center', fontWeight: 800, fontSize: 15, background: 'var(--bg-input)', color: 'var(--text)', outline: 'none' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-sub)', minWidth: 30 }}>kg</span>
                        <input value={ss.r} onChange={e => updateEditSet(exId, si, 'r', e.target.value)} placeholder="reps" style={{ width: 70, borderRadius: 10, border: '1.5px solid var(--border)', padding: 10, textAlign: 'center', fontWeight: 800, fontSize: 15, background: 'var(--bg-input)', color: 'var(--text)', outline: 'none' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-sub)' }}>reps</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <button onClick={saveEdit} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', width: '100%', marginTop: 8 }}>SALVA</button>
          </div>
        </div>
      )}
    </div>
  );
}
