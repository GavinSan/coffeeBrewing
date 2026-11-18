# Coffee Brewing

Installable PWA, plain HTML/CSS/JS with no build step: `index.html`, `app.js` (all views and actions), `styles.css`, `sync.js` (Supabase cloud sync), `sw.js` (offline cache). Data lives in `localStorage` (`coffee-pwa-v1`) and syncs as one JSON row per account (`supabase/schema.sql`).

## Shipping (the owner's standing instruction)

Ship every change without asking:

1. Commit on the working branch and push it.
2. Open a pull request to `main` (or reuse the open one).
3. Wait for the **CI** check (`npm test`) to pass on the PR. Never merge with a failing or missing check: fix and push again.
4. Merge the PR into `main`. CI runs again on `main` and, only if it passes, deploys to GitHub Pages.

Don't bump `CACHE` in `sw.js` by hand: the deploy stamps it with the commit.

## Tests

```
npm ci
npm test                    # all suites, real Chromium
npm test -- gear.test.js    # one suite
```

`tests/run.js` checks syntax, serves the repo on a free port and runs each `tests/*.test.js`. Screenshots land in `test-results/` (uploaded by CI). Add or update a test with every behaviour change. Tests that use `page.clock` must advance the clock after a navigation, since the hash change only renders when the clock moves.

## Things that bite

- Top-level `const`/`let` in one classic script aren't on `window`: `sync.js` exposes `window.Cloud` on purpose.
- Anything `load()`/`migrate()` calls must be defined above `let S = load()`.
- Old saves must keep loading: change the state shape only together with `migrate()` and a test.
- CSS custom properties on `:root` share one namespace: `--soft` is a colour, easing lives in `--ease` / `--spring`. Reusing a name silently turns every `var()` user transparent (`tests/styles.test.js` guards this).
- Painted scenes (`scene()` in `app.js`) are original art in a hand-painted style; keep them free of any studio's characters, and keep text and icons plain.
