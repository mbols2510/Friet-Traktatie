import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) { console.error('Zet de omgevingsvariabele ADMIN_PASSWORD.'); process.exit(1); }
const DB_PATH = process.env.DB_PATH || './storage/orders.db';
const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const menu = JSON.parse(fs.readFileSync(path.join(root, 'data/menu.json'), 'utf8'));
const products = new Map(menu.flatMap(c => c.products.map(p => [p.id, p])));

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, items TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`);

// Per product+opties: hoeveel stuks de admin al bij de frituur heeft ingegeven.
db.exec('CREATE TABLE IF NOT EXISTS checked (key TEXT PRIMARY KEY, qty INTEGER NOT NULL)');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const safeEq = (a, b) => {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};
const isAdmin = req => {
  const [u, ...p] = Buffer.from((req.headers.authorization || '').slice(6), 'base64').toString().split(':');
  return safeEq(u, ADMIN_USER) & safeEq(p.join(':'), ADMIN_PASSWORD);
};

// Validates against the menu so nobody can post made-up products or options.
export function validateOrder(b) {
  const name = String(b?.name ?? '').trim();
  if (!name || name.length > 60) return { error: 'Vul je naam in (max. 60 tekens).' };
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 30) return { error: 'Je bestelling is leeg.' };
  const items = [];
  for (const it of b.items) {
    const p = products.get(String(it?.productId));
    const qty = Number(it?.qty);
    if (!p || !Number.isInteger(qty) || qty < 1 || qty > 20) return { error: 'Ongeldig product.' };
    const choices = {};
    for (const g of p.groups) {
      const picked = it.choices?.[g.name];
      if (!picked?.length) {
        if (g.required) return { error: `Kies een optie bij ${p.name}.` };
        continue;
      }
      if (!Array.isArray(picked) || picked.some(o => !g.options.includes(o)) || (g.single && picked.length > 1))
        return { error: `Ongeldige keuze bij ${p.name}.` };
      choices[g.name] = [...new Set(picked)];
    }
    items.push({ productId: p.id, name: p.name, qty, choices, note: String(it.note ?? '').trim().slice(0, 200) });
  }
  return { name, items };
}

const readBody = req => new Promise((ok, no) => {
  let s = '';
  req.on('data', c => { s += c; if (s.length > 100_000) { no(new Error('too big')); req.destroy(); } });
  req.on('end', () => { try { ok(JSON.parse(s)); } catch (e) { no(e); } });
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname); // gooit bij ongeldige %-codes: valt zo in de catch (400)
    if (p === '/healthz') return send(res, 200, 'ok', 'text/plain');
    if (p === '/api/menu') return send(res, 200, menu);
    if (p === '/api/orders' && req.method === 'POST') {
      const v = validateOrder(await readBody(req));
      if (v.error) return send(res, 400, v);
      db.prepare('INSERT INTO orders (name, items) VALUES (?, ?)').run(v.name, JSON.stringify(v.items));
      return send(res, 201, { ok: true });
    }
    if (p === '/admin' || p.startsWith('/api/admin/')) {
      if (!isAdmin(req)) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"' });
        return res.end('Inloggen vereist');
      }
      if (p === '/admin') return send(res, 200, fs.readFileSync(path.join(root, 'admin.html')), TYPES['.html']);
      if (p === '/api/admin/orders' && req.method === 'GET') {
        const rows = db.prepare('SELECT * FROM orders ORDER BY id').all();
        return send(res, 200, rows.map(r => ({ ...r, items: JSON.parse(r.items) })));
      }
      if (p === '/api/admin/checked' && req.method === 'GET')
        return send(res, 200, Object.fromEntries(db.prepare('SELECT key, qty FROM checked').all().map(r => [r.key, r.qty])));
      if (p === '/api/admin/checked' && req.method === 'PUT') {
        const { key, qty } = await readBody(req);
        if (typeof key !== 'string' || !key || key.length > 500 || !Number.isInteger(qty) || qty < 0 || qty > 1000)
          return send(res, 400, { error: 'Ongeldig verzoek.' });
        db.prepare('INSERT INTO checked (key, qty) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET qty = excluded.qty').run(key, qty);
        return send(res, 200, { ok: true });
      }
      const m = p.match(/^\/api\/admin\/orders\/(\d+)$/);
      if (m && req.method === 'DELETE') {
        db.prepare('DELETE FROM orders WHERE id = ?').run(Number(m[1]));
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: 'not found' });
    }
    const file = path.join(root, 'public', p === '/' ? 'index.html' : p);
    if (!file.startsWith(path.join(root, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
      return send(res, 404, 'Niet gevonden', 'text/plain');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': p.startsWith('/img/') ? 'public, max-age=86400' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 400, { error: 'Ongeldig verzoek.' });
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')))
  server.listen(PORT, () => console.log(`Luistert op :${PORT}`));
