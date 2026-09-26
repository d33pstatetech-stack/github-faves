/**
 * Classifier — assigns categories + tags to a repo.
 *
 * Strategy, cheapest and most explainable signal first:
 *   1. Explicit override  (always wins)
 *   2. Keyword rules     (deterministic, tuned via taxonomy.js `kw` lists)
 *   3. Embedding fallback (only for repos rules did not place; free tier)
 *
 * Rules weight by field so a GitHub topic match counts for more than an
 * incidental README word. Scores are normalized per category and anything
 * under MIN_SCORE is dropped, which keeps categories meaningful instead of
 * letting every repo land in "AI Agents".
 */

import { CATEGORIES, TAG_DICTS } from './taxonomy.js';

const W_TOPIC = 3;
const W_NAME = 2;
const W_DESC = 2;
const W_BODY = 1;
const MIN_SCORE = 2;

/**
 * Single generic words. Trustworthy when a maintainer curated them as a
 * GitHub topic, but weak evidence from a name, description or README -- every
 * README says "install", "local", "memory". Scoring them at full weight put
 * techfort/LokiJS (an in-memory JS database) into RAG and Mobile/Android, so
 * they earn a single point unless they came from a topic.
 */
const GENERIC = new Set([
  'agent', 'agents', 'app', 'apps', 'tool', 'tools', 'local', 'free', 'api',
  'rag', 'memory', 'android', 'ios', 'web', 'python', 'code', 'github',
  'install', 'docker', 'server', 'client', 'lib', 'library', 'sdk', 'ui',
  'framework', 'engine', 'platform', 'system', 'file', 'files', 'data',
  'model', 'models', 'chat', 'run', 'build', 'use', 'using', 'support',
  'fast', 'easy', 'simple', 'modern', 'powerful', 'open', 'source', 'project',
  'demo', 'example', 'examples', 'package', 'module', 'core', 'custom',
  'official', 'complete', 'lightweight', 'native', 'customizable', 'cli',
  'windows', 'linux', 'programming', 'software', 'development', 'developer',
  'script', 'scripts', 'typescript', 'rust', 'golang', 'react', 'vue',
]);

/** Phrases are always specific enough to trust at full weight. */
function isSpecific(kw) {
  return kw.includes(' ') || !GENERIC.has(kw);
}

function matchTerm(hay, term) {
  if (term.includes(' ')) return hay.includes(term);
  return hay.includes(term);
}

function weightedHits(texts, keywords) {
  // texts: array of [body, weight] pairs, ordered highest weight first.
  const hits = new Map();
  for (const kw of keywords) {
    // Highest-weight field this keyword appears in.
    let bestW = 0;
    for (const [body, weight] of texts) {
      if (body && matchTerm(body, kw)) { bestW = weight; break; }
    }
    if (!bestW) continue;
    // A curated topic is strong evidence even for a generic word; anywhere
    // else a generic single word is worth exactly one point.
    const score = bestW === W_TOPIC ? W_TOPIC : (isSpecific(kw) ? bestW : 1);
    hits.set(kw, score);
  }
  let total = 0;
  const matched = [];
  for (const [kw, w] of hits) {
    total += w;
    matched.push(kw);
  }
  return { score: total, matched };
}

/** The README head we trust for classification — the intro paragraph only. */
function bodyText(repo) {
  return (repo.summary || '').slice(0, 400).toLowerCase();
}

/**
 * Rule-based classification.
 * @param {{name:string, full_name:string, description:string, topics:string[],
 *          language:string, summary:string}} repo
 */
export function classifyByRules(repo) {
  const topics = (repo.topics || []).join(' ').toLowerCase();
  const name = `${repo.full_name || repo.name || ''}`.toLowerCase();
  const desc = (repo.description || '').toLowerCase();
  const body = bodyText(repo);

  const texts = [
    [topics, W_TOPIC],
    [name, W_NAME],
    [desc, W_DESC],
    [body, W_BODY],
  ];

  const scores = {};
  const evidence = {};
  for (const cat of CATEGORIES) {
    const { score, matched } = weightedHits(texts, cat.kw);
    if (score >= MIN_SCORE) {
      scores[cat.slug] = score;
      evidence[cat.slug] = matched.slice(0, 6);
    }
  }

  // Tags: same weighted scan over the tag dictionary, using the full README
  // (not just the intro paragraph) since a wrong tag is cheap to ignore --
  // but generic single words still can't match README prose.
  const tagTexts = [
    [topics, W_TOPIC],
    [name, W_NAME],
    [desc, W_DESC],
    [(repo.summary || '').toLowerCase(), W_BODY],
  ];
  const tags = new Set();
  for (const { tags: dict } of TAG_DICTS) {
    for (const [slug, label] of dict) {
      const term = label.toLowerCase();
      const { score } = weightedHits(tagTexts, [term]);
      if (score > 0) tags.add(slug);
    }
  }

  // Keep top categories by score; allow multi-label but not everything.
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const cats = ranked.slice(0, 4).map(([slug]) => slug);

  return { cats, tags: [...tags], scores, evidence, source: 'rules' };
}

/**
 * Build the searchable text for a repo (used for rules + embedding input).
 * README head is badge-stripped by the sync step; this just bounds it.
 */
export function repoText(repo) {
  return [
    repo.full_name,
    repo.description,
    (repo.topics || []).join(' '),
    (repo.summary || '').slice(0, 700),
  ].filter(Boolean).join('\n').slice(0, 1400);
}

/**
 * Cosine similarity between two 384-dim vectors (bge-small, unit-ish length).
 */
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return (na && nb) ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * Merge embedding-suggested categories into rule results.
 * Only applied when rules produced nothing, or to fill gaps for weak matches.
 * @param {{cats:string[],tags:string[],scores:object,evidence:object,source:string}} ruleResult
 * @param {Float32Array|number[]} repoVec
 * @param {Map<string,Float32Array>} categoryVecs slug -> centroid vector
 */
export function mergeEmbedding(ruleResult, repoVec, categoryVecs) {
  if (!repoVec || !categoryVecs) return ruleResult;

  const sims = [];
  for (const [slug, cvec] of categoryVecs) {
    sims.push([slug, cosine(repoVec, cvec)]);
  }
  sims.sort((a, b) => b[1] - a[1]);

  // Absolute threshold. bge-small cosine for related-but-not-identical
  // topical text typically lands 0.5-0.7; unrelated is < 0.4.
  const SIM_MIN = 0.52;
  const top = sims.filter(([, s]) => s >= SIM_MIN).slice(0, 3);

  if (!top.length) return ruleResult;

  const cats = new Set(ruleResult.cats);
  const scores = { ...ruleResult.scores };
  const evidence = { ...ruleResult.evidence };
  let usedEmbed = false;

  for (const [slug, s] of top) {
    if (!cats.has(slug)) {
      cats.add(slug);
      scores[slug] = s.toFixed(2);
      evidence[slug] = ['embedding'];
      usedEmbed = true;
    }
  }

  return {
    cats: [...cats],
    tags: ruleResult.tags,
    scores,
    evidence,
    source: usedEmbed ? (ruleResult.cats.length ? 'mixed' : 'embed') : ruleResult.source,
  };
}
