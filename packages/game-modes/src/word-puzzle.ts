import { invalid, isSupportedWord, issue, normalizeWord, points, segmentGraphemes } from './shared';
import type { WordRound } from './shared';
import type { ValidationIssue, WordAttempt } from '../../contracts/src/index';

export function wordFeedback(answer: string, guess: string, locale = 'en'): WordAttempt['feedback'] {
  const target = segmentGraphemes(normalizeWord(answer, locale), locale);
  const entered = segmentGraphemes(normalizeWord(guess, locale), locale);
  if (target.length !== entered.length) invalid('The guess must have the same number of letters as the answer.');
  const feedback: WordAttempt['feedback'] = entered.map(() => 'absent');
  const remaining = new Map<string, number>();
  target.forEach((letter, index) => {
    if (letter === entered[index]) feedback[index] = 'exact';
    else remaining.set(letter, (remaining.get(letter) ?? 0) + 1);
  });
  entered.forEach((letter, index) => {
    if (feedback[index] === 'exact') return;
    const available = remaining.get(letter) ?? 0;
    if (available > 0) {
      feedback[index] = 'present';
      remaining.set(letter, available - 1);
    }
  });
  return feedback;
}

export function validateWordGuess(round: WordRound, guess: string): string {
  if (typeof guess !== 'string' || guess.length > 100) invalid('Enter a valid word.');
  const normalized = normalizeWord(guess, round.publicConfig.locale);
  if (!normalized || !isSupportedWord(normalized)) invalid('Use letters only, without spaces, punctuation, or symbols.');
  if (segmentGraphemes(normalized).length !== round.publicConfig.length) invalid(`Enter exactly ${round.publicConfig.length} letters.`);
  if (round.publicConfig.dictionaryPolicy === 'custom') {
    const allowed = new Set([round.secretConfig.answer, ...round.secretConfig.allowedGuesses].map(word => normalizeWord(word, round.publicConfig.locale)));
    if (!allowed.has(normalized)) invalid('That word is not in this round’s approved word list.');
  }
  return normalized;
}

export function validateWord(round: WordRound): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const answer = normalizeWord(round.secretConfig.answer, round.publicConfig.locale);
  if (!answer || !isSupportedWord(answer)) errors.push(issue(round, 'secretConfig.answer', 'Use supported Latin letters only, without spaces or punctuation.'));
  if (segmentGraphemes(answer).length !== round.publicConfig.length) errors.push(issue(round, 'publicConfig.length', 'Word length must match the normalized answer’s grapheme count.'));
  round.secretConfig.allowedGuesses.forEach((word, index) => {
    const normalized = normalizeWord(word, round.publicConfig.locale);
    if (!normalized || !isSupportedWord(normalized) || segmentGraphemes(normalized).length !== round.publicConfig.length) {
      errors.push(issue(round, `secretConfig.allowedGuesses.${index}`, `Every approved guess must contain exactly ${round.publicConfig.length} supported letters.`));
    }
  });
  return errors;
}

export function scoreWordAttempt(attempt: number, maxAttempts: number): number {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > maxAttempts) return 0;
  return points(1000 - (attempt - 1) * 150);
}
