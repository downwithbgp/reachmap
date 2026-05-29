# ReachMap — Deployment

## Target

`https://reachmap.vadimpetrov.com`

## Build

```bash
cd web/app
npm install
npm run build     # → dist/
```

Output:
- `dist/index.html` — 1.3 KB
- `dist/assets/index-*.js` — ~900 KB (270 KB gzipped)
- `dist/data/` — static JSON artifacts

## Cloudflare Pages

### Setup

1. Connect Git repo to Cloudflare Pages
2. Configure build:
   - **Build command:** `cd web/app && npm install && npm run build`
   - **Output directory:** `web/app/dist`
3. Custom domain: `reachmap.vadimpetrov.com`
   - Add CNAME record: `reachmap.vadimpetrov.com → reachmap.pages.dev`

### Environment

No environment variables required. All data is static JSON in `public/data/`.

## Static hosting (nginx)

```nginx
server {
    listen 80;
    server_name reachmap.vadimpetrov.com;
    root /var/www/reachmap;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Deploy:
```bash
rsync -avz web/app/dist/ user@server:/var/www/reachmap/
```

## Post-deploy smoke test

- [ ] Page loads at `https://reachmap.vadimpetrov.com`
- [ ] March 2026 case loads by default
- [ ] Hilbert fingerprint renders (compact national IPv4 view)
- [ ] deck.gl map renders (collector points + Cuba outline)
- [ ] Case selector works (March 2026 / May 2026 / July 2021)
- [ ] Timeline buttons work (before / event / after)
- [ ] Selecting a prefix updates details panel
- [ ] Provenance/disclaimer visible in sidebar
- [ ] About/Method section present
- [ ] No console errors
- [ ] No requests to localhost or 10.0.3.200
- [ ] Social preview: title and description appear in link unfurls

## Data refresh

To update the data artifacts:
```bash
./scripts/process_cuba.sh
cp -r data/processed/countries/CU/* web/app/public/data/CU/
cd web/app && npm run build
```
