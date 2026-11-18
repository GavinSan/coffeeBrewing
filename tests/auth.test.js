// Sign-in flow against a mocked Supabase: instant feedback, clear errors, survives a reload.
const BASE = process.env.BASE || 'http://localhost:8000/';
const { chromium, devices } = require('playwright');
const SB = 'https://pbvfevkgzusqhqkoexjc.supabase.co';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  const mock = { otpDelay: 1500, otpStatus: 200, verifyOk: false, otpCalls: 0 };
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "window.COFFEE_CLOUD={url:'" + SB + "',key:'test-key'};" }));
  await ctx.route(SB + '/**', async (r) => {
    const u = new URL(r.request().url()), json = (st, body) => r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname === '/auth/v1/otp') {
      mock.otpCalls++; await wait(mock.otpDelay);
      return mock.otpStatus === 200 ? json(200, {}) : json(mock.otpStatus, { code: mock.otpStatus, error_code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 42 seconds.' });
    }
    if (u.pathname === '/auth/v1/verify') {
      if (!mock.verifyOk) return json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      const now = Math.floor(Date.now() / 1000), pl = Buffer.from(JSON.stringify({ sub: 'u1', exp: now + 3600, aud: 'authenticated', role: 'authenticated', email: 'me@example.com' })).toString('base64url');
      return json(200, { access_token: 'x.' + pl + '.y', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'me@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    if (u.pathname === '/rest/v1/brew_state') return r.request().method() === 'GET' ? json(200, []) : json(201, [{ updated_at: 1 }]);
    return json(404, {});
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '#account'); await p.waitForSelector('#f-email');

  // send: the code step appears at once, while the email is still going out
  await p.fill('#f-email', 'Me@Example.com ');
  const t0 = Date.now(); await p.click('[data-a=sendCode]');
  await p.waitForSelector('#f-code', { timeout: 1000 });
  ok(Date.now() - t0 < 800 && /Sending a code/.test(await p.textContent('#auth-msg')), 'code step shows at once with "Sending…" (' + (Date.now() - t0) + ' ms)');
  ok(await p.evaluate(() => document.activeElement.id) === 'f-code', 'code box gets focus');
  const attrs = await p.$eval('#f-code', (el) => [el.placeholder, el.autocomplete, el.inputMode]);
  ok(attrs[0] === '' && attrs[1] === 'one-time-code' && attrs[2] === 'numeric', 'no sample code as placeholder; one-time-code autofill, number pad');
  await p.waitForFunction(() => /We sent a code to/.test(document.getElementById('auth-msg').textContent));
  ok(/me@example\.com/.test(await p.textContent('#auth-msg')), 'email trimmed and lower-cased');
  ok(await p.$eval('#resend', (el) => el.disabled && /Resend in \d+s/.test(el.textContent)), 'resend waits with a countdown');

  // reload (e.g. after switching to Mail) keeps the code step
  await p.reload(); await p.waitForSelector('#f-code');
  ok(/We sent a code to/.test(await p.textContent('#auth-msg')), 'reload keeps you on the code step');

  // wrong code: clear message that stays
  await p.fill('#f-code', '12');
  await p.click('[data-a=verifyCode]');
  ok(/6-digit code/.test(await p.textContent('.err')), 'short code: asks for 6 digits');
  await p.fill('#f-code', '111111'); // auto-submits at 6 digits
  await p.waitForSelector('.err:has-text("wrong or has expired")');
  await wait(2500);
  ok(await p.locator('.err').count() === 1, 'error stays on screen (not a passing toast)');

  // too many requests: back to email with the reason
  await p.click('[data-a=codeBack]'); mock.otpStatus = 429; mock.otpDelay = 200;
  await p.click('[data-a=sendCode]');
  await p.waitForSelector('#f-email'); await p.waitForSelector('.err');
  ok(/Too many codes/.test(await p.textContent('.err')), 'rate limit explained on the email step');

  // right code signs in
  mock.otpStatus = 200; mock.verifyOk = true;
  await p.click('[data-a=sendCode]'); await p.waitForFunction(() => /We sent/.test((document.getElementById('auth-msg') || {}).textContent || ''));
  await p.fill('#f-code', '424242');
  await p.waitForSelector('#sync-status');
  ok(await p.evaluate(() => !localStorage.getItem('coffee-signin')), 'signed in; draft cleared');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
