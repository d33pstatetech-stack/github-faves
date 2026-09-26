import { useState } from 'react';
import { SORTS } from '../lib/filter.js';

/**
 * Fixed header: sidebar toggle, search, triage toggle, sort, sync.
 * Search filters as you type; nothing here waits on a round trip.
 */
export default function Header({
  q, setQ, sort, setSort,
  sidebarOpen, setSidebarOpen,
  activeCount, onClearFilters,
  triageOnly, setTriageOnly, triageCount,
  syncing, syncInfo, onSync,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sorts = SORTS;

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-edge/80 bg-base/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1900px] items-center gap-2.5 px-3 sm:gap-3 sm:px-5">
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle filters sidebar"
          aria-expanded={sidebarOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-edge bg-surface text-muted transition hover:border-edge-hi hover:text-primary active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {sidebarOpen ? (
              <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>
            ) : (
              <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>
            )}
          </svg>
        </button>

        <a href="/" className="hidden shrink-0 items-center gap-2 sm:flex">
          <span className="text-xl leading-none">⭐</span>
          <span className="neon-title text-[0.9375rem] font-bold tracking-tight">
            Github Faves
          </span>
        </a>

        {/* Search */}
        <div className="relative min-w-0 flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, description, topics, tags, notes…"
            aria-label="Search repositories"
            className="h-10 w-full rounded-lg border border-edge bg-surface pl-11 pr-3 text-sm text-primary placeholder:text-faint focus:border-edge-hi focus:bg-surface-hi focus:outline-none"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-faint transition hover:text-primary"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Triage: the "starred it, haven't filed it yet" queue. */}
        {triageCount > 0 && (
          <button
            onClick={() => setTriageOnly((v) => !v)}
            aria-pressed={triageOnly}
            title="Show only repos with no category yet"
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition active:scale-95 ${
              triageOnly
                ? 'border-amber/60 bg-amber/20 text-amber'
                : 'border-edge bg-surface text-muted hover:border-edge-hi hover:text-primary'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v6M12 22v-6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M2 12h6M22 12h-6M4.9 19.1l4.2-4.2M14.9 9.1l4.2-4.2" />
            </svg>
            <span className="hidden md:inline">Triage</span>
            <span className="tabular-nums">{triageCount}</span>
          </button>
        )}

        {/* Active filter count + clear */}
        {activeCount > 0 && (
          <button
            onClick={onClearFilters}
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-edge-hi bg-surface-hi px-3 py-2 text-xs font-bold text-primary transition hover:bg-surface-top lg:flex"
          >
            {activeCount} filter{activeCount > 1 ? 's' : ''}
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}

        {/* Sort */}
        <div className="relative hidden shrink-0 sm:block">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort repositories"
            className="h-10 appearance-none rounded-lg border border-edge bg-surface pl-3 pr-9 text-xs font-semibold text-secondary focus:border-edge-hi focus:outline-none"
          >
            {sorts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>

        {/* Sync */}
        <button
          onClick={onSync}
          disabled={syncing}
          title="Pull newly starred repos and refresh existing ones"
          className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-violet px-3.5 text-xs font-bold text-white transition hover:brightness-115 active:scale-95 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className={`h-4 w-4 ${syncing ? 'spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" />
          </svg>
          <span className="hidden sm:inline">{syncing ? 'Syncing' : 'Sync'}</span>
        </button>

        {/* Sort on mobile */}
        <div className="relative sm:hidden">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Sort options"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-edge bg-surface text-muted"
          >
            <svg viewBox="0 0 24 24" className="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h13" /><path d="M3 12h9" /><path d="M3 18h5" />
              <path d="m17 14 3 3 3-3" /><path d="M20 17V4" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-edge bg-surface shadow-2xl">
              {sorts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSort(s.id); setMenuOpen(false); }}
                  className={`block w-full px-3.5 py-2.5 text-left text-xs font-semibold transition hover:bg-surface-hi ${sort === s.id ? 'text-neon' : 'text-secondary'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {syncing && (
        <div className="flex items-center gap-2 border-t border-edge/70 bg-surface/70 px-4 py-1.5 text-[0.6875rem] font-medium text-secondary">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-neon shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
          <span className="truncate">{syncInfo?.message || 'Syncing…'}</span>
        </div>
      )}
    </header>
  );
}
