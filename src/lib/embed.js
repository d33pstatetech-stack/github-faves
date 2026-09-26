/**
 * Workers AI embeddings — the semantic fallback for repos that no keyword
 * rule places, and the source of category centroids for the embedding pass.
 *
 * Cost (bge-small-en-v1.5, 1841 neurons / M input tokens, 512 token cap):
 * we feed ~400 tokens per repo, so a full 218-repo pass is ~161 neurons
 * against a 10,000/day free allocation. Negligible.
 */

const MODEL = '@cf/baai/bge-small-en-v1.5';
const MAX_CHARS = 1400; // ~400 tokens, inside the 512 limit

/** Embed one string -> Float32Array(384). Returns null on failure. */
export async function embed(env, text) {
  try {
    const res = await env.AI.run(MODEL, {
      text: [text.slice(0, MAX_CHARS)],
      pooling: 'mean',
    });
    const vec = res?.data?.[0];
    if (!Array.isArray(vec) || vec.length !== 384) return null;
    return Float32Array.from(vec);
  } catch {
    return null;
  }
}

/** Embed a batch (model supports batching; one call, still one neuron bill). */
export async function embedBatch(env, texts) {
  try {
    const res = await env.AI.run(MODEL, {
      text: texts.map((t) => t.slice(0, MAX_CHARS)),
      pooling: 'mean',
    });
    const out = [];
    for (const item of res?.data || []) {
      if (Array.isArray(item) && item.length === 384) out.push(Float32Array.from(item));
    }
    return out;
  } catch {
    return [];
  }
}

/** Mean of member vectors -> centroid, or null if no usable members. */
export function centroid(vectors) {
  const usable = vectors.filter(Boolean);
  if (!usable.length) return null;
  const dim = usable[0].length;
  const out = new Float32Array(dim);
  for (const v of usable) for (let i = 0; i < dim; i++) out[i] += v[i];
  for (let i = 0; i < dim; i++) out[i] /= usable.length;
  return out;
}

/** Pack a Float32Array for a D1 BLOB column. */
export function packVec(vec) {
  return vec ? new Uint8Array(vec.buffer.slice(0)) : null;
}

/** Unpack a D1 BLOB back into a Float32Array. */
export function unpackVec(blob) {
  if (!blob) return null;
  const bytes = blob instanceof ArrayBuffer ? new Uint8Array(blob) : new Uint8Array(blob);
  // Copy so the buffer is correctly aligned for Float32Array.
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Float32Array(copy.buffer);
}
