import {MODE_META,type ModeId,type Round,type ArcadeRound} from '../../contracts/src/index';
import {getDefaultRound} from './fixtures';
import {isArcade} from './arcade';
export type QuestionType='single'|'multiple'|'boolean';
export type AnswerKind='integer'|'approximate'|'decimal'|'boolean'|'choice'|'word'|'multiple'|'list'|'size'|'text';
export type QuestionAnswer={type:QuestionType;kind:AnswerKind;text:string;answer:string;alternatives:string[];distractors:string[];unit:string;exact:boolean;requiredCount?:number};
export type Recommendation={games:ModeId[];reason:string;missing?:string;confidence:'high'|'moderate'|'low'};
import {stackScale} from './stack-scale';
export {stackScale} from './stack-scale';
export function recommend(q:QuestionAnswer,recent:ModeId[]=[]):Recommendation{
 const result=(games:ModeId[],reason:string,missing?:string,confidence:Recommendation['confidence']='high')=>({games,reason,missing,confidence});
 if(q.kind==='size')return result(['size_it_up'],'A calibrated target and reference are needed.');
 if(!q.answer.trim())return result([],'Enter the answer to find a suitable game.','What is the correct answer?','low');
 if(q.type==='boolean'||q.kind==='boolean'){const games:ModeId[]=['drop','sling'];games.sort((a,b)=>recent.slice(-3).filter(m=>m===a).length-recent.slice(-3).filter(m=>m===b).length);return result(games,'Two clear answers: True or False.');}
 if(q.type==='multiple'&&q.kind!=='list'&&q.answer.split('|').filter(s=>s.trim()).length+q.distractors.filter(s=>s.trim()).length>6)return result([],'Fish supports up to six choices.','Split this question into smaller questions. Your answers remain saved.','low');
 if(q.type==='multiple')return q.kind==='list'?result([],'Lists need to be rewritten as a choice question.','Enter the correct choices and at least one incorrect choice.','low'):q.distractors.some(s=>s.trim())?result(['fish'],'Catch every correct fish, then reel in your selection.'):result([],'Add an incorrect choice to make a playable fishing question.','Add at least one incorrect choice.','low');

 if(q.kind==='word')return /^[A-Za-z]{3,12}$/.test(q.answer)?result(['word_puzzle'],'A hidden word with letter feedback.'):result([],'Guess needs a single word of 3–12 letters.','Use a shorter word or add incorrect choices.','low');
 if(q.kind==='choice'){
  if(q.distractors.filter(s=>s.trim()).length>5)return result([],'Use up to six total choices.','Split this question into smaller questions. Your choices remain saved.','low');
  if(q.distractors.filter(s=>s.trim()).length<1)return result([],'Add incorrect choices to unlock the arcade games.','Add at least one incorrect choice.','low');
  const games:ModeId[]=q.distractors.filter(s=>s.trim()).length>3||[q.answer,...q.distractors].some(s=>s.length>40)?['fish']:['fish','claw','sling'];games.sort((a,b)=>recent.slice(-3).filter(m=>m===a).length-recent.slice(-3).filter(m=>m===b).length);
  return result(games,'One correct answer and distinct alternatives.');
 }
 if(q.kind==='text')return result([],'Add incorrect choices for Fish, Claw or Sling.','Or choose Hidden word for a word-guessing question.','low');
 const n=Number(q.answer),whole=Number.isSafeInteger(n),stack=stackScale(n).practical?['stack' as const]:[];
 if(!Number.isFinite(n)||Math.abs(n)>1e15)return result([],'Enter a supported numerical answer.',undefined,'low');
 if(q.kind==='approximate'||!q.exact)return result(['fermi',...(whole&&n>=0&&n<=999999?[...stack,'draw' as const]:[])],'This answer is scored by proximity.');
 if(whole&&n>=0&&n<=99999999&&(/\b(code|pin|digits?)\b/i.test(q.text)||/\b(in what year|which year|what year|year did|year was|year were|year of|born in|founded in)\b/i.test(q.text)))return result(['crack','draw','fermi'],'An exact year or code belongs on digit wheels.');
 if(!whole||n<0)return result(['fermi'],'Use exact numeric entry for decimals and negative values.');
 if(/\b(percent|temperature|degrees?|distance|length|height|width|weight|mass|speed|metres?|meters?|kilometres?|kilometers?|km|kg|celsius|fahrenheit)\b/i.test(q.text+' '+q.unit))return result(['fermi',...(n<=999?['draw' as const]:[])],'A measurement is clearest as a numerical estimate.');
 if(n<=120){const games:ModeId[]=['amountle',...stack];games.sort((a,b)=>recent.slice(-3).filter(m=>m===a).length-recent.slice(-3).filter(m=>m===b).length);return result([...games,'draw','fermi'],'A small whole quantity works well with pouring or building.');}
 if(n<=999)return result(['draw','fermi',...stack],'Draw this short whole number, then check it before submitting.');
 if(n<=99999999)return result(['fermi',...stack,...(n<=999999?['draw' as const]:[])],'Numerical entry keeps this larger quantity practical.');
 return result(['fermi'],'Exact numeric entry keeps a large answer practical.');
}
export function answerFromRound(r:Round):QuestionAnswer{
 const type=r.questionType??(r.mode==='drop'?'boolean':r.mode==='rare_answers'?'multiple':'single');
 const kind:AnswerKind=r.answerStructure??(r.mode==='word_puzzle'?'word':r.mode==='size_it_up'?'size':r.mode==='rare_answers'?'list':isArcade(r)?r.publicConfig.kind==='number'?'integer':r.publicConfig.kind:'approximate');
 let answer='',alternatives:string[]=[],distractors:string[]=[];
 if(r.mode==='rare_answers')answer=r.secretConfig.answers.map(x=>x.canonical).join('|');
 else if(r.mode==='size_it_up')answer=String(r.secretConfig.targetSize);
 else if(isArcade(r)){answer=r.mode==='crack'?String(r.secretConfig.answer).padStart(r.publicConfig.codeLength,'0'):String(r.secretConfig.answer);alternatives=r.secretConfig.acceptedAlternatives;distractors=r.publicConfig.options.filter(o=>!r.secretConfig.correctOptionIds.includes(o.id)).map(o=>o.label);if(kind==='multiple')answer=r.publicConfig.options.filter(o=>r.secretConfig.correctOptionIds.includes(o.id)).map(o=>o.label).join('|');}
 else answer=String(r.secretConfig.answer);
 return {type,kind,text:r.question,answer,alternatives,distractors,unit:'unit' in r.publicConfig?r.publicConfig.unit:'',requiredCount:isArcade(r)?r.publicConfig.requiredCount:undefined,exact:r.scoringPolicy==='exact'||kind!=='approximate'};
}
/** One canonical answer is translated between compatible interactions; no duplicate questions. */
export function roundFromAnswer(q:QuestionAnswer,mode:ModeId,old:Round):Round{
 const compatible=recommend(q).games;if(!compatible.includes(mode))mode=compatible[0]??'answer';
 const base=getDefaultRound(mode),n=Number(q.answer),safe=Number.isFinite(n)?n:0;
 const r={...base,speedScoring:'time-v1',id:old.id,question:q.text,answerProvided:!!q.answer.trim(),questionType:q.type,answerStructure:q.kind,scoringPolicy:q.exact?'exact' as const:'proximity' as const,provenance:old.provenance,sourceUrl:old.sourceUrl,explanation:old.explanation,allowRevision:false,timerSeconds:old.timerSeconds} as Round;
 if(r.mode==='fermi'){r.secretConfig.answer=safe;r.publicConfig={...r.publicConfig,unit:q.unit,min:-1e15,max:1e15,step:1e-6,errorMode:safe<=0?'absolute':'proportional',tolerance:Math.max(1,Math.abs(safe))};}
 if(r.mode==='amountle'){r.secretConfig.answer=safe;r.publicConfig={...r.publicConfig,unit:q.unit,maxCount:500,allowRemove:false,steps:[1],tolerance:Math.max(10,safe/2)};}
 if(r.mode==='word_puzzle'){r.secretConfig.answer=q.answer.toUpperCase();r.publicConfig.length=q.answer.length;}
 if(r.mode==='size_it_up'&&old.mode==='size_it_up')return {...old,speedScoring:'time-v1',question:q.text,questionType:q.type,answerStructure:'size'};
 if(isArcade(r)){
  const c=r.publicConfig,s=r.secretConfig;c.unit=q.unit;c.requiredCount=q.requiredCount;c.kind=q.type==='boolean'?'boolean':q.type==='multiple'?(q.kind==='list'?'list':'multiple'):q.kind==='choice'?'choice':q.kind==='text'||mode==='answer'?'text':'number';
  s.answer=q.type==='boolean'?q.answer==='true':c.kind==='number'?safe:q.answer;s.acceptedAlternatives=q.alternatives;
  const labels=q.kind==='multiple'?q.answer.split('|').map(s=>s.trim()).filter(Boolean):[q.answer];
  c.options=q.type==='boolean'?[{id:'true',label:'TRUE'},{id:'false',label:'FALSE'}]:q.kind==='choice'||q.kind==='multiple'?[...labels,...q.distractors.filter(s=>s.trim())].map((label,i)=>({id:`opt_${hash(old.id+label).toString(36)}`,label})):[];
  s.correctOptionIds=q.type==='boolean'?[String(s.answer)]:c.options.filter((_,i)=>i<labels.length).map(o=>o.id);
  if(r.mode==='fish'&&c.kind==='multiple')c.selectionScoring='balanced-v1';
  // Deterministic shuffle hides answer position without using the answer's value as a cue.
  c.options.sort((a,b)=>hash(old.id+a.id)-hash(old.id+b.id));
  c.codeLength=Math.max(1,Math.min(8,q.answer.length));c.max=r.mode==='crack'?10**c.codeLength-1:99999999;c.min=0;
  const scaling=stackScale(safe);
  c.step=1;c.blockValues=scaling.values;if(r.mode==='stack'){r.timerSeconds=Math.max(40,old.timerSeconds);c.stackPhysics='support-v1';} c.tolerance=Math.max(10,Math.abs(safe));
 }
 return r;
}
function hash(s:string){let h=2166136261;for(const x of s)h=Math.imul(h^x.charCodeAt(0),16777619);return h>>>0;}
export function questionSeed(type:QuestionType):Round{const r=getDefaultRound(type==='boolean'?'drop':'answer');r.question='';r.explanation='';r.answerProvided=false;r.questionType=type;r.answerStructure=type==='boolean'?'boolean':type==='multiple'?'multiple':'text';if(isArcade(r)){r.secretConfig.answer='';r.secretConfig.correctOptionIds=[];r.publicConfig.options=[];r.publicConfig.kind=type==='boolean'?'boolean':type==='multiple'?'multiple':'text';}return r;}
export const QUESTION_TYPES=[{id:'single',name:'Single Answer',detail:'A number, word or one correct choice.',sprite:'draw'},{id:'multiple',name:'Multiple Answers',detail:'Catch every correct choice.',sprite:'stack'},{id:'boolean',name:'True or False',detail:'One statement. Two possibilities.',sprite:'drop'}] as const;
export const interactionHelp=(mode:ModeId)=>MODE_META[mode].description;
