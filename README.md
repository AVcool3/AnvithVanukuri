# Anvith Vanukuri Personal Website

A responsive personal portfolio built with HTML, CSS, and JavaScript.

## What's included

- Social media/contact links
- Browser-tab favicon logo
- Interactive hero typewriter line
- Short about section
- StudioHone featured product section
- Coursework highlights
- Experience timeline
- Publications and writing highlights
- Skills, activities, and interests pulled from resume details
- Project cards that link to GitHub repositories

## Robust linear solver

The `robust-solve/` folder holds a standalone JavaScript module (`solve`) that
improves on `numpy.linalg.solve` by monitoring the growth factor of Gaussian
elimination and escalating to safer factorizations when needed, plus a React
demo component and a Node test suite. See `robust-solve/README.md`.

## Customize the site

Most content lives in `script.js` inside the `profile` object.

1. Update `profile.summary` and `profile.about`.
2. Update the social links if any profile URLs change.
3. Update the StudioHone section in `index.html` if the product positioning changes.
4. Update the course list, experience entries, publications, skills, activities, interests, and project repositories.
5. Edit `typewriterPhrases` in `script.js` to change the animated hero text.
6. Open `index.html` in a browser to view the site.
