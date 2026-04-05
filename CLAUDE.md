# dathanna

Generate Tailwind-style color shade ramps from a single input color using OKLCH color space with perceptually-uniform lightness distribution.

## Commands

- `npm test` — run test suite
- `npm run preview` — CLI preview of color ramps
- `npm run tuner` — open interactive HTML tuner

## Project structure

- `src/core.js` — all library logic (single-file library)
- `test.js` — test suite
- `tuner.html` — interactive parameter tuner (browser-based)
- `preview.js` — CLI preview tool

## Conventions

- Plain JavaScript, ES modules (`"type": "module"`)
- Node.js 18+ target
- Single production dependency: `culori`. Do not add new dependencies without explicit approval.

## Reference (read on demand, not upfront)

- Programmatic API & options → README.md "Programmatic Usage"
- Tuning parameters & what they control → README.md "Tuning Guide"
- How generation works (OKLCH, toe function, chroma curve) → README.md "How It Works"

## Maintenance

- When adding commands, files, or conventions, update this file.
