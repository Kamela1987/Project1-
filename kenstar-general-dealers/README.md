# Kenstar General Dealers — Business Website

A static, no-build-step website for Kenstar General Dealers (registered under PACRA, Zambia), offering:

- ATS-optimized & job-aligned CVs
- Cover letters
- Interview preparation notes
- Website design
- Business plans & company profiles

## Files

- `index.html` — page structure and content
- `styles.css` — theme, layout, responsive styles (light/dark aware)
- `script.js` — mobile nav toggle and contact form handling

## Before publishing

1. Replace the placeholder email (`info@kenstargeneraldealers.com`) and phone/WhatsApp number (`+260 XXX XXX XXX`) in `index.html` with your real contact details.
2. Wire the contact form (`script.js`) to a real backend or form service (e.g. Formspree, a serverless function, or an email API) — it currently only shows a confirmation message locally.
3. Fill in real prices on the pricing cards, or keep "Contact for price" if you prefer quoting per client.
4. Host it: any static host works (GitHub Pages, Netlify, Vercel, or a shared hosting plan).

## Local preview

Open `index.html` directly in a browser, or serve the folder with any static file server, e.g.:

```
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.
