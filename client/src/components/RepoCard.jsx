import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { fmtAgo, fmtDate, fmtStars } from '../lib/filter.js';

const DEEPWIKI = (fullName) => `https://deepwiki.com/${fullName}`;

/**
 * Front: owner, repo name (large + neon), description, tags.
 * Back: README-derived summary, stats, links, sticky note.
 * Click / Enter / Space flips. The back face loads its detail lazily.
 */
export default function RepoCard({ repo, categories, onNoteSaved }) {
  const [flipped, setFlipped] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState(repo.note || '');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!flipped || loaded.current) return;
    loaded.current = true;
    setLoading(true);
    api.repo(repo.full_name)
      .then((d) => {
        setDetail(d);
        setNote(d.note || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [flipped, repo.full_name]);

  async function saveNote() {
    setSavingNote(true);
    try {
      await api.saveNote(repo.full_name, note.trim());
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1600);
      onNoteSaved?.(repo.full_name, note.trim());
    } finally {
      setSavingNote(false);
    }
  }

  const catLabels = (repo.cats || []).map(
    (slug) => categories.find((c) => c.slug === slug)?.label || slug
  );

  return (
    <div className="flip-scene h-[19rem]">
      <div
        className={`flip-inner cursor-pointer ${flipped ? 'is-flipped' : ''}`}
        onClick={() => setFlipped((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFlipped((v) => !v);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`${repo.full_name}. ${flipped ? 'Show front' : 'Show details'}`}
        aria-pressed={flipped}
      >
        {/* ── FRONT ── */}
        <article className="flip-face p-4">
          {/* Owner: deliberately quiet. */}
          <p className="truncate text-xs font-medium tracking-wide text-muted">
            {repo.owner}
          </p>

          {/* Name: the focal point. */}
          <div className="mt-0.5 flex items-start justify-between gap-2">
            <h3
              className="neon-title min-w-0 flex-1 text-[1.375rem] font-bold leading-[1.15] tracking-tight"
              title={repo.name}
            >
              {repo.name}
            </h3>
            <div className="flex shrink-0 items-center gap-2.5 pt-1.5 text-xs font-semibold tabular-nums text-neon/90">
              <span title={`${repo.stars} stars`} className="flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                  <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
                </svg>
                {fmtStars(repo.stars)}
              </span>
              {repo.is_archived && (
                <span className="text-amber/80" title="Archived upstream">A</span>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="mt-2.5 line-clamp-3 text-[0.8125rem] leading-[1.5] text-secondary">
            {repo.description || (
              <span className="italic text-faint">No description</span>
            )}
          </p>

          {/* Tags — luminous, distinct from prose. */}
          <div className="mt-auto flex flex-wrap items-end gap-1.5 pt-3">
            {repo.tags?.length > 0 ? (
              <>
                {repo.tags.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="neon-tag rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide"
                  >
                    {t}
                  </span>
                ))}
                {repo.tags.length > 4 && (
                  <span className="pb-0.5 text-[0.6875rem] font-semibold text-faint">
                    +{repo.tags.length - 4}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[0.6875rem] italic text-faint">untagged</span>
            )}
          </div>

          {repo.note && (
            <span
              title="Has a note"
              className="absolute right-3.5 top-3.5 h-2 w-2 rounded-full bg-amber shadow-[0_0_8px_rgba(251,191,36,0.8)]"
            />
          )}
        </article>

        {/* ── BACK ── */}
        <article className="flip-face flip-face-back p-4">
          <div className="mb-2.5 flex items-start justify-between gap-2">
            <h3 className="neon-title-cyan min-w-0 flex-1 text-[0.9375rem] font-bold leading-tight">
              {repo.full_name}
            </h3>
            <button
              onClick={(e) => { e.stopPropagation(); setFlipped(false); }}
              aria-label="Flip back"
              className="shrink-0 rounded p-1 text-muted transition hover:bg-white/5 hover:text-primary"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" />
              </svg>
            </button>
          </div>

          <dl className="mb-2.5 grid grid-cols-3 gap-1.5 text-center">
            <Stat label="Stars" value={fmtStars(repo.stars)} />
            <Stat label="Starred" value={fmtAgo(repo.starred_at)} />
            <Stat label="Pushed" value={fmtAgo(repo.pushed_at)} />
          </dl>

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pr-1">
            {loading && <p className="text-[0.8125rem] text-muted">Loading…</p>}
            {!loading && (
              <>
                {catLabels.length > 0 && (
                  <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-violet/90">
                    {catLabels.join(' · ')}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-[0.8125rem] leading-[1.55] text-secondary">
                  {detail?.summary || repo.description || (
                    <span className="italic text-faint">No description</span>
                  )}
                </p>
                <dl className="mt-2 space-y-0.5 text-[0.6875rem] text-muted">
                  {repo.language && (
                    <div className="flex gap-1.5"><dt>Language:</dt><dd className="text-secondary">{repo.language}</dd></div>
                  )}
                  {repo.license && (
                    <div className="flex gap-1.5"><dt>License:</dt><dd className="text-secondary">{repo.license}</dd></div>
                  )}
                  {repo.created_at && (
                    <div className="flex gap-1.5"><dt>Created:</dt><dd className="text-secondary">{fmtDate(repo.created_at)}</dd></div>
                  )}
                </dl>
              </>
            )}
          </div>

          <div className="mt-2.5 shrink-0">
            <label
              htmlFor={`note-${repo.full_name}`}
              className="mb-1 block text-[0.625rem] font-bold uppercase tracking-[0.12em] text-amber/85"
            >
              Note
            </label>
            <textarea
              id={`note-${repo.full_name}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              rows={2}
              maxLength={500}
              placeholder="Why did I star this?"
              className="w-full resize-none rounded-lg border border-edge bg-void/60 px-2.5 py-1.5 text-[0.75rem] leading-relaxed text-secondary placeholder:text-faint focus:border-amber/60 focus:outline-none"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); saveNote(); }}
                disabled={savingNote}
                className="rounded-md bg-amber px-2.5 py-1 text-[0.6875rem] font-bold text-void transition hover:brightness-110 active:scale-95 disabled:opacity-60"
              >
                {savingNote ? 'Saving…' : noteSaved ? 'Saved ✓' : 'Save note'}
              </button>
              <span className="text-[0.625rem] tabular-nums text-faint">{note.length}/500</span>
            </div>
          </div>

          <div className="mt-2.5 flex shrink-0 gap-1.5">
            <a
              href={`https://github.com/${repo.full_name}`}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded-lg border border-edge bg-surface-hi px-2 py-1.5 text-center text-[0.6875rem] font-bold text-secondary transition hover:border-edge-hi hover:bg-surface-top hover:text-primary"
            >
              GitHub ↗
            </a>
            <a
              href={DEEPWIKI(repo.full_name)}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded-lg border border-violet/45 bg-violet/15 px-2 py-1.5 text-center text-[0.6875rem] font-bold text-violet transition hover:bg-violet/25"
            >
              DeepWiki ↗
            </a>
          </div>
        </article>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-edge bg-void/50 px-1 py-1.5">
      <dt className="text-[0.5625rem] font-bold uppercase tracking-[0.1em] text-faint">{label}</dt>
      <dd className="truncate text-[0.8125rem] font-bold tabular-nums text-primary">{value}</dd>
    </div>
  );
}
