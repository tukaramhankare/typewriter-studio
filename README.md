# Typewriter Studio

Turn any text into a typewriter animation — style it, time it, export it. 100% offline, runs entirely in your browser, and nothing you type is ever uploaded anywhere.

**[▶ Live Demo](https://tukaramhankare.github.io/typewriter-studio/)**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
![No dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![Offline first](https://img.shields.io/badge/offline-first-orange)

## Features

- **Multi-phrase rotation** — animate a single block of text, or rotate through multiple phrases (one per line)
- **Full timing control** — typing speed, deleting speed, pause after typed/deleted, natural jitter, punctuation-aware pausing
- **Style controls** — font, size, alignment, text/background/cursor color, and four built-in theme presets (Dark, Light, Terminal, Neon)
- **Cursor customization** — bar, underscore, block, or a custom character, with adjustable blink speed
- **One-click export** — generates a self-contained embeddable snippet (HTML + CSS + JS, zero dependencies) that you can paste into any other page, or download directly
- **Persistence** — your text and settings are saved automatically in your own browser via `localStorage`; nothing is ever sent to a server
- **Accessibility** — instant mode for `prefers-reduced-motion`, a screen-reader-friendly full-text region
- **Zero dependencies** — vanilla HTML, CSS, and JavaScript; no build step, no `npm install`, no framework

## Getting Started

No build step required.

```bash
git clone https://github.com/tukaramhankare/typewriter-studio.git
cd typewriter-studio
```

Then just open `index.html` in a browser, or serve it locally:

```bash
python3 -m http.server 8000
```

and visit `http://localhost:8000`.

## Usage

1. Type or paste your text — one phrase per line if you want rotating mode
2. Adjust style, timing, and cursor to taste
3. Hit **Play** to preview the animation
4. Click **Generate embed code** to get a self-contained snippet for pasting into any other page

## Project Structure

```
typewriter-studio/
├── index.html   # markup and controls
├── styles.css   # dark, terracotta-accented console theme
├── app.js       # typing state machine, persistence, export logic
└── LICENSE
```

## Browser Support

Works in any modern desktop or mobile browser (Chrome, Firefox, Safari, Edge). No polyfills or plugins required.

## License

Licensed under the [Apache License 2.0](LICENSE).

## Author

**Tukaram Hankare** — Farmer, Coder & Web Developer, Solapur, Maharashtra, India
[GitHub](https://github.com/tukaramhankare) · [Project Showcase](https://tukaramhankare.github.io/master-package/)
