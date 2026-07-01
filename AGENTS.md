# AGENTS.md

## Cursor Cloud specific instructions

This repository is a fully static personal portfolio website. There is no package
manager, build step, dependency manifest, lint config, or test suite — it is just
`index.html`, `styles.css`, `script.js`, and the `assets/` directory.

### Running the site (development)

Serve the directory with any static file server and open it in a browser. The page
content in the Coursework, Experience, Publications, and Projects sections is injected at runtime by
`script.js`, so opening the file via `file://` works, but serving over HTTP is preferred:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000/index.html`.

### Lint / test / build

There are none. There is nothing to install, build, or test. Editing content is done
directly in the `profile` object near the top of `script.js` (see `README.md`).
