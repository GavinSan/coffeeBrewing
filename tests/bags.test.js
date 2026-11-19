// How much is left in each bag, running low, correcting the amount, and what happens when a bag is finished.
const BASE = process.env.BASE || 'http://localhost:8000/';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "window.COFFEE_CLOUD={url:'https://x.supabase.co',key:''};" }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { if (sessionStorage.s) return; sessionStorage.s = 1; const now = Date.now(), d = (ms) => new Date(ms).toISOString().slice(0, 10);
    const brew = (id, beanId, ago, dose, stars) => ({ id, beanId, at: now - ago * 864e5, date: d(now - ago * 864e5), method: 'pour', gearId: 'g', dripper: 'v60', recipeId: '46', dose, ratio: 16, temp: 92, grind: 24, stars, ratedAt: stars ? 1 : 0 });
    localStorage.setItem('coffee-pwa-v1', JSON.stringify({
      beans: [{ id: 'big', name: 'Guji', roaster: 'Terminal 3', origin: 'Ethiopia', weight: 300, price: 30, notes: [], buyDate: d(now - 20 * 864e5), openDate: d(now - 16 * 864e5) },
        { id: 'low', name: 'Lychee', roaster: 'Terminal 3', origin: 'Colombia', weight: 100, price: 24, notes: [], buyDate: d(now - 30 * 864e5), openDate: d(now - 28 * 864e5) }],
      brews: [brew('a', 'big', 1, 20, 4), brew('b', 'low', 9, 20, 3), brew('c', 'low', 6, 20, 5), brew('d', 'low', 3, 20, 4), brew('e', 'low', 2, 20, 0)],
      gear: [{ id: 'g', model: 'v60', material: 'Ceramic', size: '02' }], setupSeen: true, grinders: [], recipes: [], filters: [], countdown: 3, updatedAt: 1 })); });
  const S = () => p.evaluate(() => S);

  // every open bag shows what's left
  await p.goto(BASE + '#brew'); await p.waitForSelector('.hero');
  const other = await p.textContent('.list .row');
  ok(/20 g/.test(other) && /almost out|running low/.test(other), 'home: other bags show grams left and a low warning (' + other.replace(/\s+/g, ' ').trim() + ')');
  await p.goto(BASE + '#beans'); await p.waitForSelector('#blist .row');
  const rows = await p.$$eval('#blist .row', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ')));
  ok(rows.some((t) => /280 g · ~14 cups/.test(t)) && rows.some((t) => /20 g · (running low|almost out)/.test(t)), 'beans list: each bag shows grams and cups left');
  ok(await p.locator('#blist .mm.low').count() === 1, 'only the nearly empty bag is marked low');

  // the low bag's hero nudges a restock
  await p.evaluate(() => { const g = S.beans.find((x) => x.id === 'big'); g.finishDate = new Date().toISOString().slice(0, 10); save(); });
  await p.goto(BASE + '#brew'); await p.waitForSelector('.hero');
  ok(/Running low/.test(await p.textContent('.hero')) && await p.locator('.hero [data-a=buyAgain]').count() === 1, 'up-next card says running low with Buy again');
  await p.evaluate(() => { delete S.beans.find((x) => x.id === 'big').finishDate; save(); });

  // correct the amount left
  await p.goto(BASE + '#bean/big'); await p.waitForSelector('[data-a=fixLeft]');
  await p.click('[data-a=fixLeft]'); await p.fill('#sheet-in', '150'); await p.click('#sheet [data-a=sheetOk]');
  ok(await p.evaluate(() => left(S.beans.find((x) => x.id === 'big'))) === 150, 'correcting sets 150 g left');
  ok(/150 g/.test(await p.textContent('.card')), 'bag page shows the corrected amount');

  // brewing the last cup finishes the bag and shows its summary
  await p.goto(BASE + '#brew'); await p.click('[data-a=startBrew][data-id=low]'); await p.click('[data-a=toRecipe]'); await p.waitForSelector('[data-a=logNoTimer]');
  await p.click('[data-a=logNoTimer]'); await p.waitForSelector('#fall.on .addcard');
  const card = (await p.textContent('#fall .addcard')).replace(/\s+/g, ' ');
  ok(/Bag finished/.test(card) && /Lychee/.test(card) && /Cups\s*5/.test(card) && /Per cup\s*\$4\.80/.test(card) && /Best cup/.test(card), 'finishing shows the bag summary: ' + card.slice(0, 120));
  const lowBag = (await S()).beans.find((x) => x.id === 'low');
  ok(!!lowBag.finishDate, 'bag is marked finished');
  await p.click('[data-a=doneBuyAgain]'); await p.waitForSelector('h1:text("New bag")');
  ok(await p.inputValue('#f-name') === 'Lychee' && await p.inputValue('#f-roastDate') === '', 'Buy it again opens a copy with a fresh roast date');

  // finished bags move to Finished with when and how many cups
  await p.evaluate(() => { DR.B = null; }); await p.goto(BASE + '#beans'); await p.click('[data-a=pref][data-k=beanTab][data-v=done]');
  ok(/Finished .* · 5 cups/.test(await p.textContent('#blist')), 'Finished tab shows when it ran out and how many cups');

  // marking finished by hand also shows the summary
  await p.goto(BASE + '#bean/big'); await p.click('[data-a=finishNow]'); await p.click('#sheet [data-a=sheetOk]'); await p.waitForSelector('#fall.on .addcard');
  ok(/Guji/.test(await p.textContent('#fall .addcard')), 'Finished it (by hand) shows the summary too');
  await p.click('[data-a=doneClose]');
  ok(await p.locator('#fall.on').count() === 0, 'Done closes it');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await p.screenshot({ path: require('path').join(__dirname, '..', 'test-results', 'bags.png') });
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
