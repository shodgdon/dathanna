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

The core generation logic is in `src/core.js`.  Here are the specific knobs to adjust and what they control.

### Lightness targets (`TONE_TARGETS`)

This is the most impactful thing to change.  It's an object mapping each stop number to a target "tone" value on a 0–1 perceptual scale.  Higher values are lighter.

```js
const TONE_TARGETS = {
  25:  0.985,
  50:  0.965,
  // ...
  950: 0.160,
  975: 0.100,
};
```

If a specific stop feels too light or too dark, adjust its tone value and regenerate the preview.  Small changes (0.01–0.02) have visible effects.

### Toe function constants (`K1`, `K2`)

These control how the perceptual tone scale maps to actual OKLCH lightness.  The current values (`K1=0.173`, `K2=0.004`) were chosen to approximate CIE Lab contrast behavior.  Ottosson's original values (`K1=0.206`, `K2=0.03`) are also reasonable—they produce slightly less contrast in the dark range.

You probably don't need to change these unless you want to fundamentally alter the contrast distribution.

### Chroma curve (in `getChroma`)

Three parameters control the chroma bell curve:

```js
const bell = Math.sin(t * Math.PI) ** 0.65;  // Exponent: lower = wider bell, higher = sharper peak
const peakMultiplier = 1.20;                   // How much chroma can exceed the base color's chroma
const minRatio = 0.20;                         // Minimum chroma ratio at the extremes (25/975)
```

If shades feel oversaturated in the midtones, lower `peakMultiplier`.  If the light/dark ends feel too gray, raise `minRatio`.  If the curve feels too flat or too peaked, adjust the exponent.

### Hue shifts (in `getHue`)

A lookup table applies per-region hue shifts.  Each entry is the maximum shift in degrees for that hue range:

```js
if (baseHue >= 0 && baseHue < 60)        shiftDeg = -4;  // Reds
else if (baseHue >= 60 && baseHue < 120)  shiftDeg = -6;  // Yellows/oranges
// ...
```

Set any region to `0` to disable hue shifting for that range, or increase the values if the dark shades look too monotone.  The `1.2` exponent on the magnitude curve controls how quickly the shift ramps up away from the 500 midpoint.

### Tuning workflow

1. Edit a parameter in `src/core.js`
2. Run `node preview.js` (or `node preview.js "#yourcolor"`)
3. Refresh `preview.html` in the browser
4. Compare against Tailwind's reference values with `node test.js`
5. Repeat

---

## Architecture

```
dathanna/
  package.json         # Project config, culori dependency
  src/
    core.js            # All generation logic, exports generateShades() and toTailwindCSS()
  test.js              # Comparison against Tailwind v4 reference values
  preview.js           # Generates preview.html from CLI args or demo colors
  preview.html         # Generated output (not checked in)
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
