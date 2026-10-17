import type {ArcadeRound,Submission,ValidationIssue} from '../../contracts/src/index';
import {invalid,issue,normalizeAnswer,points} from './shared';

export const ARCADE_MODES=['draw','claw','drop','sling','fish','stack','crack','answer'] as const;
export function isArcade(round:{mode:string}):round is ArcadeRound{return (ARCADE_MODES as readonly string[]).includes(round.mode);}
export function validateArcade(r:ArcadeRound):ValidationIssue[]{
 const c=r.publicConfig,s=r.secretConfig,out:ValidationIssue[]=[];
 if(c.min>=c.max)out.push(issue(r,'publicConfig.max','Maximum must be greater than minimum.'));
 if(['draw','stack','crack'].includes(r.mode)){
  if(typeof s.answer!=='number'||!Number.isSafeInteger(s.answer)||s.answer<c.min||s.answer>c.max)out.push(issue(r,'secretConfig.answer','Enter a whole number within the allowed range.'));
  if(r.mode==='draw'&&Number(s.answer)<0)out.push(issue(r,'secretConfig.answer','Draw currently supports non-negative whole numbers.'));
  if(r.mode==='crack'&&(Number(s.answer)<0||Number(s.answer)>=10**c.codeLength))out.push(issue(r,'secretConfig.answer','The answer must fit the code wheels.'));
  if(r.mode==='stack'&&(Number(s.answer)<0||c.blockValues.some(v=>v%c.step!==0)||Number(s.answer)%c.step!==0))out.push(issue(r,'publicConfig.step','The answer and blocks must fit the declared unit scale.'));
 }
 if(['claw','fish','sling'].includes(r.mode)||(r.mode==='answer'&&c.kind==='multiple')){
  const ids=c.options.map(o=>o.id),labels=c.options.map(o=>normalizeAnswer(o.label));
  if(c.options.length<2||new Set(ids).size!==ids.length||new Set(labels).size!==labels.length)out.push(issue(r,'publicConfig.options','Add 2–6 distinct answer choices.'));
  if(!s.correctOptionIds.length||s.correctOptionIds.some(id=>!ids.includes(id))||new Set(s.correctOptionIds).size!==s.correctOptionIds.length)out.push(issue(r,'secretConfig.correctOptionIds','Select the correct choices.'));
  if(r.mode!=='answer'&&s.correctOptionIds.length!==1)out.push(issue(r,'secretConfig.correctOptionIds','This game requires exactly one correct choice.'));
 }
 if(r.mode==='drop'&&typeof s.answer!=='boolean')out.push(issue(r,'secretConfig.answer','Choose True or False.'));
 if(r.mode==='answer'&&['text','list'].includes(c.kind)&&!String(s.answer).trim())out.push(issue(r,'secretConfig.answer','Enter the accepted answer or required list.'));
 return out;
}
export function sanitizeArcade(r:ArcadeRound,p:Record<string,unknown>):Submission['payload']{
 const c=r.publicConfig;
 if(['draw','stack','crack'].includes(r.mode)){
  const v=p.value;if(typeof v!=='number'||!Number.isSafeInteger(v)||v<c.min||v>c.max||(r.mode==='crack'&&v>=10**c.codeLength)||(r.mode==='stack'&&v%c.step!==0))invalid('Enter a whole number within the allowed range.');
  return {value:v as number};
 }
 if(r.mode==='drop'){if(p.choiceId!=='true'&&p.choiceId!=='false')invalid('Choose True or False.');return {choiceId:p.choiceId as string};}
 if(['claw','sling','fish'].includes(r.mode)){if(typeof p.choiceId!=='string'||!c.options.some(o=>o.id===p.choiceId))invalid('Choose an answer from this round.');return {choiceId:p.choiceId as string};}
 if(c.kind==='multiple'||c.kind==='list'){
  if(!Array.isArray(p.choices)||!p.choices.length||p.choices.length>30||p.choices.some(x=>typeof x!=='string'||x.length>100))invalid('Enter your selected answers.');
  const choices=(p.choices as string[]).map(x=>x.trim());
  if(new Set(choices.map(normalizeAnswer)).size!==choices.length)invalid('Each answer can appear once.');
  if(c.kind==='multiple'&&choices.some(id=>!c.options.some(o=>o.id===id)))invalid('Choose answers from this round.');
  return {choices};
 }
 if(typeof p.text!=='string'||!p.text.trim()||p.text.length>100)invalid('Enter your answer.');return {text:(p.text as string).trim()};
}
export function arcadeAnswer(r:ArcadeRound):string|number{
 if(r.publicConfig.options.length)return r.publicConfig.options.filter(o=>r.secretConfig.correctOptionIds.includes(o.id)).map(o=>o.label).join(', ');
 return typeof r.secretConfig.answer==='boolean'?(r.secretConfig.answer?'True':'False'):r.secretConfig.answer;
}
export function scoreArcade(r:ArcadeRound,p:Submission['payload']):{points:number;value?:number;selected:string;correct:boolean}{
 const s=r.secretConfig,c=r.publicConfig;let correct=false,n=0;
 let selected=p.text??p.choices?.join(', ')??c.options.find(o=>o.id===p.choiceId)?.label??p.choiceId??String(p.value??'');
 if(p.value!==undefined){correct=p.value===s.answer;n=correct?1000:r.scoringPolicy==='proximity'?points(1000*(1-Math.abs(p.value-Number(s.answer))/c.tolerance)):0;}
 else if(r.mode==='drop'){correct=p.choiceId===String(s.answer);selected=p.choiceId==='true'?'True':'False';n=correct?500:0;}
 else if(p.choiceId!==undefined){correct=s.correctOptionIds.includes(p.choiceId);n=correct?Math.round(1000*(1-1/c.options.length)):0;}
 else if(c.kind==='multiple'){correct=JSON.stringify([...(p.choices??[])].sort())===JSON.stringify([...s.correctOptionIds].sort());n=correct?1000:0;selected=c.options.filter(o=>p.choices?.includes(o.id)).map(o=>o.label).join(', ');}
 else if(c.kind==='list'){const expected=String(s.answer).split('|').map(normalizeAnswer).sort();correct=JSON.stringify((p.choices??[]).map(normalizeAnswer).sort())===JSON.stringify(expected);n=correct?1000:0;}
 else {correct=[String(s.answer),...s.acceptedAlternatives].some(a=>normalizeAnswer(a)===normalizeAnswer(p.text??''));n=correct?1000:0;}
 return {points:n,selected,correct,...(p.value!==undefined?{value:p.value}:{})};
}
