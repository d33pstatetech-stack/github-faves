/**
 * Offline classifier validation.
 *
 * Pulls every starred repo and runs the real classifyByRules() against it so
 * taxonomy quality can be tuned without a deploy. Also cross-checks against the
 * 30 legacy GitHub Star Lists (used only as a sanity signal, not as the
 * taxonomy source).
 *
 *   node scripts/validate.mjs            # distribution + samples
 *   node scripts/validate.mjs --uncat    # list the uncategorized repos
 *   node scripts/validate.mjs --check    # agreement vs legacy lists
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classifyByRules } from '../src/lib/classify.js';
import { CATEGORIES } from '../src/lib/taxonomy.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// Token: env, else .dev.vars, else the sibling dashboard's .env.
function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  for (const f of [join(root, '.dev.vars'), join(root, '..', 'Generative AI Dashboard', '.env')]) {
    try {
      const m = readFileSync(f, 'utf8').match(/ghp_\S+/);
      if (m) return m[0];
    } catch { /* try next */ }
  }
  throw new Error('No GITHUB_TOKEN found');
}

const T = token();
const args = new Set(process.argv.slice(2));

async function gql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${T}`,
      'Content-Type': 'application/json',
      'User-Agent': 'github-faves-validate',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  if (j.errors?.length) throw new Error(j.errors[0].message);
  return j.data;
}

const FIELDS = `
  nameWithOwner description stargazerCount
  primaryLanguage { name }
  repositoryTopics(first: 20) { nodes { topic { name } } }
`;

async function allStars() {
  const out = [];
  let cursor = null;
  for (;;) {
    const after = cursor ? `, after: "${cursor}"` : '';
    const d = await gql(`query { viewer { starredRepositories(first: 100${after},
      orderBy: {field: STARRED_AT, direction: DESC}) {
      totalCount pageInfo { hasNextPage endCursor }
      edges { node { ${FIELDS} } } } } }`);
    const c = d.viewer.starredRepositories;
    out.push(...c.edges.map((e) => ({
      full_name: e.node.nameWithOwner,
      name: e.node.nameWithOwner.split('/')[1],
      description: e.node.description || '',
      topics: (e.node.repositoryTopics?.nodes || []).map((t) => t.topic.name),
      language: e.node.primaryLanguage?.name || '',
    })));
    cursor = c.pageInfo.endCursor;
    if (!c.pageInfo.hasNextPage) break;
  }
  return out;
}

async function legacyLists() {
  const d = await gql(`query { viewer { lists(first: 100) {
    nodes { name items(first: 100) { nodes { ... on Repository { nameWithOwner } } } } } } }`);
  const m = new Map();
  for (const l of d.viewer.lists.nodes) {
    for (const i of l.items.nodes) {
      if (!m.has(i.nameWithOwner)) m.set(i.nameWithOwner, []);
      m.get(i.nameWithOwner).push(l.name);
    }
  }
  return m;
}

// ── run ──
const repos = await allStars();
const results = repos.map((r) => ({ ...r, ...classifyByRules(r) }));

const uncat = results.filter((r) => r.cats.length === 0);
const catCount = new Map();
const tagCount = new Map();
let multi = 0;
for (const r of results) {
  for (const c of r.cats) catCount.set(c, (catCount.get(c) || 0) + 1);
  for (const t of r.tags) tagCount.set(t, (tagCount.get(t) || 0) + 1);
  if (r.cats.length > 1) multi++;
}

console.log(`\n=== ${results.length} repos ===`);
console.log(`uncategorized: ${uncat.length}  (${((uncat.length / results.length) * 100).toFixed(0)}%)`);
console.log(`multi-category: ${multi}`);
console.log(`distinct tags: ${tagCount.size}`);

console.log(`\n--- category distribution (of ${CATEGORIES.length} defined) ---`);
for (const c of [...CATEGORIES].sort((a, b) => (catCount.get(b.slug) || 0) - (catCount.get(a.slug) || 0))) {
  const n = catCount.get(c.slug) || 0;
  const bar = '#'.repeat(Math.round((n / results.length) * 60));
  console.log(`${String(n).padStart(4)}  ${c.slug.padEnd(22)} ${bar}`);
}
const empty = CATEGORIES.filter((c) => !catCount.get(c.slug));
if (empty.length) console.log(`\nEMPTY categories: ${empty.map((c) => c.slug).join(', ')}`);

console.log(`\n--- top 25 tags ---`);
for (const [t, n] of [...tagCount].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log(`${String(n).padStart(4)}  ${t}`);
}

if (args.has('--uncat') && uncat.length) {
  console.log(`\n--- uncategorized (${uncat.length}) ---`);
  for (const r of uncat) {
    console.log(`  ${r.full_name}  ${(r.description || '(no description)').slice(0, 80)}`);
    console.log(`      topics: ${(r.topics || []).join(', ') || '(none)'}  lang=${r.language}`);
  }
}

if (args.has('--check')) {
  const legacy = await legacyLists();
  console.log(`\n--- agreement vs ${legacy.size} legacy-labeled repos ---`);
  // Coarse mapping: new category -> legacy list names that plausibly overlap.
  const equiv = {
    'voice-tts-stt': ['Speech-TTS-STT', 'Cool or fun'],
    'ai-agents': ['AI Agents', 'Claw', 'Hermes-agent'],
    'ai-video-gen': ['Video_related'],
    'ai-image-gen': ['Image_related', 'Lora_related'],
    'ai-coding-agents': ['Coding', 'AI Agents', 'How-to'],
    'embedded-iot': ['Microcontrollers', 'Raspberry Pi', 'Robots'],
    'self-hosted': ['Hosting & storage', 'Infrastructure'],
    'llm-resources': ['How-to', 'Cool or fun'],
    'rag-retrieval': ['RAG', 'Documents'],
    'browser-automation': ['web_scraper', 'WebDev'],
    'cybersecurity-osint': ['Security', 'OSINT', 'Hacking'],
    'web-dev': ['WebDev', 'Web based AI'],
    'ai-gateway-routing': ['API', 'AI Agents'],
    'bookmarks-pkm': ['Cool or fun', 'How-to'],
    'data-finance': ['exercise', 'How-to'],
    'mobile-android': ['Android'],
    'system-utilities': ['Windows', 'Linux', 'Networking'],
  };
  let agree = 0, checked = 0;
  for (const r of results) {
    const labs = legacy.get(r.full_name);
    if (!labs) continue;
    checked++;
    const hit = r.cats.some((c) => (equiv[c] || []).some((l) => labs.includes(l)));
    if (hit) agree++;
  }
  console.log(`  ${agree}/${checked} (${((agree / checked) * 100).toFixed(0)}%) of legacy-labeled repos land in a comparable new category`);
  console.log(`  (informational only — the fresh taxonomy is intentionally different)`);
}
