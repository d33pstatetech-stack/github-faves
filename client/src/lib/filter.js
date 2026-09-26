/** Filtering + sorting. Pure functions so the grid re-renders instantly. */

export const SORTS = [
  { id: 'starred_desc', label: 'Recently starred' },
  { id: 'starred_asc', label: 'Oldest starred' },
  { id: 'name_asc', label: 'Name (A→Z)' },
  { id: 'name_desc', label: 'Name (Z→A)' },
  { id: 'stars_desc', label: 'Most stars' },
  { id: 'stars_asc', label: 'Fewest stars' },
  { id: 'pushed_desc', label: 'Recently updated' },
  { id: 'pushed_asc', label: 'Least recently updated' },
  { id: 'age_desc', label: 'Newest repo' },
  { id: 'age_asc', label: 'Oldest repo' },
  { id: 'forks_desc', label: 'Most forks' },
];

const t = (v) => (v ? Date.parse(v) || 0 : 0);

export function filterAndSort(repos, { q, cats, tags, sort, matchAll }) {
  const needle = q.trim().toLowerCase();
  const terms = needle ? needle.split(/\s+/) : [];

  let out = repos.filter((r) => {
    // Category filter
    if (cats.size) {
      const hit = matchAll
        ? [...cats].every((c) => r.cats.includes(c))
        : [...cats].some((c) => r.cats.includes(c));
      if (!hit) return false;
    }
    // Tag filter
    if (tags.size) {
      const hit = matchAll
        ? [...tags].every((tg) => r.tags.includes(tg))
        : [...tags].some((tg) => r.tags.includes(tg));
      if (!hit) return false;
    }
    // Text search across name, description, topics, tags, note
    if (terms.length) {
      const hay = [
        r.full_name, r.description, r.language, r.note,
        (r.topics || []).join(' '), (r.cats || []).join(' '), (r.tags || []).join(' '),
      ].join(' ').toLowerCase();
      if (!terms.every((term) => hay.includes(term))) return false;
    }
    return true;
  });

  const byName = (a, b) => a.full_name.localeCompare(b.full_name);
  const cmp = {
    starred_desc: (a, b) => t(b.starred_at) - t(a.starred_at),
    starred_asc: (a, b) => t(a.starred_at) - t(b.starred_at),
    name_asc: byName,
    name_desc: (a, b) => byName(b, a),
    stars_desc: (a, b) => (b.stars || 0) - (a.stars || 0),
    stars_asc: (a, b) => (a.stars || 0) - (b.stars || 0),
    pushed_desc: (a, b) => t(b.pushed_at) - t(a.pushed_at),
    pushed_asc: (a, b) => t(a.pushed_at) - t(b.pushed_at),
    age_desc: (a, b) => t(b.created_at) - t(a.created_at),
    age_asc: (a, b) => t(a.created_at) - t(b.created_at),
    forks_desc: (a, b) => (b.forks || 0) - (a.forks || 0),
  }[sort];

  if (cmp) out = [...out].sort(cmp);
  return out;
}

export function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtAgo(v) {
  if (!v) return '—';
  const ms = Date.now() - Date.parse(v);
  if (Number.isNaN(ms)) return '—';
  const d = Math.floor(ms / 86400000);
  if (d < 1) return 'today';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export function fmtStars(n) {
  const v = n || 0;
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(v);
}
