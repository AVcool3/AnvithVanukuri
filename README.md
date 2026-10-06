# Anvith Vanukuri — personal site

A static, hand-built portfolio: `index.html`, `styles.css`, `script.js`, and `assets/`.
No build step, no dependencies. Serve the folder and open it:

```
python3 -m http.server 8000
```

## The idea

The site is styled as an "observatory notebook" — warm paper and graphite ink in light
mode, warm charcoal in dark mode (follows your OS). It leans on the through-line in
the resume: measuring double-star orbits, then measuring risk and position sizes.

Calm graphics, all drawn in code:

- a slow double-star orbit in the hero (SVG + CSS animation)
- an efficient-frontier curve that draws itself as you scroll (SVG, `stroke-dashoffset`)
- a sparse field of specks on a `<canvas>` that parallaxes gently behind the page

Scrollable parts:

- **Ledger** (experience) scrolls sideways — drag, arrow buttons, or arrow keys
- **Margins** (skills / involvement / interests) drift as three slow marquee lines
- every section fades up as it enters view; the thin bar at the top tracks progress

All motion respects `prefers-reduced-motion`.

## Editing content

Everything that isn't static copy comes from the `profile` object at the top of
`script.js`. Each section has a `render*()` function right below it that turns the
data into DOM — if you've used React, think `profile` = props and each `render*()` =
a component.

| Section        | Edit                                      |
| -------------- | ----------------------------------------- |
| Hero           | `profile.name / location / program / statement`, `profile.socials` (`hero: true`) |
| 01 Notes       | `profile.about` (array of paragraphs), `profile.marginNote` |
| 02 Now         | copy is in `index.html` under `<section id="now">` |
| 03 Ledger      | `profile.experiences` (sorted newest → oldest automatically) |
| 04 Papers      | `profile.publications` (sorted newest first; `glyph: "stars"` or `"frontier"`) |
| 05 Transcript  | `profile.courses` |
| 06 Margins     | `profile.skills / activities / interests` |
| 07 Builds      | `profile.projects` |
| 08 Hello       | `profile.socials` |

Colors, fonts, and spacing all live in the `:root` block at the top of `styles.css`.
The orbit speed is `animation: orbit 48s` in `styles.css` (match the caption in `index.html`).
