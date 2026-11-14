const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let menu = [], cart = [];
const find = id => menu.flatMap(c => c.products).find(p => p.id === id);
const fmt = it => Object.entries(it.choices).map(([g, o]) => `${g}: ${o.join(', ')}`).join(' · ');

async function init() {
  menu = await (await fetch('/api/menu')).json();
  $('nav').innerHTML = menu.map(c => `<a href="#c${c.id}">${esc(c.name)}</a>`).join('');
  $('menu').innerHTML = menu.map(c => `<section id="c${c.id}"><h2>${esc(c.name)}</h2>` + c.products.map(p => `
    <div class="card" data-s="${esc((c.name + ' ' + p.name + ' ' + p.description).toLowerCase())}">
      ${p.image ? `<img loading="lazy" src="/img/${p.image}" alt="">` : '<span class="ph"></span>'}
      <div><h3>${esc(p.name)}</h3>${p.description ? `<p>${esc(p.description)}</p>` : ''}</div>
      <button class="btn" data-id="${p.id}">Kies</button></div>`).join('') + '</section>').join('');
  $('menu').addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) openProduct(b.dataset.id); });
  $('q').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.card').forEach(x => x.hidden = !x.dataset.s.includes(q));
    document.querySelectorAll('#menu section').forEach(s => s.hidden = ![...s.querySelectorAll('.card')].some(c => !c.hidden));
  });
  $('cartBtn').onclick = openCart;
}

function openProduct(id) {
  const p = find(id), f = $('pf');
  f.innerHTML = `<h3>${esc(p.name)}</h3>${p.description ? `<p>${esc(p.description)}</p>` : ''}` +
    p.groups.map((g, i) => `<fieldset><legend>${esc(g.name)} <small>${g.single ? 'kies er één' : 'meerdere mogelijk'} (optioneel)</small></legend><div class="opts">` +
      g.options.map(o => `<label><input type="${g.single ? 'radio' : 'checkbox'}" name="g${i}" value="${esc(o)}">${esc(o)}</label>`).join('') + '</div></fieldset>').join('') +
    `<textarea name="note" rows="2" maxlength="200" placeholder="Opmerking (optioneel)"></textarea>
    <div class="row"><div class="qty"><button type="button" data-d="-1" aria-label="Minder">−</button><b id="qv">1</b><button type="button" data-d="1" aria-label="Meer">+</button></div>
    <span><button type="button" class="btn ghost" id="x">Annuleer</button> <button class="btn" value="add">Toevoegen</button></span></div>`;
  let qty = 1;
  f.onclick = e => { const d = e.target.dataset.d; if (d) { qty = Math.min(20, Math.max(1, qty + +d)); $('qv').textContent = qty; } };
  $('x').onclick = () => $('pd').close();
  f.onsubmit = () => {
    const choices = {};
    p.groups.forEach((g, i) => { const v = [...f.querySelectorAll(`[name=g${i}]:checked`)].map(x => x.value); if (v.length) choices[g.name] = v; });
    cart.push({ productId: p.id, name: p.name, qty, choices, note: f.note.value.trim() });
    renderBar();
  };
  $('pd').showModal();
}

function renderBar() {
  const n = cart.reduce((s, i) => s + i.qty, 0);
  $('bar').hidden = !n;
  $('cartBtn').textContent = `Bekijk bestelling (${n})`;
}

function openCart() {
  const f = $('cf');
  const lines = cart.map((it, i) => `<div class="line"><div><b>${it.qty}× ${esc(it.name)}</b><small>${esc(fmt(it))}${it.note ? ' · ' + esc(it.note) : ''}</small></div><button type="button" data-rm="${i}">Verwijder</button></div>`).join('');
  f.innerHTML = `<h3>Jouw bestelling</h3>${lines || '<p>Je bestelling is leeg.</p>'}
    <input class="t" name="name" maxlength="60" placeholder="Jouw naam" autocomplete="name" required>
    <p class="err" id="err" role="alert"></p>
    <div class="row"><button type="button" class="btn ghost" id="back">Verder kiezen</button><button class="btn" value="go" ${cart.length ? '' : 'disabled'}>Bestelling plaatsen</button></div>`;
  f.onclick = e => { const r = e.target.dataset.rm; if (r !== undefined) { cart.splice(+r, 1); renderBar(); openCart(); } };
  $('back').onclick = () => $('cd').close();
  f.onsubmit = async e => {
    e.preventDefault();
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.name.value, items: cart }) });
    if (!res.ok) { $('err').textContent = (await res.json()).error || 'Er ging iets mis, probeer opnieuw.'; return; }
    const name = f.name.value.trim();
    cart = []; renderBar(); $('cd').close();
    $('menu').hidden = $('q').hidden = $('nav').hidden = true;
    $('done').hidden = false;
    $('done').innerHTML = `<div class="done"><h2>Bedankt ${esc(name)}!</h2><p>Je bestelling is doorgegeven. Smakelijk!</p><button class="btn" onclick="location.reload()">Nog een bestelling plaatsen</button></div>`;
    scrollTo(0, 0);
  };
  if (!$('cd').open) $('cd').showModal();
}
init();
