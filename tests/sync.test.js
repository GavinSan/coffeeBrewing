const { chromium } = require('playwright');
const BASE = process.env.BASE || BASE;
const SB = 'https://pbvfevkgzusqhqkoexjc.supabase.co';
const db = {}; // user_id -> { data, updated_at }
const UID = '11111111-1111-1111-1111-111111111111';
const log = [];
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

function session() {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: UID, exp: now + 3600, aud: 'authenticated', role: 'authenticated', email: 'me@example.com' })).toString('base64url');
  return { access_token: 'x.' + payload + '.y', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r',
    user: { id: UID, aud: 'authenticated', role: 'authenticated', email: 'me@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
}
async function device(browser, name, seed) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const st = { offline: false, errs: [] };
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "window.COFFEE_CLOUD={url:'" + SB + "',key:'test-key'};" }));
  await ctx.route(SB + '/**', async (r) => {
    const req = r.request(), u = new URL(req.url()), m = req.method();
    if (st.offline) return r.abort('internetdisconnected');
    log.push(name + ' ' + m + ' ' + u.pathname + u.search);
    const json = (s, b, h) => r.fulfill({ status: s, contentType: 'application/json', headers: h || {}, body: JSON.stringify(b) });
    if (u.pathname === '/auth/v1/otp') return json(200, {});
    if (u.pathname === '/auth/v1/verify') return json(200, session());
    if (u.pathname === '/auth/v1/user') return json(200, session().user);
    if (u.pathname === '/auth/v1/logout') return r.fulfill({ status: 204, body: '' });
    if (u.pathname === '/rest/v1/brew_state') {
      const q = Object.fromEntries(u.searchParams);
      const id = (q.user_id || '').replace('eq.', '');
      if (m === 'GET') {
        const row = db[id];
        const rows = row ? [{ data: row.data, updated_at: row.updated_at }] : [];
        if ((req.headers()['accept'] || '').includes('vnd.pgrst.object')) return rows.length ? json(200, rows[0]) : json(406, { code: 'PGRST116', message: 'no rows' });
        return json(200, rows);
      }
      if (m === 'POST') {
        const b = JSON.parse(req.postData());
        if (db[b.user_id]) return json(409, { code: '23505', message: 'duplicate key' });
        db[b.user_id] = { data: b.data, updated_at: b.updated_at };
        return json(201, [{ updated_at: b.updated_at }]);
      }
      if (m === 'PATCH') {
        const b = JSON.parse(req.postData()), row = db[id], want = +String(q.updated_at).replace('eq.', '');
        if (!row || row.updated_at !== want) return json(200, []);
        db[id] = { data: b.data, updated_at: b.updated_at };
        return json(200, [{ updated_at: b.updated_at }]);
      }
    }
    return json(404, { message: 'unmocked ' + m + ' ' + u.pathname });
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => st.errs.push(e.message));
  p.on('console', (msg) => { if (msg.type() === 'error' && !/internetdisconnected|Failed to load resource/.test(msg.text())) st.errs.push(msg.text()); });
  await p.addInitScript((s) => { if (!localStorage.getItem('coffee-pwa-v1') && s) localStorage.setItem('coffee-pwa-v1', JSON.stringify(s)); }, seed);
  await p.goto(BASE + '#account');
  return { p, st, ctx };
}
const st0 = (beans, brews) => ({ beans, brews: brews || [], grinders: [], owned: [], recipes: [], filters: [], countdown: 3, updatedAt: 1 });
const bean = (id, name) => ({ id, name, roaster: '', weight: 200, price: 20, notes: [], roast: 1, rating: 0 });
const names = (p) => p.evaluate(() => S.beans.map((b) => b.name).sort().join(','));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const t = Date.now(); while (Date.now() - t < (ms || 6000)) { if (await fn()) return true; await wait(100); } return false; }

async function signIn(d) {
  await d.p.fill('#f-email', 'me@example.com');
  await d.p.click('[data-a=sendCode]');
  await d.p.waitForSelector('#f-code');
  await d.p.fill('#f-code', '123456'); // signs in as soon as 6 digits are in
  await d.p.waitForSelector('#sync-status');
}

(async () => {
  const browser = await chromium.launch();

  // 0. no key: app works locally, no Account section
  {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "window.COFFEE_CLOUD={url:'" + SB + "',key:''};" }));
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '#account');
    ok(await p.locator('.label:text-is("Sync")').count() === 0, 'no key: sync section hidden');
    ok(await p.locator('text=saved on this device').count() >= 1, 'no key: device-only text');
    await p.evaluate(() => { S.beans.unshift({ id: 'z', name: 'Local', notes: [] }); save(); });
    ok(JSON.parse(await p.evaluate(() => localStorage.getItem('coffee-pwa-v1'))).beans.length === 1, 'no key: save still works');
    ok(errs.length === 0, 'no key: no errors ' + errs.join('|'));
    await ctx.close();
  }

  // 1. device A signs in with local data -> uploaded
  const A = await device(browser, 'A', st0([bean('a1', 'Ethiopia A')]));
  await signIn(A);
  ok(await until(() => db[UID] && db[UID].data.beans.length === 1), 'A: first sign-in uploads local log');
  ok(await until(async () => /Synced/.test(await A.p.textContent('#sync-status'))), 'A: status shows Synced');

  // 2. device B signs in with different local data -> merged both ways
  const B = await device(browser, 'B', st0([bean('b1', 'Kenya B')]));
  await signIn(B);
  ok(await until(async () => (await names(B.p)) === 'Ethiopia A,Kenya B'), 'B: merged account + local data');
  ok(await until(() => db[UID].data.beans.length === 2), 'B: merged result uploaded');
  await A.p.click('[data-a=syncNow]');
  ok(await until(async () => (await names(A.p)) === 'Ethiopia A,Kenya B'), 'A: pulls B\'s bean');

  // 3. normal edit on A flows to B
  await A.p.evaluate(() => { S.beans.unshift({ id: 'a2', name: 'Colombia A2', notes: [] }); save(); });
  ok(await until(() => db[UID].data.beans.length === 3), 'A: edit auto-uploads after debounce');
  await B.p.click('[data-a=syncNow]');
  ok(await until(async () => (await names(B.p)) === 'Colombia A2,Ethiopia A,Kenya B'), 'B: receives A\'s edit');

  // 4. deletion on B propagates (no conflict)
  await B.p.evaluate(() => { S.beans = S.beans.filter((b) => b.id !== 'b1'); save(); });
  ok(await until(() => db[UID].data.beans.length === 2), 'B: delete uploaded');
  await A.p.click('[data-a=syncNow]');
  ok(await until(async () => (await names(A.p)) === 'Colombia A2,Ethiopia A'), 'A: delete arrives (not resurrected)');

  // 5. B offline edits while A edits -> both kept after B reconnects
  B.st.offline = true; await B.ctx.setOffline(true);
  await B.p.evaluate(() => { S.beans.unshift({ id: 'b3', name: 'Offline B3', notes: [] }); save(); });
  await wait(2200);
  ok(/Offline|waiting/i.test(await B.p.textContent('#sync-status')), 'B: offline status shown: ' + await B.p.textContent('#sync-status'));
  await A.p.evaluate(() => { S.beans.unshift({ id: 'a4', name: 'Panama A4', notes: [] }); save(); });
  ok(await until(() => db[UID].data.beans.some((b) => b.id === 'a4')), 'A: uploads while B offline');
  B.st.offline = false; await B.ctx.setOffline(false);
  await B.p.click('[data-a=syncNow]');
  ok(await until(async () => (await names(B.p)) === 'Colombia A2,Ethiopia A,Offline B3,Panama A4'), 'B: conflict merged, nothing lost');
  ok(await until(() => db[UID].data.beans.length === 4), 'B: merged state uploaded');

  // 5b. flaky network (browser thinks it's online) settles instead of spinning forever
  B.st.offline = true;
  await B.p.evaluate(() => { S.countdown = 5; save(); });
  const t0 = Date.now();
  ok(await until(async () => !/Syncing/.test(await B.p.textContent('#sync-status')), 40000), 'B: flaky network settles in ' + Math.round((Date.now() - t0) / 1000) + 's: ' + await B.p.textContent('#sync-status'));
  B.st.offline = false;
  await B.p.click('[data-a=syncNow]');
  ok(await until(() => db[UID].data.countdown === 5), 'B: retried change uploads once back');

  // 6. reload keeps session and data
  await A.p.reload();
  ok(await until(async () => (await names(A.p)) === 'Colombia A2,Ethiopia A,Offline B3,Panama A4'), 'A: after reload, signed in and synced');

  // 7. sign out keeps local data
  await A.p.click('[data-a=signOut]'); await A.p.click('[data-a=sheetOk]');
  ok(await until(async () => (await A.p.locator('#f-email').count()) === 1), 'A: sign out shows form');
  ok((await names(A.p)).split(',').length === 4, 'A: data kept after sign out');

  ok(A.st.errs.length === 0 && B.st.errs.length === 0, 'no page errors ' + A.st.errs.concat(B.st.errs).join(' | '));
  await A.p.goto(BASE + '#account'); await A.p.screenshot({ path: require('path').join(__dirname, '..', 'test-results', 'sync-signedout.png') });
  await B.p.screenshot({ path: require('path').join(__dirname, '..', 'test-results', 'sync-signedin.png') });
  await browser.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
