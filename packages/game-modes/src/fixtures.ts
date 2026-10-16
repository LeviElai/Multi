import {newId} from '../../contracts/src/id';
import type { ModeId, QuizInput, Round } from '../../contracts/src/index';

/** Author-defined examples: all numeric answers follow directly from the prompt. */
export function getDefaultRound(mode: ModeId): Round {
  const common = {
    id: newId(), schemaVersion: 1 as const, timerSeconds: 40,
    maxPoints: 1000 as const, provenance: 'creator_confirmed' as const, allowRevision: true,
  };
  switch (mode) {
    case 'fermi': return {
      ...common, mode, question: 'A square mosaic has 12 rows of 12 tiles. How many tiles are there?',
      explanation: '12 × 12 = 144 tiles. This is an author-defined arithmetic puzzle.',
      publicConfig: { unit: 'tiles', errorMode: 'proportional', min: 0, max: 1000, tolerance: 144, step: 1 },
      secretConfig: { answer: 144 },
    };
    case 'rare_answers': return {
      ...common, mode, question: 'Pick one name from our palette: Coral, Mint, Lilac, Lemon, or Sky. The least shared answer wins.',
      explanation: 'Only this puzzle’s five palette names are valid. Rarity is calculated from the room’s final valid answers.',
      publicConfig: { rarityMethod: 'live_room', adjudication: 'allowlist', locale: 'en', normalizationVersion: 'nfkc-en-v1' },
      secretConfig: { answers: ['Coral', 'Mint', 'Lilac', 'Lemon', 'Sky'].map(canonical => ({ canonical, aliases: [] })) },
    };
    case 'word_puzzle': return {
      ...common, mode, timerSeconds: 90, allowRevision: false,
      question: 'Find the five-letter word. Your clue: a looping path.',
      explanation: 'The creator’s selected word is ORBIT. Exact positions and remaining letters are matched in two passes.',
      publicConfig: { length: 5, maxAttempts: 6, locale: 'en', dictionaryPolicy: 'unrestricted_valid_chars' },
      secretConfig: { answer: 'ORBIT', allowedGuesses: [] },
    };
    case 'size_it_up': return {
      ...common, mode, question: 'Our block has an area of 240 square units and a width of 10 units. Resize its height beside the 10-unit reference.',
      explanation: 'The height is 240 ÷ 10 = 24 units, so its height is 24 ÷ 10 = 2.4 times the reference. The vector uses a calibrated 100-unit axis.',
      publicConfig: { unit: 'units', axis: 'height', referenceSize: 10, referenceLabel: '10-unit reference', targetLabel: 'Puzzle block', asset: 'block', minRatio: 0.25, maxRatio: 4, calibration: { version: 1, intrinsicDimension: 100, start: 0, end: 100 } },
      secretConfig: { targetSize: 24 },
    };
    case 'amountle': return {
      ...common, mode, question: 'Seven boxes hold eight tokens each. Drop the total number of tokens.',
      explanation: '7 × 8 = 56 tokens. The integer count controls scoring; animated tokens are decorative.',
      publicConfig: { unit: 'tokens', maxCount: 100, allowRemove: true, steps: [1, 10], showCount: true, tolerance: 28 },
      secretConfig: { answer: 56 },
    };
  }
}

export function getDemoQuiz(): QuizInput {
  return {
    title: 'A little friendly competition',
    description: 'Five different ways to play. A complete, creator-confirmed starter quiz with arithmetic, a custom palette, and a hidden word.',
    language: 'en', audienceContext: 'adult_private', theme: 'studio',
    rounds: (['fermi', 'rare_answers', 'word_puzzle', 'size_it_up', 'amountle'] as const).map(getDefaultRound),
  };
}
