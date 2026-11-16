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

Everything is stored in the browser's `localStorage` on the device. Gear → Export makes a JSON backup.
