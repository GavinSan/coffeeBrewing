// Brew flow with last-time reference, editing a logged brew, scanning a bag (on-device text recognition), sharing a cup, the timer dial, search clearing and suggestion spacing.
const BASE = process.env.BASE || 'http://localhost:8000/';
const { chromium, devices } = require('playwright');
const path = require('path');
const SB = 'https://pbvfevkgzusqhqkoexjc.supabase.co';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANBAEB5k0dHQAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "window.COFFEE_CLOUD={url:'" + SB + "',key:'test-key',otpLength:6};" }));
  await ctx.route(SB + '/**', async (r) => {
    const u = new URL(r.request().url()), json = (st, body) => r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname === '/auth/v1/otp') return json(200, {});
    if (u.pathname === '/auth/v1/verify') {
      const now = Math.floor(Date.now() / 1000), pl = Buffer.from(JSON.stringify({ sub: 'u1', exp: now + 3600, aud: 'authenticated', role: 'authenticated', email: 'me@example.com' })).toString('base64url');
      return json(200, { access_token: 'x.' + pl + '.y', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'me@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
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

  // 4. scan a bag: real text recognition on the device, no upload
  const T = Date.UTC(2026, 10, 19);
  const parse = (lines) => p.evaluate(([l, t]) => parseLabel(l, t), [lines, T]);
  let o = await parse(['ONYX COFFEE LAB', 'COLOMBIA', 'HUILA', 'WASHED', 'NOTES: RED APPLE / CARAMEL / CACAO', '12 OZ', 'ROASTED 11.10.26']);
  ok(o.origin === 'Colombia' && o.roaster === 'Onyx Coffee Lab' && o.process === 'Washed' && o.weight === 340 && o.roastDate === '2026-10-11' && o.notes.join() === 'Red apple,Caramel,Cacao', 'label rules: caps, ounces, day-first dates, notes line ' + JSON.stringify(o));
  o = await parse(['Kiambu AA', 'Washed', 'Notes: blackcurrant, honey, grapefruit']);
  ok(o.process === 'Washed' && o.origin === 'Kenya' && o.notes.indexOf('Honey') >= 0 && o.name === 'Kiambu AA', 'honey as a flavour isn’t the process; region gives the country ' + JSON.stringify(o));
  o = await parse(['Best before 2027-01-01', 'Roast date: Nov 3, 2026', 'Black honey', 'Yirgacheffe']);
  ok(o.roastDate === '2026-11-03' && o.process === 'Honey' && o.origin === 'Ethiopia', 'roast date over best-before; black honey ' + JSON.stringify(o));
  o = await parse(['Roasted 2027-05-01', 'Anaerobic natural', 'Finca El Paraiso', 'sey']);
  ok(!o.roastDate && o.process === 'Anaerobic' && o.farm === 'Finca El Paraiso' && o.roaster === 'Sey', 'no future dates; farm line; a roaster you know ' + JSON.stringify(o));

  await p.goto(BASE + '#bean/new'); await p.waitForSelector('[data-a=scanBag]');
  await p.fill('#f-weight', '200');
  const label = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 900; c.height = 1100; const x = c.getContext('2d'); x.fillStyle = '#EFE6D8'; x.fillRect(0, 0, 900, 1100); x.fillStyle = '#222';
    x.font = '600 40px sans-serif'; x.fillText('SEY COFFEE', 80, 120); x.font = 'bold 90px serif'; x.fillText('Gesha Village', 80, 290);
    x.font = '36px sans-serif'; ['Bench Maji, Ethiopia', 'Process: Natural', 'Producer: Adam Overton', 'Tasting notes: jasmine, bergamot', 'Light roast', 'Roasted on 02/11/2026', 'Net wt 250g'].forEach((t, i) => x.fillText(t, 80, 420 + i * 80));
    return c.toDataURL('image/png').split(',')[1]; });
  const reqs = []; p.on('request', (r) => { if (!r.url().startsWith(BASE)) reqs.push(r.url()); });
  await p.setInputFiles('#scan-in', { name: 'bag.png', mimeType: 'image/png', buffer: Buffer.from(label, 'base64') });
  await p.waitForSelector('.hint:has-text("Filled from the label")', { timeout: 60000 });
  const B = await p.evaluate(() => DR.B);
  ok(B.name === 'Gesha Village' && B.roaster === 'Sey' && B.origin === 'Ethiopia' && B.farm === 'Adam Overton' && B.process === 'Natural' && B.roast === 1 && B.roastDate === '2026-11-02' && B.notes.join() === 'Jasmine,Bergamot', 'scan reads the label ' + JSON.stringify(B));
  ok(B.weight === '200', 'scan doesn’t overwrite what you typed');
  ok(reqs.length === 0, 'scanning sends nothing off the device ' + reqs.join(' '));
  ok(await p.locator('.field.filled').count() >= 4 && await p.locator('.from').count() >= 4, 'filled fields are marked "from photo"');
  ok(/Gesha Village/.test(await p.textContent('details.ocr pre')), 'the text it read can be checked');
  await p.screenshot({ path: path.join(__dirname, '..', 'test-results', 'scan.png'), fullPage: true });
  await p.setInputFiles('#scan-in', { name: 'bag.png', mimeType: 'image/png', buffer: PNG }); await p.waitForSelector('.err', { timeout: 60000 });
  ok(/any text/.test(await p.textContent('.err')), 'a photo with no text is explained');

  // 5. timer dial: a ring fills with the water, a mark for each pour target, no liquid or bubbles
  await p.goto(BASE + '#brew'); await p.click('.hero [data-a=startBrew]'); await p.click('[data-a=toRecipe]'); await p.click('[data-a=toTimer]'); await p.waitForSelector('#t-main');
  ok(await p.locator('#wave').count() === 0 && await p.locator('.dial .tick').count() >= 1, 'dial with pour marks, no liquid layer');
  ok(/Pour to/i.test(await p.textContent('#t-k1')) && /Total water/.test(await p.textContent('#t-gto')), 'before starting: first pour and total water shown');
  await p.click('#t-main'); await p.waitForFunction(() => document.body.classList.contains('pouring'), null, { timeout: 8000 });
  await p.waitForFunction(() => parseFloat(document.getElementById('t-arc').getAttribute('stroke-dasharray')) > 0, null, { timeout: 4000 });
  ok(/Still to add/i.test(await p.textContent('#t-k2')) && /Time left/i.test(await p.textContent('#t-k3')), 'pouring: still to add and time left shown, ring fills');
  await p.screenshot({ path: path.join(__dirname, '..', 'test-results', 'timer-dial.png') });

  // 6. search boxes have a clear button
  await p.click('[data-a=tReset]').catch(() => {});
  await p.goto(BASE + '#beans'); await p.waitForSelector('#f-q');
  ok(!(await p.isVisible('.search .x')), 'no clear button while empty');
  await p.fill('#f-q', 'kenya'); ok(await p.isVisible('.search .x'), 'clear button shows once there is text');
  await p.click('.search .x');
  ok(await p.inputValue('#f-q') === '' && await p.locator('#blist .row').count() === 2 && !(await p.isVisible('.search .x')), 'tapping it empties the search and lists every bag again');

  // 7. suggestions keep a gap from their field
  await p.goto(BASE + '#bean/new'); await p.fill('#f-origin', 'Co'); await p.waitForSelector('#sg-origin .chip');
  const gap = await p.evaluate(() => document.querySelector('#sg-origin .chip').getBoundingClientRect().top - document.getElementById('f-origin').getBoundingClientRect().bottom);
  ok(gap >= 10, 'origin suggestions sit apart from the field: ' + gap + 'px');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
