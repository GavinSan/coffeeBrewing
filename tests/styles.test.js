// Guards against CSS that silently stops painting (e.g. a custom property name reused for something else).
const BASE = process.env.BASE || 'http://localhost:8000/';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "window.COFFEE_CLOUD={url:'https://x.supabase.co',key:''};" }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => {
    if (sessionStorage.seeded) return; sessionStorage.seeded = 1;
    const d = new Date().toISOString().slice(0, 10);
    localStorage.setItem('coffee-pwa-v1', JSON.stringify({ beans: [{ id: 'b', name: 'Kenya', weight: 250, price: 25, notes: [], buyDate: d }],
      brews: [{ id: 'w', beanId: 'b', at: Date.now(), date: d, method: 'pour', dripper: 'v60', recipeId: '46', dose: 20, ratio: 16, temp: 92, grind: 24 }],
      gear: [{ id: 'g', model: 'v60', material: 'Ceramic', size: '02' }], setupSeen: true, grinders: [], recipes: [], filters: [], countdown: 3, updatedAt: 1 }));
  });
  // root custom properties used as colours must still be colours
  await p.goto(BASE + '#brew'); await p.waitForTimeout(300);
  const vars = await p.evaluate(() => ['--ground', '--card', '--ink', '--muted', '--line', '--soft', '--roast', '--brew', '--crema'].map((v) => [v, getComputedStyle(document.documentElement).getPropertyValue(v).trim()]));
  vars.forEach(([v, val]) => ok(/^#[0-9a-f]{3,8}$/i.test(val), v + ' is a colour (' + val + ')'));
  const bg = (sel) => p.$eval(sel, (el) => getComputedStyle(el).backgroundColor);
  const painted = (c) => c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent';
  ok(painted(await bg('.meter')), 'bag meter track is painted');
  await p.goto(BASE + '#rate/w'); await p.waitForSelector('.seg button');
  ok(painted(await bg('.seg button')), 'taste boxes are painted');
  await p.click('.seg button >> nth=2');
  ok(painted(await bg('.seg button.on')), 'picked taste box is painted');
  await p.goto(BASE + '#brew'); await p.click('.hero [data-a=startBrew]'); await p.waitForSelector('.stepper button');
  ok(painted(await bg('.stepper button')), 'stepper − / + are painted');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
