import { finite, invalid, issue, ratioPoints } from './shared';
import type { SizeRound } from './shared';
import type { ValidationIssue } from '../../contracts/src/index';

export function validateSize(round: SizeRound): ValidationIssue[] {
  const { minRatio, maxRatio, referenceSize, calibration } = round.publicConfig;
  const actual = round.secretConfig.targetSize / referenceSize;
  const errors: ValidationIssue[] = [];
  if (calibration.intrinsicDimension !== 100) errors.push(issue(round, 'publicConfig.calibration.intrinsicDimension', 'Built-in vector assets use an intrinsic dimension of exactly 100 units.'));
  if (!finite(minRatio) || minRatio >= maxRatio) errors.push(issue(round, 'publicConfig.minRatio', 'Minimum ratio must be finite, positive, and below maximum.'));
  if (!Number.isFinite(actual) || actual < minRatio || actual > maxRatio) errors.push(issue(round, 'secretConfig.targetSize', 'The true target/reference ratio must be reachable within the controls.'));
  if (![calibration.intrinsicDimension, calibration.start, calibration.end].every(Number.isFinite)
      || calibration.intrinsicDimension <= 0 || calibration.start < 0
      || calibration.end <= calibration.start || calibration.end > calibration.intrinsicDimension) {
    errors.push(issue(round, 'publicConfig.calibration', 'Calibration requires 0 ≤ start < end ≤ intrinsic dimension on the chosen axis.'));
  }
  return errors;
}

export function sanitizeSize(round: SizeRound, ratio: unknown): number {
  if (!finite(ratio) || ratio <= 0 || ratio < round.publicConfig.minRatio || ratio > round.publicConfig.maxRatio) {
    invalid(`Choose a ratio from ${round.publicConfig.minRatio} to ${round.publicConfig.maxRatio}.`);
  }
  return ratio;
}

export function scoreSize(round: SizeRound, ratio: number): number {
  return ratioPoints(ratio, round.secretConfig.targetSize / round.publicConfig.referenceSize);
}
