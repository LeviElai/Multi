import {MODE_META,MODES,type ModeId,type Round} from '../../contracts/src/index';
import {publicQuestionProjection,sanitizeAndValidateSubmission,scoreRound,validateAuthorConfig} from './index';
import type {AnswerKind} from './question';
const definitions:Record<typeof MODES[number],{answers:AnswerKind[];requires:string[];asset:string;alternative:string;scoring:string}>={
 amountle:{answers:['integer'],requires:['maxCount','unit'],asset:'factory',alternative:'Tap or hold the pour button; no removal or numeric shortcut.',scoring:'Exact or published Count proximity policy.'},
 fermi:{answers:['integer','approximate','decimal'],requires:['min','max','step','errorMode'],asset:'stars',alternative:'Keyboard or mobile numeric entry.',scoring:'Exact, proportional ratio, or linear absolute distance; explicitly configured.'},
 word_puzzle:{answers:['word'],requires:['length','maxAttempts'],asset:'library',alternative:'Physical and onscreen keyboard.',scoring:'1000 minus 150 per additional attempt; unsolved zero.'},
 draw:{answers:['integer'],requires:['min','max'],asset:'ink',alternative:'Correct recognized digits or type instead.',scoring:'Confirmed number only. Handwriting is never scored.'},
 size_it_up:{answers:['size'],requires:['referenceSize','axis','calibration'],asset:'workshop',alternative:'Slider and fine adjustment buttons.',scoring:'Proportional error using calibrated real dimensions.'},
 claw:{answers:['choice'],requires:['options'],asset:'prizes',alternative:'Keyboard slider, left/right and Grab.',scoring:'Correct: round(1000 × (1 − 1/options)); wrong: zero.'},
 drop:{answers:['boolean'],requires:[],asset:'carnival',alternative:'Aim True or Aim False, then Drop.',scoring:'Correct 500, incorrect zero. Landing animation never changes the choice.'},
 sling:{answers:['choice'],requires:['options'],asset:'grove',alternative:'Keyboard slider and Launch, or focus a target and press Enter.',scoring:'Same choice policy as Claw; no dexterity bonus.'},
 fish:{answers:['choice'],requires:['options'],asset:'reef',alternative:'Keep answers still; keyboard-accessible answer buttons.',scoring:'Same choice policy as Claw; no speed bonus.'},
 stack:{answers:['integer','approximate'],requires:['step','blockValues','max'],asset:'cloudworks',alternative:'Numbered block buttons and Undo.',scoring:'Represented value, exact or configured linear proximity.'},
 crack:{answers:['integer'],requires:['codeLength'],asset:'vault',alternative:'Type code or use individual digit buttons.',scoring:'Exact code; no partial digit or speed bonus.'},
};
/** Shared inventory, with server-safe functions independent of React/graphics. */
type Interaction=typeof definitions[typeof MODES[number]]&{id:ModeId;name:string;description:string;playerComponent:string;revealComponent:string;mobile:string;validate:typeof validateAuthorConfig;sanitize:typeof sanitizeAndValidateSubmission;score:typeof scoreRound;project:typeof publicQuestionProjection};
export const INTERACTIONS=MODES.reduce((registry,mode)=>{
 registry[mode]={id:mode,...MODE_META[mode],...definitions[mode],playerComponent:['amountle','fermi','word_puzzle','size_it_up'].includes(mode)?'ModePlayer':'ArcadePlayer',revealComponent:'RoundVisualization',mobile:'Touch-first controls; responsive pixel scene.',validate:validateAuthorConfig,sanitize:sanitizeAndValidateSubmission,score:scoreRound,project:publicQuestionProjection};
 return registry;
},{} as Record<typeof MODES[number],Interaction>);
