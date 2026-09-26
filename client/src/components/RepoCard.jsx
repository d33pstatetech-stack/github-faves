import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api.js';
import { fmtAgo, fmtDate, fmtStars } from '../lib/filter.js';

const DEEPWIKI = (fullName) => `https://deepwiki.com/${fullName}`;

const POP_W = 288;
const POP_H = 210;
const GAP = 10;

/**
 * Front: owner, repo name (large + neon), scrollable description, tags, note icon.
 * Back:  README summary, stats, outbound links.
 * Click / Enter / Space flips. The back face loads its detail lazily.
 */
export default function RepoCard({ repo, categories, onNoteSaved }) {
  const [flipped, setFlipped] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  // Note popover
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(repo.note || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const anchorRef = useRef(null);
  const popRef = useRef(null);
  const textareaRef = useRef(null);
  const loaded = useRef(false);
  const savedRef = useRef(repo.note || '');
  const [pos, setPos] = useState(null);

  const hasNote = (repo.note || note || '').trim().length > 0;

  useEffect(() => {
    if (!flipped) return;
    if (loaded.current) return;
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

  // ── popover positioning ────────────────────────────────────────────────
  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 10;
    let left;
    let top;

    if (vw < 640) {
      // Narrow viewport: no usable gutter beside the card, so drop below the
      // anchor and keep clear of the right edge.
      left = Math.max(margin, Math.min(r.left - 24, vw - POP_W - margin));
      top = r.bottom + GAP;
      if (top + POP_H > vh - margin) {
        top = Math.max(margin, r.top - POP_H - GAP);
      }
    } else {
      const fitsRight = vw - r.right >= POP_W + GAP + margin;
      left = fitsRight ? r.right + GAP : r.left - POP_W - GAP;
      left = Math.max(margin, Math.min(left, vw - POP_W - margin));
      top = Math.max(margin, Math.min(r.top - 8, vh - POP_H - margin));
    }
    setPos({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!noteOpen) {
      setPos(null);
      return;
    }
    place();
    const onScrollOrResize = () => place();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [noteOpen, place]);

  // Focus the textarea once the popover is on screen.
  useEffect(() => {
    if (!noteOpen || !pos) return;
    const t = setTimeout(() => textareaRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [noteOpen, pos]);

  // Dismiss on Escape or an outside click.
  useEffect(() => {
    if (!noteOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setNoteOpen(false);
      }
    };
    const onDown = (e) => {
      if (popRef.current?.contains(e.target)) return;
      if (anchorRef.current?.contains(e.target)) return;
      setNoteOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown, true);
    };
  }, [noteOpen]);

  // Autosave: whatever is typed is persisted, so there is nothing to lose by
  // closing the popover. Debounced to avoid a write per keystroke.
  useEffect(() => {
    if (!noteOpen) return;
    const current = note.trim();
    if (current === savedRef.current) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await api.saveNote(repo.full_name, current);
        savedRef.current = current;
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        onNoteSaved?.(repo.full_name, current);
      } catch {
        /* keep the draft; the next keystroke retries */
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [note, noteOpen, repo.full_name, onNoteSaved]);

  // Flush any pending edit when the popover closes or the card unmounts.
  useEffect(() => {
    if (noteOpen) return;
    const current = note.trim();
    if (current === savedRef.current) return;
    const flush = () => {
      savedRef.current = current;
      api.saveNote(repo.full_name, current)
        .then(() => onNoteSaved?.(repo.full_name, current))
        .catch(() => {});
    };
    flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteOpen]);

  const catLabels = (repo.cats || []).map(
    (slug) => categories.find((c) => c.slug === slug)?.label || slug
  );

  const notePopover =
    noteOpen && pos
      ? createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={`Note for ${repo.full_name}`}
            style={{ left: pos.left, top: pos.top, width: POP_W }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="fixed z-[70] rounded-xl border border-amber/35 bg-surface/97 p-3 shadow-[0_18px_45px_-10px_rgba(0,0,0,0.8),0_0_0_1px_rgba(251,191,36,0.12)] backdrop-blur-xl"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-amber/90">
                Note
              </span>
              <span className="truncate text-[0.625rem] text-faint">{repo.name}</span>
            </div>

            <textarea
              ref={textareaRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') setNoteOpen(false);
              }}
              rows={5}
              maxLength={500}
              placeholder="Why did I star this?"
              className="w-full resize-none rounded-lg border border-edge bg-void/70 px-2.5 py-2 text-[0.8125rem] leading-relaxed text-secondary placeholder:text-faint focus:border-amber/60 focus:outline-none"
            />

            <div className="mt-2 flex items-center gap-2">
              <span
                className={`text-[0.6875rem] font-semibold transition ${
                  saving ? 'text-amber/80' : saved ? 'text-emerald-400' : 'text-faint'
                }`}
                role="status"
                aria-live="polite"
              >
                {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Autosaves as you type'}
              </span>
              <button
                onClick={() => setNoteOpen(false)}
                className="ml-auto rounded-md border border-edge bg-surface-hi px-2.5 py-1.5 text-[0.6875rem] font-bold text-secondary transition hover:text-primary"
              >
                Close
              </button>
              <span className="text-[0.625rem] tabular-nums text-faint">
                {note.length}/500
              </span>
            </div>
          </div>,
          document.body
        )
      : null;

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
          <div className="flex items-start justify-between gap-2">
            {/* Owner: deliberately quiet. */}
            <p className="min-w-0 flex-1 truncate pt-0.5 text-xs font-medium tracking-wide text-muted">
              {repo.owner}
            </p>

            {/* Note toggle */}
            <button
              ref={anchorRef}
              onClick={(e) => {
                e.stopPropagation();
                setNoteOpen((v) => !v);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label={noteOpen ? 'Close note' : hasNote ? 'Edit note' : 'Add note'}
              aria-expanded={noteOpen}
              title={hasNote ? 'Edit note' : 'Add a note'}
              className={`-mr-1 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition active:scale-90 ${
                noteOpen || hasNote
                  ? 'border-amber/55 bg-amber/20 text-amber'
                  : 'border-edge bg-surface-hi text-muted hover:border-amber/45 hover:text-amber'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          </div>

          {/* Name: the focal point. */}
          <div className="mt-1 flex items-start justify-between gap-2">
            <h3
              className="neon-title min-w-0 flex-1 text-[1.375rem] font-bold leading-[1.15] tracking-tight"
              title={repo.name}
            >
              {repo.name}
            </h3>
            <div className="flex shrink-0 items-center gap-2 pt-1.5 text-xs font-semibold tabular-nums text-neon/90">
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

          {/* Description: fills the remaining height and scrolls. */}
          <div className="thin-scroll mt-2.5 min-h-0 flex-1 overflow-y-auto pr-1">
            <p className="text-[0.8125rem] leading-[1.5] text-secondary">
              {repo.description || (
                <span className="italic text-faint">No description</span>
              )}
            </p>
          </div>

          {/* Tags — luminous, distinct from prose. */}
          <div className="mt-2 flex shrink-0 flex-wrap items-end gap-1.5 pt-1.5">
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

          <div className="mt-3 flex shrink-0 gap-1.5">
            <a
              href={`https://github.com/${repo.full_name}`}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded-lg border border-edge bg-surface-hi px-2 py-2 text-center text-[0.6875rem] font-bold text-secondary transition hover:border-edge-hi hover:bg-surface-top hover:text-primary"
            >
              GitHub ↗
            </a>
            <a
              href={DEEPWIKI(repo.full_name)}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded-lg border border-violet/45 bg-violet/15 px-2 py-2 text-center text-[0.6875rem] font-bold text-violet transition hover:bg-violet/25"
            >
              DeepWiki ↗
            </a>
          </div>
        </article>
      </div>

      {notePopover}
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
