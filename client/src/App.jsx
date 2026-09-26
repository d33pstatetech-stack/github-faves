import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { filterAndSort, SORTS } from './lib/filter.js';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import RepoCard from './components/RepoCard.jsx';

export default function App() {
  const [repos, setRepos] = useState([]);
  const [taxonomy, setTaxonomy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [q, setQ] = useState('');
  const [selectedCats, setSelectedCats] = useState(() => new Set());
  const [selectedTags, setSelectedTags] = useState(() => new Set());
  const [sort, setSort] = useState('starred_desc');
  const [matchAll, setMatchAll] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [triageOnly, setTriageOnly] = useState(false);

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState(null);

  const load = useCallback(async () => {
    try {
      const [idx, tax] = await Promise.all([api.index(), api.taxonomy()]);
      setRepos(idx.repos || []);
      setTaxonomy(tax);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    setSyncInfo({ message: 'Starting…' });
    try {
      await api.syncStart();
      // The frontend drives the batch loop; each call is one small server-side
      // step so no single invocation exceeds the Workers CPU budget.
      for (let i = 0; i < 200; i++) {
        const st = await api.syncStep();
        setSyncInfo({ message: st.message, phase: st.phase, processed: st.processed, total: st.total });
        if (st.status === 'done' || st.status === 'idle') break;
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
      setSyncInfo(null);
    }
  }, [load]);

  // Triage = repos no classifier could place. Newest first, always.
  const triageCount = useMemo(
    () => repos.filter((r) => (r.cats || []).length === 0).length,
    [repos]
  );

  const visible = useMemo(() => {
    const base = triageOnly
      ? repos.filter((r) => (r.cats || []).length === 0)
      : repos;
    return filterAndSort(
      base,
      // While triaging, newest-first is the only useful order.
      { q, cats: selectedCats, tags: selectedTags, sort: triageOnly ? 'starred_desc' : sort, matchAll }
    );
  }, [repos, q, selectedCats, selectedTags, sort, matchAll, triageOnly]);

  // Sidebar counts describe the whole collection, so a category that exists
  // reads as "0" rather than silently vanishing.
  const counts = useMemo(() => {
    const byCat = {};
    const byTag = {};
    for (const r of repos) {
      for (const c of r.cats || []) byCat[c] = (byCat[c] || 0) + 1;
      for (const t of r.tags || []) byTag[t] = (byTag[t] || 0) + 1;
    }
    return { cats: byCat, tags: byTag };
  }, [repos]);

  const toggleCat = (slug) => setSelectedCats((s) => {
    const n = new Set(s);
    n.has(slug) ? n.delete(slug) : n.add(slug);
    return n;
  });
  const toggleTag = (slug) => setSelectedTags((s) => {
    const n = new Set(s);
    n.has(slug) ? n.delete(slug) : n.add(slug);
    return n;
  });
  const clearAll = () => {
    setSelectedCats(new Set());
    setSelectedTags(new Set());
    setQ('');
    setTriageOnly(false);
  };
  const activeCount = selectedCats.size + selectedTags.size + (q.trim() ? 1 : 0);

  const onNoteSaved = (fullName, note) => {
    setRepos((rs) => rs.map((r) => (r.full_name === fullName ? { ...r, note } : r)));
  };

  return (
    <div className="min-h-full">
      <Header
        q={q} setQ={setQ}
        sort={sort} setSort={setSort}
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        activeCount={activeCount} onClearFilters={clearAll}
        triageOnly={triageOnly} setTriageOnly={setTriageOnly} triageCount={triageCount}
        syncing={syncing} syncInfo={syncInfo} onSync={runSync}
      />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        taxonomy={taxonomy}
        selectedCats={selectedCats} toggleCat={toggleCat} clearCats={() => setSelectedCats(new Set())}
        selectedTags={selectedTags} toggleTag={toggleTag} clearTags={() => setSelectedTags(new Set())}
        matchAll={matchAll} setMatchAll={setMatchAll}
        counts={counts}
      />

      <main
        className={`pt-16 transition-[padding] duration-200 ${
          sidebarOpen ? 'lg:pl-[20rem]' : 'lg:pl-0'
        }`}
      >
        <div className="mx-auto max-w-[1900px] px-3 py-4 sm:px-5">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.8125rem] text-muted">
              <span className="text-base font-bold tabular-nums text-primary">{visible.length}</span>
              {visible.length === repos.length ? ' repos' : ` of ${repos.length} repos`}
              {triageOnly && <span className="text-amber"> · awaiting triage</span>}
              {activeCount > 0 && !triageOnly && <span> · filtered</span>}
            </p>
            {(activeCount > 0 || triageOnly) && (
              <button
                onClick={clearAll}
                className="rounded-lg border border-edge bg-surface px-3 py-1.5 text-[0.8125rem] font-semibold text-secondary transition hover:border-edge-hi hover:text-primary"
              >
                Clear filters
              </button>
            )}
          </div>

          {loading && <div className="py-24 text-center text-sm text-muted">Loading…</div>}

          {!loading && error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm text-rose-200">
              <p className="font-bold">Could not load</p>
              <p className="mt-1 text-xs opacity-80">{error}</p>
              <button onClick={load} className="mt-3 rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs font-bold">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && repos.length === 0 && (
            <EmptyState onSync={runSync} syncing={syncing} />
          )}

          {!loading && !error && repos.length > 0 && visible.length === 0 && (
            <div className="py-24 text-center">
              <p className="text-sm text-muted">No repos match these filters.</p>
              <button onClick={clearAll} className="mt-3 rounded-lg border border-edge bg-surface px-4 py-2 text-xs font-bold text-secondary transition hover:border-edge-hi hover:text-primary">
                Clear filters
              </button>
            </div>
          )}

          {visible.length > 0 && (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((r) => (
                <RepoCard
                  key={r.full_name}
                  repo={r}
                  categories={taxonomy?.categories || []}
                  onNoteSaved={onNoteSaved}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState({ onSync, syncing }) {
  return (
    <div className="py-24 text-center">
      <p className="text-4xl">⭐</p>
      <h2 className="neon-title mt-4 text-lg font-bold">Nothing synced yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-secondary">
        Hit Sync to pull in every starred repo. Each one is classified into
        categories and tags automatically.
      </p>
      <button
        onClick={onSync}
        disabled={syncing}
        className="mt-5 rounded-lg bg-violet px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-115 active:scale-95 disabled:opacity-60"
      >
        {syncing ? 'Syncing…' : 'Sync my stars'}
      </button>
    </div>
  );
}
