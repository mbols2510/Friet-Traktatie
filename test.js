import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
process.env.DB_PATH = ':memory:';
process.env.ADMIN_PASSWORD = 'test';
const { validateOrder } = await import('./server.js');
const p = JSON.parse(fs.readFileSync('./data/menu.json', 'utf8')).flatMap(c => c.products).find(p => p.groups.length);
test('geldige bestelling', () => {
  const r = validateOrder({ name: ' An ', items: [{ productId: p.id, qty: 2, choices: { [p.groups[0].name]: [p.groups[0].options[0]] } }] });
  assert.equal(r.name, 'An'); assert.equal(r.items[0].qty, 2);
});
test('ongeldige invoer wordt geweigerd', () => {
  assert.ok(validateOrder({ name: '', items: [] }).error);
  assert.ok(validateOrder({ name: 'x', items: [{ productId: 'nope', qty: 1 }] }).error);
  assert.ok(validateOrder({ name: 'x', items: [{ productId: p.id, qty: 1, choices: { [p.groups[0].name]: ['verzonnen'] } }] }).error);
});

import { spawn } from 'node:child_process';
const run = env => spawn('node', ['--no-warnings', 'server.js'], { env: { ...process.env, ...env }, cwd: import.meta.dirname });
test('server start niet zonder wachtwoord', async () => {
  const p = run({ ADMIN_PASSWORD: '' });
  assert.notEqual(await new Promise(r => p.on('exit', r)), 0);
});
test('ongeldige URL geeft 400 en laat de server leven', async () => {
  const p = run({ PORT: '3777' });
  await new Promise(r => setTimeout(r, 800));
  try {
    assert.equal((await fetch('http://localhost:3777/%E0%A4%A')).status, 400);
    assert.equal((await fetch('http://localhost:3777/healthz')).status, 200);
    assert.equal((await fetch('http://localhost:3777/api/admin/orders')).status, 401);
  } finally { p.kill(); }
});
