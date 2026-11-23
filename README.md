# Hourline: the sales site

A static landing page that presents Hourline, the system for firms that design and build.
Plain HTML, CSS and JavaScript. There is no build step and no backend.

## Run it locally

Open `index.html` in a browser, or serve the folder:

```
python -m http.server 4173
```

Then open http://localhost:4173.

## What is in here

| Path | What it is |
|---|---|
| `index.html` | The page: hero, walkthrough, modules, websites, Proton, roles, security, contact |
| `css/styles.css` | All styles. One dark theme |
| `js/scene.js` | The 3D scene (three.js): the logo and its ring, the building, the Proton orb |
| `js/globe.js` | The spinning dotted globe drawn over the home page in the websites section |
| `js/main.js` | What the scene shows at each scroll position, plus tabs, the chat and the form |
| `assets/showcase/` | Page images for the websites section. `home.webp` is a real capture; the others are samples |
| `tools/mock-sites.html` | The invented portfolio pages the sample images are captured from |
| `tools/capture.mjs` | Re-captures the sample pages: `node tools/capture.mjs` (needs Node 22+ and Chrome) |

The page loads three.js, the fonts and the icon set from public CDNs.

## Before publishing

- Replace the placeholder contact details (`sales@example.com` and the phone number) in
  `index.html` and `js/main.js`.
- All figures and names inside the mock screens are sample data.
