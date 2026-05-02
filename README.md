# dathanna

Generates Tailwind-style color shade ramps (25–975) from a single input color.  Built on OKLCH color space with a perceptual toe function for even contrast distribution across shades.

---

## Setup

Requires Node.js (v18+).

```bash
npm install
```

That's it.  The only dependency is [culori](https://culorijs.org/), a color manipulation library used by Tailwind CSS v4 internally.

---

## Quick Start

### Visual preview

```bash
node preview.js
open preview.html
```

This generates an HTML file with color swatches for a demo palette of eight colors.  Open it in any browser to inspect the shades visually.  Click any swatch to copy its hex value.

### Preview with custom colors

```bash
node preview.js "#3b82f6"
node preview.js "#3b82f6" "#ef4444" "#22c55e"
node preview.js --name=brand "#6366f1" --name=accent "#f97316"
```

Without `--name`, colors are labeled `color-1`, `color-2`, etc.

### Comparison test

```bash
node test.js
```

Runs dathanna against Tailwind CSS v4's reference palette values for blue, red, and green.  Shows lightness and chroma deltas at every stop so you can see how closely the generated output tracks the hand-tuned Tailwind palette.

---

## Programmatic Usage

Import the module directly for use in build scripts, design tooling, or application code.

### Generating shades

```js
import { generateShades } from './src/core.js';

const { shades, pinnedStop } = generateShades('#3b82f6');

// shades is an object keyed by stop number:
// {
//   25:  { oklch: { l, c, h }, hex: '#f8fbff', css: 'oklch(...)' },
//   50:  { ... },
//   100: { ... },
//   ...
//   975: { ... },
// }

// pinnedStop tells you which stop the input color was placed at (auto-detected)
```

### Options

```js
// Force the input color to a specific stop instead of auto-detecting
generateShades('#22c55e', { pinStop: 500 });

// Generate without sRGB gamut clamping (for Display P3 output)
generateShades('#3b82f6', { clampToSrgb: false });
```

### Tailwind default palettes

All 26 standard Tailwind v4/v4.2 default color palettes are available as OKLCH data with all 13 stops (25–975) pre-computed:

```js
import { TAILWIND_PALETTES, extrapolateLight, extrapolateDark } from './src/core.js';

// Get a palette's full 13-stop data (25–975)
const blue = TAILWIND_PALETTES.blue;
// { 25: { l, c, h }, 50: { l: 0.97, c: 0.014, h: 254.604 }, ..., 975: { l, c, h } }

// extrapolateLight/extrapolateDark are still available for custom palettes
const shade25 = extrapolateLight(customPalette);   // { l, c, h }
const shade975 = extrapolateDark(customPalette);   // { l, c, h }
```

Available palettes: red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose, slate, gray, zinc, neutral, stone, taupe, mauve, mist, olive.

To browse all palettes visually with their generated 25/975 shades:

```bash
npm run shades
# or just: open tailwind-shades.html
```

### Tailwind CSS v4 output

```js
import { toTailwindCSS } from './src/core.js';

const css = toTailwindCSS('brand', '#3b82f6');
// Returns a ready-to-paste @theme block:
// @theme {
//   --color-brand-25: oklch(...);
//   --color-brand-50: oklch(...);
//   ...
//   --color-brand-975: oklch(...);
// }

// Use hex values instead of OKLCH:
const hexCss = toTailwindCSS('brand', '#3b82f6', { format: 'hex' });
// @theme {
//   --color-brand-25: #f8fbff;
//   --color-brand-50: #eff6ff;
//   ...
//   --color-brand-975: #121b2d;
// }

// Standard Tailwind stops only (50–950, no 25/975):
const standardCss = toTailwindCSS('brand', '#3b82f6', { extendedStops: false });

// Hex values with standard stops:
const hexStandard = toTailwindCSS('brand', '#3b82f6', { format: 'hex', extendedStops: false });

// Include contrast variables for text/icons on each shade:
const withOnColors = toTailwindCSS('brand', '#3b82f6', { onColors: true });
// Adds: --color-on-brand-500: #ffffff; (white on dark shades, black on light)

// Custom on-color values (hex, CSS variables, or any valid CSS value):
const customOnColors = toTailwindCSS('brand', '#3b82f6', {
  onColors: { light: 'var(--color-text-inverse)', dark: 'var(--color-text-primary)' }
});

// Use a Tailwind palette name instead of generating from a color:
const baseCss = toTailwindCSS('base', 'slate');
// Outputs the stored slate palette data as CSS variables
```

### Brand palette generation

Generate a complete brand color package from a single input color — brand shades, a matched neutral base palette, and per-shade contrast decisions:

```js
import { generateBrandPalette } from './src/core.js';

const palette = generateBrandPalette('#3b82f6');
// {
//   brand:         { 25: '#f8fbff', 50: '#eff6ff', ..., 975: '#121b2d' },
//   base:          { 25: '#f9f9fb', 50: '#f1f5f9', ..., 975: '#0c1220' },
//   brandContrast: { 25: 'light', 50: 'light', ..., 900: 'dark', 975: 'dark' },
//   baseSource:    'slate',
//   pinnedStop:    500,
// }
```

- **`brand`** — 13 hex shades generated from the input color
- **`base`** — 13 hex shades from the closest Tailwind neutral palette
- **`brandContrast`** — `'light'` (use dark text) or `'dark'` (use light text) for each brand shade
- **`baseSource`** — which neutral was selected (e.g. `'slate'`, `'stone'`)
- **`pinnedStop`** — which stop the input color maps to

### Neutral matching

Find the closest Tailwind neutral palette for any color:

```js
import { matchNeutral } from './src/core.js';

const { name, palette } = matchNeutral('#3b82f6');
// name: 'slate'
// palette: { 25: { l, c, h }, 50: { l, c, h }, ..., 975: { l, c, h } }
```

The 9 neutral candidates: neutral, taupe, stone, olive, mist, slate, gray, zinc, mauve.

### Contrast mode

Determine whether a color needs light or dark text:

```js
import { getContrastMode } from './src/core.js';

getContrastMode('#3b82f6');  // 'dark'  (L < 0.725, use light text)
getContrastMode('#1e3a5f');  // 'dark'  (L < 0.725, use light text)
```

---

## Shade Stops

The generator produces 13 stops:

| Stop | Purpose |
| --- | --- |
| 25 | Near-white tint (extended, not in standard Tailwind) |
| 50 | Lightest standard shade |
| 100–400 | Light range |
| 500 | Mid-tone (typical base color placement) |
| 600–900 | Dark range |
| 950 | Darkest standard shade |
| 975 | Near-black shade (extended, not in standard Tailwind) |

Stops 25 and 975 are custom additions that provide a subtle off-white and off-black with a hint of the color's hue—useful for backgrounds and deep shadows where the standard 50/950 stops feel too saturated.

---

## How It Works

### Color space

All generation happens in OKLCH (Oklab's cylindrical form), which separates lightness, chroma, and hue into independent channels.  This means adjusting lightness doesn't cause hue shifts, and the perceptual spacing between shades is even.

### Toe function

Raw OKLCH lightness doesn't map to contrast the way designers expect—the dark end feels compressed.  The generator applies a "toe function" (from Björn Ottosson, modified by facelessuser) that remaps lightness values to better approximate CIE Lab's contrast behavior.  This is the same insight behind Google's HCT color space, but achieved with a simple math function instead of an expensive color model.

### Chroma curve

Chroma follows a bell-shaped curve: low at the extremes (near-white and near-black shades are naturally desaturated), peaking in the 400–600 range.  The peak can exceed the input color's chroma, matching Tailwind's behavior where mid-dark shades are often more vivid than the 500 shade.

### Hue shift

Subtle hue shifts are applied at the light and dark extremes, varying by hue region.  Warm colors shift slightly cooler in dark shades; cool colors shift slightly warmer.  Maximum shift is about 6° at the extremes.

### Gamut mapping

By default, every shade is clamped to the sRGB gamut by reducing chroma while preserving lightness and hue.  Pass `clampToSrgb: false` to generate P3-gamut colors for native apps.

---

## Tuning Guide

### Interactive tuner

The fastest way to tune parameters is the browser-based tuner:

```bash
npm run tuner
# or just: open tuner.html
```

This opens a self-contained HTML file (no build step, loads culori from CDN) with all generation parameters exposed as sliders.  Changes update color ramps in real time.

A sticky header at the top provides navigation between modes, along with **Focus Mode**, **Reset All**, and **Export Config** buttons.  Reset All and Export Config are disabled when no parameters have been modified.

#### Compare mode (default)

The default view evaluates dathanna's output against palettes from other tools.  Paste a Tailwind v3 or v4 palette into the collapsible **Palette Input** panel:

```css
/* Tailwind v4 */
--color-brand-50: #fafafa;
--color-brand-100: #f5f5f5;
...
```

```js
/* Tailwind v3 */
'50': '#fafafa',
'100': '#f5f5f5',
...
```

The format is auto-detected and the input panel auto-collapses after a valid palette is parsed.  The reference palette appears above dathanna's generated output, aligned at the shared 50–950 stops (dathanna's extended 25 and 975 stops extend beyond).  Click any reference swatch to use that color as the generation input, or enter a hex value manually.

Each dathanna swatch shows lightness (L) and chroma (C) deltas vs. the reference, color-coded green/yellow/red by magnitude.

#### Tuning mode

Switch to Tuning mode to view multiple color ramps simultaneously (blue, red, green, amber by default).  You can add/remove colors or load a demo palette.  All ramps update together when you adjust any parameter, so you can see how a change affects warm, cool, and neutral hues at once.

#### Parameter panels

Four collapsible parameter panels sit below the palette output.  Each panel header has an info tooltip (ⓘ) explaining what its parameters control.  Every parameter has a slider, a direct-entry number field, left/right step buttons (◄►), and an individual reset button (↺) that is disabled when the parameter matches its default value.

| Panel | Parameters | What they control |
| --- | --- | --- |
| Toe Function | K1, K2 | How perceptual tone maps to OKLCH lightness.  Affects overall contrast distribution. |
| Chroma Curve | Bell exponent, peak multiplier, min ratio | Shape of the chroma bell curve.  Controls saturation intensity across the ramp. |
| Hue Shift | 6 hue-region sliders, ramp exponent | Subtle hue adjustments at light/dark extremes, per hue family. |
| Tone Targets | 13 per-stop sliders (25–975) | Exact perceptual lightness target for each shade stop.  Laid out column-first (top-to-bottom, then left-to-right). |

#### Focus Mode

Toggle **Focus Mode** (header button or press **f**) to hide all swatch text for a pure color-only comparison.

#### Exporting parameters

Once you're happy with the tuning, click **Export Config** to copy the current parameter values to clipboard.  The output is formatted as JS code ready to paste into `src/core.js`:

```js
const K1 = 0.173;
const K2 = 0.004;

const bell = Math.sin(t * Math.PI) ** 0.65;
const peakMultiplier = 1.20;
const minRatio = 0.20;

const TONE_TARGETS = {
  25:  0.985,
  50:  0.965,
  ...
};
```

### Parameter reference

The core generation logic is in `src/core.js`.  For details on what each parameter controls:

- **Tone targets** (`TONE_TARGETS`) — Most impactful.  Maps each stop to a perceptual lightness value (0–1).  Small changes (0.01–0.02) have visible effects.
- **Toe function** (`K1`, `K2`) — Controls the perceptual-to-OKLCH lightness mapping.  Current values approximate CIE Lab contrast.  Ottosson's originals (`K1=0.206`, `K2=0.03`) produce slightly less contrast in the dark range.
- **Chroma curve** (in `getChroma`) — Bell exponent shapes the curve (lower = wider, higher = peakier).  Peak multiplier allows mid-tones to exceed base chroma.  Min ratio sets the chroma floor at extremes.
- **Hue shifts** (in `getHue`) — Per-region shift table (max ~6° at extremes).  Set any region to 0 to disable.  Ramp exponent controls how quickly the shift increases away from the 500 midpoint.

---

## Architecture

```
dathanna/
  package.json           # Project config, culori dependency
  src/
    core.js              # All generation logic, palette data, exports
  test.js                # Comparison tests and API validation
  preview.js             # Generates preview.html from CLI args or demo colors
  preview.html           # Generated output (not checked in)
  tuner.html             # Interactive parameter tuner (open directly in browser)
  tailwind-shades.html   # Tailwind default palettes with generated 25/975 shades
```

The intent is for `src/core.js` to eventually be extracted into a larger application.  It has no side effects, no filesystem access, and no CLI concerns—just pure functions that take a color string and return shade data.

---

## References

Sources that informed the approach:

- [Björn Ottosson — A perceptual color space for image processing](https://bottosson.github.io/posts/oklab/) — The OKLCH color space
- [Björn Ottosson — Okhsl and Okhsv color picker](https://bottosson.github.io/posts/colorpicker/#intermission---a-new-lightness-estimate-for-oklab) — The toe function for lightness remapping
- [facelessuser — Exploring Tonal Palettes](https://gist.github.com/facelessuser/0235cb0fecc35c4e06a8195d5e18947b) — Modified toe constants, HCT vs. OKLCH comparison
- [Tailwind CSS v4 — Colors documentation](https://tailwindcss.com/docs/customizing-colors) — Reference palette values
- [Evil Martians — Better dynamic themes in Tailwind with OKLCH](https://evilmartians.com/chronicles/better-dynamic-themes-in-tailwind-with-oklch-color-magic) — Practical OKLCH palette generation patterns
- [culori documentation](https://culorijs.org/) — Color library API
