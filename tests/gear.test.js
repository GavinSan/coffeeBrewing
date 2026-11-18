const BASE = process.env.BASE || BASE;
const { chromium, devices } = require('playwright');
const OUT = require('path').join(__dirname, '..', 'test-results') + '/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "window.COFFEE_CLOUD={url:'https://x.supabase.co',key:''};" }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('coffee-pwa-v1') || '{}'));
  const D = () => p.evaluate(() => DR.D);
  const shot = (n) => p.screenshot({ path: OUT + n + '.png' });

  // onboarding
  await p.goto(BASE); await p.waitForSelector('h1:text("Your gear")');
  ok(p.url().endsWith('#setup'), 'first run opens gear setup');
  for (const id of ['v60', 'kalita', 'orea', 'switch', 'french']) await p.click('#catalog [data-a=toggleGear][data-v=' + id + ']');
  ok((await st()).gear.length === 5, 'picked 5 brewers');
  await p.fill('#f-cq', 'timemore');
  ok(await p.locator('#catalog [data-a=toggleGear]').count() === 1, 'catalog search by brand');
  await p.fill('#f-cq', '');
  const v60 = (await st()).gear.find((g) => g.model === 'v60');
  await p.click('#mine [data-a=setGear][data-id="' + v60.id + '"][data-f=material][data-v=Ceramic]');
  await p.click('#mine [data-a=setGear][data-id="' + v60.id + '"][data-f=size][data-v="01"]');
  await p.click('#mine [data-a=dupGear][data-id="' + v60.id + '"]');
  const g1 = (await st()).gear.filter((g) => g.model === 'v60');
  ok(g1.length === 2 && g1[0].material === 'Ceramic' && g1[0].size === '01' && g1[1].material !== 'Ceramic', 'V60 ceramic 01 plus a second V60 in another material');
  await p.fill('#f-name', 'Niche Zero'); await p.click('[data-a=setSG][data-v=Electric]');
  await shot('g1-setup');
  await p.click('[data-a=setupDone]'); await p.waitForSelector('text=Start with a bag of beans');
  ok((await st()).grinders[0].kind === 'Electric', 'grinder saved as electric');

  // a bag, then brewing only shows owned gear
  await p.click('.welcome [data-a=newBean]'); await p.fill('#f-name', 'Kenya'); await p.fill('#f-price', '28'); await p.fill('#f-weight', '250');
  await p.click('[data-a=saveBean]'); await p.waitForSelector('[data-a=addedBrew]'); await p.click('[data-a=addedBrew]');
  await p.waitForSelector('h1:text("Brew")');
  ok(await p.locator('[data-a=pickGear]').count() === 6, 'brew step shows only your 6 brewers');
  const kal = (await st()).gear.find((g) => g.model === 'kalita');
  await p.click('[data-a=pickGear][data-id="' + kal.id + '"]');
  const kf = await p.$$eval('[data-a=setD][data-f=filter]', (xs) => xs.map((x) => x.dataset.v));
  ok(kf.includes('Wave 185') && !kf.includes('Cafec T-90') && !kf.includes('Chemex bonded'), 'Kalita: flat filters only');
  await shot('g2-brewer');
  await p.click('[data-a=toRecipe]'); await p.waitForSelector('h1:text("Recipe")');
  const kr = await p.$$eval('[data-a=setRecipe]', (xs) => xs.map((x) => x.textContent));
  ok(!kr.includes('Steep & release') && !kr.includes('Hybrid'), 'Kalita: no steep or hybrid recipes');
  await p.click('[data-a=toMethod]'); await p.waitForSelector('[data-a=pickGear]');
  const sw = (await st()).gear.find((g) => g.model === 'switch');
  await p.click('[data-a=pickGear][data-id="' + sw.id + '"]'); await p.click('[data-a=toRecipe]'); await p.waitForSelector('h1:text("Recipe")');
  const sr = await p.$$eval('[data-a=setRecipe]', (xs) => xs.map((x) => x.textContent));
  ok(sr.includes('Steep & release') && sr.includes('Hybrid') && (await D()).recipeId === 'switch', 'Switch: valve recipes offered, steep picked first time');
  await p.click('[data-a=toMethod]'); await p.waitForSelector('[data-a=pickGear]');
  const fp = (await st()).gear.find((g) => g.model === 'french');
  await p.click('[data-a=pickGear][data-id="' + fp.id + '"]');
  ok((await D()).method === 'french' && await p.locator('[data-a=setD][data-f=filter]').count() === 0, 'French press: method switches, no filters');
  await p.click('[data-a=pickGear][data-id="' + g1[0].id + '"]'); await p.click('[data-a=toRecipe]'); await p.waitForSelector('h1:text("Recipe")');

  // typed values
  await p.fill('#v-grind', '70'); await p.press('#v-grind', 'Enter');
  await p.fill('#v-ratio', '15,5'); await p.press('#v-ratio', 'Enter');
  await p.fill('#v-dose', '18'); await p.locator('#v-dose').blur();
  const d1 = await D();
  ok(d1.grind === 70 && d1.ratio === 15.5 && d1.dose === 18 && (await p.textContent('#v-water')) === '279 g', 'typed grind 70, ratio 15.5, dose 18 → 279 g');
  await p.click('[data-a=step][data-k=grind][data-d="1"]');
  ok((await D()).grind === 71, '+ still works after typing');

  // rename a built-in recipe and give a step its own temp
  await p.click('[data-a=setRecipe][data-v="46"]');
  await p.click('[data-a=editRecipe]'); await p.waitForSelector('h1:text("Edit recipe")');
  await p.fill('#f-name', 'Kasuya 4:6');
  await p.fill('[data-rs="1"][data-k=temp]', '88');
  await p.fill('[data-rs="1"][data-k=label]', 'Second');
  await p.fill('[data-rs="2"][data-k=t]', '1.35');
  await shot('g3-editor');
  await p.click('[data-a=saveRecipe]'); await p.waitForSelector('h1:text("Recipe")');
  const ov = (await st()).recipeOver['46'];
  ok(ov && ov.name === 'Kasuya 4:6' && ov.steps[1].temp === 88 && ov.steps[1].label === 'Second' && ov.steps[2].t === 95, 'built-in renamed, step temp/label/time saved without leaving the field');
  ok((await p.textContent('[data-a=setRecipe][data-v="46"]')) === 'Kasuya 4:6', 'new name shows in recipe list');
  await p.click('[data-a=toTimer]'); await p.waitForSelector('#t-clock');
  ok(/Second\s*88°/.test(await p.textContent('#ts-1')), 'timer step shows 88°');
  await shot('g4-timer');
  await p.click('[data-a=back]'); await p.waitForSelector('h1:text("Recipe")');
  await p.click('[data-a=editRecipe]'); await p.waitForSelector('[data-a=resetRecipe]');
  await p.click('[data-a=resetRecipe]'); await p.click('#sheet [data-a=sheetOk]'); await p.waitForSelector('h1:text("Recipe")');
  ok(!(await st()).recipeOver['46'] && (await p.textContent('[data-a=setRecipe][data-v="46"]')) === '4:6', 'reset to original');

  // gear item page and custom brewer
  await p.goto(BASE + '#gear'); await p.waitForSelector('h1:text("Gear")');
  ok(await p.locator('[data-a=editGear]').count() === 6, 'gear lists 6 brewers');
  await shot('g5-gear');
  await p.click('[data-a=editGear][data-id="' + kal.id + '"]'); await p.waitForSelector('.gearhero');
  await p.click('[data-a=setGear][data-f=material][data-v=Glass]'); await p.fill('#f-nick', 'Glass Wave');
  await p.locator('#f-nick').blur();
  const k2 = (await st()).gear.find((g) => g.id === kal.id);
  ok(k2.material === 'Glass' && k2.nick === 'Glass Wave', 'material and display name saved');
  await shot('g6-item');
  await p.goto(BASE + '#setup'); await p.waitForSelector('[data-a=customGear]');
  await p.click('[data-a=customGear]'); await p.fill('#sheet-in', 'Torch Mountain'); await p.click('#sheet [data-a=sheetOk]');
  await p.waitForSelector('.gearhero');
  await p.click('[data-a=setGear][data-f=valve]');
  ok((await st()).gear.find((g) => g.model === 'custom').valve === true, 'custom brewer with valve');

  // journal: spend = bag prices when bought
  await p.evaluate(() => { const old = new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10); S.beans.push({ id: 'old', name: 'Old', price: 40, weight: 250, buyDate: old, finishDate: old, notes: [] }); S.brews.push({ id: 'x', beanId: S.beans[0].id, at: Date.now(), date: new Date().toISOString().slice(0, 10), method: 'pour', dripper: 'v60', dose: 15, ratio: 16, temp: 93, stars: 4, ratedAt: 1 }); save(); });
  await p.goto(BASE + '#journal'); await p.click('[data-a=pref][data-k=period][data-v="30"]');
  const spent = await p.textContent('.stat:nth-child(2) .v');
  ok(spent === '$28.00' && /1 bag/.test(await p.textContent('.stat:nth-child(2) .d')), 'spent (30 days) = bag bought: ' + spent);
  await p.click('[data-a=pref][data-k=period][data-v=all]');
  ok((await p.textContent('.stat:nth-child(2) .v')) === '$68.00', 'spent (all) = both bags');

  // old saves: owned drippers turn into gear
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.setItem('coffee-pwa-v1', JSON.stringify({ beans: [{ id: 'b', name: 'B', notes: [] }], brews: [], owned: ['v60', 'orea', 'chemex'], grinders: [], recipes: [], filters: [], countdown: 3, updatedAt: 1 })); } });
  await p2.goto(BASE + '#gear'); await p2.waitForSelector('h1:text("Gear")');
  ok(await p2.locator('[data-a=editGear]').count() === 3 && await p2.evaluate(() => S.setupSeen && !('owned' in S)), 'old owned list migrates to gear');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
