import {newId} from '../../contracts/src/id';
import { MODES, type ModeId, type QuizInput, type Round } from '../../contracts/src/index';

/** Author-defined examples: all numeric answers follow directly from the prompt. */
export function getDefaultRound(mode: ModeId): Round {
  const common = {
    id: newId(), schemaVersion: 1 as const, timerSeconds: 40,
    maxPoints: 1000 as const, provenance: 'creator_confirmed' as const, allowRevision: true,
  };
  if(['draw','claw','drop','sling','fish','stack','crack','answer'].includes(mode))return {
    ...common,mode:mode as 'draw',allowRevision:false,question:mode==='drop'?'An octopus has three hearts.': ['fish','claw','sling'].includes(mode)?'What is the capital of France?':'How many sides does a hexagon have?',
    scoringPolicy:'exact',questionType:mode==='drop'?'boolean':'single',
    publicConfig:{...(mode==='fish'?{fishScoring:'catch-v1' as const}:{}),...(mode==='crack'?{crackScoring:'deduction-v1' as const}:{}),unit:'',min:0,max:99999999,step:1,tolerance:100,codeLength:4,blockValues:[1,5,10,25],kind:mode==='drop'?'boolean':['fish','claw','sling'].includes(mode)?'choice':mode==='answer'?'text':'number',options:['fish','claw','sling'].includes(mode)?[{id:'a',label:'Rome'},{id:'b',label:'Paris'},{id:'c',label:'Berlin'}]:[]},
    secretConfig:{answer:mode==='drop'?true:['fish','claw','sling','answer'].includes(mode)?'Paris':6,acceptedAlternatives:[],correctOptionIds:['fish','claw','sling'].includes(mode)?['b']:[]}
  } as Round;
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
  throw new Error("Unknown interaction");
}

export function getDemoQuiz(): QuizInput {
  return {
    title: 'Arcade sampler',
    description: 'Eleven ways to play. Try each interaction before hosting.',
    language: 'en', audienceContext: 'adult_private', theme: 'studio',
    rounds: (['fermi','fish','word_puzzle','size_it_up','amountle'] as const).map(getDefaultRound),
  };
}

export function getArcadeQuiz():QuizInput{
 const quiz={...getDemoQuiz(),title:'The eleven-game arcade',rounds:MODES.map(getDefaultRound)};
 for(const r of quiz.rounds){
  if(r.mode==='fermi'){r.question='Approximately how many kilometres is Earth’s equatorial diameter?';r.secretConfig.answer=12756;r.publicConfig={...r.publicConfig,unit:'km',max:100000,tolerance:12756};r.sourceUrl='https://science.nasa.gov/earth/facts/';r.explanation='NASA gives an equatorial diameter of 12,756 km. The polar diameter is different.';}
  if(r.mode==='amountle'){r.question='What is the atomic number of gold?';r.secretConfig.answer=79;r.publicConfig={...r.publicConfig,unit:'protons',maxCount:160,tolerance:40};r.sourceUrl='https://periodic-table.rsc.org/element/79/Gold';r.explanation='Gold has 79 protons in its nucleus.';}
  if(r.mode==='draw'){r.question='What is the atomic number of oxygen?';r.secretConfig.answer=8;r.publicConfig.unit='';r.sourceUrl='https://periodic-table.rsc.org/element/8/oxygen';r.explanation='The Royal Society of Chemistry lists atomic number 8.';}
  if(r.mode==='stack'){r.question='How many countries founded the United Nations in 1945?';r.secretConfig.answer=51;r.publicConfig.unit='countries';r.sourceUrl='https://www.un.org/en/about-us';r.explanation='The United Nations began with 51 member states.';}
  if(r.mode==='crack'){r.question='In what year did World War II end?';r.secretConfig.answer=1945;r.publicConfig.unit='year';r.explanation='World War II ended in 1945.';}
  if(r.mode==='claw'){r.question='Which of these numbers is prime?';r.publicConfig.options=[{id:'a',label:'21'},{id:'b',label:'29'},{id:'c',label:'27'}];r.secretConfig.answer='29';r.explanation='29 has no positive divisors other than 1 and itself.';}
  if(r.mode==='sling'){r.question='Which planet is known as the Red Planet?';r.publicConfig.options=[{id:'a',label:'Venus'},{id:'b',label:'Mars'},{id:'c',label:'Jupiter'}];r.secretConfig.answer='Mars';r.explanation='Iron-rich minerals give Mars its reddish appearance.';}
 }
 return quiz;
}

/** New opt-in starter content. Previously saved quizzes retain their exact rounds. */
export function getWorkshopQuiz(): QuizInput {
 const quiz=getArcadeQuiz();quiz.title='The arcade warm-up';quiz.description='A little space, a hidden word, and some unexpected discoveries.';
 for(const r of quiz.rounds){
  if(r.mode==='rare_answers'){r.question='Name a living flightless bird. Try to choose one nobody else will.';r.secretConfig.answers=[{canonical:'Penguin',aliases:['penguins','emperor penguin','king penguin']},{canonical:'Ostrich',aliases:['ostriches']},{canonical:'Emu',aliases:['emus']},{canonical:'Kiwi',aliases:['kiwis','kiwi bird']},{canonical:'Cassowary',aliases:['cassowaries']},{canonical:'Rhea',aliases:['rheas']},{canonical:'Kakapo',aliases:['kākāpō','owl parrot']},{canonical:'Takahe',aliases:['takahē','south island takahe']}];r.explanation='This round groups penguin species as Penguin. Ostrich, emu, kiwi, cassowary, rhea, kākāpō and takahē are also in the accepted set. Matching answers share the same score.';r.publicConfig.adjudication='host_review';}
  if(r.mode==='word_puzzle'){r.question='Five letters: flat and even. Read it backwards and it stays the same.';r.secretConfig.answer='LEVEL';r.explanation='LEVEL is a palindrome. Both Ls and both Es count separately.';}
  if(r.mode==='size_it_up'){r.question='A city car beside a 1.75 m ruler. Resize it to the length you would expect.';r.secretConfig.targetSize=4.2;r.publicConfig={...r.publicConfig,axis:'width',referenceSize:1.75,referenceLabel:'1.75 m reference',targetLabel:'City car',asset:'car',referenceAsset:'block',minRatio:0.5,maxRatio:5};r.explanation='Our reference city car is 4.2 m long, or 2.4 times the 1.75 m ruler. Real models vary.';}
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
