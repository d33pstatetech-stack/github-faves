/**
 * GitHub GraphQL client.
 *
 * Chosen over REST for three reasons discovered against the live account:
 *   - REST /user/starred returns EMPTY `topics` (breaks the rules engine);
 *     GraphQL repositoryTopics works.
 *   - README resolves only as `HEAD:README.md`; bare `HEAD:README` is null.
 *   - One request returns 100 repos, so a full 218-repo sync is 3 calls
 *     instead of 218.
 */

const API = 'https://api.github.com/graphql';

const STAR_FIELDS = `
  nameWithOwner
  description
  homepageUrl
  stargazerCount
  forkCount
  isArchived
  isFork
  createdAt
  pushedAt
  updatedAt
  primaryLanguage { name }
  licenseInfo { spdxId }
  repositoryTopics(first: 20) { nodes { topic { name } } }
`;

async function gh(env, query, variables = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'github-faves',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL: ${json.errors[0].message}`);
  }
  return json.data;
}

/** Total starred count + who we are. */
export async function getViewer(env) {
  const d = await gh(env, `query { viewer { login starredRepositories(first: 1) { totalCount } } }`);
  return { login: d.viewer.login, total: d.viewer.starredRepositories.totalCount };
}

/**
 * One page of starred repos, metadata only (no README). 100 per call.
 * @returns {{repos: object[], cursor: string|null, hasNext: boolean, total: number}}
 */
export async function getStarredPage(env, cursor = null, first = 100) {
  const args = cursor
    ? `first: ${first}, after: "${cursor}", orderBy: {field: STARRED_AT, direction: DESC}`
    : `first: ${first}, orderBy: {field: STARRED_AT, direction: DESC}`;
  const d = await gh(env, `query {
    viewer { starredRepositories(${args}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges { starredAt node { ${STAR_FIELDS} } }
    } }
  }`);
  const conn = d.viewer.starredRepositories;
  return {
    total: conn.totalCount,
    cursor: conn.pageInfo.endCursor,
    hasNext: conn.pageInfo.hasNextPage,
    repos: conn.edges.map((e) => shape(e.node, e.starredAt)),
  };
}

/**
 * A batch of repos WITH README head text. Used by the enrich phase.
 * @param {string[]} fullNames owner/repo
 */
export async function getRepoDetails(env, fullNames) {
  // GraphQL aliases let us batch many repos into one request.
  const parts = fullNames.map((fn, i) => {
    const [owner, name] = fn.split('/');
    return `r${i}: repository(owner: "${owner}", name: "${name}") {
      ${STAR_FIELDS}
      object(expression: "HEAD:README.md") { ... on Blob { text } }
    }`;
  });
  const d = await gh(env, `query { ${parts.join('\n')} }`);
  return fullNames
    .map((fn, i) => {
      const node = d[`r${i}`];
      return node ? shape(node, null, node.object?.text || '') : null;
    })
    .filter(Boolean);
}

/** Normalize a GraphQL repo node into our D1 row shape. */
function shape(n, starredAt, readme = '') {
  return {
    fullName: n.nameWithOwner,
    owner: n.nameWithOwner.split('/')[0],
    name: n.nameWithOwner.split('/')[1],
    description: n.description || '',
    homepage: n.homepageUrl || '',
    language: n.primaryLanguage?.name || '',
    topics: (n.repositoryTopics?.nodes || []).map((t) => t.topic.name),
    license: n.licenseInfo?.spdxId || '',
    stars: n.stargazerCount || 0,
    forks: n.forkCount || 0,
    isFork: n.isFork ? 1 : 0,
    isArchived: n.isArchived ? 1 : 0,
    createdAt: n.createdAt,
    pushedAt: n.pushedAt,
    updatedAt: n.updatedAt,
    starredAt: starredAt,
    summary: readme ? cleanReadme(readme) : '',
  };
}

/**
 * Reduce a README to the informative head: drop badges, HTML blocks, images,
 * headings markers and collapse whitespace. Keeps ~1200 chars for the card back
 * and gives the rules engine clean text.
 */
export function cleanReadme(md) {
  let s = md;
  s = s.replace(/<[^>]+>/g, ' ');                 // html tags
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');      // images
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');    // links -> text
  s = s.replace(/```[\s\S]*?```/g, ' ');            // code blocks
  s = s.replace(/`[^`]*`/g, ' ');                   // inline code
  s = s.replace(/^[#>\-*+|=]+/gm, ' ');             // heading/list markers
  s = s.replace(/^\s*\|.*$/gm, ' ');                // tables
  s = s.replace(/[*_~]/g, ' ');                     // emphasis
  s = s.replace(/https?:\/\/\S+/g, ' ');            // bare urls
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  return s.slice(0, 1200);
}
