import { DomainError } from '../../contracts/src/index';
import type { Round, ValidationIssue } from '../../contracts/src/index';

export const SCORING_VERSION = 'v3.2';
export const MAX_NUMBER = 1e15;
export type FermiRound = Extract<Round, { mode: 'fermi' }>;
export type RareRound = Extract<Round, { mode: 'rare_answers' }>;
export type WordRound = Extract<Round, { mode: 'word_puzzle' }>;
export type SizeRound = Extract<Round, { mode: 'size_it_up' }>;
export type AmountRound = Extract<Round, { mode: 'amountle' }>;

export function invalid(message: string): never {
  throw new DomainError('INVALID_SUBMISSION', message, 422);
}

export function points(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1000, Math.round(value))) : 0;
}

export function ratioPoints(guess: number, answer: number): number {
  if (guess <= 0 || answer <= 0 || !Number.isFinite(guess) || !Number.isFinite(answer)) return 0;
  return points(1000 * Math.min(guess / answer, answer / guess));
}

export function absolutePoints(guess: number, answer: number, tolerance: number): number {
  if (!Number.isFinite(guess) || !Number.isFinite(answer) || !Number.isFinite(tolerance) || tolerance <= 0) return 0;
  return points(1000 * Math.max(0, 1 - Math.abs(guess - answer) / tolerance));
}

export function issue(round: Round, field: string, message: string, severity: ValidationIssue['severity'] = 'error'): ValidationIssue {
  return { roundId: round.id, field, message, severity };
}

export function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_NUMBER;
}

export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function assertPlainText(value: unknown, maxLength = 100): string {
  if (typeof value !== 'string' || value.length > maxLength) invalid(`Enter text of at most ${maxLength} characters.`);
  const text = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  // Values are rendered as text, never HTML. Also reject markup and invisible
  // direction/control characters so moderation cannot be visually bypassed.
  if (!text || /[<>\p{Cc}\p{Cf}]/u.test(text)) invalid('Use visible plain text without markup.');
  return text;
}

/** Versioned English rarity profile. Accents remain significant; aliases are explicit. */
export function normalizeAnswer(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase('en').replace(/[\p{P}\p{S}\s]+/gu, ' ').trim();
}

export function segmentGraphemes(text: string, locale = 'en'): string[] {
  return Array.from(new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(text), part => part.segment);
}

export function normalizeWord(text: string, locale = 'en'): string {
  return text.normalize('NFKC').trim().toLocaleUpperCase(locale).normalize('NFC');
}

export function isSupportedWord(text: string): boolean {
  return segmentGraphemes(text).every(grapheme => /^\p{Script=Latin}\p{M}*$/u.test(grapheme));
}

// Compare decimal grids with integers instead of floating-point modulo. This
// correctly accepts e.g. 0.3 on a 0.1 grid without admitting off-grid guesses.
function decimalParts(value: number): { coefficient: bigint; exponent: number } {
  const [mantissa, exponent = '0'] = value.toString().toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  return { coefficient: BigInt(`${whole}${fraction}`), exponent: Number(exponent) - fraction.length };
}

export function onStep(value: number, minimum: number, step: number): boolean {
  if (!finite(value) || !finite(minimum) || !finite(step) || step <= 0) return false;
  const parts = [value, minimum, step].map(decimalParts);
  const base = Math.min(...parts.map(part => part.exponent));
  const [v, min, increment] = parts.map(part => part.coefficient * BigInt(10) ** BigInt(part.exponent - base));
  return (v - min) % increment === BigInt(0);
}
