import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
process.env.DB_PATH = ':memory:';
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
