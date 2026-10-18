// Run after `docker compose up --build -d --wait` from the repository root.
// Uses only a disposable workflow, removed in finally. No AI calls or browser actions.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
if (existsSync('.env')) process.loadEnvFile('.env');
function origin(name, fallback) {
  const port = Number(process.env[name] || fallback);
  assert(Number.isInteger(port) && port > 0 && port <= 65535, `Invalid ${name}`);
  return `http://127.0.0.1:${port}`;
}
const api = origin('BACKEND_PORT', 3001);
const front = origin('FRONTEND_PORT', 8080);
const fixtures = origin('DEMO_WEBSITES_PORT', process.env.FIXTURES_PORT || 3100);
async function request(base, path, options = {}) {
  const response = await fetch(base + path, { ...options, signal: AbortSignal.timeout(15000) });
  assert(response.ok, `${options.method || 'GET'} ${path}: HTTP ${response.status}`);
  return response;
}
let id;
try {
  await request(api, '/health');
  await request(front, '/preview-health');
  assert.match(await (await request(front, '/')).text(), /Ghost web preview/);
  await request(front, '/health');
  const spec = await (await request(front, '/docs/json')).json();
  assert(spec.paths['/api/workflows'], 'Workflow routes missing from OpenAPI');
  const created = await (await request(api, '/api/workflows', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Docker smoke ${randomUUID()}`, status: 'DRAFT' }),
  })).json();
  // API responses use the persisted workflow object directly.
  id = created.id;
  assert.match(id, /^[0-9a-f-]{36}$/i);
  const saved = await (await request(front, `/api/workflows/${id}`)).json();
  assert.equal(saved.name, created.name);
  await request(api, `/api/workflows/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Docker API/database smoke check' }),
  });
  const updated = await (await request(api, `/api/workflows/${id}`)).json();
  assert.equal(updated.description, 'Docker API/database smoke check');
  assert.match(await (await request(fixtures, '/login')).text(), /Work email/);
  assert.match(await (await request(fixtures, '/nova/login')).text(), /NOVA/);
  const image = await request(fixtures, '/nova/products.png');
  assert.match(image.headers.get('content-type') || '', /image\/png/);
  console.log('PASS: API/database CRUD, frontend preview/proxy, Swagger, Forma and NOVA routes/artwork.');
} finally {
  if (id) await request(api, `/api/workflows/${id}`, { method: 'DELETE' });
}
