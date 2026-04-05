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
export const STANDARD_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

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
// Tailwind v4 / v4.2 default palettes — OKLCH values
// ---------------------------------------------------------------------------

/**
 * All 26 standard Tailwind default color palettes with their official OKLCH
 * values for stops 50–950. Use with extrapolateLight/extrapolateDark to
 * generate the additional 25 and 975 shades.
 */
export const TAILWIND_PALETTES = {
  red: {
    50:  { l: 0.971, c: 0.013, h: 17.38 },
    100: { l: 0.936, c: 0.032, h: 17.717 },
    200: { l: 0.885, c: 0.062, h: 18.334 },
    300: { l: 0.808, c: 0.114, h: 19.571 },
    400: { l: 0.704, c: 0.191, h: 22.216 },
    500: { l: 0.637, c: 0.237, h: 25.331 },
    600: { l: 0.577, c: 0.245, h: 27.325 },
    700: { l: 0.505, c: 0.213, h: 27.518 },
    800: { l: 0.444, c: 0.177, h: 26.899 },
    900: { l: 0.396, c: 0.141, h: 25.723 },
    950: { l: 0.258, c: 0.092, h: 26.042 },
  },
  orange: {
    50:  { l: 0.98,  c: 0.016, h: 73.684 },
    100: { l: 0.954, c: 0.038, h: 75.164 },
    200: { l: 0.901, c: 0.076, h: 70.697 },
    300: { l: 0.837, c: 0.128, h: 66.29 },
    400: { l: 0.75,  c: 0.183, h: 55.934 },
    500: { l: 0.705, c: 0.213, h: 47.604 },
    600: { l: 0.646, c: 0.222, h: 41.116 },
    700: { l: 0.553, c: 0.195, h: 38.402 },
    800: { l: 0.47,  c: 0.157, h: 37.304 },
    900: { l: 0.408, c: 0.123, h: 38.172 },
    950: { l: 0.266, c: 0.079, h: 36.259 },
  },
  amber: {
    50:  { l: 0.987, c: 0.022, h: 95.277 },
    100: { l: 0.962, c: 0.059, h: 95.617 },
    200: { l: 0.924, c: 0.12,  h: 95.746 },
    300: { l: 0.879, c: 0.169, h: 91.605 },
    400: { l: 0.828, c: 0.189, h: 84.429 },
    500: { l: 0.769, c: 0.188, h: 70.08 },
    600: { l: 0.666, c: 0.179, h: 58.318 },
    700: { l: 0.555, c: 0.163, h: 48.998 },
    800: { l: 0.473, c: 0.137, h: 46.201 },
    900: { l: 0.414, c: 0.112, h: 45.904 },
    950: { l: 0.279, c: 0.077, h: 45.635 },
  },
  yellow: {
    50:  { l: 0.987, c: 0.026, h: 102.212 },
    100: { l: 0.973, c: 0.071, h: 103.193 },
    200: { l: 0.945, c: 0.129, h: 101.54 },
    300: { l: 0.905, c: 0.182, h: 98.111 },
    400: { l: 0.852, c: 0.199, h: 91.936 },
    500: { l: 0.795, c: 0.184, h: 86.047 },
    600: { l: 0.681, c: 0.162, h: 75.834 },
    700: { l: 0.554, c: 0.135, h: 66.442 },
    800: { l: 0.476, c: 0.114, h: 61.907 },
    900: { l: 0.421, c: 0.095, h: 57.708 },
    950: { l: 0.286, c: 0.066, h: 53.813 },
  },
  lime: {
    50:  { l: 0.986, c: 0.031, h: 120.757 },
    100: { l: 0.967, c: 0.067, h: 122.328 },
    200: { l: 0.938, c: 0.127, h: 124.321 },
    300: { l: 0.897, c: 0.196, h: 126.665 },
    400: { l: 0.841, c: 0.238, h: 128.85 },
    500: { l: 0.768, c: 0.233, h: 130.85 },
    600: { l: 0.648, c: 0.2,   h: 131.684 },
    700: { l: 0.532, c: 0.157, h: 131.589 },
    800: { l: 0.453, c: 0.124, h: 130.933 },
    900: { l: 0.405, c: 0.101, h: 131.063 },
    950: { l: 0.274, c: 0.072, h: 132.109 },
  },
  green: {
    50:  { l: 0.982, c: 0.018, h: 155.826 },
    100: { l: 0.962, c: 0.044, h: 156.743 },
    200: { l: 0.925, c: 0.084, h: 155.995 },
    300: { l: 0.871, c: 0.15,  h: 154.449 },
    400: { l: 0.792, c: 0.209, h: 151.711 },
    500: { l: 0.723, c: 0.219, h: 149.579 },
    600: { l: 0.627, c: 0.194, h: 149.214 },
    700: { l: 0.527, c: 0.154, h: 150.069 },
    800: { l: 0.448, c: 0.119, h: 151.328 },
    900: { l: 0.393, c: 0.095, h: 152.535 },
    950: { l: 0.266, c: 0.065, h: 152.934 },
  },
  emerald: {
    50:  { l: 0.979, c: 0.021, h: 166.113 },
    100: { l: 0.95,  c: 0.052, h: 163.051 },
    200: { l: 0.905, c: 0.093, h: 164.15 },
    300: { l: 0.845, c: 0.143, h: 164.978 },
    400: { l: 0.765, c: 0.177, h: 163.223 },
    500: { l: 0.696, c: 0.17,  h: 162.48 },
    600: { l: 0.596, c: 0.145, h: 163.225 },
    700: { l: 0.508, c: 0.118, h: 165.612 },
    800: { l: 0.432, c: 0.095, h: 166.913 },
    900: { l: 0.378, c: 0.077, h: 168.94 },
    950: { l: 0.262, c: 0.051, h: 172.552 },
  },
  teal: {
    50:  { l: 0.984, c: 0.014, h: 180.72 },
    100: { l: 0.953, c: 0.051, h: 180.801 },
    200: { l: 0.91,  c: 0.096, h: 180.426 },
    300: { l: 0.855, c: 0.138, h: 181.071 },
    400: { l: 0.777, c: 0.152, h: 181.912 },
    500: { l: 0.704, c: 0.14,  h: 182.503 },
    600: { l: 0.6,   c: 0.118, h: 184.704 },
    700: { l: 0.511, c: 0.096, h: 186.391 },
    800: { l: 0.437, c: 0.078, h: 188.216 },
    900: { l: 0.386, c: 0.063, h: 188.416 },
    950: { l: 0.277, c: 0.046, h: 192.524 },
  },
  cyan: {
    50:  { l: 0.984, c: 0.019, h: 200.873 },
    100: { l: 0.956, c: 0.045, h: 203.388 },
    200: { l: 0.917, c: 0.08,  h: 205.041 },
    300: { l: 0.865, c: 0.127, h: 207.078 },
    400: { l: 0.789, c: 0.154, h: 211.53 },
    500: { l: 0.715, c: 0.143, h: 215.221 },
    600: { l: 0.609, c: 0.126, h: 221.723 },
    700: { l: 0.52,  c: 0.105, h: 223.128 },
    800: { l: 0.45,  c: 0.085, h: 224.283 },
    900: { l: 0.398, c: 0.07,  h: 227.392 },
    950: { l: 0.302, c: 0.056, h: 229.695 },
  },
  sky: {
    50:  { l: 0.977, c: 0.013, h: 236.62 },
    100: { l: 0.951, c: 0.026, h: 236.824 },
    200: { l: 0.901, c: 0.058, h: 230.902 },
    300: { l: 0.828, c: 0.111, h: 230.318 },
    400: { l: 0.746, c: 0.16,  h: 232.661 },
    500: { l: 0.685, c: 0.169, h: 237.323 },
    600: { l: 0.588, c: 0.158, h: 241.966 },
    700: { l: 0.5,   c: 0.134, h: 242.749 },
    800: { l: 0.443, c: 0.11,  h: 240.79 },
    900: { l: 0.391, c: 0.09,  h: 240.876 },
    950: { l: 0.293, c: 0.066, h: 243.157 },
  },
  blue: {
    50:  { l: 0.97,  c: 0.014, h: 254.604 },
    100: { l: 0.932, c: 0.032, h: 255.585 },
    200: { l: 0.882, c: 0.059, h: 254.128 },
    300: { l: 0.809, c: 0.105, h: 251.813 },
    400: { l: 0.707, c: 0.165, h: 254.624 },
    500: { l: 0.623, c: 0.214, h: 259.815 },
    600: { l: 0.546, c: 0.245, h: 262.881 },
    700: { l: 0.488, c: 0.243, h: 264.376 },
    800: { l: 0.424, c: 0.199, h: 265.638 },
    900: { l: 0.379, c: 0.146, h: 265.522 },
    950: { l: 0.282, c: 0.091, h: 267.935 },
  },
  indigo: {
    50:  { l: 0.962, c: 0.018, h: 272.314 },
    100: { l: 0.93,  c: 0.034, h: 272.788 },
    200: { l: 0.87,  c: 0.065, h: 274.039 },
    300: { l: 0.785, c: 0.115, h: 274.713 },
    400: { l: 0.673, c: 0.182, h: 276.935 },
    500: { l: 0.585, c: 0.233, h: 277.117 },
    600: { l: 0.511, c: 0.262, h: 276.966 },
    700: { l: 0.457, c: 0.24,  h: 277.023 },
    800: { l: 0.398, c: 0.195, h: 277.366 },
    900: { l: 0.359, c: 0.144, h: 278.697 },
    950: { l: 0.257, c: 0.09,  h: 281.288 },
  },
  violet: {
    50:  { l: 0.969, c: 0.016, h: 293.756 },
    100: { l: 0.943, c: 0.029, h: 294.588 },
    200: { l: 0.894, c: 0.057, h: 293.283 },
    300: { l: 0.811, c: 0.111, h: 293.571 },
    400: { l: 0.702, c: 0.183, h: 293.541 },
    500: { l: 0.606, c: 0.25,  h: 292.717 },
    600: { l: 0.541, c: 0.281, h: 293.009 },
    700: { l: 0.491, c: 0.27,  h: 292.581 },
    800: { l: 0.432, c: 0.232, h: 292.759 },
    900: { l: 0.38,  c: 0.189, h: 293.745 },
    950: { l: 0.283, c: 0.141, h: 291.089 },
  },
  purple: {
    50:  { l: 0.977, c: 0.014, h: 308.299 },
    100: { l: 0.946, c: 0.033, h: 307.174 },
    200: { l: 0.902, c: 0.063, h: 306.703 },
    300: { l: 0.827, c: 0.119, h: 306.383 },
    400: { l: 0.714, c: 0.203, h: 305.504 },
    500: { l: 0.627, c: 0.265, h: 303.9 },
    600: { l: 0.558, c: 0.288, h: 302.321 },
    700: { l: 0.496, c: 0.265, h: 301.924 },
    800: { l: 0.438, c: 0.218, h: 303.724 },
    900: { l: 0.381, c: 0.176, h: 304.987 },
    950: { l: 0.291, c: 0.149, h: 302.717 },
  },
  fuchsia: {
    50:  { l: 0.977, c: 0.017, h: 320.058 },
    100: { l: 0.952, c: 0.037, h: 318.852 },
    200: { l: 0.903, c: 0.076, h: 319.62 },
    300: { l: 0.833, c: 0.145, h: 321.434 },
    400: { l: 0.74,  c: 0.238, h: 322.16 },
    500: { l: 0.667, c: 0.295, h: 322.15 },
    600: { l: 0.591, c: 0.293, h: 322.896 },
    700: { l: 0.518, c: 0.253, h: 323.949 },
    800: { l: 0.452, c: 0.211, h: 324.591 },
    900: { l: 0.401, c: 0.17,  h: 325.612 },
    950: { l: 0.293, c: 0.136, h: 325.661 },
  },
  pink: {
    50:  { l: 0.971, c: 0.014, h: 343.198 },
    100: { l: 0.948, c: 0.028, h: 342.258 },
    200: { l: 0.899, c: 0.061, h: 343.231 },
    300: { l: 0.823, c: 0.12,  h: 346.018 },
    400: { l: 0.718, c: 0.202, h: 349.761 },
    500: { l: 0.656, c: 0.241, h: 354.308 },
    600: { l: 0.592, c: 0.249, h: 0.584 },
    700: { l: 0.525, c: 0.223, h: 3.958 },
    800: { l: 0.459, c: 0.187, h: 3.815 },
    900: { l: 0.408, c: 0.153, h: 2.432 },
    950: { l: 0.284, c: 0.109, h: 3.907 },
  },
  rose: {
    50:  { l: 0.969, c: 0.015, h: 12.422 },
    100: { l: 0.941, c: 0.03,  h: 12.58 },
    200: { l: 0.892, c: 0.058, h: 10.001 },
    300: { l: 0.81,  c: 0.117, h: 11.638 },
    400: { l: 0.712, c: 0.194, h: 13.428 },
    500: { l: 0.645, c: 0.246, h: 16.439 },
    600: { l: 0.586, c: 0.253, h: 17.585 },
    700: { l: 0.514, c: 0.222, h: 16.935 },
    800: { l: 0.455, c: 0.188, h: 13.697 },
    900: { l: 0.41,  c: 0.159, h: 10.272 },
    950: { l: 0.271, c: 0.105, h: 12.094 },
  },
  slate: {
    50:  { l: 0.984, c: 0.003, h: 247.858 },
    100: { l: 0.968, c: 0.007, h: 247.896 },
    200: { l: 0.929, c: 0.013, h: 255.508 },
    300: { l: 0.869, c: 0.022, h: 252.894 },
    400: { l: 0.704, c: 0.04,  h: 256.788 },
    500: { l: 0.554, c: 0.046, h: 257.417 },
    600: { l: 0.446, c: 0.043, h: 257.281 },
    700: { l: 0.372, c: 0.044, h: 257.287 },
    800: { l: 0.279, c: 0.041, h: 260.031 },
    900: { l: 0.208, c: 0.042, h: 265.755 },
    950: { l: 0.129, c: 0.042, h: 264.695 },
  },
  gray: {
    50:  { l: 0.985, c: 0.002, h: 247.839 },
    100: { l: 0.967, c: 0.003, h: 264.542 },
    200: { l: 0.928, c: 0.006, h: 264.531 },
    300: { l: 0.872, c: 0.01,  h: 258.338 },
    400: { l: 0.707, c: 0.022, h: 261.325 },
    500: { l: 0.551, c: 0.027, h: 264.364 },
    600: { l: 0.446, c: 0.03,  h: 256.802 },
    700: { l: 0.373, c: 0.034, h: 259.733 },
    800: { l: 0.278, c: 0.033, h: 256.848 },
    900: { l: 0.21,  c: 0.034, h: 264.665 },
    950: { l: 0.13,  c: 0.028, h: 261.692 },
  },
  zinc: {
    50:  { l: 0.985, c: 0,     h: 0 },
    100: { l: 0.967, c: 0.001, h: 286.375 },
    200: { l: 0.92,  c: 0.004, h: 286.32 },
    300: { l: 0.871, c: 0.006, h: 286.286 },
    400: { l: 0.705, c: 0.015, h: 286.067 },
    500: { l: 0.552, c: 0.016, h: 285.938 },
    600: { l: 0.442, c: 0.017, h: 285.786 },
    700: { l: 0.37,  c: 0.013, h: 285.805 },
    800: { l: 0.274, c: 0.006, h: 286.033 },
    900: { l: 0.21,  c: 0.006, h: 285.885 },
    950: { l: 0.141, c: 0.005, h: 285.823 },
  },
  neutral: {
    50:  { l: 0.985, c: 0, h: 0 },
    100: { l: 0.97,  c: 0, h: 0 },
    200: { l: 0.922, c: 0, h: 0 },
    300: { l: 0.87,  c: 0, h: 0 },
    400: { l: 0.708, c: 0, h: 0 },
    500: { l: 0.556, c: 0, h: 0 },
    600: { l: 0.439, c: 0, h: 0 },
    700: { l: 0.371, c: 0, h: 0 },
    800: { l: 0.269, c: 0, h: 0 },
    900: { l: 0.205, c: 0, h: 0 },
    950: { l: 0.145, c: 0, h: 0 },
  },
  stone: {
    50:  { l: 0.985, c: 0.001, h: 106.423 },
    100: { l: 0.97,  c: 0.001, h: 106.424 },
    200: { l: 0.923, c: 0.003, h: 48.717 },
    300: { l: 0.869, c: 0.005, h: 56.366 },
    400: { l: 0.709, c: 0.01,  h: 56.259 },
    500: { l: 0.553, c: 0.013, h: 58.071 },
    600: { l: 0.444, c: 0.011, h: 73.639 },
    700: { l: 0.374, c: 0.01,  h: 67.558 },
    800: { l: 0.268, c: 0.007, h: 34.298 },
    900: { l: 0.216, c: 0.006, h: 56.043 },
    950: { l: 0.147, c: 0.004, h: 49.25 },
  },
  taupe: {
    50:  { l: 0.986, c: 0.002, h: 67.8 },
    100: { l: 0.96,  c: 0.002, h: 17.2 },
    200: { l: 0.922, c: 0.005, h: 34.3 },
    300: { l: 0.868, c: 0.007, h: 39.5 },
    400: { l: 0.714, c: 0.014, h: 41.2 },
    500: { l: 0.547, c: 0.021, h: 43.1 },
    600: { l: 0.438, c: 0.017, h: 39.3 },
    700: { l: 0.367, c: 0.016, h: 35.7 },
    800: { l: 0.268, c: 0.011, h: 36.5 },
    900: { l: 0.214, c: 0.009, h: 43.1 },
    950: { l: 0.147, c: 0.004, h: 49.3 },
  },
  mauve: {
    50:  { l: 0.985, c: 0,     h: 0 },
    100: { l: 0.96,  c: 0.003, h: 325.6 },
    200: { l: 0.922, c: 0.005, h: 325.62 },
    300: { l: 0.865, c: 0.012, h: 325.68 },
    400: { l: 0.711, c: 0.019, h: 323.02 },
    500: { l: 0.542, c: 0.034, h: 322.5 },
    600: { l: 0.435, c: 0.029, h: 321.78 },
    700: { l: 0.364, c: 0.029, h: 323.89 },
    800: { l: 0.263, c: 0.024, h: 320.12 },
    900: { l: 0.212, c: 0.019, h: 322.12 },
    950: { l: 0.145, c: 0.008, h: 326 },
  },
  mist: {
    50:  { l: 0.987, c: 0.002, h: 197.1 },
    100: { l: 0.963, c: 0.002, h: 197.1 },
    200: { l: 0.925, c: 0.005, h: 214.3 },
    300: { l: 0.872, c: 0.007, h: 219.6 },
    400: { l: 0.723, c: 0.014, h: 214.4 },
    500: { l: 0.56,  c: 0.021, h: 213.5 },
    600: { l: 0.45,  c: 0.017, h: 213.2 },
    700: { l: 0.378, c: 0.015, h: 216 },
    800: { l: 0.275, c: 0.011, h: 216.9 },
    900: { l: 0.218, c: 0.008, h: 223.9 },
    950: { l: 0.148, c: 0.004, h: 228.8 },
  },
  olive: {
    50:  { l: 0.988, c: 0.003, h: 106.5 },
    100: { l: 0.966, c: 0.005, h: 106.5 },
    200: { l: 0.93,  c: 0.007, h: 106.5 },
    300: { l: 0.88,  c: 0.011, h: 106.6 },
    400: { l: 0.737, c: 0.021, h: 106.9 },
    500: { l: 0.58,  c: 0.031, h: 107.3 },
    600: { l: 0.466, c: 0.025, h: 107.3 },
    700: { l: 0.394, c: 0.023, h: 107.4 },
    800: { l: 0.286, c: 0.016, h: 107.4 },
    900: { l: 0.228, c: 0.013, h: 107.4 },
    950: { l: 0.153, c: 0.006, h: 107.1 },
  },
};

// ---------------------------------------------------------------------------
// Shade extrapolation for default palettes
// ---------------------------------------------------------------------------

/**
 * Extrapolate shade 25 from existing stops using geometric ratio in
 * distance-from-endpoint space. Uses the ratio between stops 50 and 100
 * to predict one step lighter.
 *
 * @param {object} stops - Palette stops object (keyed by stop number, each { l, c, h })
 * @returns {{ l: number, c: number, h: number }} Extrapolated OKLCH values
 */
export function extrapolateLight(stops) {
  const d50  = 1 - stops[50].l;
  const d100 = 1 - stops[100].l;

  const lRatio = (d100 > 0.001) ? d50 / d100 : 0.5;
  const l = 1 - d50 * Math.min(lRatio, 0.9);

  let c;
  if (stops[100].c > 0.001) {
    const cRatio = stops[50].c / stops[100].c;
    c = stops[50].c * Math.min(cRatio, 0.9);
  } else {
    c = stops[50].c * 0.5;
  }
  c = Math.max(0, c);

  return { l, c, h: stops[50].h };
}

/**
 * Extrapolate shade 975 from existing stops using geometric ratio in
 * distance-from-endpoint space. Uses the ratio between stops 950 and 900
 * to predict one step darker.
 *
 * @param {object} stops - Palette stops object (keyed by stop number, each { l, c, h })
 * @returns {{ l: number, c: number, h: number }} Extrapolated OKLCH values
 */
export function extrapolateDark(stops) {
  const l950 = stops[950].l;
  const l900 = stops[900].l;

  const lRatio = (l900 > 0.001) ? l950 / l900 : 0.5;
  const l = l950 * Math.min(lRatio, 0.9);

  let c;
  if (stops[900].c > 0.001) {
    const cRatio = stops[950].c / stops[900].c;
    c = stops[950].c * Math.min(cRatio, 0.95);
  } else {
    c = stops[950].c * 0.5;
  }
  c = Math.max(0, c);

  return { l, c, h: stops[950].h };
}

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
// Contrast color
// ---------------------------------------------------------------------------

/**
 * Determine whether light or dark text should be used on a given hex color.
 * Uses relative luminance with a 0.55 threshold.
 *
 * @param {string} hex - Hex color string
 * @returns {'light'|'dark'} Which text tone to use on this background
 */
function contrastTone(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? 'dark' : 'light';
}

// ---------------------------------------------------------------------------
// Convenience: format for Tailwind CSS v4
// ---------------------------------------------------------------------------

/**
 * Generate a Tailwind v4 @theme block for a named color.
 *
 * @param {string} name - Color name (e.g. "brand", "primary")
 * @param {string} inputColor - Input color string
 * @param {object} [options] - Same options as generateShades, plus:
 * @param {'oklch'|'hex'} [options.format='oklch'] - Output color format
 * @param {boolean} [options.extendedStops=true] - Include 25 and 975 stops
 * @param {boolean|object} [options.onColors=false] - Generate --color-on-{name} contrast variables.
 *   Pass true for black/white defaults, or { light: string, dark: string } for custom values
 *   (hex colors, CSS variables, or any valid CSS value).
 * @returns {string} CSS @theme block
 */
export function toTailwindCSS(name, inputColor, options = {}) {
  const { format = 'oklch', extendedStops = true, onColors = false, ...shadeOptions } = options;
  const { shades } = generateShades(inputColor, shadeOptions);
  const stops = extendedStops ? STOPS : STANDARD_STOPS;

  const lines = stops.map((stop) => {
    const shade = shades[stop];
    let value;

    if (format === 'hex') {
      value = shade.hex;
    } else {
      const { oklch: val } = shade;
      const l = val.l.toFixed(4);
      const c = val.c.toFixed(4);
      const h = isFinite(val.h) ? val.h.toFixed(2) : '0';
      value = `oklch(${l} ${c} ${h})`;
    }

    return `  --color-${name}-${stop}: ${value};`;
  });

  if (onColors) {
    const lightVal = (typeof onColors === 'object' && onColors.light) || '#ffffff';
    const darkVal = (typeof onColors === 'object' && onColors.dark) || '#000000';

    lines.push('');
    for (const stop of stops) {
      const tone = contrastTone(shades[stop].hex);
      const onValue = tone === 'light' ? lightVal : darkVal;
      lines.push(`  --color-on-${name}-${stop}: ${onValue};`);
    }
  }

  return `@theme {\n${lines.join('\n')}\n}`;
}
