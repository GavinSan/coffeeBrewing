# Coffee Brewing

A bean-first brew log, built as an installable PWA. No build step — plain HTML, CSS and JS.

- **Brew** — home screen. New users are asked to add a bag; after that it shows the bag you're on with your last cup and any "grind finer next time" note, so a brew is one tap. Bags you've brewed before skip straight to the recipe.
- **Beans** — your shelf: search, Open / Finished / All, sort (recently brewed, rating, freshest, cost), 4★+ filter, group by roaster. Each bag has a page with grams left, best cup ("brew it the same way"), average taste and every brew.
- **New bag** — roaster, origin and farm suggest what you've typed before; "bought one of these again?" copies a previous bag. Roast is a slider, flavours are grouped and searchable, price and weight take numbers only.
- **Timer** — the water target rises through each pour at a steady kettle rate (5 g/s), then waits and counts down to the next pour.
- **Journal** — 30 days / 90 days / year / all: cups, spend, cost per cup and rating against the previous period, cups per day/week/month, a sortable breakdown by bean, roaster, origin, process or brewer, and a filterable brew log.
- **Gear** — grinders, the drippers you own, filters. Account and backup are under the person icon.

## Run locally

```
python3 -m http.server
```

Then open http://localhost:8000.

## Deploy

Serve the folder as static files (GitHub Pages: Settings → Pages → Deploy from branch → `main` / root).
After changing files, bump `CACHE` in `sw.js` so installed copies pick up the update.

## Data

Everything is saved in the browser's `localStorage` first, so the app works offline. Gear → Export makes a JSON backup.

### Cloud sync (Supabase)

Sign in under Gear → Account (email code, no password) to keep the log in Supabase and use the same data on every device, including a future App Store build.

- `config.js` holds the project URL and publishable (anon) key. With an empty key the app runs on-device only.
- `supabase/schema.sql` creates the `brew_state` table (one JSON row per account, row level security on). Run it once in the Supabase SQL Editor.
- `sync.js` uploads changes about 1.5 s after each save and pulls when the app comes back to the foreground. If two devices changed while apart, both sets of items are kept; the device syncing last wins when it edited the same item.
- In Supabase → Authentication → Emails, add `{{ .Token }}` to the **Magic Link** and **Confirm signup** templates so the email shows the code.
- `vendor/supabase.js` is `@supabase/supabase-js` 2.118.0 (MIT), vendored so there's no build step or CDN.
