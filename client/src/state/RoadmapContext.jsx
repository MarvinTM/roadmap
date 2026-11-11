import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { validateRoadmap } from '@roadmap/shared';
import { reducer } from './reducer.js';

const RoadmapContext = createContext(null);
// How often an open page checks whether someone else saved a newer roadmap.
export const SYNC_INTERVAL_MS = 1000;
export const useRoadmap = () => useContext(RoadmapContext);

async function request(method, doc) {
  // Relative on purpose: resolves under whatever path the app is served from.
  const response = await fetch('api/roadmap', {
    method, cache: 'no-store',
    ...(doc ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Could not save roadmap.'), { status: response.status });
  return data;
}

export function RoadmapProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { doc: null, version: 0 });
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const current = useRef(state);
  current.current = state;
  const savedVersion = useRef(0);
  const busy = useRef(false);
  const alive = useRef(true);
  const lastChange = useRef(Date.now());
  const previousVersion = useRef(state.version);
  if (previousVersion.current !== state.version) {
    lastChange.current = Date.now();
    previousVersion.current = state.version;
  }

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const doc = await request('GET');
      const error = validateRoadmap(doc);
      if (error) throw new Error(error);
      if (!alive.current) return;
      savedVersion.current = 0;
      dispatch({ type: 'load', doc });
      setStatus('saved');
    } catch (error) {
      if (alive.current) { setMessage(error.message); setStatus('loadError'); }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  const save = useCallback(async () => {
    if (busy.current || !current.current.doc || current.current.version === savedVersion.current) return;
    busy.current = true;
    setStatus('saving');
    try {
      // The server only accepts the save if `revision` is still the latest (compare-and-swap).
      const snapshot = current.current;
      const metadata = await request('PUT', snapshot.doc);
      if (!alive.current) return;
      savedVersion.current = snapshot.version;
      dispatch({ type: 'saved', metadata });
      setStatus('saved');
    } catch (error) {
      if (alive.current) { setMessage(error.message); setStatus(error.status === 409 ? 'conflict' : 'error'); }
    } finally { busy.current = false; }
  }, []);

  useEffect(() => {
    if (!state.doc || ['loading', 'loadError', 'saving', 'error', 'conflict'].includes(status) || state.version === savedVersion.current) return;
    const timer = setTimeout(() => save(), Math.max(0, 500 - (Date.now() - lastChange.current)));
    return () => clearTimeout(timer);
  }, [state.doc, state.version, status, retry, save]);

  // Keep the page up to date with edits made elsewhere (another person or tab).
  // Only adopts the newer document while there is nothing unsaved locally and no
  // drag in progress, so it never discards or disturbs the user's own work.
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => {
    let checking = false;
    const idle = () => !busy.current && statusRef.current === 'saved' && current.current.doc &&
      current.current.version === savedVersion.current && !document.body.classList.contains('dragging');
    const check = async () => {
      if (checking || document.hidden || !idle()) return;
      checking = true;
      try {
        const response = await fetch('api/roadmap/revision', { cache: 'no-store' });
        if (!response.ok) return;
        const { revision } = await response.json();
        if (!alive.current || revision === current.current.doc.revision || !idle()) return;
        const version = current.current.version;
        const doc = await request('GET');
        if (!alive.current || validateRoadmap(doc) || !idle()) return;
        dispatch({ type: 'remote', doc, version });
      } catch { /* Offline or logged out: the next check, or the next save, will tell. */ }
      finally { checking = false; }
    };
    const timer = setInterval(check, SYNC_INTERVAL_MS);
    const visible = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('focus', visible);
    };
  }, []);

  useEffect(() => {
    const warn = (event) => {
      if (current.current.doc && current.current.version !== savedVersion.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const act = useCallback((action) => dispatch({ ...action, undoToken: crypto.randomUUID() }), []);
  const retrySave = () => { setStatus('saved'); setRetry((n) => n + 1); };
  return (
    <RoadmapContext.Provider value={{
      ...state, act, status: state.doc && status === 'saved' && state.version !== savedVersion.current ? 'pending' : status,
      message, reload: load, retrySave,
    }}>
      {children}
    </RoadmapContext.Provider>
  );
}
