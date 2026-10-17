import {MODE_META,type ModeId,type Round,type ArcadeRound} from '../../contracts/src/index';
import {getDefaultRound} from './fixtures';
import {isArcade} from './arcade';
export type QuestionType='single'|'multiple'|'boolean';
export type AnswerKind='integer'|'approximate'|'decimal'|'boolean'|'choice'|'word'|'multiple'|'list'|'size'|'text';
export type QuestionAnswer={type:QuestionType;kind:AnswerKind;text:string;answer:string;alternatives:string[];distractors:string[];unit:string;exact:boolean;requiredCount?:number};
export type Recommendation={games:ModeId[];reason:string;missing?:string;confidence:'high'|'moderate'|'low'};
export function recommend(q:QuestionAnswer,recent:ModeId[]=[]):Recommendation{
 const result=(games:ModeId[],reason:string,missing?:string,confidence:Recommendation['confidence']='high')=>({games,reason,missing,confidence});
 if(q.kind==='size')return result(['size_it_up'],'A calibrated target and reference are needed.');
 if(!q.answer.trim())return result(['answer'],'Enter the answer to find a suitable game.','What is the correct answer?','low');
 if(q.type==='boolean'||q.kind==='boolean')return result(['drop'],'A statement with a True or False answer.');
 if(q.type==='multiple')return result(['answer'],q.kind==='list'?'Players enter every required answer.':'Players select every correct choice.');

 if(q.kind==='word')return /^[A-Za-z]{3,12}$/.test(q.answer)?result(['word_puzzle'],'A hidden word with letter feedback.'):result(['answer'],'Guess needs a single word of 3–12 letters.','Use a shorter word or keep text entry.','low');
 if(q.kind==='choice'){
  if(q.distractors.filter(s=>s.trim()).length<1)return result(['answer'],'Add incorrect choices to unlock the arcade games.','Add at least one incorrect choice.','low');
  const games:ModeId[]=q.distractors.filter(s=>s.trim()).length>3?['fish']:['fish','claw','sling'];games.sort((a,b)=>recent.slice(-3).filter(m=>m===a).length-recent.slice(-3).filter(m=>m===b).length);
  return result(games,'One correct answer and distinct alternatives.');
 }
 if(q.kind==='text')return result(['answer'],'A factual short answer. Add choices to use Fish, Claw or Sling.',undefined,'moderate');
 const n=Number(q.answer),whole=Number.isSafeInteger(n);
 if(!Number.isFinite(n)||Math.abs(n)>1e15)return result(['answer'],'Enter a supported numerical answer.',undefined,'low');
 if(q.kind==='approximate'||!q.exact)return result(['fermi',...(whole&&n>=0&&n<=999999?['stack' as const,'draw' as const]:[])],'This answer is scored by proximity.');
 if(whole&&n>=0&&n<=99999999&&/\b(year|date|code|pin|digits?)\b/i.test(q.text))return result(['crack','draw','fermi'],'An exact year or code belongs on digit wheels.');
 if(!whole||n<0)return result(['fermi'],'Use exact numeric entry for decimals and negative values.');
 if(n<=120&&!/\b(year|code|percent|temperature|degrees?)\b/i.test(q.text+' '+q.unit))return result(['amountle','stack','draw','fermi'],'A small whole quantity works well with pouring.');
 if(n<=999999)return result(['stack','draw','crack','fermi'],'A whole number can be built, drawn or entered exactly.');
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
 const compatible=recommend(q).games;if(!compatible.includes(mode))mode=compatible[0];
 const base=getDefaultRound(mode),n=Number(q.answer),safe=Number.isFinite(n)?n:0;
 const r={...base,id:old.id,question:q.text,answerProvided:!!q.answer.trim(),questionType:q.type,answerStructure:q.kind,scoringPolicy:q.exact?'exact' as const:'proximity' as const,provenance:old.provenance,sourceUrl:old.sourceUrl,explanation:old.explanation,allowRevision:false,timerSeconds:old.timerSeconds} as Round;
 if(r.mode==='fermi'){r.secretConfig.answer=safe;r.publicConfig={...r.publicConfig,unit:q.unit,min:-1e15,max:1e15,step:1e-6,errorMode:safe<=0?'absolute':'proportional',tolerance:Math.max(1,Math.abs(safe))};}
 if(r.mode==='amountle'){r.secretConfig.answer=safe;r.publicConfig={...r.publicConfig,unit:q.unit,maxCount:500,allowRemove:false,steps:[1],tolerance:Math.max(10,safe/2)};}
 if(r.mode==='word_puzzle'){r.secretConfig.answer=q.answer.toUpperCase();r.publicConfig.length=q.answer.length;}
 if(r.mode==='size_it_up'&&old.mode==='size_it_up')return {...old,question:q.text,questionType:q.type,answerStructure:'size'};
 if(isArcade(r)){
  const c=r.publicConfig,s=r.secretConfig;c.unit=q.unit;c.requiredCount=q.requiredCount;c.kind=q.type==='boolean'?'boolean':q.type==='multiple'?(q.kind==='list'?'list':'multiple'):q.kind==='choice'?'choice':q.kind==='text'||mode==='answer'?'text':'number';
  s.answer=q.type==='boolean'?q.answer==='true':c.kind==='number'?safe:q.answer;s.acceptedAlternatives=q.alternatives;
  const labels=q.kind==='multiple'?q.answer.split('|').map(s=>s.trim()).filter(Boolean):[q.answer];
  c.options=q.kind==='choice'||q.kind==='multiple'?[...labels,...q.distractors.filter(s=>s.trim())].map((label,i)=>({id:`opt_${hash(old.id+label).toString(36)}`,label})):[];
  s.correctOptionIds=c.options.filter((_,i)=>i<labels.length).map(o=>o.id);
  // Deterministic shuffle hides answer position without using the answer's value as a cue.
  c.options.sort((a,b)=>hash(old.id+a.id)-hash(old.id+b.id));
  c.codeLength=Math.max(1,Math.min(8,q.answer.length));c.max=r.mode==='crack'?10**c.codeLength-1:99999999;c.min=0;
  const scale=safe>10000?10**Math.max(0,Math.floor(Math.log10(safe))-2):1;
  c.step=safe%scale===0?scale:1;c.blockValues=[1,5,10,25].map(v=>v*c.step);c.tolerance=Math.max(10,Math.abs(safe));
 }
 return r;
}
function hash(s:string){let h=2166136261;for(const x of s)h=Math.imul(h^x.charCodeAt(0),16777619);return h>>>0;}
export function questionSeed(type:QuestionType):Round{const r=getDefaultRound(type==='boolean'?'drop':'answer');r.question='';r.explanation='';r.answerProvided=false;r.questionType=type;r.answerStructure=type==='boolean'?'boolean':type==='multiple'?'multiple':'text';if(isArcade(r)){r.secretConfig.answer='';r.secretConfig.correctOptionIds=[];r.publicConfig.options=[];r.publicConfig.kind=type==='boolean'?'boolean':type==='multiple'?'multiple':'text';}return r;}
export const QUESTION_TYPES=[{id:'single',name:'Single Answer',detail:'A number, word or one correct choice.',sprite:'draw'},{id:'multiple',name:'Multiple Answers',detail:'Select every correct option or enter a list.',sprite:'stack'},{id:'boolean',name:'True or False',detail:'One statement. Two possibilities.',sprite:'drop'}] as const;
export const interactionHelp=(mode:ModeId)=>MODE_META[mode].description;
