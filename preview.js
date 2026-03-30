#!/usr/bin/env node

/**
 * Preview — generates an HTML file to visually inspect shade ramps.
 *
 * Usage:
 *   node preview.js                          # uses built-in demo colors
 *   node preview.js "#3b82f6"                # single color
 *   node preview.js "#3b82f6" "#ef4444"      # multiple colors
 *   node preview.js --name=brand "#3b82f6"   # named color
 */

import { generateShades, STOPS } from './src/core.js';
import { writeFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`dathanna — Generate Tailwind-style color shade ramps

Usage:
  dathanna                            Generate preview with demo colors
  dathanna "#3b82f6"                  Single color
  dathanna "#3b82f6" "#ef4444"        Multiple colors
  dathanna --name=brand "#6366f1"     Named color

Options:
  --name=NAME   Label for the next color (default: color-1, color-2, ...)
  --help, -h    Show this help message

Output:
  Writes preview.html with interactive color swatches.
  Open in any browser to inspect. Click a swatch to copy its hex value.`);
  process.exit(0);
}
const colors = [];

let currentName = null;
for (const arg of args) {
  if (arg.startsWith('--name=')) {
    currentName = arg.slice(7);
  } else {
    colors.push({
      name: currentName || `color-${colors.length + 1}`,
      input: arg,
    });
    currentName = null;
  }
}

// Default demo palette if no args
if (colors.length === 0) {
  colors.push(
    { name: 'blue',    input: '#3b82f6' },
    { name: 'red',     input: '#ef4444' },
    { name: 'green',   input: '#22c55e' },
    { name: 'amber',   input: '#f59e0b' },
    { name: 'violet',  input: '#8b5cf6' },
    { name: 'pink',    input: '#ec4899' },
    { name: 'cyan',    input: '#06b6d4' },
    { name: 'neutral', input: '#737373' },
  );
}

// ---------------------------------------------------------------------------
// Generate palettes
// ---------------------------------------------------------------------------

const palettes = colors.map(({ name, input }) => {
  try {
    const { shades, pinnedStop } = generateShades(input);
    return { name, input, shades, pinnedStop, error: null };
  } catch (e) {
    return { name, input, shades: null, pinnedStop: null, error: e.message };
  }
});

// ---------------------------------------------------------------------------
// Build HTML
// ---------------------------------------------------------------------------

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function contrastColor(hex) {
  // Quick luminance check for text color
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#000000' : '#ffffff';
}

const paletteRows = palettes.map((p) => {
  if (p.error) {
    return `
      <div class="palette-row">
        <div class="palette-label">
          <span class="palette-name">${escHtml(p.name)}</span>
          <span class="palette-input">${escHtml(p.input)}</span>
          <span class="palette-error">Error: ${escHtml(p.error)}</span>
        </div>
      </div>`;
  }

  const swatches = STOPS.map((stop) => {
    const shade = p.shades[stop];
    const hex = shade.hex;
    const fg = contrastColor(hex);
    const isPinned = stop === p.pinnedStop;
    const l = shade.oklch.l.toFixed(3);
    const c = shade.oklch.c.toFixed(3);
    const h = isFinite(shade.oklch.h) ? shade.oklch.h.toFixed(1) : '–';

    return `
      <div class="swatch${isPinned ? ' pinned' : ''}" style="background:${hex}; color:${fg};">
        <span class="swatch-stop">${stop}</span>
        <span class="swatch-hex">${hex}</span>
        <span class="swatch-oklch">L ${l}</span>
        <span class="swatch-oklch">C ${c}</span>
        <span class="swatch-oklch">H ${h}</span>
      </div>`;
  }).join('\n');

  return `
    <div class="palette-row">
      <div class="palette-label">
        <span class="palette-name">${escHtml(p.name)}</span>
        <span class="palette-input">${escHtml(p.input)}</span>
        <span class="palette-pin">pinned: ${p.pinnedStop}</span>
      </div>
      <div class="swatches">
        ${swatches}
      </div>
    </div>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>dathanna — Preview</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    background: #0f0f0f;
    color: #e0e0e0;
    padding: 24px;
    min-height: 100vh;
  }

  h1 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 4px;
    color: #fff;
  }

  .subtitle {
    font-size: 13px;
    color: #888;
    margin-bottom: 32px;
  }

  .palette-row {
    margin-bottom: 28px;
  }

  .palette-label {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 8px;
  }

  .palette-name {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    text-transform: capitalize;
  }

  .palette-input {
    font-size: 12px;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
    color: #888;
  }

  .palette-pin {
    font-size: 11px;
    color: #666;
  }

  .palette-error {
    font-size: 12px;
    color: #f87171;
  }

  .swatches {
    display: flex;
    gap: 0;
    border-radius: 8px;
    overflow: hidden;
  }

  .swatch {
    flex: 1;
    min-width: 0;
    padding: 10px 4px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    transition: transform 0.1s, z-index 0s;
    position: relative;
  }

  .swatch:hover {
    transform: scaleY(1.12);
    z-index: 10;
    box-shadow: 0 2px 12px rgba(0,0,0,0.5);
  }

  .swatch.pinned {
    outline: 2px solid rgba(255,255,255,0.6);
    outline-offset: -2px;
    z-index: 5;
  }

  .swatch-stop {
    font-size: 11px;
    font-weight: 700;
    opacity: 0.85;
  }

  .swatch-hex {
    font-size: 9px;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
    opacity: 0.7;
  }

  .swatch-oklch {
    font-size: 8px;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
    opacity: 0.5;
  }

  .swatch:hover .swatch-hex,
  .swatch:hover .swatch-oklch {
    opacity: 1;
  }

  /* Toast for copy feedback */
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: #333;
    color: #fff;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-family: "SF Mono", monospace;
    opacity: 0;
    transition: opacity 0.2s, transform 0.2s;
    pointer-events: none;
    z-index: 100;
  }

  .toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  @media (max-width: 900px) {
    .swatches { flex-wrap: wrap; border-radius: 6px; }
    .swatch { min-width: 60px; flex: 0 0 auto; }
  }
</style>
</head>
<body>

<h1>dathanna — Preview</h1>
<p class="subtitle">Click any swatch to copy its hex value. Pinned stop is outlined.</p>

${paletteRows}

<div class="toast" id="toast"></div>

<script>
  document.querySelectorAll('.swatch').forEach(el => {
    el.addEventListener('click', () => {
      const hex = el.querySelector('.swatch-hex')?.textContent;
      if (!hex) return;
      navigator.clipboard.writeText(hex).then(() => {
        const toast = document.getElementById('toast');
        toast.textContent = 'Copied ' + hex;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 1200);
      });
    });
  });
</script>

</body>
</html>`;

// ---------------------------------------------------------------------------
// Write file and report
// ---------------------------------------------------------------------------

const outPath = 'preview.html';
writeFileSync(outPath, html);
console.log(`Preview written to ${outPath}`);
console.log(`Open it in your browser: open ${outPath}`);
