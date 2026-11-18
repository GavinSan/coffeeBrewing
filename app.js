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
const PROCESSES = ['Washed', 'Natural', 'Honey', 'Pulped natural', 'Wet-hulled', 'Anaerobic', 'Carbonic maceration', 'Co-ferment'];
const ROASTS = ['Light', 'Medium-light', 'Medium', 'Medium-dark', 'Dark'];
const ROAST_C = ['#C9A27C', '#B58A5E', '#7F5533', '#5A3A22', '#33211A'];
const FLAVOR_GROUPS = [
  ['Fruity', ['Citrus', 'Lemon', 'Orange', 'Grapefruit', 'Berry', 'Blueberry', 'Strawberry', 'Cherry', 'Stone fruit', 'Peach', 'Apricot', 'Apple', 'Grape', 'Tropical', 'Mango', 'Passion fruit', 'Dried fruit']],
  ['Floral & tea', ['Floral', 'Jasmine', 'Rose', 'Bergamot', 'Tea', 'Black tea', 'Earl Grey']],
  ['Sweet', ['Caramel', 'Honey', 'Brown sugar', 'Toffee', 'Maple', 'Vanilla', 'Molasses']],
  ['Chocolate & nut', ['Chocolate', 'Milk chocolate', 'Dark chocolate', 'Cocoa', 'Nutty', 'Almond', 'Hazelnut']],
  ['Spice & more', ['Cinnamon', 'Clove', 'Spice', 'Winey', 'Boozy', 'Herbal', 'Earthy', 'Tobacco']]
];
const ORIGINS = ['Ethiopia', 'Kenya', 'Colombia', 'Panama', 'Costa Rica', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Brazil', 'Peru', 'Bolivia',
  'Ecuador', 'Mexico', 'Rwanda', 'Burundi', 'Uganda', 'Tanzania', 'DR Congo', 'Yemen', 'Indonesia', 'Papua New Guinea', 'India', 'China', 'Taiwan',
  'Thailand', 'Vietnam', 'Myanmar', 'Laos', 'Hawaii', 'Jamaica'];
const BURRS = ['Conical', 'Flat', 'Ghost'];
const AXES = [['aroma', 'Aroma'], ['acid', 'Acidity'], ['sweet', 'Sweet'], ['body', 'Body'], ['bitter', 'Bitter'], ['finish', 'Finish']];
const ADJUSTS = ['Same', 'Finer', 'Coarser', 'Hotter', 'Cooler'];
const ADJ_TEXT = { Finer: 'grind finer', Coarser: 'grind coarser', Hotter: 'brew hotter', Cooler: 'brew cooler' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FLOW = 5; // grams per second a steady kettle pour adds; sets how long each pour should take
const DAY = 864e5;

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
  edit: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.500 20.500c1.500-3.800 4.300-5.500 7.500-5.500s6 1.700 7.500 5.500"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M20 20l-4-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.500"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'
};
const PLAY = '<svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.500v13a1 1 0 0 0 1.500.900l10.500-6.500a1 1 0 0 0 0-1.700L9.500 4.600A1 1 0 0 0 8 5.500z"/></svg>';
const PAUSE = '<svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.500" height="14" rx="1.500"/><rect x="13.500" y="5" width="4.500" height="14" rx="1.500"/></svg>';
const STAR = '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.500l2.900 6 6.600.900-4.800 4.600 1.200 6.500L12 17.400l-5.900 3.100 1.200-6.500L2.500 9.400l6.600-.900z"/></svg>';
const STAR_S = '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px"><path d="M12 2.500l2.900 6 6.600.900-4.800 4.600 1.200 6.500L12 17.400l-5.900 3.100 1.200-6.500L2.500 9.400l6.600-.900z"/></svg>';
const CHEV = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.500" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const CUP = '<svg aria-hidden="true" width="64" height="64" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 18h24v10a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10z"/><path d="M34 21h3a4 4 0 0 1 0 8h-3"/><path d="M17 7c0 2 2 2.500 2 4.500s-2 2.500-2 4.500"/><path d="M24 7c0 2 2 2.500 2 4.500s-2 2.500-2 4.500"/></svg>';

// ---------- state ----------
function blank() { return { beans: [], brews: [], grinders: [], owned: [], recipes: [], filters: [], flavors: [], processes: [], countdown: 3, updatedAt: 0 }; }
function load() {
  try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return blank(); }
}
let S = load();
function save() {
  S.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Storage is full'); }
  if (window.Cloud) Cloud.changed();
}

// view settings (sort, filters, period); kept per device, not synced
const PREF_KEY = 'coffee-ui-v1';
const PDEF = { beanTab: 'open', sort: 'recent', min: 0, group: '', q: '', period: '90', by: 'bean', tsort: 'cups', lm: '', lr: '', logN: 30 };
let P = (function () { try { return Object.assign({}, PDEF, JSON.parse(localStorage.getItem(PREF_KEY)) || {}); } catch (e) { return Object.assign({}, PDEF); } })();
P.q = ''; P.logN = 30;
function savePref() { try { localStorage.setItem(PREF_KEY, JSON.stringify(P)); } catch (e) { /* not important */ } }

const DR = { B: null, G: null, R: null, D: null, Q: null, U: null }; // drafts being edited (U = sign-in form)
let T = null;   // timer
let SH = null;  // open sheet
let CH = null;  // chart buckets on screen
let lastP = null, suggHold = false;

// ---------- helpers ----------
const app = document.getElementById('app');
const nav = document.getElementById('nav');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const r1 = (n) => Math.round(n * 10) / 10;
const pad = (n) => String(n).padStart(2, '0');
function today() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function days(a, b) { if (!a || !b) return null; return Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / DAY); }
function fmt(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + pad(s % 60); }
const md = (d) => (d ? MONTHS[+d.slice(5, 7) - 1] + ' ' + +d.slice(8, 10) : '—');
const money = (n) => '$' + n.toFixed(2);
const hhmm = (ms) => { const d = new Date(ms); return d.getHours() + ':' + pad(d.getMinutes()); };
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const go = (h) => { if (location.hash === '#' + h) render(); else location.hash = h; };
const back = (fallback) => { if (history.length > 1) history.back(); else go(fallback || 'brew'); };
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function dayLabel(d) {
  const n = days(d, today());
  if (n === 0) return 'Today';
  if (n === 1) return 'Yesterday';
  const dt = new Date(d + 'T00:00');
  return (n > 0 && n < 7 ? DOW[dt.getDay()] + ', ' : '') + MONTHS[dt.getMonth()] + ' ' + dt.getDate() + (dt.getFullYear() !== new Date().getFullYear() ? ', ' + dt.getFullYear() : '');
}
function fullDate() { const d = new Date(); return DOW[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); }

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
const roastI = (b) => Math.min(5, Math.max(1, Math.round(num(b.roast) || 1)));
const cupCost = (w) => { const b = bean(w.beanId), p = b ? perG(b) : null; return p != null ? p * num(w.dose) : null; };
const brewerName = (w) => { const d = w.method === 'pour' && w.dripper ? dripper(w.dripper) : null; return d ? d.name : method(w.method).name; };
function beanStars(b) { const r = brewsOf(b.id).map((w) => w.stars).filter((n) => n > 0); return r.length ? avg(r) : (b.rating || null); }
function lastBrew(id) { let w = null; S.brews.forEach((x) => { if (x.beanId === id && (!w || (x.at || 0) >= (w.at || 0))) w = x; }); return w; }
function lastUsed(b) { const w = lastBrew(b.id); return w ? w.at : (b.buyDate ? new Date(b.buyDate + 'T00:00').getTime() : 0); }
// values typed before, most used first
function distinct(f) {
  const m = new Map();
  S.beans.forEach((b, i) => {
    const v = String(b[f] || '').trim(); if (!v) return;
    const e = m.get(v.toLowerCase()) || { v: v, n: 0, i: i };
    e.n++; e.i = Math.min(e.i, i); m.set(v.toLowerCase(), e);
  });
  return Array.from(m.values()).sort((a, b) => b.n - a.n || a.i - b.i).map((e) => e.v);
}

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
  let h = '<svg class="radar" viewBox="0 0 ' + Sz + ' ' + (Sz - 44) + '" role="img" aria-label="Taste chart: ' + AXES.map((x) => x[1] + ' ' + r1(typeof v === 'number' ? v : num(v[x[0]]))).join(', ') + '">';
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

// ---------- shared pieces ----------
function navHtml(on) {
  const tabs = [['brew', 'Brew', IC.drop], ['beans', 'Beans', IC.bean], ['journal', 'Journal', IC.stats], ['gear', 'Gear', IC.gear]];
  return '<div class="in">' + tabs.map((t) => '<a href="#' + t[0] + '"' + (t[0] === on ? ' class="on" aria-current="page"' : '') + '>' + I(t[2]) + t[1] + '</a>').join('') + '</div>';
}
function head(title, sub, o) {
  o = o || {};
  return '<div class="head">' + (o.back ? '<button class="ib clear" data-a="' + o.back + '" aria-label="Back">' + I(IC.back) + '</button>' : '') +
    '<div class="t"><h1 class="one">' + title + '</h1>' + (sub ? '<div class="sub one">' + sub + '</div>' : '') + '</div>' + (o.right || '') + '</div>';
}
function avatar() {
  const u = window.Cloud && Cloud.enabled() ? Cloud.user() : null;
  return '<button class="ib av' + (u ? ' in' : '') + '" data-a="go" data-v="account" aria-label="' + (u ? 'Account, signed in as ' + esc(u.email) : 'Account and backup') + '">' +
    (u && u.email ? esc(u.email.charAt(0).toUpperCase()) : I(IC.user)) + '</button>';
}
const dots = (n) => '<div class="dots" aria-label="Step ' + n + ' of 3">' + [1, 2, 3].map((i) => '<i' + (i === n ? ' class="on"' : '') + '></i>').join('') + '</div>';
function seg(k, opts, cur, label) {
  return '<div class="seg2" role="group" aria-label="' + esc(label) + '">' + opts.map((o) => '<button class="' + (String(cur) === o[0] ? 'on' : '') + '" data-a="pref" data-k="' + k + '" data-v="' + o[0] + '" aria-pressed="' + (String(cur) === o[0]) + '">' + o[1] + '</button>').join('') + '</div>';
}
function sel(k, opts, cur, label) {
  return '<label class="selw"><span class="sr">' + esc(label) + '</span><select data-pref="' + k + '">' + opts.map((o) => '<option value="' + esc(o[0]) + '"' + (String(cur) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>' + CHEV + '</label>';
}
const rbar = (n) => '<span class="rbar" role="img" aria-label="' + ROASTS[n - 1] + ' roast"><i style="left:' + ((n - 1) * 25) + '%"></i></span>';
function meter(b) {
  const w = num(b.weight); if (!w) return '';
  return '<div class="meter" role="img" aria-label="' + left(b) + ' of ' + w + ' grams left"><i style="width:' + Math.round(left(b) / w * 100) + '%"></i></div>';
}
function starsHtml(n, act) {
  let h = '<div class="stars">';
  for (let i = 1; i <= 5; i++) h += '<button data-a="' + act + '" data-n="' + i + '" class="' + (i <= n ? 'on' : '') + '" aria-label="' + i + ' star" aria-pressed="' + (i <= n) + '">' + STAR + '</button>';
  return h + '</div>';
}
function field(o, f, label, opt) {
  opt = opt || {};
  const v = DR[o][f] == null ? '' : DR[o][f];
  const inp = '<input id="f-' + f + '" data-o="' + o + '" data-f="' + f + '" type="' + (opt.type || 'text') + '"' +
    (opt.num ? ' data-num="1" inputmode="decimal"' : (opt.mode ? ' inputmode="' + opt.mode + '"' : '')) + (opt.sugg ? ' data-sugg="1"' : '') +
    (opt.type === 'email' ? ' autocapitalize="off" spellcheck="false"' : '') + ' value="' + esc(v) + '" placeholder="' + esc(opt.ph || '') + '" autocomplete="off">';
  const box = opt.pre || opt.suf ? '<div class="affix">' + (opt.pre ? '<span>' + opt.pre + '</span>' : '') + inp + (opt.suf ? '<span>' + opt.suf + '</span>' : '') + '</div>' : inp;
  return '<div class="field"><label for="f-' + f + '">' + label + '</label>' + box + (opt.sugg ? '<div class="sugg wrap" id="sg-' + f + '"></div>' : '') + '</div>';
}
function rateBanner(w) {
  const b = bean(w.beanId);
  return '<div class="banner"><div class="grow" style="min-width:0"><div style="font-weight:650">How was it?</div><div class="sub one">' + esc([b ? b.name : '', brewerName(w), dayLabel(w.date)].filter(Boolean).join(' · ')) + '</div></div>' +
    '<button class="btn sm" data-a="rate" data-id="' + w.id + '">Rate</button><button class="x" data-a="skipRate" data-id="' + w.id + '" aria-label="Dismiss">' + I(IC.x, 20) + '</button></div>';
}
function brewLine(w) {
  return [w.dose + ' g', '1:' + w.ratio, w.temp + '°', hasVal(w.grind) ? '#' + w.grind : null, w.elapsed != null ? fmt(w.elapsed) : null].filter(Boolean).join(' · ');
}
function beanRow(b, o) {
  o = o || {};
  const s = beanStars(b), d = days(b.roastDate, today()), wt = num(b.weight), ri = roastI(b);
  const right = o.brew ? '<span class="go" aria-hidden="true">' + I(IC.drop, 20) + '</span>'
    : '<div class="rt">' + (s != null ? '<div class="fw">' + s.toFixed(1) + ' ' + STAR_S + '</div>' : '') +
      '<div class="small muted">' + (b.finishDate ? 'Done ' + md(b.finishDate) : [d != null ? 'Day ' + d : null, wt ? left(b) + ' g' : null].filter(Boolean).join(' · ')) + '</div></div>';
  return '<button class="row" data-a="' + (o.act || (o.brew ? 'startBrew' : 'openBean')) + '" data-id="' + b.id + '"' + (o.brew ? ' aria-label="Brew ' + esc(b.name) + '"' : '') + '>' +
    '<span class="dot" style="background:' + ROAST_C[ri - 1] + '" title="' + ROASTS[ri - 1] + ' roast"></span>' +
    '<div class="grow" style="min-width:0"><div class="one fw">' + esc(b.name) + '</div><div class="small muted one">' + esc([b.roaster, b.origin, b.process].filter(Boolean).join(' · ') || 'No details yet') + '</div></div>' + right + '</button>';
}
function brewRow(w, o) {
  o = o || {};
  const rc = recipe(w.recipeId), b = bean(w.beanId);
  const title = o.bean ? esc(b ? b.name : 'Deleted bag') : dayLabel(w.date) + ' · ' + esc(rc ? rc.name : method(w.method).name);
  const sub = (o.bean ? esc([brewerName(w), rc ? rc.name : null].filter(Boolean).join(' · ')) + ' · ' : esc(brewerName(w)) + ' · ') + brewLine(w) + (w.adjust && w.adjust !== 'Same' ? ' · ' + esc(w.adjust) : '');
  return '<button class="row" data-a="rate" data-id="' + w.id + '">' + (o.bean ? '<span class="tm">' + (w.at ? hhmm(w.at) : '') + '</span>' : '') +
    '<div class="grow" style="min-width:0"><div class="one fw">' + title + '</div><div class="small muted one">' + sub + '</div></div>' +
    (isRated(w) ? '<div class="fw nowrap">' + (w.stars || '–') + ' ' + STAR_S + '</div>' : '<span class="tag soft">Rate</span>') + '</button>';
}

// ---------- Brew (home) ----------
function vHome() {
  let h = head('Brew', fullDate(), { right: avatar() });
  const pend = pending()[0];
  if (pend) h += rateBanner(pend);
  if (!S.beans.length) {
    h += '<div class="card welcome">' + CUP + '<h2>Start with a bag of beans</h2><div class="muted">Add what you’re brewing. Each cup then tracks cost, freshness and how it tasted.</div>' +
      '<button class="btn" data-a="newBean">' + I(IC.plus) + 'Add a bag</button></div>';
    if (!S.grinders.length) h += '<button class="link" data-a="go" data-v="gear">Set up your grinder and drippers</button>';
    return h;
  }
  const open = S.beans.filter((b) => !b.finishDate).sort((x, y) => lastUsed(y) - lastUsed(x));
  if (!open.length) {
    const recent = S.beans.slice().sort((x, y) => lastUsed(y) - lastUsed(x)).slice(0, 4);
    return h + '<div class="card welcome">' + CUP + '<h2>Out of beans</h2><div class="muted">Every bag is finished. Add a new one, or buy one you liked again.</div>' +
      '<button class="btn" data-a="newBean">' + I(IC.plus) + 'Add a bag</button></div>' +
      '<div class="stack"><div class="label">Buy again</div><div class="list">' + recent.map((b) => beanRow(b, { act: 'buyAgain' })).join('') + '</div></div>';
  }
  h += heroCard(open[0]);
  if (open.length > 1) h += '<div class="stack"><div class="label">Other open bags</div><div class="list">' + open.slice(1).map((b) => beanRow(b, { brew: true })).join('') + '</div></div>';
  h += '<button class="btn ghost" data-a="newBean">' + I(IC.plus) + 'New bag</button>';
  return h;
}
function heroCard(b) {
  const w = lastBrew(b.id), d = days(b.roastDate, today()), wt = num(b.weight);
  let h = '<div class="card hero"><div class="rowb" style="align-items:flex-start"><button class="titlebtn" data-a="openBean" data-id="' + b.id + '">' +
    '<div class="small muted">' + (w ? 'Up next' : 'New bag') + '</div><h2 class="one">' + esc(b.name) + '</h2><div class="small muted one">' + esc([b.roaster, b.origin].filter(Boolean).join(' · ') || 'Tap to add details') + '</div></button>' +
    (d != null ? '<div class="tag" title="Days since roast">Day ' + d + '</div>' : '') + '</div>';
  if (wt) {
    const per = w ? num(w.dose) || 15 : 15;
    h += '<div class="stack" style="gap:6px">' + meter(b) + '<div class="rowb small"><span class="fw">' + left(b) + ' g left</span><span class="muted">about ' + plural(Math.floor(left(b) / per), 'cup') + '</span></div></div>';
  }
  if (w) {
    const rc = recipe(w.recipeId);
    h += '<div class="last"><div class="small muted">Last cup · ' + dayLabel(w.date) + (w.stars ? ' · ' + w.stars + ' ' + STAR_S : '') + '</div>' +
      '<div class="one fw">' + esc([brewerName(w), rc ? rc.name : null].filter(Boolean).join(' · ')) + '</div><div class="small muted one">' + brewLine(w) + '</div>' +
      (ADJ_TEXT[w.adjust] ? '<div class="hint">' + I(IC.info, 18) + 'You noted: ' + ADJ_TEXT[w.adjust] + ' next time</div>' : '') + '</div>';
  }
  return h + '<button class="btn" data-a="startBrew" data-id="' + b.id + '">' + I(IC.drop) + (w ? 'Brew' : 'Brew the first cup') + '</button></div>';
}

// ---------- Beans ----------
function vBeans() {
  const open = S.beans.filter((b) => !b.finishDate).length;
  let h = head('Beans', S.beans.length ? open + ' open · ' + (S.beans.length - open) + ' finished' : '', { right: '<button class="ib pri" data-a="newBean" aria-label="Add a bag">' + I(IC.plus) + '</button>' + avatar() });
  if (!S.beans.length) return h + '<div class="card welcome">' + CUP + '<h2>No beans yet</h2><div class="muted">Add your first bag to start your shelf.</div><button class="btn" data-a="newBean">' + I(IC.plus) + 'Add a bag</button></div>';
  h += '<div class="search">' + I(IC.search, 20) + '<input id="f-q" type="search" placeholder="Search name, roaster, origin, flavour" value="' + esc(P.q) + '" autocomplete="off" aria-label="Search beans"></div>';
  h += seg('beanTab', [['open', 'Open'], ['done', 'Finished'], ['all', 'All']], P.beanTab, 'Show');
  h += '<div class="tools">' + sel('sort', [['recent', 'Recently brewed'], ['rating', 'Highest rated'], ['fresh', 'Freshest roast'], ['cost', 'Cheapest per gram'], ['name', 'Name A–Z']], P.sort, 'Sort by') +
    '<button class="chip sm' + (P.min ? ' on' : '') + '" data-a="pref" data-k="min" data-v="' + (P.min ? 0 : 4) + '" aria-pressed="' + !!P.min + '">' + STAR_S + ' 4 and up</button>' +
    '<button class="chip sm' + (P.group ? ' on' : '') + '" data-a="pref" data-k="group" data-v="' + (P.group ? '' : '1') + '" aria-pressed="' + !!P.group + '">By roaster</button></div>';
  return h + '<div id="blist" class="stack">' + beansList() + '</div>';
}
function beansList() {
  const q = P.q.trim().toLowerCase();
  let xs = S.beans.filter((b) => P.beanTab === 'all' || (P.beanTab === 'open' ? !b.finishDate : !!b.finishDate));
  if (q) xs = xs.filter((b) => [b.name, b.roaster, b.origin, b.farm, b.process].concat(b.notes || []).join(' ').toLowerCase().indexOf(q) >= 0);
  if (P.min) xs = xs.filter((b) => (beanStars(b) || 0) >= P.min);
  const key = {
    recent: (b) => -lastUsed(b),
    rating: (b) => -(beanStars(b) || 0),
    fresh: (b) => -(b.roastDate ? new Date(b.roastDate + 'T00:00').getTime() : 0),
    cost: (b) => (perG(b) == null ? 1e9 : perG(b))
  }[P.sort];
  xs.sort((a, b) => (key ? key(a) - key(b) : 0) || a.name.localeCompare(b.name));
  if (!xs.length) return '<div class="empty muted">' + (q || P.min ? 'No beans match.' : P.beanTab === 'done' ? 'No finished bags yet.' : 'No open bags. Tap + to add one.') + '</div>';
  if (!P.group) return '<div class="list">' + xs.map((b) => beanRow(b)).join('') + '</div>';
  const g = {};
  xs.forEach((b) => { const k = b.roaster || 'No roaster'; (g[k] = g[k] || []).push(b); });
  return Object.keys(g).map((k) => '<div class="stack" style="gap:8px"><div class="label">' + esc(k) + ' · ' + g[k].length + '</div><div class="list">' + g[k].map((b) => beanRow(b)).join('') + '</div></div>').join('');
}

function vBeanView(b) {
  const ws = brewsOf(b.id).slice().sort((x, y) => (y.at || 0) - (x.at || 0));
  const p = perG(b), wt = num(b.weight), d = days(b.roastDate, today()), s = beanStars(b), ri = roastI(b);
  let h = head(esc(b.name), esc([b.roaster, b.origin].filter(Boolean).join(' · ')), { back: 'back', right: '<button class="ib" data-a="editBean" data-id="' + b.id + '" aria-label="Edit ' + esc(b.name) + '">' + I(IC.edit) + '</button>' });
  h += '<div class="card">';
  h += '<div class="rowb">' + (wt ? '<div><span class="big">' + left(b) + ' g</span><span class="muted"> of ' + wt + ' g</span></div>' : '<div class="muted">No weight set</div>') +
    (b.finishDate ? '<span class="tag soft">Finished</span>' : (d != null ? '<span class="tag" title="Days since roast">Day ' + d + '</span>' : '')) + '</div>' + meter(b);
  const fact = (k, v) => '<div><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  h += '<div class="facts">' + fact('Roast', rbar(ri) + '<span class="one">' + ROASTS[ri - 1] + '</span>') + fact('Process', esc(b.process || '—')) +
    fact('Origin', esc(b.origin || '—')) + fact('Farm', '<span class="one">' + esc(b.farm || '—') + '</span>') +
    fact('Per gram', p != null ? money(p) : '—') + fact('Roasted', md(b.roastDate)) + '</div>';
  if (b.notes && b.notes.length) h += '<div class="wrap">' + b.notes.map((n) => '<span class="chip sm static">' + esc(n) + '</span>').join('') + '</div>';
  h += b.finishDate ? '<button class="btn" data-a="buyAgain" data-id="' + b.id + '">' + I(IC.copy) + 'Buy again</button>'
    : '<button class="btn" data-a="startBrew" data-id="' + b.id + '">' + I(IC.drop) + 'Brew</button>';
  h += '</div>';

  const best = ws.filter((w) => w.stars).sort((x, y) => y.stars - x.stars || (y.at || 0) - (x.at || 0))[0];
  if (best) {
    const rc = recipe(best.recipeId);
    h += '<div class="card"><div class="rowb"><div class="label">Best cup</div><div class="fw">' + best.stars + ' ' + STAR_S + '</div></div>' +
      '<div><div class="one fw">' + esc([brewerName(best), rc ? rc.name : null].filter(Boolean).join(' · ')) + '</div><div class="small muted one">' + brewLine(best) + ' · ' + dayLabel(best.date) + '</div></div>' +
      (b.finishDate ? '' : '<button class="btn sm ghost" data-a="brewLike" data-id="' + best.id + '">Brew it the same way</button>') + '</div>';
  }
  const tasted = ws.filter((w) => w.r && AXES.some((a) => num(w.r[a[0]]) > 0));
  if (tasted.length) {
    const m = {};
    AXES.forEach((a) => { m[a[0]] = avg(tasted.map((x) => num(x.r[a[0]])).filter((n) => n > 0)) || 0; });
    h += '<div class="card" style="padding:14px 8px 6px">' + radar(m) + '<div class="small muted" style="text-align:center;padding-bottom:6px">Average taste of ' + plural(tasted.length, 'cup') + '</div></div>';
  }
  const avgDose = avg(ws.map((x) => num(x.dose)));
  const span = b.openDate ? days(b.openDate, b.finishDate || today()) : null;
  const tiles = [
    ['Cups', String(ws.length)],
    ['Rating', s != null ? s.toFixed(1) + ' ' + STAR_S : '—'],
    ['Per cup', p != null && avgDose ? money(p * avgDose) : '—'],
    [b.finishDate ? 'Lasted' : 'Open for', span != null ? plural(span, 'day') : '—']
  ];
  h += '<div class="g2">' + tiles.map((t) => '<div class="stat"><div class="k">' + t[0] + '</div><div class="v">' + t[1] + '</div></div>').join('') + '</div>';
  if (ws.length) h += '<div class="stack"><div class="label">Brews</div><div class="list">' + ws.map((w) => brewRow(w)).join('') + '</div></div>';
  return h;
}

function blankBean() { return { name: '', roaster: '', farm: '', origin: '', price: '', weight: '', roastDate: '', buyDate: today(), process: '', roast: 3, notes: [], _k: 'new' }; }
function copyOf(src) {
  return { name: src.name, roaster: src.roaster || '', farm: src.farm || '', origin: src.origin || '', price: src.price || '', weight: src.weight || '', roastDate: '', buyDate: today(),
    process: src.process || '', roast: roastI(src), notes: (src.notes || []).slice(), _k: 'new', _from: src.name };
}
const pergText = (p) => (p != null ? money(p) + ' per gram' : 'Price ÷ weight = cost per gram');
function vBeanForm() {
  const b = DR.B, isNew = !b.id, ri = roastI(b);
  let h = head(isNew ? 'New bag' : 'Edit bag', '', { back: 'back' });
  if (isNew && !b._from && S.beans.length) {
    const seen = {}, prev = S.beans.slice().sort((x, y) => lastUsed(y) - lastUsed(x)).filter((x) => { const k = (x.name + '|' + x.roaster).toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, 6);
    h += '<div class="stack"><div class="label">Bought one of these again?</div><div class="wrap">' + prev.map((x) => '<button class="chip sm" data-a="copyBean" data-id="' + x.id + '">' + I(IC.copy, 16) + esc(x.name) + '</button>').join('') + '</div></div>';
  }
  if (b._from) h += '<div class="hint">' + I(IC.info, 18) + 'Copied from your last ' + esc(b._from) + '. Set the new roast date.</div>';
  h += field('B', 'name', 'Name', { ph: 'Guji Hambela' });
  h += field('B', 'roaster', 'Roaster', { sugg: 1, ph: 'Who roasted it' });
  h += field('B', 'origin', 'Origin', { sugg: 1, ph: 'Ethiopia' });
  h += field('B', 'farm', 'Farm or producer', { sugg: 1, ph: 'Optional' });
  h += '<div class="g2">' + field('B', 'price', 'Price', { num: 1, pre: '$', ph: '0.00' }) + field('B', 'weight', 'Weight', { num: 1, suf: 'g', ph: '250' }) + '</div>';
  h += '<div class="small muted" id="perg" style="margin-top:-8px">' + pergText(perG(b)) + '</div>';
  h += '<div class="g2">' + field('B', 'roastDate', 'Roasted', { type: 'date' }) + field('B', 'buyDate', 'Bought', { type: 'date' }) + '</div>';
  if (!isNew) h += '<div class="g2">' + field('B', 'openDate', 'Opened', { type: 'date' }) + field('B', 'finishDate', 'Finished', { type: 'date' }) + '</div>';
  const procs = PROCESSES.concat(S.processes);
  if (b.process && procs.indexOf(b.process) < 0) procs.push(b.process);
  h += '<div class="stack"><div class="label">Process</div><div class="wrap">' +
    procs.map((x) => '<button class="chip sm' + (b.process === x ? ' on' : '') + '" data-a="setB" data-f="process" data-v="' + esc(x) + '" aria-pressed="' + (b.process === x) + '">' + esc(x) + '</button>').join('') +
    '<button class="chip sm add" data-a="procAdd">' + I(IC.plus, 16) + 'Other</button></div></div>';
  h += '<div class="stack" style="gap:4px"><div class="rowb"><label class="label" for="f-roast">Roast</label><div class="fw" id="roast-lbl">' + ROASTS[ri - 1] + '</div></div>' +
    '<input type="range" id="f-roast" class="roast" min="1" max="5" step="1" value="' + ri + '" style="--c:' + ROAST_C[ri - 1] + '" aria-valuetext="' + ROASTS[ri - 1] + '">' +
    '<div class="ticks" aria-hidden="true"><span>Light</span><span>Medium</span><span>Dark</span></div></div>';
  h += '<div class="stack"><div class="label">Flavours</div><div class="wrap" id="flv-picked">' + pickedHtml() + '</div>' +
    '<div class="search sm">' + I(IC.search, 18) + '<input id="f-flv" type="text" placeholder="Find or add a flavour" autocomplete="off" aria-label="Find or add a flavour"></div>' +
    '<div id="flv-groups">' + flavorGroups('') + '</div></div>';
  h += '<button class="btn" data-a="saveBean">' + I(IC.check) + 'Save</button>';
  if (!isNew) {
    h += '<div class="g2">' + (b.finishDate ? '<span></span>' : '<button class="btn ghost" data-a="finishBean">Mark finished</button>') +
      '<button class="btn danger" data-a="delBean">' + I(IC.trash, 20) + 'Delete</button></div>';
  }
  return h;
}
function pickedHtml() {
  const n = DR.B.notes;
  return n.length ? n.map((x) => '<button class="chip sm on" data-a="note" data-v="' + esc(x) + '" aria-label="Remove ' + esc(x) + '">' + esc(x) + I(IC.x, 14) + '</button>').join('')
    : '<span class="small muted">Pick the notes printed on the bag.</span>';
}
function flavorGroups(raw) {
  const q = String(raw || '').trim().toLowerCase(), picked = DR.B.notes.map((x) => x.toLowerCase());
  const groups = FLAVOR_GROUPS.concat(S.flavors.length ? [['Yours', S.flavors]] : []);
  let h = '', exact = picked.indexOf(q) >= 0;
  groups.forEach((g) => {
    g[1].forEach((f) => { if (f.toLowerCase() === q) exact = true; });
    const xs = g[1].filter((f) => picked.indexOf(f.toLowerCase()) < 0 && (!q || f.toLowerCase().indexOf(q) >= 0));
    if (xs.length) h += '<div class="fgroup"><div class="small muted">' + esc(g[0]) + '</div><div class="wrap">' + xs.map((f) => '<button class="chip sm" data-a="note" data-v="' + esc(f) + '">' + esc(f) + '</button>').join('') + '</div></div>';
  });
  if (q && !exact) h = '<div><button class="chip sm add" data-a="noteNew">' + I(IC.plus, 16) + 'Add “' + esc(cap(String(raw).trim())) + '”</button></div>' + h;
  return '<div class="fgroups">' + h + '</div>';
}
function refreshFlv() {
  const i = document.getElementById('f-flv');
  document.getElementById('flv-picked').innerHTML = pickedHtml();
  document.getElementById('flv-groups').innerHTML = flavorGroups(i ? i.value : '');
}
function suggFor(f, v) {
  const q = String(v || '').trim().toLowerCase();
  let xs = distinct(f);
  if (f === 'origin') { const low = xs.map((x) => x.toLowerCase()); xs = xs.concat(ORIGINS.filter((o) => low.indexOf(o.toLowerCase()) < 0)); }
  if (q) xs = xs.filter((x) => x.toLowerCase().indexOf(q) >= 0 && x.toLowerCase() !== q);
  return xs.slice(0, 6);
}
function showSugg(el) {
  clearSugg('sg-' + el.dataset.f);
  const box = document.getElementById('sg-' + el.dataset.f);
  if (box) box.innerHTML = suggFor(el.dataset.f, el.value).map((x) => '<button class="chip sm" data-a="pickSugg" data-f="' + el.dataset.f + '" data-v="' + esc(x) + '">' + esc(x) + '</button>').join('');
}
function clearSugg(except) { document.querySelectorAll('.sugg').forEach((s) => { if (s.id !== except) s.innerHTML = ''; }); }

// beans pour into a pile behind a card that names the new bag, then offer to brew it
function added(b) {
  const el = document.getElementById('fall');
  const shades = ['#6F4423', '#5A3A22', '#7F5533', '#4A2E1B'];
  let pile = '';
  if (!reduced()) {
    for (let i = 0; i < 44; i++) {
      const x = (i * 37 % 100) + (Math.random() * 6 - 3), y = Math.floor(i / 11) * 22 + Math.random() * 10;
      pile += '<i style="left:' + x.toFixed(1) + '%;bottom:' + y.toFixed(0) + 'px;background:' + shades[i % 4] + ';--r:' + Math.round(Math.random() * 360) + 'deg;animation-delay:' + Math.round(Math.floor(i / 11) * 140 + Math.random() * 160) + 'ms"></i>';
    }
  }
  el.innerHTML = '<div class="pile" aria-hidden="true">' + pile + '</div><div class="addcard" role="dialog" aria-modal="true" aria-label="Bag added">' +
    '<div class="small muted">Added to your shelf</div><h2>' + esc(b.name) + '</h2>' +
    '<div class="small muted">' + esc([b.roaster, b.origin, b.process].filter(Boolean).join(' · ')) + '</div>' +
    '<button class="btn" data-a="addedBrew" data-id="' + b.id + '">' + I(IC.drop) + 'Brew it now</button><button class="btn ghost" data-a="addedDone">Later</button></div>';
  el.className = 'on';
}
function closeAdded() { const el = document.getElementById('fall'); el.className = ''; el.innerHTML = ''; }

// ---------- brew flow ----------
function brewSub(D) {
  const b = bean(D.beanId), d = b ? days(b.roastDate, today()) : null;
  return esc(b ? b.name : '') + (d != null ? ' · Day ' + d : '');
}
function vMethod() {
  const D = DR.D;
  let h = head('Brew', brewSub(D), { back: 'back', right: dots(1) });
  h += '<div class="stack"><div class="label">Method</div><div class="g3">' +
    METHODS.map((m) => '<button class="tile' + (D.method === m.id ? ' on' : '') + '" data-a="setMethod" data-v="' + m.id + '" aria-pressed="' + (D.method === m.id) + '">' + m.name + '</button>').join('') + '</div></div>';
  if (D.method === 'pour') {
    const mine = S.owned.length && !D.allDrippers;
    const list = mine ? DRIPPERS.filter((d) => S.owned.indexOf(d.id) >= 0 || d.id === D.dripper) : DRIPPERS;
    h += '<div class="stack"><div class="rowb"><div class="label">Dripper</div>' +
      (S.owned.length ? '<button class="link" style="min-height:24px" data-a="allDrippers">' + (mine ? 'Show all' : 'Only mine') + '</button>' : '') + '</div><div class="g4">' +
      list.map((d) => '<button class="tile icon cmp' + (D.dripper === d.id ? ' on' : '') + '" data-a="setD" data-f="dripper" data-v="' + d.id + '" aria-pressed="' + (D.dripper === d.id) + '">' + SV(d.svg, 34) + d.name + '</button>').join('') + '</div></div>';
    h += '<div class="stack"><div class="label">Filter</div><div class="wrap">' +
      filters().map((f) => '<button class="chip sm' + (D.filter === f ? ' on' : '') + '" data-a="setD" data-f="filter" data-v="' + esc(f) + '" aria-pressed="' + (D.filter === f) + '">' + esc(f) + '</button>').join('') +
      '<button class="chip sm add" data-a="filterAdd">' + I(IC.plus, 16) + 'Other</button></div></div>';
  }
  h += '<div class="grow"></div><button class="btn" data-a="toRecipe">Next</button>';
  return h;
}

// Each pour runs from the previous target to its own over `dur` seconds, then the coffee drains until the next step
function plan(D) {
  const r = recipe(D.recipeId) || recipes(D.method)[0];
  const water = Math.round(num(D.dose) * num(D.ratio));
  let prev = 0;
  const steps = r.steps.map((s, i) => {
    const g = s.pct == null ? null : Math.round(water * s.pct / 100);
    const next = i + 1 < r.steps.length ? r.steps[i + 1].t : r.total, len = Math.max(1, next - s.t);
    let dur = 0;
    const from = prev;
    if (g != null) {
      const add = Math.max(0, g - prev);
      dur = add ? (D.method === 'espresso' ? len : Math.min(len, Math.max(6, Math.round(add / FLOW)))) : 0;
      prev = g;
    }
    return { t: s.t, pct: s.pct, g: g, from: from, dur: dur, label: stepLabel(s, i) };
  });
  return { r: r, water: water, steps: steps };
}
function stepRow(label, k, val, sub) {
  return '<div class="steprow"><div class="one">' + label + (sub ? '<div class="small muted one">' + sub + '</div>' : '') + '</div><div class="stepper">' +
    '<button data-a="step" data-k="' + k + '" data-d="-1" aria-label="Less ' + label + '">−</button><div class="val" id="v-' + k + '">' + val + '</div>' +
    '<button data-a="step" data-k="' + k + '" data-d="1" aria-label="More ' + label + '">+</button></div></div>';
}
function vRecipe() {
  const D = DR.D, m = method(D.method), P2 = plan(D);
  const pours = P2.steps.filter((s) => s.g != null).length;
  const g = grinder(D.grinderId);
  const setup = [m.name];
  if (D.method === 'pour') { const dr = dripper(D.dripper); if (dr) setup[0] = dr.name; if (D.filter) setup.push(D.filter); }
  let h = head('Recipe', brewSub(D), { back: 'back', right: dots(2) });
  h += '<div class="setup"><div class="one fw">' + esc(setup.join(' · ')) + '</div><button class="link" data-a="toMethod">Change</button></div>';
  const lw = lastBrew(D.beanId);
  if (lw && ADJ_TEXT[lw.adjust] && !D.adjDone) {
    h += '<div class="hint">' + I(IC.info, 18) + '<span class="grow">Last time you noted: ' + ADJ_TEXT[lw.adjust] + '</span><button class="btn sm" data-a="applyAdj" data-v="' + lw.adjust + '">Apply</button></div>';
  }
  h += '<div class="wrap">' + recipes(D.method).map((r) => '<button class="chip sm' + (P2.r.id === r.id ? ' on' : '') + '" data-a="setRecipe" data-v="' + r.id + '" aria-pressed="' + (P2.r.id === r.id) + '">' + esc(r.name) + '</button>').join('') +
    (P2.r.custom ? '<button class="chip sm add" data-a="editRecipe" data-id="' + P2.r.id + '" aria-label="Edit ' + esc(P2.r.name) + '">' + I(IC.edit, 16) + 'Edit</button>' : '') +
    '<button class="chip sm add" data-a="newRecipe">' + I(IC.plus, 16) + 'Custom</button></div>';
  h += '<div class="card" style="padding:2px 18px;gap:0">' +
    stepRow('Dose', 'dose', D.dose + ' g') +
    stepRow('Ratio', 'ratio', '1:' + D.ratio) +
    stepRow('Temp', 'temp', D.temp + '°C') +
    stepRow('Grind', 'grind', hasVal(D.grind) ? D.grind : '—', g ? esc(g.name) : '') +
    '<div class="steprow"><div>' + (D.method === 'espresso' ? 'Yield' : 'Water') + '</div><div class="big">' + P2.water + ' g</div></div></div>';
  if (S.grinders.length > 1) h += '<div class="wrap">' + S.grinders.map((x) => '<button class="chip sm' + (D.grinderId === x.id ? ' on' : '') + '" data-a="setGrinder" data-v="' + x.id + '">' + esc(x.name) + '</button>').join('') + '</div>';
  h += '<div class="rowb" style="font-weight:600;padding:0 4px"><div>' + (pours > 1 ? pours + ' pours' : plural(P2.steps.length, 'step')) + '</div><div>' + fmt(P2.r.total) + '</div></div>';
  h += '<div class="grow"></div><button class="btn" data-a="toTimer">' + I(IC.drop) + 'Start</button>' +
    '<button class="link" data-a="logNoTimer">Log without timer</button>';
  return h;
}
function vTimer() {
  const D = DR.D, P2 = plan(D), b = bean(D.beanId);
  let h = head('<span style="font-size:20px">' + esc(P2.r.name) + '</span>', esc(b ? b.name : ''), { back: 'back', right: dots(3) });
  h += '<div class="stack" style="gap:6px;padding-top:4px"><div class="caption" id="t-cap">Ready</div><div class="clock" id="t-clock">0:00</div><div class="action" id="t-act" aria-live="polite"></div></div>';
  h += '<div class="pour" id="t-pour"><div class="rowb"><span class="gnow" id="t-gnow">0 g</span><span id="t-gto"></span></div><div class="pbar"><i id="t-pb"></i></div></div>';
  h += '<div class="wrap" id="t-cd" style="justify-content:center;align-items:center"><span class="small muted">Countdown</span>' +
    [3, 5].map((n) => '<button class="chip sm' + (S.countdown === n ? ' on' : '') + '" data-a="setCd" data-n="' + n + '" aria-pressed="' + (S.countdown === n) + '">' + n + 's</button>').join('') + '</div>';
  h += '<div class="stack grow" style="gap:6px">' + P2.steps.map((s, i) => '<div class="tstep" id="ts-' + i + '"><div style="display:flex;align-items:center;gap:8px;min-width:0"><div class="tm">' + fmt(s.t) + '</div><div class="one">' + esc(s.label) + '</div></div>' +
    (s.g != null ? '<div class="g">' + s.g + ' g</div>' : '') + '</div>').join('') + '</div>';
  h += '<div class="tctl"><button class="ib" style="justify-self:start;width:56px;height:56px;border-radius:28px" data-a="tReset" aria-label="Restart">' + I(IC.reset) + '</button>' +
    '<button class="play" id="t-main" data-a="tToggle" aria-label="Start">' + PLAY + '</button>' +
    '<button class="btn done" style="justify-self:end" data-a="tDone">' + I(IC.check) + 'Done</button></div>';
  return h;
}
function vRate() {
  const Q = DR.Q, w = S.brews.find((x) => x.id === Q.id), b = bean(w.beanId), rc = recipe(w.recipeId);
  let h = head('How was it?', esc([b ? b.name : '', rc ? rc.name : ''].filter(Boolean).join(' · ')), { back: 'rateBack' });
  h += radar(Q.r);
  h += '<div class="stack" style="gap:8px">' + AXES.map((x) => '<div class="taste"><div class="n">' + x[1] + '</div><div class="seg" role="group" aria-label="' + x[1] + '">' +
    [1, 2, 3, 4, 5].map((i) => '<button class="' + (Q.r[x[0]] >= i ? 'on' : '') + '" data-a="taste" data-k="' + x[0] + '" data-n="' + i + '" aria-label="' + x[1] + ' ' + i + ' of 5" aria-pressed="' + (Q.r[x[0]] === i) + '"></button>').join('') + '</div></div>').join('') + '</div>';
  h += '<div class="stack"><div class="label">Overall</div>' + starsHtml(Q.stars, 'rateQ') + '</div>';
  h += '<div class="stack"><div class="label">Next time</div><div class="wrap">' +
    ADJUSTS.map((x) => '<button class="chip sm' + (Q.adjust === x ? ' on' : '') + '" data-a="adjust" data-v="' + x + '" aria-pressed="' + (Q.adjust === x) + '">' + x + '</button>').join('') + '</div></div>';
  h += '<div class="small muted one">' + esc(brewerName(w)) + ' · ' + brewLine(w) + '</div>';
  h += '<button class="btn" data-a="saveRate">' + I(IC.check) + 'Save</button>';
  return h;
}

// ---------- Journal ----------
function kpis(ws) {
  const c = ws.map(cupCost).filter((v) => v != null), r = ws.map((w) => w.stars).filter((n) => n > 0);
  return { n: ws.length, spent: c.reduce((a, b) => a + b, 0), per: c.length ? avg(c) : null, r: r.length ? avg(r) : null };
}
function buckets(per) {
  const now = new Date(), out = [];
  const mk = (y, m, d) => new Date(y, m, d);
  if (per === '30') {
    for (let i = 29; i >= 0; i--) {
      const s = mk(now.getFullYear(), now.getMonth(), now.getDate() - i), e = mk(s.getFullYear(), s.getMonth(), s.getDate() + 1);
      out.push({ s: +s, e: +e, lab: DOW[s.getDay()] + ', ' + MONTHS[s.getMonth()] + ' ' + s.getDate(), tick: MONTHS[s.getMonth()] + ' ' + s.getDate() });
    }
    return { unit: 'day', list: out };
  }
  if (per === '90') {
    const t = mk(now.getFullYear(), now.getMonth(), now.getDate()), mon = mk(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7));
    for (let i = 12; i >= 0; i--) {
      const s = mk(mon.getFullYear(), mon.getMonth(), mon.getDate() - 7 * i), e = mk(s.getFullYear(), s.getMonth(), s.getDate() + 7), l = mk(e.getFullYear(), e.getMonth(), e.getDate() - 1);
      out.push({ s: +s, e: +e, lab: MONTHS[s.getMonth()] + ' ' + s.getDate() + '–' + (l.getMonth() !== s.getMonth() ? MONTHS[l.getMonth()] + ' ' : '') + l.getDate(), tick: MONTHS[s.getMonth()] + ' ' + s.getDate() });
    }
    return { unit: 'week', list: out };
  }
  let n = 12;
  if (per === 'all') {
    const f = new Date(Math.min.apply(null, S.brews.map((w) => w.at || Date.now())));
    n = Math.max(6, Math.min(36, (now.getFullYear() - f.getFullYear()) * 12 + now.getMonth() - f.getMonth() + 1));
  }
  for (let i = n - 1; i >= 0; i--) {
    const s = mk(now.getFullYear(), now.getMonth() - i, 1), e = mk(s.getFullYear(), s.getMonth() + 1, 1);
    out.push({ s: +s, e: +e, lab: MONTHS[s.getMonth()] + ' ' + s.getFullYear(), tick: MONTHS[s.getMonth()] + (s.getMonth() === 0 || i === n - 1 ? ' ’' + String(s.getFullYear()).slice(2) : '') });
  }
  return { unit: 'month', list: out };
}
function roundTop(x, y, w, h, r) {
  r = Math.min(r, h, w / 2);
  return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
}
function chartSvg(B) {
  const W = 320, H = 136, top = 16, bot = 22, bs = B.list, n = bs.length, ch = H - top - bot;
  const max = Math.max.apply(null, bs.map((b) => b.n).concat([1])), step = W / n, bw = Math.max(3, Math.min(20, step - 2));
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cups per ' + B.unit + ', most ' + max + '">';
  s += '<line class="grid" x1="0" x2="' + W + '" y1="' + top + '" y2="' + top + '"/><text x="0" y="' + (top - 5) + '">' + max + '</text>';
  s += '<line class="base" x1="0" x2="' + W + '" y1="' + (H - bot) + '" y2="' + (H - bot) + '"/>';
  bs.forEach((b, i) => {
    const x = i * step + (step - bw) / 2, h = b.n ? Math.max(3, b.n / max * ch) : 0;
    if (h) s += '<path class="bar" data-i="' + i + '" d="' + roundTop(x.toFixed(1) * 1, (H - bot - h).toFixed(1) * 1, bw, h, 4) + '"/>';
    s += '<rect class="hit" data-a="bar" data-i="' + i + '" x="' + (i * step).toFixed(1) + '" y="0" width="' + step.toFixed(1) + '" height="' + H + '"><title>' + esc(b.lab) + ': ' + plural(b.n, 'cup') + '</title></rect>';
  });
  [0, Math.floor((n - 1) / 2), n - 1].forEach((i, k) => {
    s += '<text x="' + (k === 0 ? 0 : k === 2 ? W : (i + 0.5) * step).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + ['start', 'middle', 'end'][k] + '">' + esc(bs[i].tick) + '</text>';
  });
  return s + '</svg>';
}
function showBar(i) {
  if (!CH || !CH.list[i]) return;
  const b = CH.list[i], cap = document.getElementById('chart-cap');
  if (cap) cap.textContent = b.lab + ' · ' + plural(b.n, 'cup');
  document.querySelectorAll('.chart .bar').forEach((p) => p.classList.toggle('dim', p.dataset.i !== String(i)));
}
const BY = {
  bean: ['Bean', (w) => { const b = bean(w.beanId); return b ? [b.id, b.name] : null; }],
  roaster: ['Roaster', (w) => { const b = bean(w.beanId), v = (b && b.roaster) || 'No roaster'; return [v, v]; }],
  origin: ['Origin', (w) => { const b = bean(w.beanId), v = (b && b.origin) || 'Unknown'; return [v, v]; }],
  process: ['Process', (w) => { const b = bean(w.beanId), v = (b && b.process) || 'Unknown'; return [v, v]; }],
  brewer: ['Brewer', (w) => { const v = brewerName(w); return [v, v]; }]
};
function vJournal() {
  let h = head('Journal', '', { right: avatar() });
  if (!S.brews.length) {
    return h + '<div class="card welcome">' + CUP + '<h2>No brews yet</h2><div class="muted">Every cup you brew shows up here, with cost, ratings and what you drank most.</div>' +
      '<button class="btn" data-a="go" data-v="brew">' + I(IC.drop) + 'Brew a cup</button></div>';
  }
  const span = { '30': 30, '90': 90, '365': 365 }[P.period] || 0, now = Date.now(), from = span ? now - span * DAY : 0;
  const ws = S.brews.filter((w) => (w.at || 0) >= from);
  const prev = span ? S.brews.filter((w) => (w.at || 0) >= from - span * DAY && (w.at || 0) < from) : null;
  h += seg('period', [['30', '30 days'], ['90', '90 days'], ['365', 'Year'], ['all', 'All']], P.period, 'Period');

  const k = kpis(ws), kp = prev && prev.length ? kpis(prev) : null;
  const delta = (a, b, f, lowGood) => {
    if (!kp || a == null || b == null) return '';
    const d = a - b; if (Math.abs(d) < 1e-9) return '<div class="d">Same as before</div>';
    const good = lowGood ? d < 0 : d > 0;
    return '<div class="d ' + (good ? 'up' : 'down') + '">' + (d > 0 ? '▲ ' : '▼ ') + f(Math.abs(d)) + ' vs previous</div>';
  };
  const tiles = [
    ['Cups', String(k.n), delta(k.n, kp && kp.n, String)],
    ['Spent on beans', k.spent ? money(k.spent) : '—', ''],
    ['Per cup', k.per != null ? money(k.per) : '—', delta(k.per, kp && kp.per, money, true)],
    ['Avg rating', k.r != null ? k.r.toFixed(1) + ' ' + STAR_S : '—', delta(k.r, kp && kp.r, (v) => v.toFixed(1))]
  ];
  h += '<div class="g2">' + tiles.map((t) => '<div class="stat"><div class="k">' + t[0] + '</div><div class="v">' + t[1] + '</div>' + t[2] + '</div>').join('') + '</div>';

  CH = buckets(P.period);
  CH.list.forEach((b) => { b.n = S.brews.filter((w) => (w.at || 0) >= b.s && (w.at || 0) < b.e).length; });
  const peak = CH.list.reduce((a, b) => (b.n > a.n ? b : a), CH.list[0]);
  h += '<div class="card chart"><div class="rowb"><div class="label">Cups per ' + CH.unit + '</div></div>' + chartSvg(CH) +
    '<div class="cap small" id="chart-cap" aria-live="polite">' + (peak.n ? 'Busiest ' + CH.unit + ': ' + peak.lab + ' · ' + plural(peak.n, 'cup') : 'No cups in this period') + '</div></div>';

  // breakdown table
  const by = BY[P.by] ? P.by : 'bean', grp = {};
  ws.forEach((w) => {
    const kv = BY[by][1](w); if (!kv) return;
    const g = grp[kv[0]] || (grp[kv[0]] = { id: kv[0], name: kv[1], n: 0, s: [], c: [] });
    g.n++; if (w.stars) g.s.push(w.stars); const c = cupCost(w); if (c != null) g.c.push(c);
  });
  let rows = Object.keys(grp).map((x) => { const g = grp[x]; return { id: g.id, name: g.name, n: g.n, s: g.s.length ? avg(g.s) : null, c: g.c.length ? avg(g.c) : null }; });
  const ts = P.tsort;
  rows.sort((a, b) => ts === 'name' ? a.name.localeCompare(b.name) : ts === 'stars' ? (b.s || 0) - (a.s || 0) || b.n - a.n : ts === 'cost' ? (a.c == null ? 1e9 : a.c) - (b.c == null ? 1e9 : b.c) : b.n - a.n || (b.s || 0) - (a.s || 0));
  const th = (key, label, al) => '<button class="' + (al || '') + (ts === key ? ' on' : '') + '" data-a="pref" data-k="tsort" data-v="' + key + '" aria-pressed="' + (ts === key) + '">' + label + (ts === key ? ' ↓' : '') + '</button>';
  h += '<div class="stack"><div class="label">Breakdown</div><div class="wrap">' + Object.keys(BY).map((x) => '<button class="chip sm' + (by === x ? ' on' : '') + '" data-a="pref" data-k="by" data-v="' + x + '" aria-pressed="' + (by === x) + '">' + BY[x][0] + '</button>').join('') + '</div>';
  h += rows.length ? '<div class="list tbl"><div class="tr th">' + th('name', BY[by][0], 'l') + th('cups', 'Cups') + th('stars', 'Rating') + th('cost', '$/cup') + '</div>' +
    rows.map((r) => (by === 'bean' ? '<button class="tr" data-a="openBean" data-id="' + esc(r.id) + '">' : '<div class="tr">') + '<div class="one fw">' + esc(r.name) + '</div><div class="n">' + r.n + '</div><div class="n">' + (r.s != null ? r.s.toFixed(1) : '—') + '</div><div class="n">' + (r.c != null ? money(r.c) : '—') + '</div>' + (by === 'bean' ? '</button>' : '</div>')).join('') + '</div>'
    : '<div class="empty muted">No cups in this period.</div>';
  h += '</div>';

  // brew log
  const ms = Array.from(new Set(S.brews.map((w) => w.method)));
  let L = ws.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
  if (P.lm) L = L.filter((w) => w.method === P.lm);
  if (P.lr === '0') L = L.filter((w) => !w.stars); else if (P.lr) L = L.filter((w) => (w.stars || 0) >= +P.lr);
  h += '<div class="stack"><div class="rowb"><div class="label">Brews</div><div class="small muted">' + plural(L.length, 'cup') + '</div></div><div class="tools">' +
    sel('lm', [['', 'All methods']].concat(ms.map((m) => [m, method(m).name])), P.lm, 'Method') +
    sel('lr', [['', 'Any rating'], ['5', '5 stars'], ['4', '4 stars and up'], ['3', '3 stars and up'], ['0', 'Not rated']], P.lr, 'Rating') + '</div>';
  if (!L.length) h += '<div class="empty muted">No brews match.</div>';
  let cur = null, open = false;
  L.slice(0, P.logN).forEach((w) => {
    if (w.date !== cur) { if (open) h += '</div>'; cur = w.date; h += '<div class="dayh">' + dayLabel(w.date) + '</div><div class="list">'; open = true; }
    h += brewRow(w, { bean: true });
  });
  if (open) h += '</div>';
  if (L.length > P.logN) h += '<button class="btn ghost sm" data-a="pref" data-k="logN" data-v="' + (P.logN + 30) + '">Show more</button>';
  return h + '</div>';
}

// ---------- Gear & account ----------
function vGear() {
  let h = head('Gear', '', { right: avatar() });
  h += '<div class="stack"><div class="label">Grinders</div>' + (S.grinders.length ? '<div class="list">' + S.grinders.map((g) => '<button class="row" data-a="editGrinder" data-id="' + g.id + '"><div class="grow" style="min-width:0"><div class="one fw">' + esc(g.name) + '</div><div class="small muted one">' +
    esc([g.burr, g.burrNote, hasVal(g.setting) ? 'usually #' + g.setting : null].filter(Boolean).join(' · ')) + '</div></div>' + I(IC.edit, 20) + '</button>').join('') + '</div>' : '') +
    '<button class="btn ghost sm" data-a="newGrinder">' + I(IC.plus, 20) + 'Add grinder</button></div>';
  h += '<div class="stack"><div class="label">Drippers you own</div><div class="small muted">Only these show when you brew pour over.</div><div class="g4">' +
    DRIPPERS.map((d) => { const on = S.owned.indexOf(d.id) >= 0; return '<button class="tile icon cmp ' + (on ? 'own' : 'off') + '" data-a="own" data-v="' + d.id + '" aria-pressed="' + on + '">' + SV(d.svg, 34) + d.name + '</button>'; }).join('') + '</div></div>';
  h += '<div class="stack"><div class="label">Filters</div><div class="wrap">' + FILTERS.map((f) => '<span class="chip sm static">' + esc(f) + '</span>').join('') +
    S.filters.map((f) => '<button class="chip sm" data-a="filterDel" data-v="' + esc(f) + '" aria-label="Remove ' + esc(f) + '">' + esc(f) + I(IC.x, 14) + '</button>').join('') +
    '<button class="chip sm add" data-a="filterAddGear">' + I(IC.plus, 16) + 'Add</button></div></div>';
  return h;
}
function vAccountPage() {
  let h = head('Account', '', { back: 'back' });
  const sec = vAccount();
  h += sec || '<div class="card"><div class="muted">Cloud sync isn’t set up in this build. Your log is saved on this device.</div></div>';
  const synced = window.Cloud && Cloud.enabled() && Cloud.user();
  h += '<div class="stack"><div class="label">Backup</div><div class="small muted">' + (synced ? 'Your log syncs to your account. Export also saves a JSON copy.' : 'Your log is saved on this device. Export a copy before switching phones.') + '</div>' +
    '<div class="g2"><button class="btn sm ghost" data-a="exportData">Export</button><button class="btn sm ghost" data-a="importData">Import</button></div>' +
    '<input type="file" id="imp" accept="application/json,.json" hidden></div>';
  return h;
}
function vAccount() {
  if (!window.Cloud || !Cloud.enabled()) return '';
  const u = Cloud.user();
  let h = '<div class="stack"><div class="label">Sync</div>';
  if (u) {
    DR.U = null;
    return h + '<div class="card"><div style="min-width:0"><h2 class="one">' + esc(u.email) + '</h2><div class="small muted" id="sync-status" role="status">' + esc(Cloud.status()) + '</div></div>' +
      '<div class="g2"><button class="btn sm ghost" data-a="syncNow">Sync now</button><button class="btn sm ghost" data-a="signOut">Sign out</button></div></div></div>';
  }
  const U = DR.U || (DR.U = { email: '', code: '', step: 'email' });
  if (U.step === 'code') {
    return h + '<div class="card"><div class="small muted">We emailed a code to ' + esc(U.email) + '.</div>' + field('U', 'code', 'Code', { mode: 'numeric', ph: '123456' }) +
      '<div class="g2"><button class="btn sm ghost" data-a="codeBack">Back</button><button class="btn sm" data-a="verifyCode">Sign in</button></div></div></div>';
  }
  return h + '<div class="card"><div class="small muted">Sign in to keep your log in the cloud and use it on every device.</div>' + field('U', 'email', 'Email', { type: 'email', ph: 'you@example.com' }) +
    '<button class="btn sm" data-a="sendCode">Email me a code</button></div></div>';
}
function vGrinder() {
  const g = DR.G;
  let h = head(g.id ? 'Edit grinder' : 'Grinder', '', { back: 'back' });
  h += field('G', 'name', 'Name', { ph: 'Comandante C40' });
  h += '<div class="stack"><div class="label">Burr</div><div class="g3">' + BURRS.map((x) => '<button class="tile' + (g.burr === x ? ' on' : '') + '" data-a="setG" data-f="burr" data-v="' + x + '" aria-pressed="' + (g.burr === x) + '">' + x + '</button>').join('') + '</div></div>';
  h += field('G', 'burrNote', 'Burr set', { ph: '64 mm SSP MP' });
  h += field('G', 'setting', 'Usual setting', { num: 1, ph: '24' });
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
  const p = parts[0] || 'brew', a = parts[1];
  if (p !== 'timer') stopTimer();
  let html = '', tab = null, dark = false;
  if (['method', 'recipe', 'timer', 'custom'].indexOf(p) >= 0 && !DR.D) { location.replace('#brew'); return; }
  if (p === 'brew') { html = vHome(); tab = 'brew'; }
  else if (p === 'beans') { html = vBeans(); tab = 'beans'; }
  else if (p === 'bean' && a === 'new') {
    if (!DR.B || DR.B._k !== 'new') DR.B = blankBean();
    html = vBeanForm();
  }
  else if (p === 'bean') { const b = bean(a); if (!b) { location.replace('#beans'); return; } html = vBeanView(b); }
  else if (p === 'edit') {
    if (!DR.B || DR.B._k !== 'e:' + a) { const src = bean(a); if (!src) { location.replace('#beans'); return; } DR.B = clone(src); DR.B._k = 'e:' + a; if (!DR.B.notes) DR.B.notes = []; }
    html = vBeanForm();
  }
  else if (p === 'method') html = vMethod();
  else if (p === 'recipe') html = vRecipe();
  else if (p === 'timer') { html = vTimer(); dark = true; }
  else if (p === 'rate') {
    const w = S.brews.find((x) => x.id === a);
    if (!w) { location.replace('#brew'); return; }
    if (!DR.Q || DR.Q.id !== a) DR.Q = { id: a, stars: w.stars || 0, adjust: w.adjust || '', r: Object.assign({ aroma: 0, acid: 0, sweet: 0, body: 0, bitter: 0, finish: 0 }, w.r || {}) };
    html = vRate();
  }
  else if (p === 'journal') { html = vJournal(); tab = 'journal'; }
  else if (p === 'stats') { location.replace(a ? '#bean/' + a : '#journal'); return; }
  else if (p === 'gear') { html = vGear(); tab = 'gear'; }
  else if (p === 'account') html = vAccountPage();
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
  else { location.replace('#brew'); return; }
  document.body.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = dark ? '#1F140D' : '#F4EEE6';
  if (!dark) document.getElementById('wave').style.height = '0';
  app.innerHTML = html;
  nav.innerHTML = tab ? navHtml(tab) : '';
  const route = parts.slice(0, 2).join('/');
  if (route !== lastP) {
    if (lastP !== null) window.scrollTo(0, 0);
    lastP = route;
    if (!reduced()) { app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter'); }
  }
  if (p === 'timer') initTimer();
}
function rerender() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

// ---------- timer ----------
function initTimer() {
  if (!T) T = { phase: 'idle', base: 0, startAt: 0, cdEnd: 0, idx: -1, iv: null, cdShown: null, btn: '', pouring: false };
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
// grams that should be in the brewer `el` seconds in
function waterAt(steps, el) {
  let g = 0;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (el < s.t) break;
    if (s.g == null) continue;
    g = s.dur && el < s.t + s.dur ? s.from + (s.g - s.from) * (el - s.t) / s.dur : s.g;
  }
  return g;
}
function paintTimer() {
  if (!T || !DR.D) return;
  const clock = document.getElementById('t-clock');
  if (!clock) return;
  const P2 = plan(DR.D);
  const cap = document.getElementById('t-cap'), act = document.getElementById('t-act'), wave = document.getElementById('wave');
  const gnow = document.getElementById('t-gnow'), gto = document.getElementById('t-gto'), pb = document.getElementById('t-pb');
  document.getElementById('t-cd').style.visibility = T.phase === 'idle' ? 'visible' : 'hidden';
  if (T.phase === 'count') {
    const leftS = Math.ceil((T.cdEnd - Date.now()) / 1000);
    if (leftS <= 0) { T.phase = 'run'; T.startAt = Date.now(); T.base = 0; T.idx = -1; }
    else {
      if (T.cdShown !== leftS) { T.cdShown = leftS; beep(660, 120); }
      cap.textContent = 'Get ready'; clock.textContent = String(leftS); setMain('pause');
      return;
    }
  }
  const el = elapsedNow();
  let idx = -1;
  if (T.phase !== 'idle') P2.steps.forEach((s, i) => { if (el >= s.t) idx = i; });
  if (T.phase === 'run' && idx !== T.idx) { T.idx = idx; beep(880, 220); if (navigator.vibrate) navigator.vibrate(120); }
  P2.steps.forEach((s, i) => { document.getElementById('ts-' + i).className = 'tstep' + (i === idx ? ' now' : (i < idx ? ' past' : '')); });
  clock.textContent = fmt(el);

  const cur = P2.steps[Math.max(idx, 0)], nxt = idx >= 0 ? P2.steps[idx + 1] : null;
  const water = T.phase === 'idle' ? 0 : waterAt(P2.steps, el);
  const pouring = T.phase !== 'idle' && cur.g != null && cur.dur > 0 && el < cur.t + cur.dur;
  if (T.phase === 'run' && T.pouring && !pouring) beep(520, 160); // stop pouring
  T.pouring = pouring && T.phase === 'run';
  wave.style.height = (P2.water ? Math.min(100, water / P2.water * 100) : 0) + '%';
  gnow.textContent = Math.round(water) + ' g';

  const over = el >= P2.r.total;
  let say;
  if (T.phase === 'idle') {
    say = cur.g != null ? cur.label + ' · to ' + cur.g + ' g' : cur.label;
    gto.textContent = cur.g != null ? 'first pour ' + cur.g + ' g' : ''; pb.style.width = '0';
    cap.textContent = 'Ready'; setMain('play');
  } else {
    if (pouring) {
      say = cur.label + ' · to ' + cur.g + ' g';
      gto.textContent = 'target ' + cur.g + ' g';
      pb.style.width = Math.min(100, (el - cur.t) / cur.dur * 100) + '%';
    } else if (over) {
      say = 'Tap Done when it stops'; gto.textContent = ''; pb.style.width = '100%';
    } else {
      say = cur.g != null ? (nxt ? 'Let it drain' : 'Let it draw down') : cur.label;
      gto.textContent = nxt ? 'next: ' + nxt.label + ' in ' + fmt(nxt.t - el) : 'done at ' + fmt(P2.r.total);
      const a = cur.t + (cur.g != null ? cur.dur : 0), b = nxt ? nxt.t : P2.r.total;
      pb.style.width = (b > a ? Math.min(100, (el - a) / (b - a) * 100) : 100) + '%';
    }
    cap.textContent = T.phase === 'paused' ? 'Paused' : (over ? 'Finishing' : pouring ? 'Pour' : 'Wait');
    setMain(T.phase === 'paused' ? 'play' : 'pause');
  }
  document.getElementById('t-pour').classList.toggle('wait', T.phase !== 'idle' && !pouring);
  if (act.textContent !== say) act.textContent = say;
}
function stopTimer() {
  if (!T) return;
  clearInterval(T.iv);
  if (T.lock && T.lock.release) T.lock.release().catch(function () {});
  T = null;
}

// ---------- actions ----------
function startBrew(id, replace) {
  const own = S.brews.filter((w) => w.beanId === id).slice(-1)[0];
  const last = own || S.brews.slice(-1)[0];
  const g = S.grinders[0];
  if (last) {
    DR.D = { beanId: id, method: last.method, dripper: last.dripper || S.owned[0] || 'v60', filter: last.filter || FILTERS[0], recipeId: last.recipeId, dose: last.dose, ratio: last.ratio, temp: last.temp, grind: last.grind, grinderId: grinder(last.grinderId) ? last.grinderId : (g ? g.id : null) };
    if (!recipe(DR.D.recipeId)) DR.D.recipeId = method(DR.D.method).recipe;
  } else {
    const m = METHODS[0];
    DR.D = { beanId: id, method: m.id, dripper: S.owned[0] || 'v60', filter: FILTERS[0], recipeId: m.recipe, dose: m.dose, ratio: m.ratio, temp: m.temp, grind: g && hasVal(g.setting) ? num(g.setting) : '', grinderId: g ? g.id : null };
  }
  // with history the setup is known, so go straight to the recipe; first time, pick method and dripper
  const to = last ? 'recipe' : 'method';
  if (replace) location.replace('#' + to); else go(to);
}
function brewFrom(w) {
  const g = S.grinders[0];
  DR.D = { beanId: w.beanId, method: w.method, dripper: w.dripper || S.owned[0] || 'v60', filter: w.filter || FILTERS[0], recipeId: recipe(w.recipeId) ? w.recipeId : method(w.method).recipe,
    dose: w.dose, ratio: w.ratio, temp: w.temp, grind: w.grind, grinderId: grinder(w.grinderId) ? w.grinderId : (g ? g.id : null), adjDone: true };
  go('recipe');
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
  save(); DR.D = null; go('brew'); toast('Logged · rate it after a sip');
}

const A = {
  sheetX: () => closeSheet(),
  sheetOk: () => { const o = SH; if (!o) return; const i = document.getElementById('sheet-in'); const v = i ? i.value.trim() : true; if (o.input && !v) { i.focus(); return; } closeSheet(); o.cb(v); },
  go: (d) => go(d.v),
  back: () => { DR.B = null; DR.G = null; back(); },
  pref: (d) => { const k = d.k; P[k] = k === 'min' || k === 'logN' ? +d.v : d.v; if (k !== 'logN') P.logN = 30; savePref(); rerender(); },
  bar: (d) => showBar(+d.i),
  newBean: () => { DR.B = null; go('bean/new'); },
  openBean: (d) => go('bean/' + d.id),
  editBean: (d) => { DR.B = null; go('edit/' + d.id); },
  copyBean: (d) => { const b = bean(d.id); if (b) { DR.B = copyOf(b); rerender(); window.scrollTo(0, 0); } },
  buyAgain: (d) => { const b = bean(d.id); if (b) { DR.B = copyOf(b); go('bean/new'); } },
  setB: (d) => { DR.B[d.f] = DR.B[d.f] === d.v ? '' : d.v; rerender(); },
  procAdd: () => sheet({ title: 'Process', input: true, ph: 'Thermal shock', ok: 'Use', cb: (v) => { DR.B.process = cap(v); rerender(); } }),
  note: (d) => { const n = DR.B.notes, i = n.indexOf(d.v); if (i >= 0) n.splice(i, 1); else n.push(d.v); refreshFlv(); },
  noteNew: () => {
    const i = document.getElementById('f-flv'), v = i ? cap(i.value.trim()) : '';
    if (!v) return;
    if (DR.B.notes.map((x) => x.toLowerCase()).indexOf(v.toLowerCase()) < 0) DR.B.notes.push(v);
    i.value = ''; refreshFlv(); i.focus();
  },
  pickSugg: (d) => {
    suggHold = false;
    const B = DR.B; B[d.f] = d.v;
    if (d.f === 'farm') { const prev = S.beans.find((x) => x.farm === d.v); if (prev) { if (!B.origin) B.origin = prev.origin || ''; if (!B.process) B.process = prev.process || ''; } }
    if (d.f === 'roaster' && !hasVal(B.weight)) { const prev = S.beans.find((x) => x.roaster === d.v && hasVal(x.weight)); if (prev) B.weight = prev.weight; }
    rerender();
  },
  saveBean: () => {
    const b = DR.B;
    if (!String(b.name).trim()) { toast('Add a name'); const f = document.getElementById('f-name'); if (f) f.focus(); return; }
    ['name', 'roaster', 'farm', 'origin'].forEach((k) => { b[k] = String(b[k] || '').trim(); });
    const isNew = !b.id;
    delete b._k; delete b._from; delete b.rating;
    const builtIn = [].concat.apply([], FLAVOR_GROUPS.map((g) => g[1])).map((x) => x.toLowerCase());
    b.notes.forEach((n) => { if (builtIn.indexOf(n.toLowerCase()) < 0 && S.flavors.indexOf(n) < 0) S.flavors.push(n); });
    if (b.process && PROCESSES.indexOf(b.process) < 0 && S.processes.indexOf(b.process) < 0) S.processes.push(b.process);
    if (isNew) { b.id = uid(); S.beans.unshift(b); } else S.beans[S.beans.findIndex((x) => x.id === b.id)] = b;
    save(); DR.B = null;
    if (isNew) added(b); else back('bean/' + b.id);
  },
  addedBrew: (d) => { closeAdded(); startBrew(d.id, true); },
  addedDone: () => { closeAdded(); back('beans'); },
  finishBean: () => { DR.B.finishDate = today(); rerender(); },
  delBean: () => sheet({ title: 'Delete ' + DR.B.name + ' and its brews?', ok: 'Delete', danger: true, cb: () => {
    S.beans = S.beans.filter((x) => x.id !== DR.B.id); S.brews = S.brews.filter((w) => w.beanId !== DR.B.id);
    save(); DR.B = null; go('beans');
  } }),
  startBrew: (d) => startBrew(d.id),
  brewLike: (d) => { const w = S.brews.find((x) => x.id === d.id); if (w) brewFrom(w); },
  setMethod: (d) => {
    const D = DR.D;
    if (D.method === d.v) return;
    const m = method(d.v), last = S.brews.filter((w) => w.method === d.v).slice(-1)[0];
    D.method = d.v;
    if (last) { D.recipeId = recipe(last.recipeId) ? last.recipeId : m.recipe; D.dose = last.dose; D.ratio = last.ratio; D.temp = last.temp; D.grind = last.grind; }
    else { D.recipeId = m.recipe; D.dose = m.dose; D.ratio = m.ratio; D.temp = m.temp; }
    rerender();
  },
  setD: (d) => {
    DR.D[d.f] = d.v;
    if (d.f === 'dripper') { const lw = S.brews.filter((w) => w.dripper === d.v && w.filter).slice(-1)[0]; if (lw) DR.D.filter = lw.filter; }
    rerender();
  },
  allDrippers: () => { DR.D.allDrippers = !DR.D.allDrippers; rerender(); },
  filterAdd: () => sheet({ title: 'Filter', input: true, ph: 'Sibarist Fast', ok: 'Add', cb: (v) => { if (filters().indexOf(v) < 0) { S.filters.push(v); save(); } DR.D.filter = v; rerender(); } }),
  filterAddGear: () => sheet({ title: 'Filter', input: true, ph: 'Sibarist Fast', ok: 'Add', cb: (v) => { if (filters().indexOf(v) < 0) { S.filters.push(v); save(); } rerender(); } }),
  filterDel: (d) => sheet({ title: 'Remove ' + d.v + '?', ok: 'Remove', danger: true, cb: () => { S.filters = S.filters.filter((f) => f !== d.v); save(); rerender(); } }),
  toRecipe: () => {
    const D = DR.D;
    if (D.method === 'pour' && D.dripper === 'switch' && ['switch', 'hybrid'].indexOf(D.recipeId) < 0 && !S.brews.some((w) => w.dripper === 'switch')) D.recipeId = 'switch';
    if (!recipe(D.recipeId) || recipe(D.recipeId).m !== D.method) D.recipeId = method(D.method).recipe;
    go('recipe');
  },
  toMethod: () => go('method'),
  setRecipe: (d) => { DR.D.recipeId = d.v; rerender(); },
  setGrinder: (d) => { DR.D.grinderId = d.v; const g = grinder(d.v); if (g && hasVal(g.setting)) DR.D.grind = num(g.setting); rerender(); },
  applyAdj: (d) => {
    const D = DR.D, g = grinder(D.grinderId), st = g && g.step ? g.step : 1;
    if (d.v === 'Finer' || d.v === 'Coarser') D.grind = Math.max(0, r1((hasVal(D.grind) ? num(D.grind) : 0) + (d.v === 'Finer' ? -st : st)));
    if (d.v === 'Hotter') D.temp = Math.min(100, num(D.temp) + 1);
    if (d.v === 'Cooler') D.temp = Math.max(0, num(D.temp) - 1);
    D.adjDone = true; rerender(); toast(d.v === 'Finer' || d.v === 'Coarser' ? 'Grind set to ' + D.grind : 'Temp set to ' + D.temp + '°C');
  },
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
  backRecipe: () => { DR.R = null; back('recipe'); },
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
    save(); DR.D.recipeId = r.id; DR.R = null; back('recipe');
  },
  delRecipe: () => sheet({ title: 'Delete ' + DR.R.name + '?', ok: 'Delete', danger: true, cb: () => {
    S.recipes = S.recipes.filter((x) => x.id !== DR.R.id); save();
    DR.D.recipeId = method(DR.D.method).recipe; DR.R = null; back('recipe');
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
      clearInterval(T.iv); T.iv = setInterval(paintTimer, 100);
    } else if (T.phase === 'count') { T.phase = 'idle'; clearInterval(T.iv); }
    else if (T.phase === 'run') { T.base = elapsedNow(); T.phase = 'paused'; }
    else if (T.phase === 'paused') { T.startAt = Date.now(); T.phase = 'run'; }
    paintTimer();
  },
  tReset: () => { if (!T) return; clearInterval(T.iv); const ac = T.ac; T = { phase: 'idle', base: 0, startAt: 0, cdEnd: 0, idx: -1, iv: null, cdShown: null, ac: ac, btn: '', pouring: false }; paintTimer(); },
  tDone: () => logBrew(T && (T.phase === 'run' || T.phase === 'paused') ? Math.round(elapsedNow()) : null),
  rate: (d) => { DR.Q = null; go('rate/' + d.id); },
  skipRate: (d) => { const w = S.brews.find((x) => x.id === d.id); if (w) { w.skip = true; save(); } rerender(); },
  rateBack: () => { DR.Q = null; back(); },
  rateQ: (d) => { DR.Q.stars = DR.Q.stars === +d.n ? 0 : +d.n; rerender(); },
  taste: (d) => { DR.Q.r[d.k] = DR.Q.r[d.k] === +d.n ? 0 : +d.n; rerender(); },
  adjust: (d) => { DR.Q.adjust = DR.Q.adjust === d.v ? '' : d.v; rerender(); },
  saveRate: () => {
    const Q = DR.Q, w = S.brews.find((x) => x.id === Q.id);
    w.stars = Q.stars; w.r = Q.r; w.adjust = Q.adjust; w.ratedAt = Date.now();
    save(); DR.Q = null; toast('Saved'); back();
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
    save(); DR.G = null; back('gear');
  },
  delGrinder: () => sheet({ title: 'Delete ' + DR.G.name + '?', ok: 'Delete', danger: true, cb: () => { S.grinders = S.grinders.filter((x) => x.id !== DR.G.id); save(); DR.G = null; back('gear'); } }),
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

// ---------- events ----------
// a press briefly blurs the button, then its label settles back in
const tapKey = (x) => [x.dataset.a, x.dataset.k, x.dataset.id, x.dataset.n, x.dataset.f, x.dataset.i, x.dataset.a === 'pref' ? '' : x.dataset.v].join('|');
function pop(el) {
  if (reduced() || !el.classList) return;
  el.classList.remove('pop'); void el.getBoundingClientRect(); el.classList.add('pop');
  el.addEventListener('animationend', () => el.classList.remove('pop'), { once: true });
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || !A[el.dataset.a]) return;
  e.preventDefault();
  const key = tapKey(el);
  pop(el);
  A[el.dataset.a](el.dataset, el);
  if (!el.isConnected) {
    const n = Array.prototype.find.call(document.querySelectorAll('[data-a="' + el.dataset.a + '"]'), (x) => tapKey(x) === key);
    if (n) pop(n);
  }
});
document.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  const t = e.target.closest && e.target.closest('rect[data-a="bar"]');
  if (t) showBar(+t.dataset.i);
});
document.addEventListener('pointerdown', (e) => { suggHold = !!(e.target.closest && e.target.closest('.sugg')); });
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (el.dataset && el.dataset.sugg) showSugg(el); else if (el.tagName === 'INPUT') clearSugg();
});
document.addEventListener('focusout', () => {
  setTimeout(() => { const a = document.activeElement; if (!suggHold && !(a && a.dataset && a.dataset.sugg)) clearSugg(); }, 0);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'sheet-in') A.sheetOk();
  if (e.key === 'Enter' && e.target.id === 'f-flv') { e.preventDefault(); A.noteNew(); }
  if (e.key === 'Enter' && e.target.id === 'f-email' && DR.U) A.sendCode();
  if (e.key === 'Enter' && e.target.id === 'f-code' && DR.U) A.verifyCode();
  if (e.key === 'Escape' && SH) closeSheet();
  if (e.key === 'Escape' && document.getElementById('fall').className === 'on') A.addedDone();
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'f-q') { P.q = el.value; document.getElementById('blist').innerHTML = beansList(); return; }
  if (el.id === 'f-flv') { document.getElementById('flv-groups').innerHTML = flavorGroups(el.value); return; }
  if (el.id === 'f-roast' && DR.B) {
    const n = +el.value; DR.B.roast = n;
    el.style.setProperty('--c', ROAST_C[n - 1]); el.setAttribute('aria-valuetext', ROASTS[n - 1]);
    document.getElementById('roast-lbl').textContent = ROASTS[n - 1];
    return;
  }
  if (!el.dataset || !el.dataset.o || !DR[el.dataset.o]) return;
  if (el.dataset.num) {
    // numbers only: digits and one decimal point (a comma counts as the point)
    const parts = el.value.replace(/,/g, '.').replace(/[^0-9.]/g, '').split('.');
    const clean = parts.shift() + (parts.length ? '.' + parts.join('') : '');
    if (clean !== el.value) el.value = clean;
  }
  DR[el.dataset.o][el.dataset.f] = el.value;
  if (el.dataset.sugg) showSugg(el);
  if (el.dataset.o === 'B' && (el.dataset.f === 'price' || el.dataset.f === 'weight')) {
    const out = document.getElementById('perg');
    if (out) out.textContent = pergText(perG(DR.B));
  }
});
document.addEventListener('change', (e) => {
  if (e.target.dataset && e.target.dataset.pref) { P[e.target.dataset.pref] = e.target.value; P.logN = 30; savePref(); rerender(); return; }
  if (e.target.id !== 'imp' || !e.target.files[0]) return;
  const fr = new FileReader();
  fr.onload = () => {
    let data = null;
    try { data = JSON.parse(fr.result); } catch (err) { data = null; }
    if (!data || !Array.isArray(data.beans) || !Array.isArray(data.brews)) { toast('Not a backup file'); return; }
    sheet({ title: 'Replace everything with ' + data.beans.length + ' bags and ' + data.brews.length + ' brews?', ok: 'Replace', danger: true, cb: () => { S = Object.assign(blank(), data); save(); go('brew'); } });
  };
  fr.readAsText(e.target.files[0]);
});
window.addEventListener('hashchange', render);
document.addEventListener('visibilitychange', () => { if (!document.hidden && T) paintTimer(); });
render();
if (window.Cloud) Cloud.init();
