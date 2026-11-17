'use strict';
/* Coffee Brewing — bean-first brew log. Saved in localStorage; sync.js mirrors it to the cloud when signed in. */

const KEY = 'coffee-pwa-v1';

// ---------- fixed data ----------
const METHODS = [
  { id: 'pour', name: 'Pour over', dose: 20, ratio: 16, temp: 92, recipe: '46' },
  { id: 'french', name: 'French press', dose: 30, ratio: 16, temp: 95, recipe: 'fp' },
  { id: 'siphon', name: 'Siphon', dose: 20, ratio: 15, temp: 92, recipe: 'sp' },
  { id: 'espresso', name: 'Espresso', dose: 18, ratio: 2, temp: 93, recipe: 'es' },
  { id: 'aero', name: 'AeroPress', dose: 15, ratio: 16, temp: 90, recipe: 'ap' },
  { id: 'cold', name: 'Cold brew', dose: 60, ratio: 10, temp: 20, recipe: 'cb' }
];

// steps: t = second it starts; pct = pour up to this % of total water (null = no pouring)
const PRESETS = [
  { id: '46', m: 'pour', name: '4:6', total: 210, steps: [
    { t: 0, pct: 20 }, { t: 45, pct: 40 }, { t: 90, pct: 60 }, { t: 135, pct: 80 }, { t: 165, pct: 100 }] },
  { id: 'one', m: 'pour', name: 'One pour', total: 180, steps: [
    { t: 0, pct: 15, label: 'Bloom' }, { t: 45, pct: 100, label: 'Pour' }] },
  { id: 'three', m: 'pour', name: 'Three pour', total: 165, steps: [
    { t: 0, pct: 15, label: 'Bloom' }, { t: 40, pct: 60, label: 'Pour 2' }, { t: 80, pct: 100, label: 'Pour 3' }] },
  { id: 'ten', m: 'pour', name: 'Ten pour', total: 230, steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({ t: i * 20, pct: (i + 1) * 10 })) },
  { id: 'hoff', m: 'pour', name: 'Hoffmann', total: 180, steps: [
    { t: 0, pct: 20, label: 'Bloom' }, { t: 45, pct: 40 }, { t: 70, pct: 60 }, { t: 90, pct: 80 }, { t: 110, pct: 100 }] },
  { id: 'switch', m: 'pour', name: 'Switch', total: 180, steps: [
    { t: 0, pct: 100, label: 'Closed · fill' }, { t: 120, pct: null, label: 'Open · drain' }] },
  { id: 'hybrid', m: 'pour', name: 'Hybrid', total: 165, steps: [
    { t: 0, pct: 40, label: 'Open · pour' }, { t: 45, pct: 100, label: 'Closed · fill' }, { t: 105, pct: null, label: 'Open · drain' }] },
  { id: 'fp', m: 'french', name: 'Classic', total: 510, steps: [
    { t: 0, pct: 100, label: 'Fill' }, { t: 240, pct: null, label: 'Stir · skim' }, { t: 480, pct: null, label: 'Press · pour' }] },
  { id: 'sp', m: 'siphon', name: 'Classic', total: 100, steps: [
    { t: 0, pct: null, label: 'Add coffee · stir' }, { t: 30, pct: null, label: 'Stir again' }, { t: 60, pct: null, label: 'Heat off' }] },
  { id: 'es', m: 'espresso', name: 'Classic', total: 28, steps: [{ t: 0, pct: 100, label: 'Pull shot' }] },
  { id: 'ap', m: 'aero', name: 'Classic', total: 165, steps: [
    { t: 0, pct: 100, label: 'Fill' }, { t: 120, pct: null, label: 'Stir' }, { t: 135, pct: null, label: 'Press 30s' }] },
  { id: 'cb', m: 'cold', name: 'Classic', total: 60, steps: [
    { t: 0, pct: 100, label: 'Fill · stir' }, { t: 60, pct: null, label: 'Fridge 12–16 h' }] }
];

const SV = (p, s) => '<svg aria-hidden="true" width="' + (s || 48) + '" height="' + (s || 48) + '" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
const DRIPPERS = [
  { id: 'v60', name: 'V60', svg: '<path d="M7 11h34L27 36h-6z"/><path d="M15 14c5 5 6 12 7 19"/><path d="M24 14c1 6 1 12 0 19"/><path d="M33 14c-5 5-6 12-7 19"/><path d="M13 41h22"/>' },
  { id: 'alpha', name: 'Alpha', svg: '<path d="M7 11h34L27 36h-6z"/><path d="M13 14l8 19"/><path d="M19 14l2 8"/><path d="M24 14v19"/><path d="M29 14l-2 8"/><path d="M35 14l-8 19"/><path d="M13 41h22"/>' },
  { id: 'kalita', name: 'Kalita', svg: '<path d="M8 12h32l-6 22H14z"/><path d="M11 19c2-2.5 4-2.5 6 0s4 2.5 6 0 4-2.5 6 0 4 2.5 6 0"/><path d="M19 30h.01M24 30h.01M29 30h.01"/><path d="M11 39h26"/>' },
  { id: 'origami', name: 'Origami', svg: '<path d="M6 13l4.5-3 4.5 3 4.5-3 4.5 3 4.5-3 4.5 3 4.5-3 4.5 3L27 36h-6z"/><path d="M15 13l7 21"/><path d="M24 13v21"/><path d="M33 13l-7 21"/><path d="M14 41h20"/>' },
  { id: 'flower', name: 'Flower', svg: '<path d="M5 16c2-7 10-7 12.5-1C20 9 28 9 30.5 15 33 9 41 9 43 16L27 36h-6z"/><path d="M19 25l3 9"/><path d="M24 24v10"/><path d="M29 25l-3 9"/><path d="M15 41h18"/>' },
  { id: 'switch', name: 'Switch', svg: '<path d="M7 8h34L28 31h-8z"/><path d="M16 11c4 5 5 11 6 17"/><path d="M32 11c-4 5-5 11-6 17"/><path d="M12 31h24v9H12z"/><path d="M36 35h6"/>' },
  { id: 'kono', name: 'Kono', svg: '<path d="M7 11h34L27 36h-6z"/><path d="M20 26l2 8"/><path d="M24 25v9"/><path d="M28 26l-2 8"/><path d="M13 41h22"/>' },
  { id: 'orea', name: 'Orea', svg: '<path d="M6 14h36l-7 18H13z"/><path d="M15 17l3 12"/><path d="M24 17v12"/><path d="M33 17l-3 12"/><path d="M17 32v5h14v-5"/>' },
  { id: 'april', name: 'April', svg: '<path d="M9 13h30l-5 19H14z"/><path d="M17 16l1.5 13"/><path d="M24 16v13"/><path d="M31 16l-1.5 13"/><path d="M12 32h24v5H12z"/>' },
  { id: 'melitta', name: 'Melitta', svg: '<path d="M7 11h34l-9 23H16z"/><path d="M16 15l5 16"/><path d="M32 15l-5 16"/><path d="M20 34h8"/><path d="M12 40h24"/>' },
  { id: 'chemex', name: 'Chemex', svg: '<path d="M13 6l8 17-10 19h26L27 23l8-17z"/><path d="M19 23h10"/><path d="M19 20h10"/>' }
];
const FILTERS = ['White paper', 'Brown paper', 'Cafec Abaca', 'Cafec T-90', 'Wave 155', 'Metal'];
const PROCESSES = ['Washed', 'Natural', 'Honey', 'Anaerobic'];
const ROASTS = ['Light', 'Med-Lt', 'Medium', 'Med-Dk', 'Dark'];
const FLAVORS = ['Floral', 'Citrus', 'Berry', 'Stone fruit', 'Tropical', 'Chocolate', 'Nutty', 'Caramel', 'Tea', 'Winey'];
const BURRS = ['Conical', 'Flat', 'Ghost'];
const AXES = [['aroma', 'Aroma'], ['acid', 'Acidity'], ['sweet', 'Sweet'], ['body', 'Body'], ['bitter', 'Bitter'], ['finish', 'Finish']];
const ADJUSTS = ['Same', 'Finer', 'Coarser', 'Hotter', 'Cooler'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 24px line icons
const I = (p, s) => '<svg aria-hidden="true" width="' + (s || 24) + '" height="' + (s || 24) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
const IC = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l5 5 9-11"/>',
  bean: '<ellipse cx="12" cy="12" rx="6.5" ry="9" transform="rotate(30 12 12)"/><path d="M8.500 5.500c4.500 3-1 8.500 7 13"/>',
  drop: '<path d="M12 3c4 5 6.500 8 6.500 11.500a6.500 6.500 0 0 1-13 0C5.500 11 8 8 12 3z"/>',
  gear: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.500"/><circle cx="8" cy="17" r="2.500"/>',
  stats: '<path d="M5 20v-8M12 20V4M19 20v-5"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.500-5.800"/><path d="M4 4v4.500h4.500"/>',
  edit: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>'
};
const PLAY = '<svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.500v13a1 1 0 0 0 1.500.900l10.500-6.500a1 1 0 0 0 0-1.700L9.500 4.600A1 1 0 0 0 8 5.500z"/></svg>';
const PAUSE = '<svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.500" height="14" rx="1.500"/><rect x="13.500" y="5" width="4.500" height="14" rx="1.500"/></svg>';
const STAR = '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.500l2.900 6 6.600.900-4.800 4.600 1.200 6.500L12 17.400l-5.900 3.100 1.200-6.500L2.500 9.400l6.600-.900z"/></svg>';
const STAR_S = '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px"><path d="M12 2.500l2.900 6 6.600.900-4.800 4.600 1.200 6.500L12 17.400l-5.900 3.100 1.200-6.500L2.500 9.400l6.600-.900z"/></svg>';

// ---------- state ----------
function blank() { return { beans: [], brews: [], grinders: [], owned: [], recipes: [], filters: [], countdown: 3, updatedAt: 0 }; }
function load() {
  try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return blank(); }
}
let S = load();
function save() {
  S.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Storage is full'); }
  if (window.Cloud) Cloud.changed();
}

const DR = { B: null, G: null, R: null, D: null, Q: null, U: null }; // drafts being edited (U = sign-in form)
let T = null;   // timer
let SH = null;  // open sheet

// ---------- helpers ----------
const app = document.getElementById('app');
const nav = document.getElementById('nav');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const r1 = (n) => Math.round(n * 10) / 10;
function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function days(a, b) { if (!a || !b) return null; return Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 86400000); }
function fmt(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
const md = (d) => (d ? MONTHS[+d.slice(5, 7) - 1] + ' ' + +d.slice(8, 10) : '—');
const money = (n) => '$' + n.toFixed(2);
const go = (h) => { if (location.hash === '#' + h) render(); else location.hash = h; };
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const bean = (id) => S.beans.find((b) => b.id === id);
const brewsOf = (id) => S.brews.filter((w) => w.beanId === id);
const used = (id) => brewsOf(id).reduce((a, w) => a + num(w.dose), 0);
const left = (b) => Math.max(0, r1(num(b.weight) - used(b.id)));
const perG = (b) => (num(b.price) > 0 && num(b.weight) > 0 ? num(b.price) / num(b.weight) : null);
const method = (id) => METHODS.find((m) => m.id === id) || METHODS[0];
const dripper = (id) => DRIPPERS.find((d) => d.id === id);
const grinder = (id) => S.grinders.find((g) => g.id === id);
const recipes = (m) => PRESETS.filter((r) => r.m === m).concat(S.recipes.filter((r) => r.m === m));
const recipe = (id) => PRESETS.concat(S.recipes).find((r) => r.id === id);
const filters = () => FILTERS.concat(S.filters);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const stepLabel = (s, i) => s.label || 'Pour ' + (i + 1);
const isRated = (w) => !!(w.ratedAt || w.stars);
const pending = () => S.brews.filter((w) => !isRated(w) && !w.skip).slice(-3).reverse();
const hasVal = (v) => v !== '' && v != null;

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1800);
}
function sheet(o) {
  SH = o;
  const el = document.getElementById('sheet');
  el.innerHTML = '<button class="bg" data-a="sheetX" aria-label="Close"></button><div class="box" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><h2>' + esc(o.title) + '</h2>' +
    (o.input ? '<div class="field"><input id="sheet-in" type="text" placeholder="' + esc(o.ph || '') + '" autocomplete="off" aria-label="' + esc(o.title) + '"></div>' : '') +
    '<div class="g2"><button class="btn ghost" data-a="sheetX">Cancel</button><button class="btn' + (o.danger ? ' red' : '') + '" data-a="sheetOk">' + esc(o.ok || 'OK') + '</button></div></div>';
  el.classList.add('on');
  const i = document.getElementById('sheet-in'); if (i) i.focus();
}
function closeSheet() { SH = null; const el = document.getElementById('sheet'); el.classList.remove('on'); el.innerHTML = ''; }

// hexagon taste chart; v = { aroma, acid, sweet, body, bitter, finish } each 0–5
function radar(v) {
  const Sz = 300, c = Sz / 2, R = 86;
  const pt = (i, val) => { const a = -Math.PI / 2 + i * Math.PI / 3, r = R * val / 5; return [c + r * Math.cos(a), c - 22 + r * Math.sin(a)]; };
  const poly = (val) => AXES.map((x, i) => pt(i, typeof val === 'number' ? val : num(val[x[0]])).map((n) => n.toFixed(1)).join(',')).join(' ');
  let h = '<svg class="radar" viewBox="0 0 ' + Sz + ' ' + (Sz - 44) + '" role="img" aria-label="Taste chart">';
  h += '<polygon points="' + poly(5) + '" fill="#FDFBF8" stroke="#D5C6B2" stroke-width="1.5"/>';
  for (let k = 1; k <= 4; k++) h += '<polygon points="' + poly(k) + '" fill="none" stroke="#DCCFBD"/>';
  AXES.forEach((x, i) => { const p = pt(i, 5); h += '<line x1="' + c + '" y1="' + (c - 22) + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#D5C6B2"/>'; });
  h += '<polygon points="' + poly(v) + '" fill="rgba(111,68,35,.38)" stroke="#6F4423" stroke-width="2.500" stroke-linejoin="round"/>';
  AXES.forEach((x, i) => {
    const p = pt(i, 6.15), cos = Math.cos(-Math.PI / 2 + i * Math.PI / 3);
    h += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="' + (Math.abs(cos) < 0.1 ? 'middle' : (cos > 0 ? 'start' : 'end')) + '">' + x[1] + '</text>';
  });
  return h + '</svg>';
}

// ---------- views ----------
function navHtml(on) {
  const tabs = [['beans', 'Beans', IC.bean], ['brew', 'Brew', IC.drop], ['gear', 'Gear', IC.gear], ['stats', 'Stats', IC.stats]];
  return '<div class="in">' + tabs.map((t) => '<a href="#' + t[0] + '"' + (t[0] === on ? ' class="on" aria-current="page"' : '') + '>' + I(t[2]) + t[1] + '</a>').join('') + '</div>';
}
function head(title, sub, o) {
  o = o || {};
  return '<div class="head">' + (o.back ? '<button class="ib clear" data-a="' + o.back + '" aria-label="Back">' + I(IC.back) + '</button>' : '') +
    '<div class="t"><h1 class="one">' + title + '</h1>' + (sub ? '<div class="sub one">' + sub + '</div>' : '') + '</div>' + (o.right || '') + '</div>';
}
const dots = (n) => '<div class="dots" aria-label="Step ' + n + ' of 3">' + [1, 2, 3].map((i) => '<i' + (i === n ? ' class="on"' : '') + '></i>').join('') + '</div>';

function beanCard(b) {
  const d = days(b.roastDate, today());
  const p = perG(b), w = num(b.weight);
  const pct = w ? Math.round(left(b) / w * 100) : 0;
  const meta = [w ? left(b) + ' g left' : null, p != null ? money(p) + '/g' : null].filter(Boolean).join(' · ');
  return '<div class="card">' + (w && !b.finishDate ? '<div class="fill" data-w="' + pct + '" aria-hidden="true"></div>' : '') +
    '<div class="rowb" style="align-items:flex-start">' +
      '<button class="titlebtn" data-a="editBean" data-id="' + b.id + '"><h2 class="one">' + esc(b.name) + '</h2>' +
      '<div class="small muted one">' + esc([b.origin, b.roaster].filter(Boolean).join(' · ') || 'Add details') + '</div></button>' +
      (d != null ? '<div class="tag" title="Days since roast">Day ' + d + '</div>' : '') +
    '</div>' +
    (b.notes && b.notes.length ? '<div class="small muted one">' + esc(b.notes.join(' · ')) + '</div>' : '') +
    '<div class="rowb"><div class="one" style="font-weight:600">' + esc(meta || ROASTS[(b.roast || 1) - 1]) + '</div>' +
    (b.finishDate ? '<button class="btn sm ghost" data-a="statBean" data-id="' + b.id + '">' + I(IC.stats, 20) + 'Stats</button>'
      : '<button class="btn sm dark" data-a="startBrew" data-id="' + b.id + '">' + I(IC.drop, 20) + 'Brew</button>') +
    '</div></div>';
}

function vBeans() {
  const open = S.beans.filter((b) => !b.finishDate);
  const done = S.beans.filter((b) => b.finishDate);
  let h = head('Beans', open.length ? open.length + ' open' : '', { right: '<button class="ib pri" data-a="newBean" aria-label="Add beans">' + I(IC.plus) + '</button>' });
  h += pending().map((w) => {
    const b = bean(w.beanId), rc = recipe(w.recipeId);
    return '<div class="banner"><div class="grow" style="min-width:0"><div style="font-weight:650">How was it?</div><div class="sub one">' + esc([b ? b.name : '', rc ? rc.name : ''].filter(Boolean).join(' · ')) + '</div></div>' +
      '<button class="btn sm" data-a="rate" data-id="' + w.id + '">Rate</button><button class="x" data-a="skipRate" data-id="' + w.id + '" aria-label="Dismiss">' + I(IC.x, 20) + '</button></div>';
  }).join('');
  if (!S.beans.length) h += '<div class="card"><h2>Start with a bag</h2><div class="muted">Add your beans. Every brew then tracks cost, freshness and taste.</div><button class="btn" data-a="newBean">' + I(IC.plus) + 'Add beans</button></div>';
  h += open.map(beanCard).join('');
  if (done.length) h += '<div class="label" style="margin-top:6px">Finished</div>' + done.map(beanCard).join('');
  return h;
}

function starsHtml(n, act) {
  let h = '<div class="stars">';
  for (let i = 1; i <= 5; i++) h += '<button data-a="' + act + '" data-n="' + i + '" class="' + (i <= n ? 'on' : '') + '" aria-label="' + i + ' star" aria-pressed="' + (i <= n) + '">' + STAR + '</button>';
  return h + '</div>';
}
function field(o, f, label, opt) {
  opt = opt || {};
  const v = DR[o][f] == null ? '' : DR[o][f];
  return '<div class="field"><label for="f-' + f + '">' + label + '</label><input id="f-' + f + '" data-o="' + o + '" data-f="' + f + '" type="' + (opt.type || 'text') + '"' +
    (opt.mode ? ' inputmode="' + opt.mode + '"' : '') + ' value="' + esc(v) + '" placeholder="' + esc(opt.ph || '') + '" autocomplete="off"></div>';
}
const pergText = (p) => (p != null ? money(p) + ' per gram' : 'Price ÷ weight = cost per gram');

function vBean() {
  const b = DR.B, isNew = !b.id;
  const picked = b.notes || [];
  const sugg = FLAVORS.filter((f) => picked.indexOf(f) < 0);
  let h = head(isNew ? 'Add beans' : 'Edit beans', '', { back: 'back' });
  h += field('B', 'name', 'Name', { ph: 'Guji' });
  h += '<div class="g2">' + field('B', 'roaster', 'Roaster') + field('B', 'farm', 'Farm') + '</div>';
  h += field('B', 'origin', 'Origin', { ph: 'Ethiopia' });
  h += '<div class="g2">' + field('B', 'price', 'Price $', { mode: 'decimal', ph: '0' }) + field('B', 'weight', 'Weight g', { mode: 'decimal', ph: '0' }) + '</div>';
  h += '<div class="small muted" id="perg" style="margin-top:-8px">' + pergText(perG(b)) + '</div>';
  h += '<div class="g2">' + field('B', 'roastDate', 'Roasted', { type: 'date' }) + field('B', 'buyDate', 'Bought', { type: 'date' }) + '</div>';
  if (!isNew) h += '<div class="g2">' + field('B', 'openDate', 'Opened', { type: 'date' }) + field('B', 'finishDate', 'Finished', { type: 'date' }) + '</div>';
  h += '<div class="stack"><div class="label">Process</div><div class="hs">' +
    PROCESSES.map((x) => '<button class="chip' + (b.process === x ? ' on' : '') + '" data-a="setB" data-f="process" data-v="' + x + '" aria-pressed="' + (b.process === x) + '">' + x + '</button>').join('') + '</div></div>';
  h += '<div class="stack"><div class="label">Roast</div><div class="g5 roast">' +
    ROASTS.map((x, i) => '<button class="r' + (i + 1) + (b.roast === i + 1 ? ' on' : '') + '" data-a="setRoast" data-n="' + (i + 1) + '" aria-pressed="' + (b.roast === i + 1) + '">' + x + '</button>').join('') + '</div></div>';
  h += '<div class="stack"><div class="label">Flavour</div><div class="hs">' +
    '<button class="chip add" data-a="noteAdd" aria-label="Add your own flavour">' + I(IC.plus, 18) + '</button>' +
    picked.map((x) => '<button class="chip on" data-a="note" data-v="' + esc(x) + '" aria-pressed="true">' + esc(x) + '</button>').join('') +
    sugg.map((x) => '<button class="chip" data-a="note" data-v="' + x + '" aria-pressed="false">' + x + '</button>').join('') + '</div></div>';
  h += '<div class="stack"><div class="label">Rating</div>' + starsHtml(b.rating || 0, 'rateB') + '</div>';
  h += '<button class="btn" data-a="saveBean">' + I(IC.check) + 'Save</button>';
  if (!isNew) {
    h += '<div class="g2">' + (b.finishDate ? '<span></span>' : '<button class="btn ghost" data-a="finishBean">Finished</button>') +
      '<button class="btn danger" data-a="delBean">' + I(IC.trash, 20) + 'Delete</button></div>';
  }
  return h;
}

function vPick() {
  const open = S.beans.filter((b) => !b.finishDate);
  let h = head('Brew', open.length ? 'Pick a bag' : '');
  if (!open.length) return h + '<div class="card"><div class="muted">No open bags yet.</div><button class="btn" data-a="newBean">' + I(IC.plus) + 'Add beans</button></div>';
  return h + open.map(beanCard).join('');
}

function brewSub(D) {
  const b = bean(D.beanId);
  const d = b ? days(b.roastDate, today()) : null;
  return esc(b ? b.name : '') + (d != null ? ' · Day ' + d : '');
}

function vMethod() {
  const D = DR.D;
  let h = head('Brew', brewSub(D), { back: 'home', right: dots(1) });
  h += '<div class="stack"><div class="label">Method</div><div class="g3">' +
    METHODS.map((m) => '<button class="tile' + (D.method === m.id ? ' on' : '') + '" data-a="setMethod" data-v="' + m.id + '" aria-pressed="' + (D.method === m.id) + '">' + m.name + '</button>').join('') + '</div></div>';
  if (D.method === 'pour') {
    const mine = S.owned.length && !D.allDrippers;
    const list = mine ? DRIPPERS.filter((d) => S.owned.indexOf(d.id) >= 0 || d.id === D.dripper) : DRIPPERS;
    h += '<div class="stack"><div class="rowb"><div class="label">Dripper</div>' +
      (S.owned.length ? '<button class="link" style="min-height:24px" data-a="allDrippers">' + (mine ? 'Show all' : 'Show mine') + '</button>' : '') + '</div><div class="g3">' +
      list.map((d) => '<button class="tile icon' + (D.dripper === d.id ? ' on' : '') + '" data-a="setD" data-f="dripper" data-v="' + d.id + '" aria-pressed="' + (D.dripper === d.id) + '">' + SV(d.svg) + d.name + '</button>').join('') + '</div></div>';
    h += '<div class="stack"><div class="label">Filter</div><div class="hs">' +
      filters().map((f) => '<button class="chip' + (D.filter === f ? ' on' : '') + '" data-a="setD" data-f="filter" data-v="' + esc(f) + '" aria-pressed="' + (D.filter === f) + '">' + esc(f) + '</button>').join('') +
      '<button class="chip add" data-a="filterAdd" aria-label="Add a filter">' + I(IC.plus, 18) + '</button></div></div>';
  }
  h += '<div class="grow"></div><button class="btn" data-a="toRecipe">Next</button>';
  return h;
}

function plan(D) {
  const r = recipe(D.recipeId) || recipes(D.method)[0];
  const water = Math.round(num(D.dose) * num(D.ratio));
  return { r: r, water: water, steps: r.steps.map((s, i) => ({ t: s.t, pct: s.pct, g: s.pct == null ? null : Math.round(water * s.pct / 100), label: stepLabel(s, i) })) };
}

function stepRow(label, k, val, sub) {
  return '<div class="steprow"><div class="one">' + label + (sub ? '<div class="small muted one">' + sub + '</div>' : '') + '</div><div class="stepper">' +
    '<button data-a="step" data-k="' + k + '" data-d="-1" aria-label="Less ' + label + '">−</button><div class="val" id="v-' + k + '">' + val + '</div>' +
    '<button data-a="step" data-k="' + k + '" data-d="1" aria-label="More ' + label + '">+</button></div></div>';
}

function vRecipe() {
  const D = DR.D, m = method(D.method), P = plan(D);
  const pours = P.steps.filter((s) => s.g != null).length;
  const g = grinder(D.grinderId);
  const sub = [m.name];
  if (D.method === 'pour') { const dr = dripper(D.dripper); if (dr) sub.push(dr.name); }
  let h = head('Recipe', esc(sub.join(' · ')), { back: 'toMethod', right: dots(2) });
  h += '<div class="hs">' + recipes(D.method).map((r) => '<button class="chip' + (P.r.id === r.id ? ' on' : '') + '" data-a="setRecipe" data-v="' + r.id + '" aria-pressed="' + (P.r.id === r.id) + '">' + esc(r.name) + '</button>').join('') +
    (P.r.custom ? '<button class="chip add" data-a="editRecipe" data-id="' + P.r.id + '" aria-label="Edit ' + esc(P.r.name) + '">' + I(IC.edit, 18) + '</button>' : '') +
    '<button class="chip add" data-a="newRecipe" aria-label="New recipe">' + I(IC.plus, 18) + 'Custom</button></div>';
  h += '<div class="card" style="padding:2px 18px;gap:0">' +
    stepRow('Dose', 'dose', D.dose + ' g') +
    stepRow('Ratio', 'ratio', '1:' + D.ratio) +
    stepRow('Temp', 'temp', D.temp + '°C') +
    stepRow('Grind', 'grind', hasVal(D.grind) ? D.grind : '—', g ? esc(g.name) : '') +
    '<div class="steprow"><div>' + (D.method === 'espresso' ? 'Yield' : 'Water') + '</div><div class="big">' + P.water + ' g</div></div></div>';
  if (S.grinders.length > 1) h += '<div class="hs">' + S.grinders.map((x) => '<button class="chip' + (D.grinderId === x.id ? ' on' : '') + '" data-a="setGrinder" data-v="' + x.id + '">' + esc(x.name) + '</button>').join('') + '</div>';
  h += '<div class="rowb" style="font-weight:600;padding:0 4px"><div>' + (pours > 1 ? pours + ' pours' : P.steps.length + (P.steps.length > 1 ? ' steps' : ' step')) + '</div><div>' + fmt(P.r.total) + '</div></div>';
  h += '<div class="grow"></div><button class="btn" data-a="toTimer">' + I(IC.drop) + 'Start</button>' +
    '<button class="link" data-a="logNoTimer">Log without timer</button>';
  return h;
}

function vTimer() {
  const D = DR.D, P = plan(D), b = bean(D.beanId);
  let h = head('<span style="font-size:20px">' + esc(P.r.name) + '</span>', esc(b ? b.name : ''), { back: 'tBack', right: dots(3) });
  h += '<div class="stack" style="gap:6px;padding-top:4px"><div class="caption" id="t-cap">Ready</div><div class="clock" id="t-clock">0:00</div><div class="action" id="t-act" aria-live="polite"></div></div>';
  h += '<div class="hs" id="t-cd" style="justify-content:center;align-items:center"><span class="small muted">Countdown</span>' +
    [3, 5].map((n) => '<button class="chip' + (S.countdown === n ? ' on' : '') + '" data-a="setCd" data-n="' + n + '" aria-pressed="' + (S.countdown === n) + '">' + n + 's</button>').join('') + '</div>';
  h += '<div class="stack grow" style="gap:6px">' + P.steps.map((s, i) => '<div class="tstep" id="ts-' + i + '"><div style="display:flex;align-items:center;gap:8px;min-width:0"><div class="tm">' + fmt(s.t) + '</div><div class="one">' + esc(s.label) + '</div></div>' +
    (s.g != null ? '<div class="g">' + s.g + ' g</div>' : '') + '</div>').join('') + '</div>';
  h += '<div class="tctl"><button class="ib" style="justify-self:start;width:56px;height:56px;border-radius:28px" data-a="tReset" aria-label="Restart">' + I(IC.reset) + '</button>' +
    '<button class="play" id="t-main" data-a="tToggle" aria-label="Start">' + PLAY + '</button>' +
    '<button class="btn done" style="justify-self:end" data-a="tDone">' + I(IC.check) + 'Done</button></div>';
  return h;
}

function brewLine(w) {
  return [w.dose + ' g', '1:' + w.ratio, w.temp + '°', hasVal(w.grind) ? '#' + w.grind : null, w.elapsed != null ? fmt(w.elapsed) : null].filter(Boolean).join(' · ');
}

function vRate() {
  const Q = DR.Q, w = S.brews.find((x) => x.id === Q.id), b = bean(w.beanId), rc = recipe(w.recipeId);
  let h = head('How was it?', esc([b ? b.name : '', rc ? rc.name : ''].filter(Boolean).join(' · ')), { back: 'rateBack' });
  h += radar(Q.r);
  h += '<div class="stack" style="gap:8px">' + AXES.map((x) => '<div class="taste"><div class="n">' + x[1] + '</div><div class="seg" role="group" aria-label="' + x[1] + '">' +
    [1, 2, 3, 4, 5].map((i) => '<button class="' + (Q.r[x[0]] >= i ? 'on' : '') + '" data-a="taste" data-k="' + x[0] + '" data-n="' + i + '" aria-label="' + x[1] + ' ' + i + ' of 5" aria-pressed="' + (Q.r[x[0]] === i) + '"></button>').join('') + '</div></div>').join('') + '</div>';
  h += '<div class="stack"><div class="label">Overall</div>' + starsHtml(Q.stars, 'rateQ') + '</div>';
  h += '<div class="stack"><div class="label">Next time</div><div class="hs">' +
    ADJUSTS.map((x) => '<button class="chip' + (Q.adjust === x ? ' on' : '') + '" data-a="adjust" data-v="' + x + '" aria-pressed="' + (Q.adjust === x) + '">' + x + '</button>').join('') + '</div></div>';
  h += '<div class="small muted one">' + brewLine(w) + '</div>';
  h += '<button class="btn" data-a="saveRate">' + I(IC.check) + 'Save</button>';
  return h;
}

function vStats(id) {
  let h = head('Stats');
  if (!S.beans.length) return h + '<div class="card"><div class="muted">Add beans and brew. Cost, freshness and taste show up here.</div><button class="btn" data-a="newBean">' + I(IC.plus) + 'Add beans</button></div>';
  const b = bean(id) || S.beans.slice().sort((x, y) => brewsOf(y.id).length - brewsOf(x.id).length)[0];
  const ws = brewsOf(b.id).slice().sort((x, y) => (x.at < y.at ? 1 : -1));
  const p = perG(b), u = used(b.id), w = num(b.weight);
  const rated = ws.filter((x) => x.stars).map((x) => x.stars);
  const avgDose = avg(ws.map((x) => num(x.dose)));
  h += '<div class="hs">' + S.beans.map((x) => '<button class="chip' + (x.id === b.id ? ' on' : '') + '" data-a="statBean" data-id="' + x.id + '" aria-pressed="' + (x.id === b.id) + '">' + esc(x.name) + '</button>').join('') + '</div>';

  const tasted = ws.filter((x) => x.r);
  if (tasted.length) {
    const m = {};
    AXES.forEach((a) => { m[a[0]] = avg(tasted.map((x) => num(x.r[a[0]])).filter((n) => n > 0)) || 0; });
    h += '<div class="card" style="padding:14px 8px 6px">' + radar(m) + '<div class="small muted" style="text-align:center;padding-bottom:6px">Average of ' + tasted.length + (tasted.length > 1 ? ' cups' : ' cup') + '</div></div>';
  }
  const openDay = days(b.roastDate, b.openDate);
  const tiles = [
    ['Per gram', p != null ? money(p) : '—'],
    ['Per cup', p != null && avgDose ? money(p * avgDose) : '—'],
    ['Used', r1(u) + (w ? '/' + w : '') + ' g'],
    ['Rating', rated.length ? avg(rated).toFixed(1) + ' ' + STAR_S : '—'],
    ['Cups', String(ws.length)],
    ['Opened', openDay != null ? 'Day ' + openDay : '—']
  ];
  h += '<div class="g2">' + tiles.map((t) => '<div class="stat"><div class="k">' + t[0] + '</div><div class="v">' + t[1] + '</div></div>').join('') + '</div>';
  const span = b.openDate ? days(b.openDate, b.finishDate || today()) : null;
  h += '<div class="card"><div class="dates">' +
    [['Roasted', md(b.roastDate)], ['Bought', md(b.buyDate)], ['Opened', md(b.openDate)], ['Finished', b.finishDate ? md(b.finishDate) : '—']].map((d) => '<div><div class="small muted">' + d[0] + '</div><div style="font-weight:650">' + d[1] + '</div></div>').join('') + '</div>' +
    (span != null ? '<div class="small muted one">' + (b.finishDate ? 'Lasted ' + span + ' days' : 'Open for ' + span + (span === 1 ? ' day' : ' days')) + '</div>' : '') + '</div>';

  const groups = {};
  S.beans.forEach((x) => { const k = x.roaster || 'No roaster'; (groups[k] = groups[k] || []).push(x); });
  const rows = Object.keys(groups).map((k) => {
    const bs = groups[k], stars = [];
    bs.forEach((x) => { const rs = brewsOf(x.id).filter((y) => y.stars); rs.forEach((y) => stars.push(y.stars)); if (!rs.length && x.rating) stars.push(x.rating); });
    return { name: k, p: avg(bs.map(perG).filter((v) => v != null)), s: avg(stars), fresh: avg(bs.map((x) => days(x.roastDate, x.buyDate)).filter((v) => v != null)) };
  });
  const maxP = Math.max.apply(null, rows.map((r) => r.p || 0).concat([0.0001]));
  h += '<div class="stack"><div class="label">Roasters</div>' + rows.map((r) => '<div class="stack" style="gap:6px"><div class="rowb"><div class="one" style="font-weight:600">' + esc(r.name) + '</div>' +
    '<div class="small" style="white-space:nowrap">' + [r.p != null ? money(r.p) + '/g' : null, r.s != null ? r.s.toFixed(1) + ' ' + STAR_S : null, r.fresh != null ? Math.round(r.fresh) + 'd old' : null].filter(Boolean).join(' · ') + '</div></div>' +
    '<div class="bar"><i style="width:' + Math.round((r.p || 0) / maxP * 100) + '%"></i></div></div>').join('') + '</div>';

  if (ws.length) {
    h += '<div class="stack"><div class="label">Brews</div><div class="card" style="padding:2px 18px;gap:0">' + ws.map((x) => {
      const rc = recipe(x.recipeId);
      return '<button class="hist" data-a="rate" data-id="' + x.id + '"><div class="grow" style="min-width:0"><div class="one" style="font-weight:600">' + md(x.date) + ' · ' + esc(rc ? rc.name : method(x.method).name) + '</div>' +
        '<div class="small muted one">' + brewLine(x) + (x.adjust && x.adjust !== 'Same' ? ' · ' + esc(x.adjust) : '') + '</div></div>' +
        (isRated(x) ? '<div style="font-weight:700;white-space:nowrap">' + (x.stars || '–') + ' ' + STAR_S + '</div>' : '<span class="tag">Rate</span>') + '</button>';
    }).join('') + '</div></div>';
  }
  return h;
}

function vGear() {
  let h = head('Gear');
  h += '<div class="stack"><div class="label">Grinder</div>' + S.grinders.map((g) => '<div class="card"><div class="rowb"><div style="min-width:0"><h2 class="one">' + esc(g.name) + '</h2><div class="small muted one">' +
    esc([g.burr, g.burrNote, hasVal(g.setting) ? '#' + g.setting : null].filter(Boolean).join(' · ')) + '</div></div>' +
    '<button class="ib" data-a="editGrinder" data-id="' + g.id + '" aria-label="Edit ' + esc(g.name) + '">' + I(IC.edit) + '</button></div></div>').join('') +
    '<button class="btn ghost" data-a="newGrinder">' + I(IC.plus) + 'Grinder</button></div>';
  h += '<div class="stack"><div class="label">My drippers</div><div class="g3">' +
    DRIPPERS.map((d) => { const on = S.owned.indexOf(d.id) >= 0; return '<button class="tile icon ' + (on ? 'own' : 'off') + '" data-a="own" data-v="' + d.id + '" aria-pressed="' + on + '">' + SV(d.svg) + d.name + '</button>'; }).join('') + '</div></div>';
  h += vAccount();
  const synced = window.Cloud && Cloud.user();
  h += '<div class="stack"><div class="label">Backup</div><div class="small muted">' + (synced ? 'Your log syncs to your account. Export also saves a JSON copy.' : 'Data stays on this device. Export before switching phones.') + '</div>' +
    '<div class="g2"><button class="btn sm ghost" data-a="exportData">Export</button><button class="btn sm ghost" data-a="importData">Import</button></div>' +
    '<input type="file" id="imp" accept="application/json,.json" hidden></div>';
  return h;
}

function vAccount() {
  if (!window.Cloud || !Cloud.enabled()) return '';
  const u = Cloud.user();
  let h = '<div class="stack"><div class="label">Account</div>';
  if (u) {
    DR.U = null;
    return h + '<div class="card"><div style="min-width:0"><h2 class="one">' + esc(u.email) + '</h2><div class="small muted" id="sync-status" role="status">' + esc(Cloud.status()) + '</div></div>' +
      '<div class="g2"><button class="btn sm ghost" data-a="syncNow">Sync now</button><button class="btn sm ghost" data-a="signOut">Sign out</button></div></div></div>';
  }
  const U = DR.U || (DR.U = { email: '', code: '', step: 'email' });
  if (U.step === 'code') {
    return h + '<div class="small muted">We emailed a code to ' + esc(U.email) + '.</div>' + field('U', 'code', 'Code', { mode: 'numeric', ph: '123456' }) +
      '<div class="g2"><button class="btn sm ghost" data-a="codeBack">Back</button><button class="btn sm" data-a="verifyCode">Sign in</button></div></div>';
  }
  return h + '<div class="small muted">Sign in to keep your log in the cloud and use it on more than one device.</div>' + field('U', 'email', 'Email', { type: 'email', ph: 'you@example.com' }) +
    '<button class="btn sm" data-a="sendCode">Email me a code</button></div>';
}

function vGrinder() {
  const g = DR.G;
  let h = head(g.id ? 'Edit grinder' : 'Grinder', '', { back: 'back' });
  h += field('G', 'name', 'Name', { ph: 'Comandante C40' });
  h += '<div class="stack"><div class="label">Burr</div><div class="g3">' + BURRS.map((x) => '<button class="tile' + (g.burr === x ? ' on' : '') + '" data-a="setG" data-f="burr" data-v="' + x + '" aria-pressed="' + (g.burr === x) + '">' + x + '</button>').join('') + '</div></div>';
  h += field('G', 'burrNote', 'Burr set', { ph: '64 mm SSP MP' });
  h += field('G', 'setting', 'Usual setting', { mode: 'decimal', ph: '24' });
  h += '<div class="stack"><div class="label">Step size</div><div class="g3">' + [1, 0.5, 0.1].map((x) => '<button class="tile' + (g.step === x ? ' on' : '') + '" data-a="setGStep" data-n="' + x + '" aria-pressed="' + (g.step === x) + '">' + x + '</button>').join('') + '</div></div>';
  h += '<div class="grow"></div><button class="btn" data-a="saveGrinder">' + I(IC.check) + 'Save</button>';
  if (g.id) h += '<button class="btn danger" data-a="delGrinder">' + I(IC.trash, 20) + 'Delete</button>';
  return h;
}

function vCustom() {
  const r = DR.R;
  let h = head(r.id ? 'Edit recipe' : 'New recipe', '', { back: 'backRecipe' });
  h += field('R', 'name', 'Name', { ph: 'My recipe' });
  h += r.steps.map((s, i) => '<div class="card" style="padding:6px 18px;gap:0"><div class="rowb" style="min-height:44px"><div style="font-weight:700">Step ' + (i + 1) + '</div>' +
    (r.steps.length > 1 ? '<button class="ib clear" style="margin:0 -12px 0 0" data-a="rDel" data-i="' + i + '" aria-label="Remove step ' + (i + 1) + '">' + I(IC.x, 20) + '</button>' : '') + '</div>' +
    '<div class="steprow"><div>Start</div><div class="stepper"><button data-a="rStep" data-i="' + i + '" data-k="t" data-d="-5" aria-label="5 seconds earlier">−</button><div class="val">' + fmt(s.t) + '</div><button data-a="rStep" data-i="' + i + '" data-k="t" data-d="5" aria-label="5 seconds later">+</button></div></div>' +
    '<div class="steprow"><div>Pour to</div><div class="stepper"><button data-a="rStep" data-i="' + i + '" data-k="pct" data-d="-5" aria-label="5 percent less">−</button><div class="val">' + (s.pct == null ? 'Wait' : s.pct + '%') + '</div><button data-a="rStep" data-i="' + i + '" data-k="pct" data-d="5" aria-label="5 percent more">+</button></div></div></div>').join('');
  h += '<button class="btn ghost" data-a="rAdd">' + I(IC.plus) + 'Step</button>';
  h += '<div class="card" style="padding:2px 18px;gap:0"><div class="steprow"><div>Total time</div><div class="stepper"><button data-a="rTotal" data-d="-5" aria-label="5 seconds shorter">−</button><div class="val">' + fmt(r.total) + '</div><button data-a="rTotal" data-d="5" aria-label="5 seconds longer">+</button></div></div></div>';
  h += '<button class="btn" data-a="saveRecipe">' + I(IC.check) + 'Save</button>';
  if (r.id) h += '<button class="btn danger" data-a="delRecipe">' + I(IC.trash, 20) + 'Delete</button>';
  return h;
}

// ---------- router ----------
function render() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const p = parts[0] || 'beans', a = parts[1];
  if (p !== 'timer') stopTimer();
  let html = '', tab = null, dark = false;
  if (['method', 'recipe', 'timer', 'custom'].indexOf(p) >= 0 && !DR.D) { location.replace('#brew'); return; }
  if (p === 'beans') { html = vBeans(); tab = 'beans'; }
  else if (p === 'bean') {
    if (!DR.B || DR.B._k !== a) {
      const src = a === 'new' ? { name: '', roaster: '', farm: '', origin: '', price: '', weight: '', roastDate: '', buyDate: today(), process: '', roast: 1, notes: [], rating: 0 } : bean(a);
      if (!src) { location.replace('#beans'); return; }
      DR.B = clone(src); DR.B._k = a;
    }
    html = vBean();
  }
  else if (p === 'brew') { html = vPick(); tab = 'brew'; }
  else if (p === 'method') html = vMethod();
  else if (p === 'recipe') html = vRecipe();
  else if (p === 'timer') { html = vTimer(); dark = true; }
  else if (p === 'rate') {
    const w = S.brews.find((x) => x.id === a);
    if (!w) { location.replace('#beans'); return; }
    if (!DR.Q || DR.Q.id !== a) DR.Q = { id: a, stars: w.stars || 0, adjust: w.adjust || '', r: Object.assign({ aroma: 0, acid: 0, sweet: 0, body: 0, bitter: 0, finish: 0 }, w.r || {}) };
    html = vRate();
  }
  else if (p === 'stats') { html = vStats(a); tab = 'stats'; }
  else if (p === 'gear') { html = vGear(); tab = 'gear'; }
  else if (p === 'grinder') {
    if (!DR.G || DR.G._k !== a) {
      const src = a === 'new' ? { name: '', burr: 'Conical', burrNote: '', setting: '', step: 1 } : grinder(a);
      if (!src) { location.replace('#gear'); return; }
      DR.G = clone(src); DR.G._k = a;
    }
    html = vGrinder();
  }
  else if (p === 'custom') {
    if (!DR.R || DR.R._k !== a) {
      const src = a === 'new' ? { name: '', m: DR.D.method, custom: true, total: 180, steps: [{ t: 0, pct: 15 }, { t: 40, pct: 60 }, { t: 80, pct: 100 }] } : S.recipes.find((r) => r.id === a);
      if (!src) { location.replace('#recipe'); return; }
      DR.R = clone(src); DR.R._k = a;
    }
    html = vCustom();
  }
  else { location.replace('#beans'); return; }
  document.body.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = dark ? '#1F140D' : '#F4EEE6';
  if (!dark) document.getElementById('wave').style.height = '0';
  app.innerHTML = html;
  nav.innerHTML = tab ? navHtml(tab) : '';
  // bag level: let the fill grow from empty so the amount left reads as motion
  const fills = app.querySelectorAll('.fill');
  if (fills.length) requestAnimationFrame(() => requestAnimationFrame(() => fills.forEach((f) => { f.style.width = f.dataset.w + '%'; })));
  if (p === 'timer') initTimer();
}
function rerender() {
  const y = window.scrollY;
  const xs = Array.prototype.map.call(app.querySelectorAll('.hs'), (e) => e.scrollLeft);
  render();
  app.querySelectorAll('.fill').forEach((f) => { f.style.transition = 'none'; f.style.width = f.dataset.w + '%'; });
  app.querySelectorAll('.hs').forEach((e, i) => { if (xs[i]) e.scrollLeft = xs[i]; });
  window.scrollTo(0, y);
}

// beans rain down and pile up over the whole screen, then the list appears
function beanFall(name, then) {
  if (reduced()) { then(); return; }
  const el = document.getElementById('fall');
  const W = window.innerWidth, H = window.innerHeight, size = 58, colW = 44, rowH = 34;
  const cols = Math.ceil(W / colW) + 1, rows = Math.ceil(H / rowH) + 2;
  const shades = ['#6F4423', '#5A3A22', '#7F5533', '#4A2E1B'];
  let h = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * colW - 20 + (Math.random() * 16 - 8) + (r % 2 ? colW / 2 : 0), y = r * rowH - 16 + (Math.random() * 10 - 5);
    const rot = Math.round(Math.random() * 360), sh = shades[(r * 7 + c * 3 + Math.floor(Math.random() * 2)) % 4];
    h += '<svg width="' + size + '" height="' + size + '" viewBox="0 0 48 48" style="left:' + x.toFixed(0) + 'px;bottom:' + y.toFixed(0) + 'px;--r0:' + (rot - 140) + 'deg;--r1:' + rot + 'deg;animation-delay:' + (r * 38 + Math.random() * 90).toFixed(0) + 'ms">' +
      '<ellipse cx="24" cy="24" rx="14" ry="20" fill="' + sh + '"/><path d="M19 7c9 7-4 20 9 34" fill="none" stroke="#2A1A10" stroke-width="2.500" stroke-linecap="round"/></svg>';
  }
  el.innerHTML = h + '<div class="msg"><b>' + esc(name) + '</b><span style="font-weight:600">Added</span></div>';
  el.className = 'on';
  setTimeout(() => { then(); el.classList.add('out'); }, 1900);
  setTimeout(() => { el.className = ''; el.innerHTML = ''; }, 2300);
}

// ---------- timer ----------
function initTimer() {
  if (!T) T = { phase: 'idle', base: 0, startAt: 0, cdEnd: 0, idx: -1, iv: null, cdShown: null, btn: '' };
  T.btn = '';
  paintTimer();
}
function elapsedNow() { return T.phase === 'run' ? T.base + (Date.now() - T.startAt) / 1000 : T.base; }
function beep(freq, ms) {
  try {
    if (!T || !T.ac) return;
    const o = T.ac.createOscillator(), g = T.ac.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(T.ac.destination);
    g.gain.setValueAtTime(0.25, T.ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, T.ac.currentTime + ms / 1000);
    o.start(); o.stop(T.ac.currentTime + ms / 1000);
  } catch (e) { /* silent is fine */ }
}
function setMain(kind) {
  if (T.btn === kind) return;
  T.btn = kind;
  const m = document.getElementById('t-main');
  m.innerHTML = kind === 'pause' ? PAUSE : PLAY;
  m.setAttribute('aria-label', kind === 'pause' ? 'Pause' : 'Start');
}
function paintTimer() {
  if (!T || !DR.D) return;
  const clock = document.getElementById('t-clock');
  if (!clock) return;
  const P = plan(DR.D);
  const cap = document.getElementById('t-cap'), act = document.getElementById('t-act'), wave = document.getElementById('wave');
  document.getElementById('t-cd').style.visibility = T.phase === 'idle' ? 'visible' : 'hidden';
  if (T.phase === 'count') {
    const leftS = Math.ceil((T.cdEnd - Date.now()) / 1000);
    if (leftS <= 0) { T.phase = 'run'; T.startAt = Date.now(); T.base = 0; T.idx = -1; }
    else {
      if (T.cdShown !== leftS) { T.cdShown = leftS; beep(660, 120); }
      cap.textContent = 'Get ready'; clock.textContent = String(leftS); act.textContent = ''; setMain('pause');
      return;
    }
  }
  const el = elapsedNow();
  let idx = -1;
  if (T.phase !== 'idle') P.steps.forEach((s, i) => { if (el >= s.t) idx = i; });
  if (T.phase === 'run' && idx !== T.idx) { T.idx = idx; beep(880, 220); if (navigator.vibrate) navigator.vibrate(120); }
  P.steps.forEach((s, i) => { document.getElementById('ts-' + i).className = 'tstep' + (i === idx ? ' now' : (i < idx ? ' past' : '')); });
  clock.textContent = fmt(el);
  // coffee level = how much of the water should be in by this step
  let lvl = 0;
  for (let i = 0; i <= idx; i++) if (P.steps[i].pct != null) lvl = P.steps[i].pct;
  wave.style.height = lvl + '%';
  const cur = P.steps[Math.max(idx, 0)];
  const say = cur.g != null ? (cur.label.indexOf('Pour') === 0 || cur.label === 'Bloom' ? cur.label + ' to ' + cur.g + ' g' : cur.label + ' · ' + cur.g + ' g') : cur.label;
  const over = el >= P.r.total;
  if (T.phase === 'idle') { cap.textContent = 'Ready'; act.textContent = say; setMain('play'); }
  else {
    cap.textContent = T.phase === 'paused' ? 'Paused' : (over ? 'Finishing' : 'Brewing');
    act.textContent = over ? 'Tap Done when it stops' : say;
    setMain(T.phase === 'paused' ? 'play' : 'pause');
  }
}
function stopTimer() {
  if (!T) return;
  clearInterval(T.iv);
  if (T.lock && T.lock.release) T.lock.release().catch(function () {});
  T = null;
}

// ---------- actions ----------
function startBrew(id) {
  const last = S.brews.filter((w) => w.beanId === id).slice(-1)[0] || S.brews.slice(-1)[0];
  const g = S.grinders[0];
  if (last) {
    DR.D = { beanId: id, method: last.method, dripper: last.dripper || S.owned[0] || 'v60', filter: last.filter || FILTERS[0], recipeId: last.recipeId, dose: last.dose, ratio: last.ratio, temp: last.temp, grind: last.grind, grinderId: grinder(last.grinderId) ? last.grinderId : (g ? g.id : null) };
    if (!recipe(DR.D.recipeId)) DR.D.recipeId = method(DR.D.method).recipe;
  } else {
    const m = METHODS[0];
    DR.D = { beanId: id, method: m.id, dripper: S.owned[0] || 'v60', filter: FILTERS[0], recipeId: m.recipe, dose: m.dose, ratio: m.ratio, temp: m.temp, grind: g && hasVal(g.setting) ? num(g.setting) : '', grinderId: g ? g.id : null };
  }
  go('method');
}
// the brew is logged the moment it's done; tasting notes come later
function logBrew(elapsed) {
  const D = DR.D, b = bean(D.beanId);
  S.brews.push({ id: uid(), beanId: D.beanId, at: Date.now(), date: today(), method: D.method, dripper: D.method === 'pour' ? D.dripper : null, filter: D.method === 'pour' ? D.filter : null,
    recipeId: D.recipeId, dose: D.dose, ratio: D.ratio, temp: D.temp, grind: D.grind, grinderId: D.grinderId, elapsed: elapsed, stars: 0, r: null, adjust: '' });
  if (b) {
    if (!b.openDate) b.openDate = today();
    if (num(b.weight) > 0 && left(b) <= 0 && !b.finishDate) b.finishDate = today();
  }
  save(); DR.D = null; go('beans'); toast('Logged · rate it after a sip');
}

const A = {
  sheetX: () => closeSheet(),
  sheetOk: () => { const o = SH; if (!o) return; const i = document.getElementById('sheet-in'); const v = i ? i.value.trim() : true; if (o.input && !v) { i.focus(); return; } closeSheet(); o.cb(v); },
  home: () => { DR.D = null; go('beans'); },
  back: () => { DR.B = null; DR.G = null; history.length > 1 ? history.back() : go('beans'); },
  newBean: () => { DR.B = null; go('bean/new'); },
  editBean: (d) => { DR.B = null; go('bean/' + d.id); },
  statBean: (d) => go('stats/' + d.id),
  setB: (d) => { DR.B[d.f] = DR.B[d.f] === d.v ? '' : d.v; rerender(); },
  setRoast: (d) => { DR.B.roast = +d.n; rerender(); },
  rateB: (d) => { DR.B.rating = DR.B.rating === +d.n ? 0 : +d.n; rerender(); },
  note: (d) => { const i = DR.B.notes.indexOf(d.v); if (i >= 0) DR.B.notes.splice(i, 1); else DR.B.notes.push(d.v); rerender(); },
  noteAdd: () => sheet({ title: 'Flavour', input: true, ph: 'Lychee', ok: 'Add', cb: (v) => { if (DR.B.notes.indexOf(v) < 0) DR.B.notes.push(v); rerender(); } }),
  saveBean: () => {
    const b = DR.B;
    if (!String(b.name).trim()) { toast('Add a name'); const f = document.getElementById('f-name'); if (f) f.focus(); return; }
    b.name = String(b.name).trim();
    delete b._k;
    const isNew = !b.id;
    if (isNew) { b.id = uid(); S.beans.unshift(b); } else S.beans[S.beans.findIndex((x) => x.id === b.id)] = b;
    save(); DR.B = null;
    if (isNew) beanFall(b.name, () => go('beans')); else go('beans');
  },
  finishBean: () => { DR.B.finishDate = today(); rerender(); },
  delBean: () => sheet({ title: 'Delete ' + DR.B.name + ' and its brews?', ok: 'Delete', danger: true, cb: () => {
    S.beans = S.beans.filter((x) => x.id !== DR.B.id); S.brews = S.brews.filter((w) => w.beanId !== DR.B.id);
    save(); DR.B = null; go('beans');
  } }),
  startBrew: (d) => startBrew(d.id),
  setMethod: (d) => {
    const D = DR.D;
    if (D.method === d.v) return;
    const m = method(d.v), last = S.brews.filter((w) => w.method === d.v).slice(-1)[0];
    D.method = d.v;
    if (last) { D.recipeId = recipe(last.recipeId) ? last.recipeId : m.recipe; D.dose = last.dose; D.ratio = last.ratio; D.temp = last.temp; D.grind = last.grind; }
    else { D.recipeId = m.recipe; D.dose = m.dose; D.ratio = m.ratio; D.temp = m.temp; }
    rerender();
  },
  setD: (d) => { DR.D[d.f] = d.v; rerender(); },
  allDrippers: () => { DR.D.allDrippers = !DR.D.allDrippers; rerender(); },
  filterAdd: () => sheet({ title: 'Filter', input: true, ph: 'Sibarist Fast', ok: 'Add', cb: (v) => { if (filters().indexOf(v) < 0) { S.filters.push(v); save(); } DR.D.filter = v; rerender(); } }),
  toRecipe: () => {
    const D = DR.D;
    if (D.method === 'pour' && D.dripper === 'switch' && ['switch', 'hybrid'].indexOf(D.recipeId) < 0 && !S.brews.some((w) => w.dripper === 'switch')) D.recipeId = 'switch';
    if (!recipe(D.recipeId) || recipe(D.recipeId).m !== D.method) D.recipeId = method(D.method).recipe;
    go('recipe');
  },
  toMethod: () => go('method'),
  setRecipe: (d) => { DR.D.recipeId = d.v; rerender(); },
  setGrinder: (d) => { DR.D.grinderId = d.v; const g = grinder(d.v); if (g && hasVal(g.setting)) DR.D.grind = num(g.setting); rerender(); },
  step: (d) => {
    const D = DR.D, dir = +d.d, k = d.k;
    if (k === 'dose') D.dose = Math.max(1, r1(num(D.dose) + dir * (D.method === 'espresso' ? 0.5 : 1)));
    if (k === 'ratio') D.ratio = Math.max(1, r1(num(D.ratio) + dir * 0.5));
    if (k === 'temp') D.temp = Math.min(100, Math.max(0, num(D.temp) + dir));
    if (k === 'grind') { const g = grinder(D.grinderId); const st = g && g.step ? g.step : 1; D.grind = Math.max(0, r1((hasVal(D.grind) ? num(D.grind) : 0) + dir * st)); }
    rerender();
  },
  newRecipe: () => { DR.R = null; go('custom/new'); },
  editRecipe: (d) => { DR.R = null; go('custom/' + d.id); },
  backRecipe: () => { DR.R = null; go('recipe'); },
  rStep: (d) => {
    const s = DR.R.steps[+d.i], dir = +d.d;
    if (d.k === 't') s.t = Math.max(0, s.t + dir);
    else if (s.pct == null) { if (dir > 0) s.pct = 5; }
    else { const v = s.pct + dir; s.pct = v <= 0 ? null : Math.min(100, v); }
    rerender();
  },
  rAdd: () => { const l = DR.R.steps[DR.R.steps.length - 1]; DR.R.steps.push({ t: l.t + 30, pct: l.pct == null ? null : Math.min(100, l.pct + 20) }); DR.R.total = Math.max(DR.R.total, l.t + 60); rerender(); },
  rDel: (d) => { DR.R.steps.splice(+d.i, 1); rerender(); },
  rTotal: (d) => { DR.R.total = Math.max(10, DR.R.total + +d.d); rerender(); },
  saveRecipe: () => {
    const r = DR.R;
    if (!String(r.name).trim()) { toast('Add a name'); const f = document.getElementById('f-name'); if (f) f.focus(); return; }
    r.name = String(r.name).trim();
    r.steps.sort((x, y) => x.t - y.t);
    r.total = Math.max(r.total, r.steps[r.steps.length - 1].t + 5);
    delete r._k;
    if (r.id) S.recipes[S.recipes.findIndex((x) => x.id === r.id)] = r; else { r.id = 'c' + uid(); S.recipes.push(r); }
    save(); DR.D.recipeId = r.id; DR.R = null; go('recipe');
  },
  delRecipe: () => sheet({ title: 'Delete ' + DR.R.name + '?', ok: 'Delete', danger: true, cb: () => {
    S.recipes = S.recipes.filter((x) => x.id !== DR.R.id); save();
    DR.D.recipeId = method(DR.D.method).recipe; DR.R = null; go('recipe');
  } }),
  toTimer: () => { T = null; go('timer'); },
  logNoTimer: () => logBrew(null),
  setCd: (d) => { S.countdown = +d.n; save(); if (!T || T.phase === 'idle') rerender(); },
  tToggle: () => {
    if (!T) return;
    if (T.phase === 'idle') {
      try { T.ac = T.ac || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no sound */ }
      if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then((l) => { if (T) T.lock = l; else l.release(); }).catch(function () {});
      T.phase = 'count'; T.cdEnd = Date.now() + S.countdown * 1000; T.cdShown = null;
      clearInterval(T.iv); T.iv = setInterval(paintTimer, 200);
    } else if (T.phase === 'count') { T.phase = 'idle'; clearInterval(T.iv); }
    else if (T.phase === 'run') { T.base = elapsedNow(); T.phase = 'paused'; }
    else if (T.phase === 'paused') { T.startAt = Date.now(); T.phase = 'run'; }
    paintTimer();
  },
  tReset: () => { if (!T) return; clearInterval(T.iv); const ac = T.ac; T = { phase: 'idle', base: 0, startAt: 0, cdEnd: 0, idx: -1, iv: null, cdShown: null, ac: ac, btn: '' }; paintTimer(); },
  tBack: () => go('recipe'),
  tDone: () => logBrew(T && (T.phase === 'run' || T.phase === 'paused') ? Math.round(elapsedNow()) : null),
  rate: (d) => { DR.Q = null; go('rate/' + d.id); },
  skipRate: (d) => { const w = S.brews.find((x) => x.id === d.id); if (w) { w.skip = true; save(); } rerender(); },
  rateBack: () => { DR.Q = null; history.length > 1 ? history.back() : go('beans'); },
  rateQ: (d) => { DR.Q.stars = DR.Q.stars === +d.n ? 0 : +d.n; rerender(); },
  taste: (d) => { DR.Q.r[d.k] = DR.Q.r[d.k] === +d.n ? 0 : +d.n; rerender(); },
  adjust: (d) => { DR.Q.adjust = DR.Q.adjust === d.v ? '' : d.v; rerender(); },
  saveRate: () => {
    const Q = DR.Q, w = S.brews.find((x) => x.id === Q.id);
    w.stars = Q.stars; w.r = Q.r; w.adjust = Q.adjust; w.ratedAt = Date.now();
    save(); DR.Q = null; go('stats/' + w.beanId);
  },
  own: (d) => { const i = S.owned.indexOf(d.v); if (i >= 0) S.owned.splice(i, 1); else S.owned.push(d.v); save(); rerender(); },
  newGrinder: () => { DR.G = null; go('grinder/new'); },
  editGrinder: (d) => { DR.G = null; go('grinder/' + d.id); },
  setG: (d) => { DR.G[d.f] = d.v; rerender(); },
  setGStep: (d) => { DR.G.step = +d.n; rerender(); },
  saveGrinder: () => {
    const g = DR.G;
    if (!String(g.name).trim()) { toast('Add a name'); const f = document.getElementById('f-name'); if (f) f.focus(); return; }
    g.name = String(g.name).trim();
    delete g._k;
    if (g.id) S.grinders[S.grinders.findIndex((x) => x.id === g.id)] = g; else { g.id = uid(); S.grinders.push(g); }
    save(); DR.G = null; go('gear');
  },
  delGrinder: () => sheet({ title: 'Delete ' + DR.G.name + '?', ok: 'Delete', danger: true, cb: () => { S.grinders = S.grinders.filter((x) => x.id !== DR.G.id); save(); DR.G = null; go('gear'); } }),
  exportData: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = 'coffee-backup-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  importData: () => { const i = document.getElementById('imp'); if (i) i.click(); },
  sendCode: async (d, el) => {
    const U = DR.U, email = String(U.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter your email'); const f = document.getElementById('f-email'); if (f) f.focus(); return; }
    if (el) el.disabled = true;
    try { await Cloud.sendCode(email); U.email = email; U.code = ''; U.step = 'code'; rerender(); const f = document.getElementById('f-code'); if (f) f.focus(); }
    catch (e) { toast((e && e.message) || 'Couldn’t send the code'); if (el) el.disabled = false; }
  },
  verifyCode: async (d, el) => {
    const U = DR.U, code = String(U.code || '').replace(/\s/g, '');
    if (!code) { toast('Enter the code'); return; }
    if (el) el.disabled = true;
    try { await Cloud.verify(U.email, code); toast('Signed in'); }
    catch (e) { toast('That code didn’t work'); if (el) el.disabled = false; }
  },
  codeBack: () => { DR.U.step = 'email'; rerender(); },
  syncNow: () => Cloud.sync(),
  signOut: () => sheet({ title: 'Sign out? Your log stays on this phone.', ok: 'Sign out', cb: () => Cloud.signOut() })
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || !A[el.dataset.a]) return;
  e.preventDefault();
  A[el.dataset.a](el.dataset, el);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'sheet-in') A.sheetOk();
  if (e.key === 'Enter' && e.target.id === 'f-email' && DR.U) A.sendCode();
  if (e.key === 'Enter' && e.target.id === 'f-code' && DR.U) A.verifyCode();
  if (e.key === 'Escape' && SH) closeSheet();
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.dataset || !el.dataset.o || !DR[el.dataset.o]) return;
  DR[el.dataset.o][el.dataset.f] = el.value;
  if (el.dataset.o === 'B' && (el.dataset.f === 'price' || el.dataset.f === 'weight')) {
    const out = document.getElementById('perg');
    if (out) out.textContent = pergText(perG(DR.B));
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id !== 'imp' || !e.target.files[0]) return;
  const fr = new FileReader();
  fr.onload = () => {
    let data = null;
    try { data = JSON.parse(fr.result); } catch (err) { data = null; }
    if (!data || !Array.isArray(data.beans) || !Array.isArray(data.brews)) { toast('Not a backup file'); return; }
    sheet({ title: 'Replace everything with ' + data.beans.length + ' bags and ' + data.brews.length + ' brews?', ok: 'Replace', danger: true, cb: () => { S = Object.assign(blank(), data); save(); go('beans'); } });
  };
  fr.readAsText(e.target.files[0]);
});
window.addEventListener('hashchange', render);
document.addEventListener('visibilitychange', () => { if (!document.hidden && T) paintTimer(); });
render();
if (window.Cloud) Cloud.init();
