/**
 * dathanna — Core Module
 *
 * Generates Tailwind-style color shade ramps from a single input color.
 * Uses OKLCH color space with a toe function for perceptually-uniform
 * lightness distribution and proper contrast behavior.
 *
 * Based on:
 * - Björn Ottosson's OKLCH and lightness toe function
 * - facelessuser's tonal palette exploration (modified K constants)
 * - Tailwind CSS v4's OKLCH color values as reference targets
 */

import {
  parse,
  oklch,
  formatHex,
  formatCss,
  clampChroma,
  converter,
} from 'culori';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Shade stops — standard Tailwind 50–950 plus extended 25 and 975.
 */
export const STOPS = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950, 975];

/**
 * Toe function constants.
 * Original Ottosson values: K1=0.206, K2=0.03
 * Modified values (from facelessuser's exploration) that better approximate
 * CIE Lab lightness for improved contrast in tonal palettes.
 */
const K1 = 0.173;
const K2 = 0.004;
const K3 = (1.0 + K1) / (1.0 + K2);

/**
 * Target "tone" values for each stop on a 0–1 scale.
 * These represent perceptual lightness targets (CIE Lab-like).
 * The toe function converts these to actual OKLCH L values.
 *
 * Calibrated against Tailwind CSS v4's default palette.
 */
const TONE_TARGETS = {
  25:  0.985,
  50:  0.965,
  100: 0.930,
  200: 0.870,
  300: 0.790,
  400: 0.700,
  500: 0.590,
  600: 0.490,
  700: 0.390,
  800: 0.310,
  900: 0.240,
  950: 0.160,
  975: 0.100,
};

// ---------------------------------------------------------------------------
// Toe function
// ---------------------------------------------------------------------------

/**
 * Inverse toe function — converts a perceptual tone (CIE Lab-like scale)
 * to an OKLCH lightness value.
 *
 * @param {number} x - Perceptual tone, 0–1
 * @returns {number} OKLCH L value
 */
function toeInv(x) {
  return (x * x + K1 * x) / (K3 * (x + K2));
}

/**
 * Forward toe function — converts OKLCH L back to perceptual tone.
 * Used to determine which shade stop an input color maps to.
 *
 * @param {number} x - OKLCH L value
 * @returns {number} Perceptual tone, 0–1
 */
function toe(x) {
  const k3x = K3 * x;
  // Solve quadratic: t^2 + K1*t - K3*x*t - K3*x*K2 = 0
  // => t^2 + (K1 - K3*x)*t - K3*x*K2 = 0
  const a = 1;
  const b = K1 - k3x;
  const c = -k3x * K2;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

// ---------------------------------------------------------------------------
// Chroma curve
// ---------------------------------------------------------------------------

/**
 * Compute chroma for a given stop based on the base color's chroma.
 * Creates a bell-shaped curve peaking in the mid-range (around 400–600)
 * and tapering toward both extremes.
 *
 * @param {number} baseChroma - The input color's OKLCH chroma
 * @param {number} stop - The shade stop number
 * @returns {number} Target chroma for this stop
 */
function getChroma(baseChroma, stop) {
  if (baseChroma < 0.008) return 0; // effectively achromatic

  // Normalize stop to 0–1 range across our full scale
  const t = (stop - 25) / (975 - 25);

  // Bell curve: peaks around t=0.35–0.5 (roughly stop 400–600), tapers at edges.
  // Tailwind's palette pushes chroma quite hard in the midtones —
  // often exceeding the base color's chroma (e.g. blue-600 has higher C than blue-500).
  // We use a boosted curve that can exceed 1.0x of base chroma in the peak range.
  const bell = Math.sin(t * Math.PI) ** 0.65;

  // Peak boost: Tailwind's mid-range shades often have ~15-25% more chroma
  // than the 500 shade. Allow the curve to exceed base chroma.
  const peakMultiplier = 1.20;
  const minRatio = 0.20;
  const ratio = minRatio + (peakMultiplier - minRatio) * bell;

  return baseChroma * ratio;
}

// ---------------------------------------------------------------------------
// Hue shift
// ---------------------------------------------------------------------------

/**
 * Compute a subtle hue shift for a given stop.
 * Warm colors shift slightly cool in dark shades, cool colors shift
 * slightly warm. This mimics natural color behavior and matches
 * the patterns in Tailwind's hand-tuned palette.
 *
 * @param {number} baseHue - The input color's OKLCH hue (degrees)
 * @param {number} stop - The shade stop number
 * @returns {number} Adjusted hue for this stop
 */
function getHue(baseHue, stop) {
  if (!isFinite(baseHue)) return 0; // achromatic

  // Distance from the midpoint, normalized to -1..+1
  const distance = (stop - 500) / 475;

  // Shift magnitude increases with distance from center
  const magnitude = Math.pow(Math.abs(distance), 1.2);

  // Direction depends on hue region.
  // These shifts are subtle (max ~6° at the extremes).
  let shiftDeg = 0;

  if (baseHue >= 0 && baseHue < 60)        shiftDeg = -4;  // reds: shift cooler in darks
  else if (baseHue >= 60 && baseHue < 120)  shiftDeg = -6;  // yellows/oranges: shift toward red in darks
  else if (baseHue >= 120 && baseHue < 180) shiftDeg = -4;  // greens: shift toward yellow in darks
  else if (baseHue >= 180 && baseHue < 240) shiftDeg = -3;  // cyans/blues: slight shift
  else if (baseHue >= 240 && baseHue < 300) shiftDeg = +3;  // indigos/violets: shift toward blue in darks
  else                                      shiftDeg = +4;  // magentas/pinks: shift toward red in darks

  return baseHue + shiftDeg * magnitude * Math.sign(distance);
}

// ---------------------------------------------------------------------------
// Stop mapping
// ---------------------------------------------------------------------------

/**
 * Determine which shade stop the input color most naturally maps to
 * based on its lightness.
 *
 * @param {number} oklchL - The input color's OKLCH L value
 * @returns {number} The closest shade stop
 */
export function findClosestStop(oklchL) {
  const inputTone = toe(oklchL);

  let closestStop = 500;
  let closestDist = Infinity;

  for (const [stop, targetTone] of Object.entries(TONE_TARGETS)) {
    const dist = Math.abs(inputTone - targetTone);
    if (dist < closestDist) {
      closestDist = dist;
      closestStop = Number(stop);
    }
  }

  return closestStop;
}

// ---------------------------------------------------------------------------
// Main generation
// ---------------------------------------------------------------------------

const toOklch = converter('oklch');

/**
 * Generate a full shade ramp from a single input color.
 *
 * @param {string} inputColor - Any CSS color string (hex, rgb, hsl, oklch, etc.)
 * @param {object} [options]
 * @param {number} [options.pinStop] - Force the input color to a specific stop (e.g. 500).
 *   If omitted, auto-detects based on lightness.
 * @param {boolean} [options.clampToSrgb=true] - Gamut-map to sRGB. Set false for P3 output.
 * @returns {object} { shades: Record<number, {oklch, hex, css}>, pinnedStop: number }
 */
export function generateShades(inputColor, options = {}) {
  const { pinStop, clampToSrgb = true } = options;

  // Parse and convert to OKLCH
  const parsed = parse(inputColor);
  if (!parsed) {
    throw new Error(`Could not parse color: "${inputColor}"`);
  }

  const base = toOklch(parsed);
  const baseL = base.l;
  const baseC = base.c || 0;
  const baseH = base.h || 0;

  // Determine which stop the input maps to
  const pinnedStop = pinStop || findClosestStop(baseL);

  const shades = {};

  for (const stop of STOPS) {
    let l, c, h;

    if (stop === pinnedStop) {
      // Use the exact input color at its pinned stop
      l = baseL;
      c = baseC;
      h = baseH;
    } else {
      // Compute target lightness via tone function
      const targetTone = TONE_TARGETS[stop];
      l = toeInv(targetTone);

      // Chroma: bell curve based on base chroma
      c = getChroma(baseC, stop);

      // Hue: subtle shift
      h = getHue(baseH, stop);
    }

    // Construct the OKLCH color
    let color = { mode: 'oklch', l, c, h };

    // Gamut mapping: reduce chroma to fit in sRGB
    if (clampToSrgb) {
      color = clampChroma(color, 'oklch', 'rgb');
    }

    // Format outputs
    const hex = formatHex(color);
    const css = formatCss(color);

    shades[stop] = {
      oklch: { l: color.l, c: color.c || 0, h: color.h || 0 },
      hex,
      css,
    };
  }

  return { shades, pinnedStop };
}

// ---------------------------------------------------------------------------
// Convenience: format for Tailwind CSS v4
// ---------------------------------------------------------------------------

/**
 * Generate a Tailwind v4 @theme block for a named color.
 *
 * @param {string} name - Color name (e.g. "brand", "primary")
 * @param {string} inputColor - Input color string
 * @param {object} [options] - Same options as generateShades
 * @returns {string} CSS @theme block
 */
export function toTailwindCSS(name, inputColor, options = {}) {
  const { shades } = generateShades(inputColor, options);

  const lines = STOPS.map((stop) => {
    const { oklch: val } = shades[stop];
    const l = val.l.toFixed(4);
    const c = val.c.toFixed(4);
    const h = isFinite(val.h) ? val.h.toFixed(2) : '0';
    return `  --color-${name}-${stop}: oklch(${l} ${c} ${h});`;
  });

  return `@theme {\n${lines.join('\n')}\n}`;
}
