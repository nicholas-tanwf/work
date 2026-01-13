# Our Weather

A mobile-first, accessible "today's weather" page.

## Run

Option A (quick): open `index.html` in your browser.

Option B (recommended): run a local static server in this folder.

```bash
cd "our weather"
npx serve
```

## Notes

- Uses Open‑Meteo (no API key required).
- Tries geolocation first; if blocked, falls back to a default location and you can search a city.
