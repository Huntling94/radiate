/**
 * Procedural species name generator.
 * Deterministic: same RNG state produces the same name.
 */

import type { Rng } from './rng.ts';

const PREFIXES = [
  'Vor',
  'Zel',
  'Thr',
  'Kra',
  'Mol',
  'Syn',
  'Pyr',
  'Xen',
  'Dra',
  'Vel',
  'Gor',
  'Nym',
  'Axi',
  'Bor',
  'Cel',
  'Fen',
  'Hex',
  'Lyr',
  'Oma',
  'Rhi',
];

const MIDDLES = [
  'ath',
  'kor',
  'yn',
  'al',
  'ith',
  'on',
  'ax',
  'el',
  'ur',
  'is',
  'an',
  'ol',
  'em',
  'ir',
  'us',
  'ar',
  'en',
  'ox',
  'um',
  'il',
];

const SUFFIXES = ['a', 'us', 'is', 'ax', 'or', 'ix', 'um', 'os', 'ia', 'es'];

/** Generate a species name from the RNG. */
export function generateSpeciesName(rng: Rng): string {
  const prefix = PREFIXES[rng.nextInt(0, PREFIXES.length - 1)];
  const middle = MIDDLES[rng.nextInt(0, MIDDLES.length - 1)];
  const suffix = SUFFIXES[rng.nextInt(0, SUFFIXES.length - 1)];
  return `${prefix}${middle}${suffix}`;
}
