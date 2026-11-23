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
| `js/main.js` | What the scene shows at each scroll position, plus tabs, the chat and the form |
| `assets/showcase/` | Captures of id-indetails.com used in the websites section |

The page loads three.js, the fonts and the icon set from public CDNs.

## Before publishing

- Replace the placeholder contact details (`sales@example.com` and the phone number) in
  `index.html` and `js/main.js`.
- All figures and names inside the mock screens are sample data.
