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
      ...common, mode, question: 'Calibration: resize the tree to 24 metres beside the 10-metre tower.',
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

/** New opt-in starter content. Previously saved quizzes retain their exact rounds. */
export function getWorkshopQuiz(): QuizInput {
 const quiz=getDemoQuiz();quiz.title='The five-game warm-up';quiz.description='A little space, a hidden word, and some unexpected discoveries.';
 for(const r of quiz.rounds){
  if(r.mode==='fermi'){r.question='Light travels about 300,000 km each second. Roughly how far does it travel in eight minutes?';r.secretConfig.answer=144000000;r.publicConfig={...r.publicConfig,unit:'km',max:1e9,tolerance:144000000};r.explanation='Eight minutes is 480 seconds. 480 × 300,000 = 144 million km.';}
  if(r.mode==='rare_answers'){r.question='Name a living flightless bird. Try to choose one nobody else will.';r.secretConfig.answers=[{canonical:'Penguin',aliases:['penguins','emperor penguin','king penguin']},{canonical:'Ostrich',aliases:['ostriches']},{canonical:'Emu',aliases:['emus']},{canonical:'Kiwi',aliases:['kiwis','kiwi bird']},{canonical:'Cassowary',aliases:['cassowaries']},{canonical:'Rhea',aliases:['rheas']},{canonical:'Kakapo',aliases:['kākāpō','owl parrot']},{canonical:'Takahe',aliases:['takahē','south island takahe']}];r.explanation='This round groups penguin species as Penguin. Ostrich, emu, kiwi, cassowary, rhea, kākāpō and takahē are also in the accepted set. Matching answers share the same score.';r.publicConfig.adjudication='host_review';}
  if(r.mode==='word_puzzle'){r.question='Five letters: flat and even. Read it backwards and it stays the same.';r.secretConfig.answer='LEVEL';r.explanation='LEVEL is a palindrome. Both Ls and both Es count separately.';}
  if(r.mode==='size_it_up'){r.question='A city car beside a 1.75 m ruler. Resize it to the length you would expect.';r.secretConfig.targetSize=4.2;r.publicConfig={...r.publicConfig,axis:'width',referenceSize:1.75,referenceLabel:'1.75 m reference',targetLabel:'City car',asset:'car',referenceAsset:'block',minRatio:0.5,maxRatio:5};r.explanation='Our reference city car is 4.2 m long, or 2.4 times the 1.75 m ruler. Real models vary.';}
  if(r.mode==='amountle'){r.question='A party has six tables, each with eight guests. Drop one sweet for every guest.';r.secretConfig.answer=48;r.publicConfig={...r.publicConfig,maxCount:120,unit:'sweets'};r.explanation='6 tables × 8 guests = 48 sweets.';}
 }
 return quiz;
}

/** A new authored round starts with no example question or reveal. Saved quizzes are untouched. */
export function getEmptyRound(mode:ModeId):Round{
 const round=getDefaultRound(mode);round.question='';round.explanation='';
 if(round.mode==='rare_answers')round.secretConfig.answers=[];
 if(round.mode==='word_puzzle')round.secretConfig.answer='';
 return round;
}
