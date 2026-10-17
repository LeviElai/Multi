import { absolutePoints, finite, invalid, issue, onStep, ratioPoints } from './shared';
import type { FermiRound } from './shared';
import type { ValidationIssue } from '../../contracts/src/index';

/** Canonical decimal notation only. Commas and exponent notation are deliberately ambiguous/unsupported. */
export function parseFermiNumber(input: unknown): number {
  if (typeof input === 'number') {
    if (!finite(input)) invalid('Enter a finite number between −1 quadrillion and 1 quadrillion.');
    return Object.is(input, -0) ? 0 : input;
  }
  if (typeof input !== 'string' || input.length > 100) invalid('Enter a number, optionally followed by K, M, or B.');
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([kmb])?$/i.exec(input.trim());
  if (!match) invalid('Use a decimal point and optional K, M, or B; do not use commas or scientific notation.');
  const exponent = { k: 3, m: 6, b: 9 }[match[2]?.toLowerCase() as 'k' | 'm' | 'b'] ?? 0;
  const result = Number(`${match[1]}e${exponent}`);
  if (!finite(result)) invalid('That number is outside the supported range.');
  return Object.is(result, -0) ? 0 : result;
}

export function validateFermi(round: FermiRound): ValidationIssue[] {
  const { min, max, step, errorMode } = round.publicConfig;
  const { answer } = round.secretConfig;
  const errors: ValidationIssue[] = [];
  if (min >= max) errors.push(issue(round, 'publicConfig.max', 'Maximum must be greater than minimum.'));
  if (step > max - min) errors.push(issue(round, 'publicConfig.step', 'Step must fit within the input range.'));
  if (answer < min || answer > max) errors.push(issue(round, 'secretConfig.answer', 'The answer must be within the player input range.'));
  if (!onStep(answer, min, step)) errors.push(issue(round, 'secretConfig.answer', 'The answer must be reachable using the configured minimum and step.'));
  if (errorMode === 'proportional' && answer <= 0) errors.push(issue(round, 'publicConfig.errorMode', 'Use absolute scoring for a zero or negative answer.'));
  return errors;
}

export function sanitizeFermi(round: FermiRound, value: unknown): number {
  const parsed = parseFermiNumber(value);
  const { min, max, step } = round.publicConfig;
  if (parsed < min || parsed > max) invalid(`Enter a value from ${min} to ${max}.`);
  if (!onStep(parsed, min, step)) invalid(`Use increments of ${step} from ${min}.`);
  return parsed;
}

export function scoreFermi(round: FermiRound, value: number): number {
  if(round.scoringPolicy==='exact')return value===round.secretConfig.answer?1000:0;
  return round.publicConfig.errorMode === 'proportional'
    ? ratioPoints(value, round.secretConfig.answer)
    : absolutePoints(value, round.secretConfig.answer, round.publicConfig.tolerance);
}
