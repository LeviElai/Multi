import {createHash} from 'node:crypto';
import {z} from 'zod';
import {MODES} from '../../../packages/contracts/src/index';
import {NUMERIC_FACTS,isApproximateFact} from './numeric-facts';
import {DAILY_POOL} from './daily-pool';
import {DailyQuestionSchema} from './daily-question';

export const DailyArcadeRoundSchema=DailyQuestionSchema.extend({mode:z.enum(MODES)}).strict();
export const DailyArcadeSchema=z.array(DailyArcadeRoundSchema).length(5).superRefine((rounds,ctx)=>{
 if(new Set(rounds.map(r=>r.mode)).size!==5||new Set(rounds.map(r=>r.id)).size!==5)ctx.addIssue({code:'custom',message:'Daily games and questions must be distinct'});
 for(const r of rounds)if(new Set(r.options.map(x=>x.toLowerCase())).size!==4)ctx.addIssue({code:'custom',message:'Duplicate choices'});
});
export type DailyArcadeRound=z.infer<typeof DailyArcadeRoundSchema>;
const numeric=new Set(['amountle','fermi','draw','size_it_up','stack','crack']);
const families={action:['fish','claw','sling','drop'],tactile:['draw','stack','amountle','size_it_up'],puzzle:['fermi','crack','word_puzzle']} as const;
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const numberQuestions=NUMERIC_FACTS.map(f=>DailyQuestionSchema.parse({id:'fact-'+f.id,question:f.question,options:(f.answer<=10?[f.answer,f.answer+1,f.answer+2,f.answer+3]:[f.answer,Math.max(1,Math.round(f.answer*.7)),Math.round(f.answer*1.3)+1,Math.round(f.answer*1.6)+3]).map(String),answer:0,category:'Numbers',difficulty:f.difficulty,sourceUrl:f.sourceUrl,explanation:f.explanation}));
export function eligibleArcadeQuestions(mode:(typeof MODES)[number]){
 return (numeric.has(mode)?numberQuestions:DAILY_POOL).filter(q=>{
  const fact=NUMERIC_FACTS.find(f=>q.id==='fact-'+f.id);
  if(numeric.has(mode)&&(!fact||!Number.isInteger(fact.answer)))return false;
  if(['amountle','stack'].includes(mode)&&(!fact||fact.answer>100||fact.answer<1||isApproximateFact(fact)))return false;
  if(mode==='crack'&&(!fact||fact.answer>9999||isApproximateFact(fact)))return false;
  if(mode==='draw'&&(!fact||fact.answer>9999||isApproximateFact(fact)))return false;
  if(mode==='size_it_up'&&(!fact||!fact.id.endsWith('-diameter')||fact.id==='earth-diameter'))return false;
  if(mode==='word_puzzle'&&!/^[a-z]{3,12}$/i.test(q.options[q.answer]))return false;
  return true;
 });
}
export function selectDailyArcade(day:string,recent:readonly DailyArcadeRound[][]=[],preferred:readonly string[]=[]):DailyArcadeRound[]{
 const frequency=new Map(MODES.map(mode=>[mode,recent.flat().filter(r=>r.mode===mode).length]));
 const previous=recent[0]?.map(r=>r.mode).join(',');
 const ranked=(family:readonly (typeof MODES)[number][])=>[...family].sort((a,b)=>(frequency.get(a)??0)-(frequency.get(b)??0)||hash(day+':mode:'+a).localeCompare(hash(day+':mode:'+b)));
 const modes=[...ranked(families.action).slice(0,2),...ranked(families.tactile).slice(0,2),...ranked(families.puzzle).slice(0,1)]
  .sort((a,b)=>hash(day+':order:'+a).localeCompare(hash(day+':order:'+b)));
 if(modes.join(',')===previous)modes.reverse();
 const used=new Set<string>(),sources=new Set<string>();
 const rounds=modes.map((mode,i)=>{
  const difficulty=(['easy','medium','medium','medium','challenging'] as const)[i];
  const applicable=eligibleArcadeQuestions(mode).sort((a,b)=>Number(a.difficulty!==difficulty)-Number(b.difficulty!==difficulty)||Number(recent.some(day=>day.some(r=>r.id===a.id)))-Number(recent.some(day=>day.some(r=>r.id===b.id)))||Number(!preferred.includes(a.id))-Number(!preferred.includes(b.id))||hash(day+':'+mode+':'+a.id).localeCompare(hash(day+':'+mode+':'+b.id)));
  const q=applicable.find(q=>!used.has(q.id)&&!sources.has(q.sourceUrl))??applicable.find(q=>!used.has(q.id));
  if(!q)throw Error(`Insufficient reviewed daily content for ${mode}`);
  used.add(q.id);sources.add(q.sourceUrl);
  // Shuffle the four answers once, before publication, so the correct answer
  // never occupies a predictable position. All players see the same order.
  const shuffled=q.options.map((text,index)=>({text,index})).sort((a,b)=>hash(day+':'+q.id+':'+a.text).localeCompare(hash(day+':'+q.id+':'+b.text)));
  return {...q,mode,options:shuffled.map(v=>v.text),answer:shuffled.findIndex(v=>v.index===q.answer)};
 });
 return DailyArcadeSchema.parse(rounds);
}
