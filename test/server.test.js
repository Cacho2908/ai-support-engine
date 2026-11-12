import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function withServer(deps, fn) {
  const server = createServer(deps).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}
const post = (base, body, headers = { 'content-type': 'application/json' }) =>
  fetch(`${base}/api/analyze`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('POST /api/analyze traditional devuelve el contrato', async () => {
  await withServer({}, async (base) => {
    const res = await post(base, { message: 'No puedo iniciar sesión', mode: 'traditional' });
    assert.equal(res.status, 200);
    const j = await res.json();
    assert.deepEqual(Object.keys(j).sort(), ['category', 'mode', 'priority', 'requiresHumanReview', 'response']);
    assert.equal(j.category, 'ACCESS');
    assert.equal(j.mode, 'traditional');
  });
});

test('validaciones HTTP: 400 / 404 / 415', async () => {
  await withServer({}, async (base) => {
    assert.equal((await post(base, { mode: 'traditional' })).status, 400);
    assert.equal((await post(base, { message: 'hola', mode: 'xyz' })).status, 400);
    assert.equal((await post(base, '{mal json')).status, 400);
    assert.equal((await post(base, { message: 'hola' }, { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await fetch(`${base}/otra`)).status, 404);
  });
});

test('error inesperado -> 500 genérico sin filtrar detalles', async () => {
  const complete = async () => { throw Object.assign(new Error('boom'), {}); };
  await withServer({ complete }, async (base) => {
    const res = await post(base, { message: 'hola', mode: 'generative' });
    assert.equal(res.status, 500); // error inesperado -> genérico, sin detalles
    assert.ok(!(await res.text()).includes('boom'));
  });
});

test('generative sin API key configurada -> 503 controlado', async () => {
  const prev = { k: process.env.ANTHROPIC_API_KEY, p: process.env.LLM_PROVIDER };
  delete process.env.ANTHROPIC_API_KEY; process.env.LLM_PROVIDER = 'anthropic';
  try {
    await withServer({}, async (base) => {
      const res = await post(base, { message: 'hola', mode: 'generative' });
      assert.equal(res.status, 503);
      assert.equal((await res.json()).error.code, 'PROVIDER_NOT_CONFIGURED');
    });
  } finally {
    if (prev.k) process.env.ANTHROPIC_API_KEY = prev.k;
    if (prev.p) process.env.LLM_PROVIDER = prev.p; else delete process.env.LLM_PROVIDER;
  }
});
