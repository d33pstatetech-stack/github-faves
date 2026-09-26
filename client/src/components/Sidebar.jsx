import { useMemo, useState } from 'react';

/**
 * Pop-out filter panel.
 *   - Categories: collapsible list + its own text filter box
 *   - Tags: listed openly + their own text filter box
 * Selection applies instantly; the Any/All switch governs how multiple
 * selections combine (Any = union, All = intersection).
 */
export default function Sidebar({
  open, onClose,
  taxonomy,
  selectedCats, toggleCat, clearCats,
  selectedTags, toggleTag, clearTags,
  matchAll, setMatchAll,
  counts,
}) {
  const [catFilter, setCatFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [catsOpen, setCatsOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);

  const cats = taxonomy?.categories || [];
  const tags = taxonomy?.tags || [];

  const shownCats = useMemo(() => {
    const f = catFilter.trim().toLowerCase();
    return cats
      .filter((c) => !f || c.label.toLowerCase().includes(f) || c.slug.includes(f))
      .sort((a, b) => (counts.cats[b.slug] || 0) - (counts.cats[a.slug] || 0) || (a.sort ?? 100) - (b.sort ?? 100));
  }, [cats, catFilter, counts.cats]);

  const shownTags = useMemo(() => {
    const f = tagFilter.trim().toLowerCase();
    return tags
      .filter((t) => !f || t.slug.includes(f) || (t.label || '').toLowerCase().includes(f))
      .sort((a, b) => b.count - a.count);
  }, [tags, tagFilter]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-void/70 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-16 bottom-0 z-50 flex w-[20rem] flex-col border-r border-edge bg-surface/95 backdrop-blur-xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Filters"
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="neon-title text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-secondary">
            Filters
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-edge text-[0.6875rem] font-bold">
              {[
                ['any', 'Any', 'Match at least one selected filter'],
                ['all', 'All', 'Match every selected filter'],
              ].map(([mode, label, title]) => (
                <button
                  key={mode}
                  onClick={() => setMatchAll(mode === 'all')}
                  title={title}
                  className={`px-2.5 py-1.5 transition ${
                    (mode === 'all') === matchAll
                      ? 'bg-violet text-white'
                      : 'bg-surface-hi text-muted hover:text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              aria-label="Close sidebar"
              className="rounded p-1.5 text-muted transition hover:bg-surface-hi hover:text-primary lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          {/* ── Categories ── */}
          <Section
            title="Categories"
            count={selectedCats.size}
            open={catsOpen}
            onToggle={() => setCatsOpen((v) => !v)}
            onClear={clearCats}
          >
            <FilterInput
              value={catFilter}
              onChange={setCatFilter}
              placeholder="Filter categories…"
              ariaLabel="Filter category list"
            />
            <ul className="mt-2 space-y-0.5 pb-3">
              {shownCats.length === 0 && (
                <li className="px-1.5 py-2 text-xs text-faint">No categories match.</li>
              )}
              {shownCats.map((c) => {
                const n = counts.cats[c.slug] || 0;
                const on = selectedCats.has(c.slug);
                return (
                  <li key={c.slug}>
                    <button
                      onClick={() => toggleCat(c.slug)}
                      aria-pressed={on}
                      title={c.description}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${
                        on
                          ? 'bg-violet/18 text-primary ring-1 ring-inset ring-violet/45'
                          : 'text-secondary hover:bg-surface-hi hover:text-primary'
                      }`}
                    >
                      <span
                        className={`flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded border ${
                          on ? 'border-violet bg-violet' : 'border-edge-hi'
                        }`}
                      >
                        {on && (
                          <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                      <span className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_6px_currentColor]" style={{ background: c.color, color: c.color }} />
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold">{c.label}</span>
                      <span className="shrink-0 text-[0.6875rem] font-semibold tabular-nums text-faint">{n}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>

          {/* ── Tags ── */}
          <Section
            title="Tags"
            count={selectedTags.size}
            open={tagsOpen}
            onToggle={() => setTagsOpen((v) => !v)}
            onClear={clearTags}
          >
            <FilterInput
              value={tagFilter}
              onChange={setTagFilter}
              placeholder="Filter tags…"
              ariaLabel="Filter tag list"
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5 pb-4">
              {shownTags.length === 0 && (
                <span className="px-1 py-1.5 text-xs text-faint">No tags match.</span>
              )}
              {shownTags.map((t) => {
                const on = selectedTags.has(t.slug);
                return (
                  <button
                    key={t.slug}
                    onClick={() => toggleTag(t.slug)}
                    aria-pressed={on}
                    className={`rounded-md border px-2 py-1 text-[0.6875rem] font-bold transition ${
                      on
                        ? 'neon-tag'
                        : 'border-edge bg-surface-hi text-secondary hover:border-edge-hi hover:text-primary'
                    }`}
                  >
                    {t.label || t.slug}
                    <span className="ml-1.5 tabular-nums opacity-60">{t.count}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        </div>
      </aside>
    </>
  );
}

function Section({ title, count, open, onToggle, onClear, children }) {
  return (
    <section className="border-b border-edge/60 px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        <button onClick={onToggle} aria-expanded={open} className="flex flex-1 items-center gap-2 text-left">
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-secondary">{title}</span>
          {count > 0 && (
            <span className="rounded bg-violet px-1.5 py-0.5 text-[0.625rem] font-bold text-white tabular-nums">{count}</span>
          )}
        </button>
        {count > 0 && (
          <button onClick={onClear} className="text-[0.6875rem] font-semibold text-faint transition hover:text-primary">
            clear
          </button>
        )}
      </div>
      {open && <div className="mt-2.5">{children}</div>}
    </section>
  );
}

function FilterInput({ value, onChange, placeholder, ariaLabel }) {
  return (
    <div className="relative">
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-2.5 top-1/2 h-[0.875rem] w-[0.875rem] -translate-y-1/2 text-faint" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-8 w-full rounded-lg border border-edge bg-void/50 pl-8 pr-2.5 text-[0.8125rem] text-primary placeholder:text-faint focus:border-edge-hi focus:outline-none"
      />
    </div>
  );
}
