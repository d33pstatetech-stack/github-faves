/**
 * Github Faves — Cloudflare Worker
 *
 * Pulls your GitHub stars into D1, classifies them into categories + tags, and
 * serves a compact index so the client can filter/sort with zero D1 reads.
 *
 * Architecture notes (driven by Workers Free limits: 10ms CPU/invocation,
 * 50 external subrequests/request, 100k requests/day):
 *
 *   - Sync is CLIENT-DRIVEN STEPPING, not one big invocation. The frontend
 *     calls POST /api/sync/step repeatedly; each step handles BATCH_SIZE repos
 *     (1 GraphQL request + 1 embedding call + 1 D1 batch write ~= 3 subrequests).
 *     A 218-repo sync = 3 metadata pages + 22 enrich steps. This keeps every
 *     invocation well inside 10ms CPU, which parsing 5.3MB of README in one go
 *     would not (that is ~50-100ms).
 *
 *   - GET /api/index returns a KV-snapshot blob (~45KB for 218 repos) so
 *     filtering/sorting is client-side and instant.
 *
 * Auth: Cloudflare Access (same gate as the genai dashboard, see
 * isAccessAuthenticated). GitHub access is a PAT in the GITHUB_TOKEN secret.
 *
 * Routes:
 *   GET  /api/health
 *   GET  /api/index                     -> compact repo index (KV snapshot)
 *   GET  /api/taxonomy                  -> categories + observed tags
 *   GET  /api/repo?full_name=owner/repo -> card-back detail
 *   PUT  /api/repo/note                 {full_name, note}
 *   PUT  /api/repo/override             {full_name, cats, tags}
 *   POST /api/sync/start                -> begin a sync run
 *   POST /api/sync/step                 -> process one batch, returns progress
 *   GET  /api/sync/status               -> progress
 *   POST /api/reclassify                -> re-run rules on stored data
 *   *  -> static assets (client/dist)
 */

import { CATEGORIES } from './lib/taxonomy.js';
import { getViewer, getStarredPage, getRepoDetails } from './lib/github.js';
import { classifyByRules, mergeEmbedding, repoText } from './lib/classify.js';
import { embedBatch, centroid, packVec, unpackVec } from './lib/embed.js';

const BATCH_SIZE = 10;
const INDEX_KEY = 'repos:index:v1';
const TAXONOMY_KEY = 'taxonomy:v1';

// ─── Access gate ───
// Mirrors the Generative AI Dashboard worker: Cloudflare Access asserts
// identity via headers. Localhost is trusted for `wrangler dev`.
function isAccessAuthenticated(request) {
  const url = new URL(request.url);
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return true;
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  return !!(jwt || email);
}

const PROTECTED = ['/api/index', '/api/taxonomy', '/api/repo', '/api/sync', '/api/reclassify'];

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (path.startsWith('/api/')) {
      if (PROTECTED.some((p) => path.startsWith(p)) && !isAccessAuthenticated(request)) {
        return json({ error: 'unauthorized' }, 401);
      }
      try {
        return await handleApi(request, env, path, url);
      } catch (err) {
        return json({ error: String(err?.message || err) }, 500);
      }
    }

    // Non-API: static assets are served by the assets binding before the
    // Worker runs (see [assets] + not_found_handling in wrangler.toml), so
    // anything reaching here is genuinely unrouted.
    return new Response('Not found', { status: 404 });
  },
};

async function handleApi(request, env, path, url) {
  // ─── health ───
  if (path === '/api/health') {
    return json({
      ok: true,
      classifyVersion: env.CLASSIFY_VERSION,
      hasToken: !!env.GITHUB_TOKEN,
      batchSize: BATCH_SIZE,
    });
  }

  // ─── index (KV snapshot) ───
  if (path === '/api/index') {
    const cached = await env.INDEX.get(INDEX_KEY, 'json');
    if (cached) return json(cached);
    // Cold (or pre-sync): build from D1 so first load still works.
    const built = await buildIndex(env);
    return json(built);
  }

  // ─── taxonomy ───
  if (path === '/api/taxonomy') {
    const cached = await env.INDEX.get(TAXONOMY_KEY, 'json');
    if (cached) return json(cached);
    const built = await buildTaxonomy(env);
    return json(built);
  }

  // ─── repo detail (card back) ───
  if (path === '/api/repo') {
    const fullName = url.searchParams.get('full_name');
    if (!fullName) return json({ error: 'full_name required' }, 400);
    const row = await env.DB.prepare(
      `SELECT full_name, description, homepage, language, topics, license, stars,
              forks, is_archived, is_fork, created_at, pushed_at, starred_at,
              summary, cats, tags, cat_source, cat_scores, note, note_updated_at
         FROM repos WHERE full_name = ?`
    ).bind(fullName).first();
    if (!row) return json({ error: 'not found' }, 404);
    return json({ ...row, topics: safeJson(row.topics, []), cats: safeJson(row.cats, []), tags: safeJson(row.tags, []) });
  }

  // ─── sticky note ───
  if (path === '/api/repo/note' && request.method === 'PUT') {
    const { full_name, note } = await request.json();
    if (!full_name) return json({ error: 'full_name required' }, 400);
    await env.DB.prepare(
      `UPDATE repos SET note = ?, note_updated_at = datetime('now') WHERE full_name = ?`
    ).bind(note || null, full_name).run();
    await refreshIndex(env);
    return json({ ok: true, full_name, note: note || null });
  }

  // ─── manual category/tag override ───
  if (path === '/api/repo/override' && request.method === 'PUT') {
    const { full_name, cats, tags } = await request.json();
    if (!full_name) return json({ error: 'full_name required' }, 400);
    await env.DB.prepare(
      `INSERT INTO overrides (full_name, cats, tags, created_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(full_name) DO UPDATE SET cats = excluded.cats, tags = excluded.tags`
    ).bind(full_name, JSON.stringify(cats || []), JSON.stringify(tags || [])).run();
    // Re-apply immediately so the UI reflects the override.
    await applyOverride(env, full_name);
    await refreshIndex(env);
    return json({ ok: true, full_name, cats, tags });
  }

  // ─── sync: start ───
  if (path === '/api/sync/start' && request.method === 'POST') {
    return startSync(env);
  }

  // ─── sync: step (client-driven) ───
  if (path === '/api/sync/step' && request.method === 'POST') {
    return syncStep(env);
  }

  // ─── sync: status ───
  if (path === '/api/sync/status') {
    const run = await env.DB.prepare(
      `SELECT id, status, phase, total, processed, created, updated, error, started_at
         FROM sync_runs ORDER BY id DESC LIMIT 1`
    ).first();
    return json(run || { status: 'idle' });
  }

  // ─── reclassify stored rows (no GitHub fetch) ───
  if (path === '/api/reclassify' && request.method === 'POST') {
    return reclassify(env);
  }

  return json({ error: 'not found' }, 404);
}

// ────────────────────────────── sync ──────────────────────────────

async function startSync(env) {
  // Only one run at a time.
  const active = await env.DB.prepare(
    `SELECT id FROM sync_runs WHERE status = 'running' ORDER BY id DESC LIMIT 1`
  ).first();
  if (active) return json({ run: active, resumed: true });

  const run = await env.DB.prepare(
    `INSERT INTO sync_runs (status, phase, total, processed, created, updated)
     VALUES ('running', 'meta', 0, 0, 0, 0) RETURNING id`
  ).first();
  await env.DB.prepare(
    `INSERT INTO sync_lock (id, run_id, started_at) VALUES (1, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET run_id = excluded.run_id, started_at = excluded.started_at`
  ).bind(run.id).run();
  return json({ run_id: run.id, phase: 'meta', total: 0, processed: 0 });
}

/**
 * One batch. Two phases:
 *   meta   -> pull the next page of 100 starred repos (metadata, no README)
 *   enrich -> for the next BATCH_SIZE un-enriched repos, fetch README head,
 *             classify (rules), embed only if rules found nothing, upsert.
 * Returns progress; the client calls again until done.
 */
async function syncStep(env) {
  const state = await env.DB.prepare(
    `SELECT r.* FROM sync_runs r ORDER BY r.id DESC LIMIT 1`
  ).first();
  if (!state || state.status !== 'running') return json({ status: 'idle' });

  // Phase 1: metadata pages (3 calls for 218 repos).
  if (state.phase === 'meta') {
    const { repos, cursor, hasNext, total } = await getStarredPage(env, state.cursor || null, 100);
    await upsertRepos(env, repos, null); // no classification yet
    const processed = state.processed + repos.length;
    // Enrich is a separate pass; reset the counter so the progress bar reads
    // 0/218 again instead of starting from the meta-phase total.
    const phase = hasNext ? 'meta' : 'enrich';
    await env.DB.prepare(
      `UPDATE sync_runs SET phase = ?, cursor = ?, total = ?, processed = ?, updated_at = datetime('now')
        WHERE id = ?`
    ).bind(phase, cursor, total, hasNext ? processed : 0, state.id).run();
    return json({
      status: 'running', phase, total, processed, batch: 'meta',
      message: `indexed ${processed}/${total}`,
    });
  }

  // Phase 2: enrich + classify, BATCH_SIZE repos per step.
  // "Stale" = classify_version below the current rules version. The meta phase
  // writes classify_version 0, so every freshly-indexed repo is picked up here.
  const pending = await env.DB.prepare(
    `SELECT full_name FROM repos WHERE classify_version < ?1
     ORDER BY starred_at DESC LIMIT ?2`
  ).bind(Number(env.CLASSIFY_VERSION), BATCH_SIZE).all();
  const names = (pending.results || []).map((r) => r.full_name);

  if (!names.length) {
    // Nothing left to enrich -> finish.
    await env.DB.prepare(
      `UPDATE sync_runs SET status = 'done', phase = 'done', updated_at = datetime('now') WHERE id = ?`
    ).bind(state.id).run();
    await refreshIndex(env);
    const counted = await env.DB.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN cats = '[]' THEN 1 ELSE 0 END) as uncat
         FROM repos`
    ).first();
    return json({
      status: 'done', total: counted.total, uncategorized: counted.uncat || 0,
      message: `synced ${counted.total} repos (${counted.uncat || 0} uncategorized)`,
    });
  }

  const details = await getRepoDetails(env, names);
  // Category centroids for the embedding fallback, built from already-classified rows.
  const catVecs = await categoryCentroids(env);
  const needed = details.filter((d) => classifyByRules(d).cats.length === 0).map(repoText);
  const vecs = needed.length ? await embedBatch(env, needed) : [];
  let vi = 0;

  const results = [];
  for (const d of details) {
    let rule = classifyByRules(d);
    let vec = null;
    if (rule.cats.length === 0 && vecs.length) {
      vec = vecs[vi++] || null;
      rule = mergeEmbedding(rule, vec, catVecs);
    }
    results.push({ ...d, ...rule, embed: vec });
  }
  await upsertRepos(env, results, true);

  // Re-apply any manual overrides for this batch.
  for (const r of results) await applyOverride(env, r.fullName);

  const processed = state.processed + names.length;
  await env.DB.prepare(
    `UPDATE sync_runs SET processed = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(processed, state.id).run();

  return json({
    status: 'running', phase: 'enrich', total: state.total, processed,
    batch: 'enrich', message: `enriched ${processed}/${state.total}`,
  });
}

async function upsertRepos(env, repos, withClassification) {
  if (!repos.length) return;
  const cv = Number(env.CLASSIFY_VERSION);
  const now = new Date().toISOString();
  const stmts = repos.map((r) => {
    const cats = withClassification ? JSON.stringify(r.cats || []) : null;
    const tags = withClassification ? JSON.stringify(r.tags || []) : null;
    const src = withClassification ? (r.source || null) : null;
    const scores = withClassification ? JSON.stringify(r.scores || {}) : null;
    const embed = withClassification && r.embed ? packVec(r.embed) : null;
    return env.DB.prepare(
      `INSERT INTO repos
         (full_name, owner, name, description, homepage, language, topics, license,
          stars, forks, is_fork, is_archived, created_at, pushed_at, starred_at,
          summary, cats, tags, cat_source, cat_scores, embed, classify_version, synced_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(full_name) DO UPDATE SET
         description = excluded.description,
         homepage    = excluded.homepage,
         language    = excluded.language,
         topics      = excluded.topics,
         license     = excluded.license,
         stars       = excluded.stars,
         forks       = excluded.forks,
         is_fork     = excluded.is_fork,
         is_archived = excluded.is_archived,
         pushed_at   = excluded.pushed_at,
         starred_at  = COALESCE(excluded.starred_at, repos.starred_at),
         synced_at   = excluded.synced_at,
         -- only overwrite classification if we computed a new one
         summary     = COALESCE(NULLIF(excluded.summary, ''), repos.summary),
         cats        = COALESCE(excluded.cats, repos.cats),
         tags        = COALESCE(excluded.tags, repos.tags),
         cat_source  = COALESCE(excluded.cat_source, repos.cat_source),
         cat_scores  = COALESCE(excluded.cat_scores, repos.cat_scores),
         embed       = COALESCE(excluded.embed, repos.embed),
         classify_version = CASE WHEN excluded.cats IS NULL THEN repos.classify_version ELSE excluded.classify_version END`
    ).bind(
      r.fullName, r.owner, r.name, r.description, r.homepage, r.language,
      JSON.stringify(r.topics || []), r.license, r.stars, r.forks,
      r.isFork, r.isArchived, r.createdAt, r.pushedAt, r.starredAt,
      r.summary || null, cats, tags, src, scores, embed,
      withClassification ? cv : 0, now
    );
  });
  // D1 batch: one round-trip, counts as separate statements for the write budget.
  await env.DB.batch(stmts);
}

/** Force a repo's stored cats/tags to match its override row (if any). */
async function applyOverride(env, fullName) {
  const ov = await env.DB.prepare(
    `SELECT cats, tags FROM overrides WHERE full_name = ?`
  ).bind(fullName).first();
  if (!ov) return;
  const merged = safeJson(ov.cats, []);
  const mtags = safeJson(ov.tags, []);
  await env.DB.prepare(
    `UPDATE repos SET cats = ?, tags = ?, cat_source = 'override' WHERE full_name = ?`
  ).bind(JSON.stringify(merged), JSON.stringify(mtags), fullName).run();
}

/** Re-run rules over stored rows without hitting GitHub. */
async function reclassify(env) {
  let total = 0;
  let passes = 0;
  // Loop in slices so a rule change over a large collection still completes
  // inside one request (each slice is one read + one batched write).
  do {
    const rows = await env.DB.prepare(
      `SELECT full_name, description, topics, language, summary FROM repos
        WHERE classify_version < ?1 LIMIT 200`
    ).bind(Number(env.CLASSIFY_VERSION)).all();
    if (!rows.results.length) break;

    const catVecs = await categoryCentroids(env);
    const withOverride = await env.DB.prepare(`SELECT full_name FROM overrides`).all();
    const ovSet = new Set((withOverride.results || []).map((r) => r.full_name));

    const stmts = [];
    for (const r of rows.results) {
      if (ovSet.has(r.full_name)) {
        // Keep the manual override, but mark it current so it stops being stale.
        stmts.push(env.DB.prepare(
          `UPDATE repos SET classify_version = ? WHERE full_name = ?`
        ).bind(Number(env.CLASSIFY_VERSION), r.full_name));
        continue;
      }
      const repo = { ...r, topics: safeJson(r.topics, []) };
      const rule = classifyByRules(repo);
      stmts.push(env.DB.prepare(
        `UPDATE repos SET cats = ?, tags = ?, cat_source = ?, cat_scores = ?,
                classify_version = ? WHERE full_name = ?`
      ).bind(
        JSON.stringify(rule.cats), JSON.stringify(rule.tags), 'rules',
        JSON.stringify(rule.scores), Number(env.CLASSIFY_VERSION), r.full_name
      ));
    }
    if (stmts.length) await env.DB.batch(stmts);
    total += stmts.length;
    passes++;
  } while (passes < 5);

  // The index is served from the KV snapshot, so it MUST be rebuilt here or
  // clients keep seeing the pre-reclassify state.
  await refreshIndex(env);
  return json({ status: 'done', reclassified: total });
}

// ────────────────────── index + taxonomy snapshots ──────────────────────

/** Compact payload for the client: everything needed to render/filter/sort. */
async function buildIndex(env) {
  const rows = await env.DB.prepare(
    `SELECT full_name, owner, name, description, language, topics, license, stars,
            forks, is_archived, is_fork, created_at, pushed_at, starred_at,
            cats, tags, cat_source, note
       FROM repos ORDER BY starred_at DESC`
  ).all();
  const repos = (rows.results || []).map((r) => ({
    full_name: r.full_name,
    owner: r.owner,
    name: r.name,
    description: r.description || '',
    language: r.language || '',
    license: r.license || '',
    topics: safeJson(r.topics, []),
    stars: r.stars,
    forks: r.forks,
    is_archived: !!r.is_archived,
    is_fork: !!r.is_fork,
    created_at: r.created_at,
    pushed_at: r.pushed_at,
    starred_at: r.starred_at,
    cats: safeJson(r.cats, []),
    tags: safeJson(r.tags, []),
    cat_source: r.cat_source,
    note: r.note || '',
  }));
  return { generated_at: new Date().toISOString(), count: repos.length, repos };
}

async function buildTaxonomy(env) {
  // Categories are static in taxonomy.js; tags are whatever the classifier
  // actually produced, so the sidebar never lists tags with zero repos.
  const rows = await env.DB.prepare(`SELECT tags, cats FROM repos`).all();
  const tagCount = new Map();
  const catCount = new Map();
  for (const r of rows.results || []) {
    for (const t of safeJson(r.tags, [])) tagCount.set(t, (tagCount.get(t) || 0) + 1);
    for (const c of safeJson(r.cats, [])) catCount.set(c, (catCount.get(c) || 0) + 1);
  }
  return {
    categories: CATEGORIES.map((c) => ({ ...c, count: catCount.get(c.slug) || 0 })),
    tags: [...tagCount.entries()]
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** Rebuild both KV snapshots (called after sync / note / override writes). */
async function refreshIndex(env) {
  const index = await buildIndex(env);
  const taxonomy = await buildTaxonomy(env);
  await Promise.all([
    env.INDEX.put(INDEX_KEY, JSON.stringify(index)),
    env.INDEX.put(TAXONOMY_KEY, JSON.stringify(taxonomy)),
  ]);
}

// ───────────────────────── embedding centroids ─────────────────────────

/**
 * Category centroids for the embedding fallback: mean of already-classified
 * repo vectors per category. Built lazily and cheap at this scale.
 */
async function categoryCentroids(env) {
  const rows = await env.DB.prepare(
    `SELECT cats, embed FROM repos WHERE embed IS NOT NULL AND cats != '[]' LIMIT 300`
  ).all();
  const buckets = new Map();
  for (const r of rows.results || []) {
    const vec = unpackVec(r.embed);
    if (!vec) continue;
    for (const c of safeJson(r.cats, [])) {
      if (!buckets.has(c)) buckets.set(c, []);
      buckets.get(c).push(vec);
    }
  }
  const out = new Map();
  for (const [slug, vecs] of buckets) {
    const cen = centroid(vecs);
    if (cen) out.set(slug, cen);
  }
  return out;
}

function safeJson(v, fallback) {
  if (v == null) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}
