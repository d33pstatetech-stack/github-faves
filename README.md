# Github Faves

A self-hosted web application that imports a GitHub account's starred
repositories, classifies each one into broad **categories** and specific
**tags**, and presents them as a filterable card grid. Built to run entirely
within the Cloudflare Workers free tier.

---

## Overview

Starring a repository on GitHub is a low-friction capture action, but it
produces an unstructured, growing list. This application adds structure to
that list by inferring a taxonomy from repository metadata, then exposes
multi-axis filtering, sorting, free-text search, and per-repository notes.

**Category** — a broad topical bucket. Twenty-four are defined. A repository
may belong to several simultaneously; multi-label assignment is the norm rather
than the exception.

**Tag** — a narrower refinement layered over categories. Tags identify specific
models (`wan2.2`, `seedance-2`, `minimax-h3`, `qwen-image`, `flux`, `ltx-2`),
specific techniques (`upscale`, `frame-interpolation`, `faceswap`, `lipsync`),
specific hardware (`esp32`, `arduino`, `jetson`), or specific infrastructure
(`docker`, `proxmox`, `mcp`, `comfyui`).

### Feature set

- **Import** — one action retrieves every starred repository, fetches README
  content, classifies it, and refreshes metadata on already-known entries.
- **Filtering** — categories and tags combine; an Any/All switch governs
  whether selections union or intersect. Each filter group has its own text
  filter. Filtering and sorting execute client-side against a single cached
  payload, so results update without a network round trip.
- **Sorting** — by name, star count, date starred, repository age, last push,
  or fork count, in either direction.
- **Detail view** — cards flip to reveal a longer extracted summary, language,
  license, and creation date, plus outbound links to the repository and to
  its DeepWiki page. Both card faces scroll their own text region, so a long
  description remains fully readable without expanding the card.
- **Notes** — a 500-character annotation opened from a pencil icon on the card
  front. The editor renders in a popover anchored beside the card, autosaves on
  a debounce as you type, and dismisses on the same icon, an outside click, or
  Escape. The icon fills amber once a note exists, and note text is searchable.
- **Manual overrides** — category and tag assignments can be corrected by hand.
  Overrides take precedence over inference and are preserved across
  reclassification.
- **Triage queue** — a filter isolating repositories that no classifier could
  place, ordered newest-first, for incremental cleanup.

## Architecture

```
client/                    React 19 + Vite 8 + Tailwind CSS 4
  src/App.jsx              state, filter orchestration, layout
  src/components/          Header, Sidebar, RepoCard
  src/lib/filter.js        pure filter + sort functions

src/worker.js              HTTP router, sync stepper, index builder
src/lib/taxonomy.js        category definitions + tag dictionary
src/lib/classify.js        rule engine, scoring, embedding merge
src/lib/github.js          GitHub GraphQL client, README extraction
src/lib/embed.js           embedding calls, vector packing

D1  github-faves           repos, categories, tags, overrides, sync_runs, sync_lock
KV  INDEX                  prebuilt index + taxonomy snapshots
AI  Workers AI             text embedding model
```

### Request flow

The frontend loads `/api/index` and `/api/taxonomy` once. Both responses are
snapshots written to KV by the Worker, so page load costs one KV read per
endpoint rather than a full table scan. All filtering, sorting and searching
then run in the browser.

### Why the import is stepped

The Workers Free plan permits **10 ms of CPU per invocation** and **50 external
subrequests per request**. A corpus of a few hundred repositories carries
several megabytes of README text; parsing that within a single invocation
exceeds the CPU allowance by roughly an order of magnitude.

Import is therefore decomposed into a sequence of small steps that the
frontend drives in a loop:

| phase | work per step | subrequests |
|---|---|---|
| `meta` | one GraphQL page, 100 repositories, metadata only | 1 |
| `enrich` | 10 repositories: README fetch, classification, embedding, D1 write | ~3 |

Each step is independently schedulable, reports incremental progress, and
stays within both limits. `POST /api/sync/start` creates a run record;
`POST /api/sync/step` advances it; the run terminates when no unprocessed rows
remain.

### Why GraphQL rather than REST

Three properties of the REST API make it unsuited to this workload:

1. `GET /user/starred` returns an empty `topics` array. Topics are a
   maintainer-curated signal and one of the strongest classification inputs
   available; GraphQL's `repositoryTopics` returns them.
2. README content resolves only for an explicit filename
   (`HEAD:README.md`). The extensionless form returns null.
3. A single GraphQL query returns 100 repositories, reducing a full import
   from hundreds of requests to a handful.

REST pagination provides no stable cursor, so incremental imports would require
re-reading and diffing the entire list on every run.

## Classification

Three stages execute in order of cost and explainability.

### 1. Rule engine (primary)

Each category carries a keyword list. Keywords are matched against four fields
at differing weights:

| field | weight |
|---|---|
| GitHub topics | 3 |
| repository name (`owner/name`) | 2 |
| description | 2 |
| README opening paragraph | 1 |

A category is assigned when its accumulated score reaches a threshold of 2. Up
to four categories are retained per repository, ranked by score.

A generic-word discount prevents the dominant failure mode. Words such as
*agent*, *local*, *memory*, *cli* and *api* appear in nearly every README, and
naive substring matching against them produces confident misassignments. These
terms score 1 point when matched outside a curated topic and retain full weight
only when sourced from a topic, where a human has asserted the label. Category
scores are also recorded per repository, so assignments remain auditable.

### 2. Embedding fallback (secondary)

Repositories that stage 1 leaves unassigned are embedded with
`@cf/baai/bge-small-en-v1.5` (384 dimensions, mean pooling) and compared by
cosine similarity against per-category centroids computed from already
classified repositories. Assignments above a similarity threshold are merged
in. Only unplaced repositories are embedded, which bounds cost sharply.

At roughly 400 tokens per repository, a full pass over a 218-repository
corpus consumes approximately 161 neurons against a daily allocation of
10,000.

### 3. Manual overrides (authoritative)

Overrides are stored separately and applied last, both during import and during
reclassification. They are never overwritten by inference.

### Cost control

`repos.classify_version` records the rule generation a repository was last
scored against. Editing the taxonomy and incrementing `CLASSIFY_VERSION` in
`wrangler.toml` marks affected rows stale; `POST /api/reclassify` then
re-scores them from stored data with no GitHub requests and no embedding
expenditure.

## Technology selection

| layer | choice | rationale |
|---|---|---|
| compute | Cloudflare Workers | free tier exceeds actual load; no server to operate |
| database | D1 (SQLite) | 5 GB storage, 5 M rows/day read — orders of magnitude above need |
| snapshot cache | Workers KV | serves the client index without touching D1 |
| inference | Workers AI embeddings | included in the free allocation |
| auth | Cloudflare Access | identity handled at the edge; no auth code, no token storage |
| frontend | React + Vite + Tailwind | small static bundle served from the Worker itself |

**Authentication** operates in two independent layers. Cloudflare Access fronts
the entire domain with an email-restricted allow policy, injecting a signed
identity assertion that the Worker validates. GitHub access uses a classic
personal access token stored as a Worker secret, eliminating the OAuth
callback, refresh, and consent machinery entirely.

**Resource consumption** per full import: approximately 25 Worker requests, 25
GitHub API requests, 250 D1 writes, 1,000 D1 reads, 161 embedding neurons, and
2 KV writes — roughly 0.2% of the daily free allocation.

## API

| method | path | purpose |
|---|---|---|
| `GET` | `/api/health` | liveness and resolved configuration |
| `GET` | `/api/index` | compact repository index (KV snapshot) |
| `GET` | `/api/taxonomy` | categories and observed tag frequencies |
| `GET` | `/api/repo?full_name=` | single repository detail |
| `PUT` | `/api/repo/note` | upsert annotation |
| `PUT` | `/api/repo/override` | upsert manual category/tag assignment |
| `POST` | `/api/sync/start` | create an import run |
| `POST` | `/api/sync/step` | advance the run by one batch |
| `GET` | `/api/sync/status` | current run state |
| `POST` | `/api/reclassify` | re-score stored rows against current rules |

## Data model

```sql
repos(
  full_name TEXT PRIMARY KEY,   -- "owner/name"
  owner, name, description, homepage, language, topics, license,
  stars, forks, is_fork, is_archived,
  created_at, pushed_at, starred_at,
  summary,                      -- extracted README head
  cats, tags,                   -- JSON arrays of slugs
  cat_source, cat_scores,       -- provenance and per-category scores
  embed BLOB,                   -- 384-float vector
  classify_version,             -- rule generation last applied
  note, note_updated_at
)
categories(slug, label, description, color, sort)
tags(slug, label, facet)
overrides(full_name, cats, tags)      -- authoritative
sync_runs(id, status, phase, cursor, total, processed, ...)
sync_lock(id, run_id, started_at)     -- single-run guarantee
```

## Setup

Requires a Cloudflare account and a GitHub personal access token. The token
needs no scopes beyond public repository metadata.

```bash
# 1. Install
npm install
npm --prefix client install

# 2. Create backing resources, then paste the returned ids into wrangler.toml
npx wrangler d1 create github-faves
npx wrangler kv namespace create INDEX

# 3. Apply schema
npx wrangler d1 execute github-faves --remote --file=migrations/0001_init.sql

# 4. Store the GitHub token
npx wrangler secret put GITHUB_TOKEN

# 5. Build and deploy
npm run build
npx wrangler deploy
```

Create a Cloudflare Access application (self-hosted) covering the deployed
hostname with an allow policy restricted to the intended email addresses. The
Worker validates the `Cf-Access-Jwt-Assertion` header and returns `401`
otherwise; `isAccessAuthenticated()` in `src/worker.js` is the entire check.

For local development, `wrangler dev` serves the Worker on `127.0.0.1`, which
the auth function trusts by design. Place the token in `.dev.vars`.

One wrinkle: `wrangler dev` proxies the remote `AI` binding to the deployed
Worker, and that Worker sits behind Access, so the dev server refuses to start
until given service-token credentials. Create a service token under
Zero Trust → Access → Service Auth → Service Tokens, add
`{ any_valid_service_token: {} }` to the app's allow policy, then export
`CLOUDFLARE_ACCESS_CLIENT_ID` and `CLOUDFLARE_ACCESS_CLIENT_SECRET` before
running `wrangler dev`. See `.dev.vars.example`.

## Customization

`src/lib/taxonomy.js` is the primary extension point and is written as plain
readable data. Adding a category requires a `slug`, `label`, `color` and a
`kw` keyword list. Adding a tag requires a `[slug, match-term]` pair within a
`TAG_DICTS` facet, which determines where it appears in the sidebar. The
sidebar enumerates only tags present on at least one repository.

An offline evaluation harness scores the live corpus without deploying:

```bash
node scripts/validate.mjs            # distribution, tag frequency
node scripts/validate.mjs --uncat    # repositories rules fail to place
node scripts/validate.mjs --check    # agreement against GitHub Star Lists
```

## Known limits

- Client-side filtering requires shipping the full index to the browser. This
  is free at current scale but is the binding constraint past roughly 5,000
  repositories, at which point server-side filtering and pagination would
  become necessary.
- Import is browser-driven, so it does not complete if the tab is closed
  mid-run. A queue-based or cron-driven importer would remove that dependency.
- Classification quality is bounded by repository self-description. Entries
  lacking both a description and topics cannot be placed by rules and depend
  entirely on the embedding fallback.
- The taxonomy is static and compiled into the bundle. Runtime category editing
  would require category storage in D1 and an editing surface.
