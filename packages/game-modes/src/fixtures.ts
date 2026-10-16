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
      explanation: '12 rows × 12 tiles = 144 tiles.',
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
      explanation: 'An orbit is the looping path of one object around another.',
      publicConfig: { length: 5, maxAttempts: 6, locale: 'en', dictionaryPolicy: 'unrestricted_valid_chars' },
      secretConfig: { answer: 'ORBIT', allowedGuesses: [] },
    };
    case 'size_it_up': return {
      ...common, mode, question: 'Resize the tree to 24 metres beside the 10-metre tower.',
      explanation: 'The tree is 24 metres tall: 2.4 times the 10-metre tower.',
      publicConfig: { unit: 'm', axis: 'height', referenceSize: 10, referenceLabel: '10 m tower', targetLabel: 'Tree', asset: 'tree', referenceAsset: 'tower', minRatio: 0.25, maxRatio: 4, calibration: { version: 1, intrinsicDimension: 100, start: 0, end: 100 } },
      secretConfig: { targetSize: 24 },
    };
    case 'amountle': return {
      ...common, mode, question: 'Seven trays hold eight sweets each. How many sweets are there?',
      explanation: '7 × 8 = 56 sweets. Your last accepted pour is your answer.',
      publicConfig: { unit: 'sweets', maxCount: 100, allowRemove: false, steps: [1, 10], showCount: true, tolerance: 28 },
      secretConfig: { answer: 56 },
    };
  }
}

export function getDemoQuiz(): QuizInput {
  return {
    title: 'Five-game starter',
    description: 'Five rounds: numbers, rare answers, a hidden word, sizing and sweets.',
    language: 'en', audienceContext: 'adult_private', theme: 'studio',
    rounds: (['fermi', 'rare_answers', 'word_puzzle', 'size_it_up', 'amountle'] as const).map(getDefaultRound),
  };
}
