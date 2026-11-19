// Brew timer on a phone: controls always on screen, current step centred in the carousel, finished steps tucked away.
const BASE = process.env.BASE || 'http://localhost:8000/';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone SE'], serviceWorkers: 'block' }); // small screen on purpose
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "window.COFFEE_CLOUD={url:'https://x.supabase.co',key:''};" }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-11-19T08:00:00') });
  await p.addInitScript(() => { if (sessionStorage.s) return; sessionStorage.s = 1; const d = new Date().toISOString().slice(0, 10);
    localStorage.setItem('coffee-pwa-v1', JSON.stringify({ beans: [{ id: 'b', name: 'Kenya', weight: 250, price: 25, notes: [], buyDate: d }],
      brews: [{ id: 'w', beanId: 'b', at: Date.now() - 864e5, date: d, method: 'pour', gearId: 'g', dripper: 'v60', recipeId: 'ten', dose: 20, ratio: 16, temp: 92, grind: 24 }],
      gear: [{ id: 'g', model: 'v60', material: 'Ceramic', size: '02' }], setupSeen: true, grinders: [], recipes: [], filters: [], countdown: 3, updatedAt: 1 })); });
  const settle = async (cond) => { for (let i = 0; i < 40; i++) { if (await cond()) return true; await p.clock.runFor(50); } return cond(); };
  await p.goto(BASE + '#brew'); await settle(async () => (await p.locator('.hero [data-a=startBrew]').count()) > 0);
  await p.click('.hero [data-a=startBrew]'); await settle(async () => (await p.locator('[data-a=toTimer]').count()) > 0);
  await p.click('[data-a=toTimer]'); await settle(async () => (await p.locator('#t-rail').count()) > 0);
  await p.clock.runFor(600); await p.waitForTimeout(500); // page ease-in finishes (CSS animation, real time)
  const vh = p.viewportSize().height;
  const onScreen = async (sel) => { const bb = await p.locator(sel).boundingBox(); return bb && bb.y >= 0 && bb.y + bb.height <= vh; };
  ok(await p.locator('#t-rail .tstep').count() === 10, 'ten-pour recipe: 10 step cards');
  ok(await onScreen('#t-main') && await onScreen('[data-a=tDone]') && await onScreen('[data-a=tReset]'), 'controls on screen before start (iPhone SE)');
  await p.click('#t-main'); await p.clock.runFor(3000 + 65000); // countdown, then into step 4 (60 s)
  ok(await p.locator('#t-cd').isHidden(), 'countdown choice hidden while brewing');
  ok(await onScreen('#t-main') && await onScreen('[data-a=tDone]'), 'controls still on screen while brewing');
  ok(await p.getAttribute('#ts-3', 'class') === 'tstep now' && /past/.test(await p.getAttribute('#ts-0', 'class')), 'step 4 is current, earlier steps marked done');
  await p.clock.runFor(1500); await p.waitForTimeout(800); // smooth scroll runs on real time
  const c = await p.evaluate(() => { const r = document.getElementById('t-rail').getBoundingClientRect(), s = document.getElementById('ts-3').getBoundingClientRect(); return [(r.left + r.right) / 2, (s.left + s.right) / 2, document.getElementById('ts-0').getBoundingClientRect().right]; });
  ok(Math.abs(c[0] - c[1]) < 30, 'current step centred in the carousel (' + Math.round(c[1] - c[0]) + ' px off)');
  ok(c[2] < 0, 'finished steps slid off to the left');
  await p.click('[data-a=tReset]'); await p.clock.runFor(300); await p.waitForTimeout(800);
  const r0 = await p.evaluate(() => document.getElementById('t-rail').scrollLeft);
  ok(r0 < 5 && await p.locator('#t-cd').isVisible(), 'restart: back to step 1, countdown choice back');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await p.screenshot({ path: require('path').join(__dirname, '..', 'test-results', 'timer-se.png') });
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
