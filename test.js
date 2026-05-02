/**
 * Test script — compare generated shades against Tailwind CSS v4 reference values.
 */

import {
  generateShades, toTailwindCSS, findClosestStop,
  generateBrandPalette, matchNeutral, getContrastMode,
  TAILWIND_PALETTES, STOPS,
} from './src/core.js';
import { parse, converter } from 'culori';

const toOklch = converter('oklch');

// -------------------------------------------------------------------------
// Tailwind v4 reference values (from the docs)
// -------------------------------------------------------------------------
const TAILWIND_REFERENCE = {
  blue: {
    input: '#3b82f6', // blue-500
    values: {
      50:  { l: 0.970, c: 0.014 },
      100: { l: 0.932, c: 0.032 },
      200: { l: 0.882, c: 0.059 },
      300: { l: 0.809, c: 0.105 },
      400: { l: 0.707, c: 0.165 },
      500: { l: 0.623, c: 0.214 },
      600: { l: 0.546, c: 0.245 },
      700: { l: 0.488, c: 0.243 },
      800: { l: 0.424, c: 0.199 },
      900: { l: 0.379, c: 0.146 },
      950: { l: 0.282, c: 0.091 },
    }
  },
  red: {
    input: '#ef4444', // red-500
    values: {
      50:  { l: 0.971, c: 0.013 },
      100: { l: 0.936, c: 0.032 },
      200: { l: 0.885, c: 0.062 },
      300: { l: 0.808, c: 0.114 },
      400: { l: 0.704, c: 0.191 },
      500: { l: 0.637, c: 0.237 },
      600: { l: 0.577, c: 0.245 },
      700: { l: 0.505, c: 0.213 },
      800: { l: 0.444, c: 0.177 },
      900: { l: 0.396, c: 0.141 },
      950: { l: 0.258, c: 0.092 },
    }
  },
  green: {
    input: '#22c55e', // green-500
    values: {
      50:  { l: 0.982, c: 0.018 },
      100: { l: 0.962, c: 0.044 },
      200: { l: 0.925, c: 0.084 },
      300: { l: 0.871, c: 0.150 },
      400: { l: 0.792, c: 0.209 },
      500: { l: 0.723, c: 0.219 },
      600: { l: 0.627, c: 0.194 },
      700: { l: 0.527, c: 0.154 },
      800: { l: 0.448, c: 0.119 },
      900: { l: 0.393, c: 0.095 },
      950: { l: 0.266, c: 0.065 },
    }
  },
};

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function pad(str, len) {
  return String(str).padStart(len);
}

function colorDiff(generated, reference) {
  const dL = Math.abs(generated.l - reference.l);
  const dC = Math.abs((generated.c || 0) - reference.c);
  return { dL, dC };
}

// -------------------------------------------------------------------------
// Run tests
// -------------------------------------------------------------------------

console.log('=== dathanna — Comparison with Tailwind v4 ===\n');

for (const [colorName, ref] of Object.entries(TAILWIND_REFERENCE)) {
  const { shades, pinnedStop } = generateShades(ref.input);

  // Check which stop the input maps to
  const inputOklch = toOklch(parse(ref.input));
  const detectedStop = findClosestStop(inputOklch.l);

  console.log(`--- ${colorName.toUpperCase()} (input: ${ref.input}) ---`);
  console.log(`  Input OKLCH L: ${inputOklch.l.toFixed(4)}, C: ${inputOklch.c.toFixed(4)}, H: ${inputOklch.h?.toFixed(1)}`);
  console.log(`  Auto-detected stop: ${detectedStop}`);
  console.log(`  Pinned stop: ${pinnedStop}`);
  console.log('');
  console.log(`  ${'Stop'.padEnd(6)} ${'Gen L'.padStart(7)} ${'Ref L'.padStart(7)} ${'ΔL'.padStart(7)} ${'Gen C'.padStart(7)} ${'Ref C'.padStart(7)} ${'ΔC'.padStart(7)}  Gen Hex`);
  console.log(`  ${'─'.repeat(60)}`);

  let totalDL = 0;
  let totalDC = 0;
  let count = 0;

  for (const stop of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
    const gen = shades[stop];
    const refVal = ref.values[stop];

    if (!refVal) continue;

    const { dL, dC } = colorDiff(gen.oklch, refVal);
    totalDL += dL;
    totalDC += dC;
    count++;

    const marker = dL > 0.05 ? ' ⚠️' : '';
    console.log(
      `  ${String(stop).padEnd(6)} ${gen.oklch.l.toFixed(4).padStart(7)} ${refVal.l.toFixed(4).padStart(7)} ${dL.toFixed(4).padStart(7)} ${gen.oklch.c.toFixed(4).padStart(7)} ${refVal.c.toFixed(4).padStart(7)} ${dC.toFixed(4).padStart(7)}  ${gen.hex}${marker}`
    );
  }

  console.log(`  ${'─'.repeat(60)}`);
  console.log(`  Avg ΔL: ${(totalDL / count).toFixed(4)}   Avg ΔC: ${(totalDC / count).toFixed(4)}`);
  console.log('');

  // Show extended stops
  console.log(`  Extended stops:`);
  console.log(`    25:  L=${shades[25].oklch.l.toFixed(4)}  C=${shades[25].oklch.c.toFixed(4)}  ${shades[25].hex}`);
  console.log(`    975: L=${shades[975].oklch.l.toFixed(4)}  C=${shades[975].oklch.c.toFixed(4)}  ${shades[975].hex}`);
  console.log('');
}

// -------------------------------------------------------------------------
// Show sample Tailwind output
// -------------------------------------------------------------------------

console.log('=== Sample Tailwind v4 Output ===\n');
console.log(toTailwindCSS('brand', '#3b82f6'));
console.log('');
console.log(toTailwindCSS('accent', '#ef4444'));

// -------------------------------------------------------------------------
// New API tests
// -------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.log(`  FAIL: ${label}`);
  }
}

console.log('\n=== matchNeutral ===\n');

// Warm colors should match warm neutrals
const warmOrange = matchNeutral('#f97316');
console.log(`  Orange (#f97316) → ${warmOrange.name}`);
assert(['stone', 'taupe'].includes(warmOrange.name), 'orange matches a warm neutral');

// Cool blue should match slate
const coolBlue = matchNeutral('#3b82f6');
console.log(`  Blue (#3b82f6) → ${coolBlue.name}`);
assert(coolBlue.name === 'slate', 'blue matches slate');

// Green should match olive or mist
const green = matchNeutral('#22c55e');
console.log(`  Green (#22c55e) → ${green.name}`);
assert(['olive', 'mist'].includes(green.name), 'green matches olive or mist');

// Near-gray should default to neutral
const gray = matchNeutral('#808080');
console.log(`  Gray (#808080) → ${gray.name}`);
assert(gray.name === 'neutral', 'gray defaults to neutral');

// Purple should match mauve or zinc
const purple = matchNeutral('#8b5cf6');
console.log(`  Purple (#8b5cf6) → ${purple.name}`);
assert(['mauve', 'zinc'].includes(purple.name), 'purple matches mauve or zinc');

// Return value has full 13-stop palette
assert(Object.keys(coolBlue.palette).length === 13, 'matchNeutral returns 13 stops');
assert(coolBlue.palette[25] !== undefined, 'matchNeutral palette includes stop 25');
assert(coolBlue.palette[975] !== undefined, 'matchNeutral palette includes stop 975');

console.log('\n=== getContrastMode ===\n');

console.log(`  White → ${getContrastMode('#ffffff')}`);
assert(getContrastMode('#ffffff') === 'light', 'white is light');

console.log(`  Black → ${getContrastMode('#000000')}`);
assert(getContrastMode('#000000') === 'dark', 'black is dark');

console.log(`  Light gray (#cccccc) → ${getContrastMode('#cccccc')}`);
assert(getContrastMode('#cccccc') === 'light', 'light gray is light');

console.log(`  Dark gray (#333333) → ${getContrastMode('#333333')}`);
assert(getContrastMode('#333333') === 'dark', 'dark gray is dark');

// Mid-tone test: blue-500 (#3b82f6) has OKLCH L ~0.62, below threshold
console.log(`  Blue-500 (#3b82f6) → ${getContrastMode('#3b82f6')}`);
assert(getContrastMode('#3b82f6') === 'dark', 'blue-500 is dark (L ~0.62)');

console.log('\n=== generateBrandPalette ===\n');

const brandResult = generateBrandPalette('#3b82f6');

// Correct shape
assert(typeof brandResult === 'object', 'returns an object');
assert(typeof brandResult.brand === 'object', 'has brand property');
assert(typeof brandResult.base === 'object', 'has base property');
assert(typeof brandResult.brandContrast === 'object', 'has brandContrast property');
assert(typeof brandResult.baseSource === 'string', 'has baseSource string');
assert(typeof brandResult.pinnedStop === 'number', 'has pinnedStop number');

// All 13 stops present
const brandStops = Object.keys(brandResult.brand).map(Number);
assert(brandStops.length === 13, 'brand has 13 stops');
assert(Object.keys(brandResult.base).length === 13, 'base has 13 stops');
assert(Object.keys(brandResult.brandContrast).length === 13, 'brandContrast has 13 stops');

// Values are hex strings
assert(brandResult.brand[500].startsWith('#'), 'brand values are hex');
assert(brandResult.base[500].startsWith('#'), 'base values are hex');

// Contrast decisions are valid
for (const stop of STOPS) {
  assert(
    brandResult.brandContrast[stop] === 'light' || brandResult.brandContrast[stop] === 'dark',
    `brandContrast[${stop}] is light or dark`
  );
}

// Light shades should be 'light', dark shades should be 'dark'
assert(brandResult.brandContrast[25] === 'light', 'stop 25 is light');
assert(brandResult.brandContrast[50] === 'light', 'stop 50 is light');
assert(brandResult.brandContrast[950] === 'dark', 'stop 950 is dark');
assert(brandResult.brandContrast[975] === 'dark', 'stop 975 is dark');

// Brand shades match generateShades output
const { shades: directShades } = generateShades('#3b82f6');
assert(brandResult.brand[500] === directShades[500].hex, 'brand[500] matches generateShades');
assert(brandResult.brand[25] === directShades[25].hex, 'brand[25] matches generateShades');

// Base source is a valid neutral
const validNeutrals = ['neutral', 'taupe', 'stone', 'olive', 'mist', 'slate', 'gray', 'zinc', 'mauve'];
assert(validNeutrals.includes(brandResult.baseSource), 'baseSource is a valid neutral name');

console.log(`  Brand[500]: ${brandResult.brand[500]}`);
console.log(`  Base source: ${brandResult.baseSource}`);
console.log(`  Pinned stop: ${brandResult.pinnedStop}`);
console.log(`  Contrast at 100: ${brandResult.brandContrast[100]}, at 900: ${brandResult.brandContrast[900]}`);

console.log('\n=== toTailwindCSS with palette name ===\n');

const paletteCss = toTailwindCSS('base', 'slate');
assert(paletteCss.includes('--color-base-25:'), 'palette CSS includes stop 25');
assert(paletteCss.includes('--color-base-975:'), 'palette CSS includes stop 975');
assert(paletteCss.includes('--color-base-500:'), 'palette CSS includes stop 500');
assert(paletteCss.startsWith('@theme {'), 'palette CSS starts with @theme');
console.log('  Palette CSS output: OK');

// Hex format with palette name
const paletteHex = toTailwindCSS('base', 'slate', { format: 'hex' });
assert(paletteHex.includes('#'), 'hex format outputs hex values');
console.log('  Palette hex format: OK');

// Standard stops only
const paletteStd = toTailwindCSS('base', 'slate', { extendedStops: false });
assert(!paletteStd.includes('--color-base-25:'), 'standard stops excludes 25');
assert(!paletteStd.includes('--color-base-975:'), 'standard stops excludes 975');
console.log('  Standard stops only: OK');

console.log('\n=== TAILWIND_PALETTES pre-stored 25/975 ===\n');

let allHave25and975 = true;
for (const [name, palette] of Object.entries(TAILWIND_PALETTES)) {
  if (!palette[25] || !palette[975]) {
    console.log(`  FAIL: ${name} missing 25/975`);
    allHave25and975 = false;
  }
}
assert(allHave25and975, 'all 26 palettes have stops 25 and 975');
console.log(`  All 26 palettes have 13 stops: ${allHave25and975 ? 'OK' : 'FAIL'}`);

// -------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------

console.log(`\n=== Test Summary: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
