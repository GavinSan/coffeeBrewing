# Coffee Brewing

A bean-first brew log, built as an installable PWA. No build step — plain HTML, CSS and JS.

- **Beans** — name, roaster, farm, price, weight, roast date, process, roast level, flavours. Cost per gram is worked out for you, and each bag shows how much is left.
- **Brew** — pick a method, dripper and filter, then a recipe (4:6, one pour, ten pour, Switch, or your own). Dose, ratio, temperature and grind remember your last brew.
- **Timer** — 3 or 5 second countdown, pour-by-pour targets, and a coffee level that rises as you pour.
- **Taste** — rate after you drink: six-point hexagon (aroma, acidity, sweet, body, bitter, finish), stars, and what to change next time.
- **Stats** — cost per gram and per cup, how long a bag lasted, and a roaster comparison.
- **Gear** — grinders (burr type, usual setting) and the drippers you own.

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
