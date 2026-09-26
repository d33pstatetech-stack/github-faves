const BASE = '/api';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error || ''; } catch { /* non-JSON */ }
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  health: () => req('/health'),
  index: () => req('/index'),
  taxonomy: () => req('/taxonomy'),
  repo: (fullName) => req(`/repo?full_name=${encodeURIComponent(fullName)}`),

  saveNote: (fullName, note) =>
    req('/repo/note', { method: 'PUT', body: JSON.stringify({ full_name: fullName, note }) }),

  saveOverride: (fullName, cats, tags) =>
    req('/repo/override', { method: 'PUT', body: JSON.stringify({ full_name: fullName, cats, tags }) }),

  syncStart: () => req('/sync/start', { method: 'POST' }),
  syncStep: () => req('/sync/step', { method: 'POST' }),
  syncStatus: () => req('/sync/status'),
  reclassify: () => req('/reclassify', { method: 'POST' }),
};
