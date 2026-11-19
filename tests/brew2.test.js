// Brew flow with last-time reference, editing a logged brew, scanning a bag, sharing a cup, and the brewing surface.
const BASE = process.env.BASE || 'http://localhost:8000/';
const { chromium, devices } = require('playwright');
const path = require('path');
const SB = 'https://pbvfevkgzusqhqkoexjc.supabase.co';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANBAEB5k0dHQAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block', acceptDownloads: true });
  const scan = { status: 200, body: { name: 'Gesha Village', roaster: 'Sey', origin: 'Ethiopia', farm: 'Oma', process: 'natural', roast: 1, roastDate: '2026-11-02', weight: 250, price: 0, notes: ['Jasmine', 'bergamot'] }, calls: 0, auth: '' };
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "window.COFFEE_CLOUD={url:'" + SB + "',key:'test-key',otpLength:6};" }));
  await ctx.route(SB + '/**', async (r) => {
    const u = new URL(r.request().url()), json = (st, body) => r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname === '/auth/v1/otp') return json(200, {});
    if (u.pathname === '/auth/v1/verify') {
      const now = Math.floor(Date.now() / 1000), pl = Buffer.from(JSON.stringify({ sub: 'u1', exp: now + 3600, aud: 'authenticated', role: 'authenticated', email: 'me@example.com' })).toString('base64url');
      return json(200, { access_token: 'x.' + pl + '.y', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'me@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    if (u.pathname === '/functions/v1/scan-bag') { scan.calls++; scan.auth = r.request().headers()['authorization'] || ''; return json(scan.status, scan.body); }
    if (u.pathname === '/rest/v1/brew_state') return r.request().method() === 'GET' ? json(200, []) : json(201, [{ updated_at: 1 }]);
    return json(404, {});
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { if (sessionStorage.s) return; sessionStorage.s = 1; const now = Date.now(), d = (ms) => new Date(ms).toISOString().slice(0, 10);
    localStorage.setItem('coffee-pwa-v1', JSON.stringify({ beans: [{ id: 'b1', name: 'Kenya', roaster: 'Sey', weight: 250, price: 25, notes: [], buyDate: d(now) }, { id: 'b2', name: 'Colombia', weight: 250, price: 20, notes: [], buyDate: d(now) }],
      brews: [{ id: 'w1', beanId: 'b1', at: now - 864e5, date: d(now - 864e5), method: 'pour', gearId: 'g2', dripper: 'kalita', filter: 'Wave 185', recipeId: 'three', dose: 18, ratio: 15, temp: 90, grind: 22, elapsed: 185, stars: 4, ratedAt: 1, r: { aroma: 4, acid: 3, sweet: 4, body: 3, bitter: 1, finish: 4 }, adjust: '' }],
      gear: [{ id: 'g1', model: 'v60', material: 'Ceramic', size: '02' }, { id: 'g2', model: 'kalita', material: 'Metal', size: '185' }], setupSeen: true, grinders: [], recipes: [], filters: [], countdown: 3, updatedAt: 1 })); });
  const st = () => p.evaluate(() => S);

  // 1. bag → brewer (last one preselected) → settings with last time as a reference
  await p.goto(BASE + '#brew'); await p.click('[data-a=startBrew][data-id=b1]'); await p.waitForSelector('[data-a=toRecipe]');
  ok(/#method$/.test(p.url()) && await p.getAttribute('[data-a=pickGear][data-id=g2]', 'aria-pressed') === 'true', 'brewer step comes first, last brewer preselected');
  ok(/Last time with this bag/.test(await p.textContent('.ref')) && /Kalita Wave 185/.test(await p.textContent('.ref')), 'brewer step shows what was used last time');
  await p.click('[data-a=pickGear][data-id=g1]'); await p.click('[data-a=toRecipe]'); await p.waitForSelector('#v-dose');
  ok(/this bag/.test(await p.textContent('.ref')) && /last 18 g/.test(await p.textContent('#app')) && /last 1:15/.test(await p.textContent('#app')), 'recipe step shows last values quietly');
  ok(/Same/.test(await p.textContent('.ref')), 'carried-over settings read "Same"');
  await p.click('[data-a=step][data-k=dose][data-d="1"]'); await p.click('[data-a=step][data-k=grind][data-d="1"]');
  await p.click('[data-a=useRef]');
  const D = await p.evaluate(() => DR.D);
  ok(D.dose === 18 && D.ratio === 15 && D.temp === 90 && D.grind === 22 && D.recipeId === 'three', '"Use these" applies last time’s settings');
  ok(await p.locator('[data-a=useRef]').count() === 0 && /Same/.test(await p.textContent('.ref')), 'reference then reads "Same"');

  // 2. edit a logged brew
  await p.goto(BASE + '#rate/w1'); await p.waitForSelector('[data-a=editBrew]');
  await p.click('.head [data-a=editBrew]'); await p.waitForSelector('h1:text("Edit brew")');
  await p.selectOption('#f-brewer', 'g:g1'); await p.waitForSelector('#f-filter');
  ok((await p.$$eval('#f-filter option', (o) => o.map((x) => x.value))).includes('Cafec T-90'), 'changing brewer offers that brewer’s filters');
  await p.selectOption('#f-filter', 'Cafec T-90'); await p.selectOption('#f-recipeId', '46');
  await p.fill('#f-dose', '19.5'); await p.fill('#f-grind', '70'); await p.fill('#f-elapsed', '3:20'); await p.fill('#f-time', '07:45');
  await p.click('[data-a=saveBrewEdit]'); await p.waitForSelector('h1:text("How was it?")');
  const w1 = (await st()).brews.find((x) => x.id === 'w1');
  ok(w1.gearId === 'g1' && w1.dripper === 'v60' && w1.filter === 'Cafec T-90' && w1.recipeId === '46' && w1.dose === 19.5 && w1.grind === 70 && w1.elapsed === 200 && new Date(w1.at).getHours() === 7, 'edits saved: brewer, filter, recipe, dose, grind, time');
  ok(/V60 02/.test(await p.textContent('.linkrow')) && /19.5 g/.test(await p.textContent('.linkrow')), 'brew page shows the edited details');

  // 3. share this cup
  await p.click('[data-a=shareCup]'); await p.waitForSelector('#sheet .cardimg');
  const dims = await p.$eval('#sheet .cardimg', async (img) => { await img.decode(); return [img.naturalWidth, img.naturalHeight]; });
  ok(dims[0] === 1080 && dims[1] === 1350, 'share image is 1080×1350');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#sheet [data-a=saveCard]')]);
  await dl.saveAs(path.join(__dirname, '..', 'test-results', 'share-card.png'));
  ok(/\.png$/.test(dl.suggestedFilename()), 'image can be saved: ' + dl.suggestedFilename());
  await p.click('#sheet .bg', { position: { x: 20, y: 20 } }); // tap the backdrop above the sheet

  // 4. scan a bag (signed in)
  await p.goto(BASE + '#bean/new'); await p.click('[data-a=scanBag]');
  ok(/Sign in first/.test(await p.textContent('.err')), 'scan asks to sign in first');
  await p.goto(BASE + '#account'); await p.fill('#f-email', 'me@example.com'); await p.click('[data-a=sendCode]');
  await p.waitForFunction(() => /We sent/.test((document.getElementById('auth-msg') || {}).textContent || '')); await p.fill('#f-code', '123456'); await p.waitForSelector('#sync-status');
  await p.evaluate(() => { DR.B = null; }); await p.goto(BASE + '#bean/new'); await p.waitForSelector('[data-a=scanBag]');
  await p.fill('#f-weight', '200');
  await p.setInputFiles('#scan-in', { name: 'bag.png', mimeType: 'image/png', buffer: PNG });
  await p.waitForSelector('.hint:has-text("Filled from your photo")');
  const B = await p.evaluate(() => DR.B);
  ok(B.name === 'Gesha Village' && B.origin === 'Ethiopia' && B.process === 'Natural' && B.roast === 1 && B.roastDate === '2026-11-02' && B.notes.join() === 'Jasmine,Bergamot', 'scan fills the form');
  ok(B.weight === '200', 'scan doesn’t overwrite what you typed');
  ok(/^Bearer x\./.test(scan.auth) && scan.calls === 1, 'scan sends the signed-in token');
  ok(await p.locator('.field.filled').count() >= 4 && await p.locator('.from').count() >= 4, 'filled fields are marked "from photo"');
  scan.status = 404; scan.body = {};
  await p.setInputFiles('#scan-in', { name: 'bag.png', mimeType: 'image/png', buffer: PNG }); await p.waitForSelector('.err');
  ok(/isn’t set up/.test(await p.textContent('.err')), 'missing scan function explained');

  // 5. brewing surface: no steam, ripples while pouring
  await p.goto(BASE + '#brew'); await p.click('.hero [data-a=startBrew]'); await p.click('[data-a=toRecipe]'); await p.click('[data-a=toTimer]'); await p.waitForSelector('#t-main');
  ok(await p.locator('#wave .wisp').count() === 0 && await p.locator('#wave .rips b').count() === 3 && await p.locator('#wave em').count() === 12, 'surface has ripples and bubbles, no steam');
  await p.click('#t-main'); await p.waitForFunction(() => document.body.classList.contains('pouring'), null, { timeout: 6000 });
  ok(true, 'pouring state switches on during a pour');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
