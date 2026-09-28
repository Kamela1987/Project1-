# SamKen Motors website

A static one-page site for SamKen Motors, a Zambian car dealership importing
vehicles from Namibia (Walvis Bay), South Africa (Durban, Cape Town, Gqeberha,
Johannesburg) and Tanzania (Dar es Salaam), landed and cleared in Zambia.

No build step — it's plain HTML/CSS/JS in `index.html`, `styles.css` and
`script.js`.

## Publish it with GitHub Pages (free hosting)

1. Push this repo to GitHub (already done if you're reading this from GitHub).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. The workflow at `.github/workflows/samken-motors-pages.yml` will build and
   deploy automatically on every push to `main` that touches this folder.
5. Your site will be live at `https://<your-github-username>.github.io/<repo-name>/`.

## Editing content

- Text, sections and links: `index.html`
- Colors/fonts/layout: `styles.css` (navy `--navy-*` and gold `--gold-*`
  variables at the top match the Facebook page branding)
- Mobile nav toggle: `script.js`

## Updating contact details

WhatsApp numbers and links live in `index.html` — search for `wa.me` to find
every button/link. Update the number after `wa.me/` (no `+`, no spaces) to
change where a button points.
