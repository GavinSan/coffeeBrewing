'use strict';
/* Cloud sync with Supabase. One row per account holds the whole app state as JSON.
   Every change is saved on the device first (app.js save()), then uploaded when
   there's a connection, so the app keeps working offline.

   Loaded before app.js; it uses app.js globals (S, KEY, blank, render, rerender, toast)
   only from functions that run after app.js has loaded. */
window.Cloud = (function () {
  const cfg = window.COFFEE_CLOUD || {};
  const META = 'coffee-sync-v1'; // { uid, base, dirty, at }: who this device last synced as, and the cloud version it has
  const TABLE = 'brew_state';
  const LISTS = ['beans', 'brews', 'grinders', 'recipes', 'gear'];
  const SETS = ['owned', 'filters', 'flavors', 'processes'];

  let sb = null, user = null, busy = false, again = false, timer = null, edits = 0;
  let state = 'idle', err = '';
  let meta = readMeta();

  function readMeta() { try { return JSON.parse(localStorage.getItem(META)) || {}; } catch (e) { return {}; } }
  function writeMeta() { try { localStorage.setItem(META, JSON.stringify(meta)); } catch (e) { /* storage full or blocked */ } }
  function enabled() { return !!(cfg.url && cfg.key && window.supabase); }
  // screens that show the account (the Account page, and the avatar on each tab)
  function showsAccount() { return /^#?\/?(account|brew|beans|journal|gear)?$/.test(location.hash); }

  function setState(s, e) {
    state = s; err = e || '';
    const el = document.getElementById('sync-status');
    if (el) el.textContent = status();
  }
  function status() {
    if (state === 'syncing') return 'Syncing…';
    if (state === 'offline') return 'Offline · changes upload when you’re back online';
    if (state === 'error') return 'Couldn’t sync · ' + err;
    if (meta.dirty) return 'Changes waiting to upload';
    if (meta.at && meta.uid === (user && user.id)) {
      const m = Math.round((Date.now() - meta.at) / 60000);
      return 'Synced ' + (m < 1 ? 'just now' : m < 60 ? m + ' min ago' : new Date(meta.at).toLocaleString());
    }
    return 'Not synced yet';
  }

  const isEmpty = (d) => LISTS.every((k) => !(d[k] && d[k].length));

  // Keep every item from both sides; when the same item is on both, `win` wins.
  function merge(win, lose) {
    const out = Object.assign(blank(), lose, win);
    LISTS.forEach((k) => {
      const a = win[k] || [], ids = new Set(a.map((x) => x.id));
      out[k] = a.concat((lose[k] || []).filter((x) => !ids.has(x.id)));
    });
    out.brews.sort((x, y) => (x.at || 0) - (y.at || 0));
    SETS.forEach((k) => { out[k] = Array.from(new Set((win[k] || []).concat(lose[k] || []))); });
    out.updatedAt = Date.now();
    return out;
  }

  // Replace local state without counting it as a local edit
  function apply(data) {
    S = migrate(Object.assign(blank(), data), data);
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
    // don't redraw screens holding a draft or a running timer
    if (!/^#\/?(timer|bean\/new|edit\/|grinder\/|custom|rate|method|recipe)/.test(location.hash)) rerender();
  }

  // Called by app.js save() after every local change
  function changed() {
    edits++;
    if (!meta.dirty) { meta.dirty = true; writeMeta(); }
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(sync, 1500);
  }

  async function round() {
    const e0 = edits;
    const got = await sb.from(TABLE).select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (got.error) throw got.error;
    const row = got.data;
    if (edits !== e0) return true; // edited while we were fetching: start over with the newer state

    const first = meta.uid !== user.id;
    let next = null, push = false;
    if (!row) push = true;                                              // empty account: upload this device
    else if (first) {                                                   // first sign-in on this device
      if (isEmpty(S)) next = row.data; else { next = merge(row.data, S); push = true; }
    }
    else if (row.updated_at === meta.base) push = !!meta.dirty;         // only this device changed (or nothing did)
    else if (!meta.dirty) next = row.data;                              // only the cloud changed
    else { next = merge(S, row.data); push = true; }                    // both changed: keep both, this device wins ties

    if (next) apply(next);
    meta.uid = user.id;

    if (!push) {
      meta.base = row.updated_at; meta.dirty = false; meta.at = Date.now(); writeMeta();
      return false;
    }

    S.updatedAt = Math.max(S.updatedAt || 0, row ? row.updated_at + 1 : 1);
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
    const e1 = edits;
    const body = { data: JSON.parse(JSON.stringify(S)), updated_at: S.updatedAt };
    // Only overwrite the version we read, so a write from another device in between isn't lost
    const res = row
      ? await sb.from(TABLE).update(body).eq('user_id', user.id).eq('updated_at', row.updated_at).select('updated_at')
      : await sb.from(TABLE).insert(Object.assign({ user_id: user.id }, body)).select('updated_at');
    if (res.error) {
      if (res.error.code === '23505') return true; // another device created the row first
      throw res.error;
    }
    if (!res.data || !res.data.length) return true; // another device wrote first: merge with it
    meta.base = body.updated_at; meta.at = Date.now();
    if (edits === e1) meta.dirty = false;
    writeMeta();
    return edits !== e1;
  }

  async function sync() {
    if (!user) return;
    if (!navigator.onLine) { setState('offline'); return; }
    if (busy) { again = true; return; }
    busy = true; clearTimeout(timer);
    setState('syncing');
    try {
      let n = 0;
      do { again = false; if (await round()) again = true; } while (again && ++n < 4);
      setState('idle');
    } catch (e) {
      if (!navigator.onLine || /fetch|network/i.test(String(e && e.message))) setState('offline');
      else setState('error', (e && e.message) || 'unknown error');
    } finally {
      busy = false;
    }
  }

  function init() {
    if (!enabled()) return;
    sb = window.supabase.createClient(cfg.url, cfg.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'coffee-auth' }
    });
    sb.auth.onAuthStateChange((ev, session) => {
      const u = session ? session.user : null;
      const was = user && user.id;
      user = u;
      if ((u && u.id) === was) return;
      if (showsAccount()) rerender();
      // don't call Supabase from inside this callback; it can deadlock the auth lock
      if (u) setTimeout(sync, 0);
    });
    window.addEventListener('online', () => sync());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  }

  async function sendCode(email) {
    const r = await sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
    if (r.error) throw r.error;
  }
  async function verify(email, token) {
    const r = await sb.auth.verifyOtp({ email: email, token: token, type: 'email' });
    if (r.error) throw r.error;
  }
  async function signOut() {
    await sb.auth.signOut();
    meta = {}; writeMeta(); // the log stays on this device; next sign-in merges it with that account
  }

  return {
    init: init, enabled: enabled, changed: changed, sync: sync, status: status,
    user: () => user, sendCode: sendCode, verify: verify, signOut: signOut,
    _merge: merge // for tests
  };
})();
