import {roundFromAnswer,type QuestionAnswer} from '../../../packages/game-modes/src/question';
import {curatedWord} from './quiz-words';
import {normalizeAnswer} from '../../../packages/game-modes/src/shared';
import { z } from 'zod';
import { DomainError, MODES, QuizInputSchema, type QuizInput, type Round } from '../../../packages/contracts/src/index';
import type { Store } from '../../../packages/db/src/types';
import { getDefaultRound, validateQuiz } from '../../../packages/game-modes/src/index';
import { digestToken, idempotentId } from './security';

export const GenerationInput = z.object({topic:z.string().trim().min(3).max(300),count:z.number().int().min(1).max(20),language:z.literal('en').default('en'),difficulty:z.enum(['easy','mixed','challenging']).default('mixed'),instructions:z.string().trim().max(600).default(''),modes:z.array(z.enum(MODES)).min(1).max(11).default(['fermi','fish','drop','stack','word_puzzle'])}).strict();
export type GenerationRequest=z.infer<typeof GenerationInput>;
type Job={id:string;owner_id:string;request_json:string;request_hash:string;status:string;requested:number;period:string;result_json:string|null;quiz_id:string|null;lease_token:string|null;error_code?:string|null;updated_at:string};
export const quotaPeriod=(now=new Date())=>now.toISOString().slice(0,7);
export async function quota(store:Store,owner:string,now=new Date()){
 const period=quotaPeriod(now);
 const row=(await store.db.query<{allowance:number;reserved:number;consumed:number}>('SELECT allowance,reserved,consumed FROM ai_usage_periods WHERE owner_id=? AND period=?',[owner,period])).rows[0];
 const allowance=Number(row?.allowance??20),used=Number(row?.consumed??0),reserved=Number(row?.reserved??0);
 return {period,base:20,allowance,used,reserved,remaining:Math.max(0,allowance-used-reserved),resetsAt:new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)).toISOString()};
}
export async function queueGeneration(store:Store,owner:string,key:string,input:GenerationRequest,now=new Date()){
 const id=await idempotentId('ai-generation',owner,key),hash=await digestToken(JSON.stringify(input)),period=quotaPeriod(now),stamp=now.toISOString(),nonce=crypto.randomUUID();
 const prior=(await store.db.query<Job>('SELECT * FROM creator_generations WHERE id=? AND owner_id=?',[id,owner])).rows[0];
 if(prior){if(prior.request_hash!==hash)throw new DomainError('IDEMPOTENCY_CONFLICT','This request key belongs to another topic.',409);return jobView(prior);}
 await store.db.batch([
  {sql:'INSERT INTO ai_usage_periods (owner_id,period,allowance,reserved,consumed) VALUES (?,?,20,0,0) ON CONFLICT(owner_id,period) DO NOTHING',params:[owner,period]},
  {sql:"INSERT INTO creator_generations (id,owner_id,request_hash,request_json,requested,period,status,lease_token,created_at,updated_at) VALUES (?,?,?,?,?,?,'pending',?,?,?) ON CONFLICT(id) DO NOTHING",params:[id,owner,hash,JSON.stringify(input),input.count,period,nonce,stamp,stamp]},
  {sql:"UPDATE ai_usage_periods SET reserved=reserved+?,mutation_token=? WHERE owner_id=? AND period=? AND allowance-consumed-reserved>=? AND EXISTS(SELECT 1 FROM creator_generations WHERE id=? AND status='pending' AND lease_token=?)",params:[input.count,nonce,owner,period,input.count,id,nonce]},
  {sql:"UPDATE creator_generations SET status=CASE WHEN EXISTS(SELECT 1 FROM ai_usage_periods WHERE owner_id=? AND period=? AND mutation_token=?) THEN 'queued' ELSE 'rejected' END WHERE id=? AND status='pending' AND lease_token=?",params:[owner,period,nonce,id,nonce]}
 ]);
 const job=(await store.db.query<Job>('SELECT * FROM creator_generations WHERE id=?',[id])).rows[0];
 if(job.status==='rejected')throw new DomainError('AI_QUOTA','You have no room for that many questions this month. Try a smaller quiz.',429);
 return jobView(job);
}
const jobView=(job:Job)=>({id:job.id,status:job.status,quizId:job.quiz_id,message:job.status==='failed'?(job.error_code==='PROVIDER_UNAVAILABLE'?'The question maker is temporarily unavailable. Your credits were returned.':job.error_code==='TIMEOUT'?'The request took too long. Your credits were returned.':'The draft did not pass the game checks. Your credits were returned. Try a narrower topic or fewer game types.'):undefined});
function failureCode(error:unknown){const message=error instanceof Error?error.message:'';return /timeout|abort|Incomplete generation/i.test(message)?'TIMEOUT':/Provider status|fetch failed/i.test(message)?'PROVIDER_UNAVAILABLE':error instanceof z.ZodError?('ANSWER_FORMAT:'+error.issues.slice(0,3).map(i=>i.path.join('.')+':'+i.code).join(',')).slice(0,240):'GAME_CHECK';}
export async function generationStatus(store:Store,owner:string,id:string){const job=(await store.db.query<Job>('SELECT * FROM creator_generations WHERE id=? AND owner_id=?',[id,owner])).rows[0];if(!job)throw new DomainError('NOT_FOUND','This generation is unavailable.',404);return jobView(job);}

// Structured, bounded output; the model cannot select IDs, provenance, URLs or execute tools.
const generatedSchema=z.object({title:z.string().min(1).max(100),questions:z.array(z.object({mode:z.enum(MODES),question:z.string().min(1).max(250),explanation:z.string().max(320),answer:z.union([z.number().finite(),z.string().max(100),z.boolean()]).optional(),options:z.array(z.string().trim().min(1).max(80)).min(2).max(6).optional(),unit:z.string().max(30).optional(),word:z.string().regex(/^[A-Z]{3,12}$/).optional(),answers:z.array(z.object({canonical:z.string().min(1).max(100),aliases:z.array(z.string().max(100)).max(8)})).min(2).max(32).optional(),referenceSize:z.number().positive().optional(),referenceLabel:z.string().max(60).optional(),targetLabel:z.string().max(60).optional(),asset:z.enum(['tower','bottle','circle','rocket','block','tree','person','car']).optional(),referenceAsset:z.enum(['tower','bottle','circle','rocket','block','tree','person','car']).optional()})).min(1).max(20)});
export function validatedGeneration(value:unknown,input:GenerationRequest):QuizInput{
 const parsed=generatedSchema.parse(value);
 if(input.count>=input.modes.length&&input.modes.some(mode=>!parsed.questions.some(q=>q.mode===mode)))throw new Error('Missing requested mode');
 if(parsed.questions.length!==input.count)throw new Error('Wrong question count');
 const rounds:Round[]=parsed.questions.map(q=>{
  if(!input.modes.includes(q.mode))throw new Error('Unrequested mode');
  const r=getDefaultRound(q.mode);r.id=crypto.randomUUID();r.question=q.mode==='word_puzzle'?q.question.replace(/^Unscramble\b/i,'Find'):q.question;r.explanation=q.explanation;r.provenance='needs_review';
  if(r.mode==='fermi'){if(typeof q.answer!=='number'||q.answer<=0)throw new Error('Numeric answer required');r.secretConfig.answer=q.answer;r.publicConfig={...r.publicConfig,unit:q.unit??'',max:Math.min(1e15,Math.max(100,q.answer*8)),tolerance:q.answer,step:Number.isInteger(q.answer)?1:0.001};}
  if(r.mode==='amountle'){if(typeof q.answer!=='number'||!Number.isInteger(q.answer)||q.answer<1||q.answer>1000)throw new Error('Count must be 1–1000');r.secretConfig.answer=q.answer;r.publicConfig={...r.publicConfig,unit:q.unit??'items',maxCount:Math.min(10000,Math.max(30,q.answer*2)),tolerance:Math.max(10,q.answer/2)};}
  if(r.mode==='word_puzzle'){if(!q.word)throw new Error('Word required');if(new RegExp('\\b'+q.word+'\\b','i').test(q.question))throw new Error('Clue gives away the word');r.secretConfig.answer=q.word;r.publicConfig.length=q.word.length;}
  if(r.mode==='size_it_up'){if(!q.referenceSize||typeof q.answer!=='number'||q.answer<=0||!q.referenceLabel||!q.targetLabel||!q.asset||!q.referenceAsset)throw new Error('Size fields required');const ratio=q.answer/q.referenceSize;if(ratio<0.4||ratio>3.5)throw new Error('Unplayable size ratio');r.secretConfig.targetSize=q.answer;r.publicConfig={...r.publicConfig,unit:q.unit??'m',referenceSize:q.referenceSize,referenceLabel:q.referenceLabel,targetLabel:q.targetLabel,asset:q.asset,referenceAsset:q.referenceAsset,minRatio:Math.max(0.1,ratio/3),maxRatio:Math.min(6,Math.max(3,ratio*2))};}
  if(['draw','stack','crack','claw','fish','sling','drop'].includes(q.mode)){
    const choice=['claw','fish','sling'].includes(q.mode),boolean=q.mode==='drop';
    if(choice&&(!q.options||!q.options.includes(String(q.answer))))throw new Error('Choices must include the correct answer');
    if(boolean&&typeof q.answer!=='boolean')throw new Error('Boolean required');
    if(!choice&&!boolean&&(typeof q.answer!=='number'||!Number.isSafeInteger(q.answer)||q.answer<0||q.answer>99999999))throw new Error('Whole number required');
    const qa:QuestionAnswer={type:boolean?'boolean':'single',kind:boolean?'boolean':choice?'choice':'integer',text:q.question,answer:String(q.answer),distractors:choice?q.options!.filter(o=>o!==String(q.answer)):[],alternatives:[],unit:q.unit??'',exact:true};
    return {...roundFromAnswer(qa,q.mode,r),mode:q.mode,provenance:'needs_review'} as Round;
  }
  return r;
 });
 const quiz=QuizInputSchema.parse({title:parsed.title,description:`Questions about ${input.topic}. Review answers before hosting.`,language:'en',audienceContext:'general',theme:'studio',rounds});
 if(validateQuiz({...quiz,rounds:quiz.rounds.map(r=>({...r,provenance:'creator_confirmed' as const}))}).some(i=>i.severity==='error'))throw new Error('Unplayable generation');return quiz;
}
export type TokenUsage={input:number;output:number;model:string};
export type RecordUsage=(usage:TokenUsage)=>Promise<void>;
export function generationPlan(input:GenerationRequest){
 const rules:Record<GenerationRequest['modes'][number],string>={
  fermi:'fermi answerData: {"answer":144,"unit":"tiles"}. Positive numeric answer (at most 3 decimals). Use a self-contained estimation puzzle with every needed number in the question, not outside trivia or current tournament formats.',
  amountle:'amountle answerData: {"groups":6,"perGroup":8,"unit":"sweets"}. Choose two integer factors 2..50, product <=1000, and a short counted noun relevant to the topic. Leave question and explanation empty: the server writes the multiplication puzzle and computes the answer.',
  word_puzzle:'word_puzzle: leave question and explanation empty; answerData is "{}". The server supplies a curated word and clue.',
  draw:'draw answerData: {"answer":206,"unit":"bones"}. An exact non-negative integer up to 99999999. Use a stable fact or self-contained arithmetic puzzle.',
  stack:'stack answerData: {"answer":46,"unit":"blocks"}. An exact non-negative integer up to 999999. Use a self-contained arithmetic puzzle.',
  crack:'crack answerData: {"answer":1945,"unit":"year"}. An exact year or code, non-negative integer up to 99999999.',
  drop:'drop answerData: {"answer":true}. A factual True/False statement, boolean answer, concise explanation. Avoid ambiguous wording.',
  fish:'fish answerData: {"answer":"Paris","options":["Rome","Paris","Berlin"]}. Exactly one correct choice. 2..4 distinct short labels, correct answer present exactly once. Verify every distractor is incorrect.',
  claw:'claw answerData: {"answer":"Paris","options":["Rome","Paris","Berlin"]}. Exactly one correct choice. 2..4 distinct short labels, correct answer present exactly once.',
  sling:'sling answerData: {"answer":"Paris","options":["Rome","Paris","Berlin"]}. Exactly one correct choice. 2..4 distinct short labels, correct answer present exactly once.', 
  size_it_up:'size_it_up: leave question and explanation empty; answerData is "{}". The server supplies a calibrated silhouette puzzle. Do not invent artwork or measurements.'
 };
 const schema={type:'object',properties:{title:{type:'string'},questions:{type:'array',items:{type:'object',properties:{mode:{type:'string',enum:input.modes},question:{type:'string'},explanation:{type:'string'},answerData:{type:'string'}},required:['mode','question','explanation','answerData']}}},required:['title','questions']};
 const prompt=`Write exactly ${input.count} accurate, fun English quiz questions. Only the selected modes; use each at least once if count permits. Keep every non-Size question relevant to the requested topic. Each answerData is a JSON-encoded object string with the EXACT keys below, using varied new values suitable for the topic; examples demonstrate format only, do not copy them. Questions <=250 characters, explanations <=320 characters with concise reasoning. ${input.modes.map(m=>rules[m]).join(' ')} Use precise nouns and units; do not conflate arms and tentacles or other distinct quantities. Use stable facts or fully specified puzzles, not advice, personal data, offensive or disputed claims or current events. Do not invent sources. Check arithmetic, scope and hidden-word privacy. No extra commentary.`;
 return {schema,prompt,maxOutputTokens:Math.min(8000,500+input.count*280)};
}
export function decodeGeneration(value:unknown,input:GenerationRequest):QuizInput{
 const wire=z.object({title:z.string(),questions:z.array(z.object({mode:z.enum(MODES),question:z.string(),explanation:z.string(),answerData:z.string().max(12000)})).max(20)}).parse(value);
 let sizeIndex=0;const usedWords=new Set<string>();
 return validatedGeneration({title:wire.title,questions:wire.questions.map(({answerData,...question})=>{
  if(question.mode==='size_it_up'){
    // Only shipped artwork and explicit house calibrations can enter a Size draft.
    // Model-suggested objects (e.g. an unsupported football goal) are never trusted.
    const presets=[
      {answer:1.5,referenceSize:1.75,referenceLabel:'1.75 m person',targetLabel:'City car',asset:'car',referenceAsset:'person',question:'How tall would you make the city car beside a 1.75 m person?'},
      {answer:0.3,referenceSize:0.2,referenceLabel:'20 cm reference',targetLabel:'Bottle',asset:'bottle',referenceAsset:'block',question:'Resize the bottle beside the 20 cm reference block.'},
      {answer:6,referenceSize:3,referenceLabel:'3 m tower',targetLabel:'Young tree',asset:'tree',referenceAsset:'tower',question:'How tall would you make the young tree beside a 3 m tower?'},
      {answer:12,referenceSize:5,referenceLabel:'5 m tower',targetLabel:'Model rocket',asset:'rocket',referenceAsset:'tower',question:'Match the model rocket to its expected height beside a 5 m tower.'},
    ];
    const preset=presets[sizeIndex++%presets.length];
    return {...preset,mode:question.mode,unit:'m',explanation:`For this house silhouette, the ${preset.targetLabel.toLowerCase()} is ${preset.answer} m tall, or ${(preset.answer/preset.referenceSize).toFixed(2)} times the reference. Real objects vary.`};
  }
  if(question.mode==='word_puzzle'){
    let suggestion='';try{const data=JSON.parse(answerData.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));if(data&&typeof data.word==='string')suggestion=data.word;}catch{/* The local bank does not need model answer fields. */}
    const [word,clue]=curatedWord(input.topic,suggestion,usedWords);
    return {...question,question:clue,explanation:`${word}: ${clue}`,word};
  }
  const data:unknown=JSON.parse(answerData.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid answer fields');if(question.mode==='amountle'){
  const factors=z.object({groups:z.number().int().min(2).max(50),perGroup:z.number().int().min(2).max(50),unit:z.string().trim().min(1).max(30)}).parse(data);
  const answer=factors.groups*factors.perGroup;
  return {...question,question:`${factors.groups} groups have ${factors.perGroup} ${factors.unit} each. How many ${factors.unit} are there in total?`,explanation:`${factors.groups} x ${factors.perGroup} = ${answer} ${factors.unit}.`,answer,unit:factors.unit};
 }
  const fields={...data} as Record<string,unknown>;
  return {...fields,...question};})},input);
}
export async function geminiGenerate(input:GenerationRequest,key:string,model='gemini-3.5-flash-lite',onUsage?:RecordUsage,fetcher:typeof fetch=fetch):Promise<QuizInput>{
 if(!/^[a-zA-Z0-9.-]+$/.test(model))throw new Error('Invalid model');
 const plan=generationPlan(input);
 const response=await fetcher('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({model,store:false,system_instruction:plan.prompt,input:JSON.stringify(input),response_format:{type:'text',mime_type:'application/json',schema:plan.schema},generation_config:{max_output_tokens:plan.maxOutputTokens,thinking_level:'minimal'}}),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw new Error(`Provider status ${response.status}`);
 const result=await response.json() as {status?:string;steps?:{type?:string;content?:{type?:string;text?:string}[]}[];usage?:{total_input_tokens?:number;total_output_tokens?:number;total_thought_tokens?:number}};
 const tokens=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?Math.min(value,10000000):0;
 await onUsage?.({input:tokens(result.usage?.total_input_tokens),output:tokens(result.usage?.total_output_tokens)+tokens(result.usage?.total_thought_tokens),model});
 if(result.status!=='completed')throw new Error('Incomplete generation');
 const text=result.steps?.filter(s=>s.type==='model_output').flatMap(s=>s.content??[]).filter(c=>c.type==='text').map(c=>c.text??'').join('')??'';
 return decodeGeneration(JSON.parse(text),input);
}
export async function runGenerationWorker(store:Store,generate:(input:GenerationRequest,onUsage:RecordUsage)=>Promise<QuizInput>,now=new Date()){
 // Expired work is refunded once. A restart never silently retries a paid provider request.
 const stale=(await store.db.query<Job>("SELECT * FROM creator_generations WHERE status='processing' AND updated_at<?",[new Date(now.getTime()-120000).toISOString()])).rows;
 for(const job of stale)await failGeneration(store,job);
 const job=(await store.db.query<Job>("SELECT * FROM creator_generations WHERE status IN ('generated','queued') ORDER BY created_at LIMIT 1")).rows[0];if(!job)return false;
 if(job.status==='queued'){
  const token=crypto.randomUUID();const claim=await store.db.query("UPDATE creator_generations SET status='processing',lease_token=?,updated_at=? WHERE id=? AND status='queued'",[token,now.toISOString(),job.id]);if(!claim.changes)return false;
  try{const quiz=await generate(GenerationInput.parse(JSON.parse(job.request_json)),async usage=>{await store.db.query("UPDATE creator_generations SET input_tokens=?,output_tokens=?,model_id=? WHERE id=? AND status='processing' AND lease_token=?",[usage.input,usage.output,usage.model,job.id,token]);});await store.db.query("UPDATE creator_generations SET status='generated',result_json=?,updated_at=? WHERE id=? AND status='processing' AND lease_token=?",[JSON.stringify(QuizInputSchema.parse(quiz)),new Date().toISOString(),job.id,token]);}catch(error){await failGeneration(store,job,failureCode(error));return true;}
 }
 const current=(await store.db.query<Job>("SELECT * FROM creator_generations WHERE id=? AND status='generated'",[job.id])).rows[0];if(!current)return true;
 const input=QuizInputSchema.parse(JSON.parse(current.result_json!));const quizId=await idempotentId('ai-draft',job.owner_id,job.id);
 await store.createQuiz(job.owner_id,input,quizId);
 const nonce=crypto.randomUUID();await store.db.batch([
  {sql:"UPDATE creator_generations SET status='done',quiz_id=?,lease_token=?,updated_at=? WHERE id=? AND status='generated'",params:[quizId,nonce,new Date().toISOString(),job.id]},
  {sql:"UPDATE ai_usage_periods SET reserved=reserved-?,consumed=consumed+? WHERE owner_id=? AND period=? AND EXISTS(SELECT 1 FROM creator_generations WHERE id=? AND lease_token=?)",params:[job.requested,job.requested,job.owner_id,job.period,job.id,nonce]}
 ]);
 return true;
}
async function failGeneration(store:Store,job:Job,errorCode='TIMEOUT'){const nonce=crypto.randomUUID();await store.db.batch([
 {sql:"UPDATE creator_generations SET status='failed',lease_token=?,updated_at=?,error_code=? WHERE id=? AND status='processing'",params:[nonce,new Date().toISOString(),errorCode,job.id]},
 {sql:'UPDATE ai_usage_periods SET reserved=reserved-? WHERE owner_id=? AND period=? AND EXISTS(SELECT 1 FROM creator_generations WHERE id=? AND lease_token=?)',params:[job.requested,job.owner_id,job.period,job.id,nonce]}
]);}
