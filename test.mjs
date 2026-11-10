import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateImage } from 'ai';
import { createAigifmaker, AuthError, QuotaError, RejectedError, GenerationFailedError } from './dist/index.js';

function fakeFetch(routes) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : undefined, auth: init?.headers?.authorization });
    const r = routes[new URL(url).pathname];
    if (!r) return new Response(new Uint8Array([0x47, 0x49, 0x46]), { status: 200 });
    const json = typeof r === 'function' ? r() : r;
    return new Response(JSON.stringify(json), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  f.calls = calls;
  return f;
}

test('generateImage: submit, queue, poll, download the GIF', async () => {
  let polls = 0;
  const fetch = fakeFetch({
    '/api/ai/generate': { code: 0, message: 'ok', data: { id: 't1', status: 'pending' } },
    '/api/ai/query': () => (++polls < 2
      ? { code: 0, data: { id: 't1', status: 'processing', queued: true, queueEta: 20 } }
      : { code: 0, data: { id: 't1', status: 'success', images: ['https://cdn.aigifmaker.ai/x.gif'], watermarked: [false] } }),
  });
  const p = createAigifmaker({ apiKey: 'sk-test', fetch, pollIntervalMs: 1 });
  const { image, providerMetadata } = await generateImage({ model: p.image(), prompt: 'a dancing corgi' });
  assert.deepEqual([...image.uint8Array], [0x47, 0x49, 0x46]);
  assert.equal(providerMetadata.aigifmaker.images[0].url, 'https://cdn.aigifmaker.ai/x.gif');
  const submit = fetch.calls[0];
  assert.equal(submit.body.model, 'gif-maker-v1');
  assert.equal(submit.body.options.output_format, 'gif');
  assert.equal(submit.body.prompt, 'a dancing corgi');
  assert.equal(submit.auth, 'Bearer sk-test');
  assert.deepEqual(fetch.calls[1].body, { taskId: 't1' });
});

const unwrapErr = (e) => (e?.cause ?? e);
for (const [name, body, cls] of [
  ['invalid key', { code: -1, message: 'invalid API key — create one at https://aigifmaker.ai/settings/apikeys' }, AuthError],
  ['wall', { code: 0, data: { wall: true, reason: 'anon_credits' } }, AuthError],
  ['insufficient credits', { code: -1, message: 'insufficient credits' }, QuotaError],
  ['cooldown', { code: 429, message: 'content cooldown' }, RejectedError],
]) {
  test(`submit ${name}`, async () => {
    const p = createAigifmaker({ apiKey: 'sk', fetch: fakeFetch({ '/api/ai/generate': body }) });
    await assert.rejects(p.image().doGenerate({ prompt: 'x', n: 1 }), (e) => unwrapErr(e) instanceof cls);
  });
}

test('failed run', async () => {
  const p = createAigifmaker({ apiKey: 'sk', pollIntervalMs: 1, fetch: fakeFetch({
    '/api/ai/generate': { code: 0, data: { id: 't1' } },
    '/api/ai/query': { code: 0, data: { id: 't1', status: 'failed', errorMessage: 'upstream error' } },
  }) });
  await assert.rejects(p.image().doGenerate({ prompt: 'x', n: 1 }), (e) => e instanceof GenerationFailedError);
});

// live smoke, free: wrong key and no key must both be auth errors (no generation)
test('live: wrong key -> AuthError', async () => {
  const p = createAigifmaker({ apiKey: 'sk-invalidtest000' });
  await assert.rejects(p.image().doGenerate({ prompt: 'smoke test', n: 1 }), (e) => e instanceof AuthError);
});
test('live: no key -> AuthError (wall)', async () => {
  const saved = process.env.AIGIFMAKER_API_KEY; delete process.env.AIGIFMAKER_API_KEY;
  try {
    const p = createAigifmaker({});
    await assert.rejects(p.image().doGenerate({ prompt: 'smoke test', n: 1 }), (e) => e instanceof AuthError && /API key is required/i.test(e.message));
  } finally { if (saved) process.env.AIGIFMAKER_API_KEY = saved; }
});
