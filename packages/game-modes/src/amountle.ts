import { absolutePoints, invalid, issue, ratioPoints } from './shared';
import type { AmountRound } from './shared';
import type { ValidationIssue } from '../../contracts/src/index';

export function validateAmount(round: AmountRound): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  if (round.secretConfig.answer > round.publicConfig.maxCount) errors.push(issue(round, 'secretConfig.answer', 'The answer cannot exceed the maximum permitted count.'));
  if (!round.publicConfig.steps.includes(1)) errors.push(issue(round, 'publicConfig.steps', 'Include the +1 control so every integer count is reachable.'));
  if (new Set(round.publicConfig.steps).size !== round.publicConfig.steps.length) errors.push(issue(round, 'publicConfig.steps', 'Count step options must be unique.'));
  return errors;
}

export function sanitizeAmount(round: AmountRound, count: unknown): number {
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > round.publicConfig.maxCount) {
    invalid(`Choose a whole-number count from 0 to ${round.publicConfig.maxCount}.`);
  }
  return count;
}

export function scoreAmount(round: AmountRound, count: number): number {
  return round.secretConfig.answer <= 100
    ? absolutePoints(count, round.secretConfig.answer, round.publicConfig.tolerance)
    : ratioPoints(count, round.secretConfig.answer);
}
