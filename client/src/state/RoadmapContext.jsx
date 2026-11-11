import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { validateRoadmap } from '@roadmap/shared';
import { reducer } from './reducer.js';

const RoadmapContext = createContext(null);
export const useRoadmap = () => useContext(RoadmapContext);

async function request(method, doc) {
  const response = await fetch('/api/roadmap', {
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

  const save = useCallback(async (overwrite = false) => {
    if (busy.current || !current.current.doc) return;
    busy.current = true;
    setStatus('saving');
    try {
      // Rebase the local snapshot onto the latest revision, still using CAS on PUT.
      const revision = overwrite ? (await request('GET')).revision : current.current.doc.revision;
      const snapshot = current.current;
      const metadata = await request('PUT', { ...snapshot.doc, revision });
      if (!alive.current) return;
      savedVersion.current = snapshot.version;
      dispatch({ type: 'saved', metadata });
      setStatus('saved');
    } catch (error) {
      if (alive.current) { setMessage(error.message); setStatus(error.status === 409 ? 'conflict' : 'error'); }
    } finally { busy.current = false; }
  }, []);

  useEffect(() => {
    if (!state.doc || ['loading', 'loadError', 'error', 'conflict'].includes(status) || state.version === savedVersion.current) return;
    const timer = setTimeout(() => save(), Math.max(0, 500 - (Date.now() - lastChange.current)));
    return () => clearTimeout(timer);
  }, [state.doc, state.version, status, retry, save]);

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
      message, reload: load, retrySave, overwrite: () => save(true),
    }}>
      {children}
    </RoadmapContext.Provider>
  );
}
