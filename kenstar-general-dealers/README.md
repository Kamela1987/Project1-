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
- `templates/` — reusable ATS CV and cover letter Word templates for client work (see `templates/README.md`)

## Before publishing

1. Replace the placeholder email (`info@kenstargeneraldealers.com`) and phone/WhatsApp number (`+260 XXX XXX XXX`) in `index.html` with your real contact details.
2. Fill in real prices on the pricing cards, or keep "Contact for price" if you prefer quoting per client.
3. Host it: any static host works (GitHub Pages, Netlify, Vercel, or a shared hosting plan).

## Contact form (already wired up)

The contact form submits to [FormSubmit.co](https://formsubmit.co/), which forwards inquiries to **monzemove@gmail.com** — no backend or signup required.

- **One-time activation:** the very first submission (from you, as a test) triggers a confirmation email from FormSubmit to monzemove@gmail.com. Click the "Activate Form" link in that email once — after that, every future submission is delivered straight to the inbox with no extra step.
- The page uses FormSubmit's AJAX endpoint (`script.js`) so visitors see an inline "message sent" confirmation without leaving the page. If that request is ever blocked (e.g. by a browser extension), it automatically falls back to a normal form submission to the same address.
- To send inquiries to a different or additional address later, update the email in the form's `action` attribute in `index.html` and the `AJAX_ENDPOINT` constant in `script.js`.
- To route this to your own domain email later (e.g. `info@kenstargeneraldealers.com`) instead of a Gmail address, just swap the address in those same two places — FormSubmit works with any inbox.

## Local preview

Open `index.html` directly in a browser, or serve the folder with any static file server, e.g.:

```
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.
