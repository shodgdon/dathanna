/**
 * Test script — compare generated shades against Tailwind CSS v4 reference values.
 */

import { generateShades, toTailwindCSS, findClosestStop } from './src/core.js';
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
