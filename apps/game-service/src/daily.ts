import {z} from 'zod';
import {DomainError} from '../../../packages/contracts/src/index';
import type {SqlDatabase} from '../../../packages/db/src/types';
import {speedPoints} from '../../../packages/game-modes/src/speed';
export const DailyQuestionSchema=z.object({id:z.string().min(1).max(100),question:z.string().min(10).max(220),options:z.array(z.string().min(1).max(80)).length(4),answer:z.number().int().min(0).max(3),category:z.string().max(40),difficulty:z.enum(['easy','medium','challenging']),sourceUrl:z.string().url(),explanation:z.string().max(400)}).strict();
export type DailyQuestion=z.infer<typeof DailyQuestionSchema>;
export const DailyQuestionsSchema=z.array(DailyQuestionSchema).length(10).superRefine((items,ctx)=>{if(new Set(items.map(q=>q.id)).size!==10||new Set(items.map(q=>q.question.toLowerCase())).size!==10)ctx.addIssue({code:'custom',message:'Duplicate daily questions'});for(const q of items)if(new Set(q.options.map(o=>o.toLowerCase())).size!==4)ctx.addIssue({code:'custom',message:'Duplicate answers'});});
const DURATION=20000;
export const utcDay=(now:number)=>new Date(now).toISOString().slice(0,10);
type Challenge={day:string;version:number;title:string;questions:string;status:string};
type ResponseRecord={key:string;index:number;choice:number;correct:boolean;points:number;elapsedMs:number};
type Attempt={id:string;day:string;owner_id:string;display_name:string;ranked:number;question_index:number;question_started_at:string;score:number;correct:number;response_ms:number;responses:string;revision:number;completed_at:string|null};
const unavailable=()=>new DomainError('DAILY_UNAVAILABLE','Today’s challenge is being prepared. Please try again shortly.',503);
export class DailyChallengeService{
 constructor(private db:SqlDatabase,private clock=()=>Date.now()){}
 async challenge(day:string):Promise<Challenge>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>utcDay(this.clock()))throw new DomainError('NOT_FOUND','This challenge is not available.',404);
  const r=await this.db.query<Challenge>("SELECT * FROM daily_challenges WHERE day=? AND status='published'",[day]);if(!r.rows[0])throw unavailable();return r.rows[0];
 }
 async board(day:string,owner?:string,offset=0){
  await this.challenge(day);
  const ranking="SELECT id,owner_id,display_name,score,correct,response_ms,RANK() OVER(ORDER BY score DESC,correct DESC,response_ms ASC) AS rank FROM daily_attempts WHERE day=? AND ranked=1 AND completed_at IS NOT NULL";
  const top=await this.db.query(`SELECT display_name,score,correct,response_ms,rank FROM (${ranking}) r ORDER BY rank,owner_id LIMIT 25 OFFSET ?`,[day,Math.max(0,Math.min(100000,offset))]);
  const own=owner?await this.db.query(`SELECT display_name,score,correct,response_ms,rank FROM (${ranking}) r WHERE owner_id=?`,[day,owner]):null;
  return {leaders:top.rows,own:own?.rows[0]??null};
 }
 async overview(day:string,owner?:string){const c=await this.challenge(day);return {day:c.day,title:c.title,version:c.version,questionCount:10,resetAt:new Date(Date.parse(utcDay(this.clock())+'T00:00:00Z')+86400000).toISOString(),serverTime:new Date(this.clock()).toISOString(),...await this.board(day,owner)};}
 async archive(before:string,owner?:string){
  const result=await this.db.query("SELECT c.day,c.title,c.version,(SELECT MAX(a.score) FROM daily_attempts a WHERE a.day=c.day AND a.owner_id=? AND a.ranked=1 AND a.completed_at IS NOT NULL) AS own_score FROM daily_challenges c WHERE c.status='published' AND c.day<? ORDER BY c.day DESC LIMIT 31",[owner??'',before]);return result.rows;
 }
 async start(day:string,owner:{id:string;displayName:string},practice:boolean){
  await this.challenge(day);const now=this.clock(),ranked=!practice&&day===utcDay(now);
  if(practice&&day===utcDay(now)){
    const completed=await this.db.query('SELECT id FROM daily_attempts WHERE day=? AND owner_id=? AND ranked=1 AND completed_at IS NOT NULL',[day,owner.id]);
    if(!completed.rows.length)throw new DomainError('RANKED_FIRST','Finish today’s ranked run before practising.',409);
  }
  const id=crypto.randomUUID();
  await this.db.query('INSERT INTO daily_attempts (id,day,owner_id,display_name,ranked,question_started_at,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING',[id,day,owner.id,owner.displayName.slice(0,60),Number(ranked),new Date(now+3000).toISOString(),new Date(now).toISOString()]);
  const rows=ranked?await this.db.query<{id:string}>('SELECT id FROM daily_attempts WHERE day=? AND owner_id=? AND ranked=1',[day,owner.id]):{rows:[{id}]};
  return this.snapshot(rows.rows[0].id,owner.id);
 }
 private async attempt(id:string,owner:string){const r=await this.db.query<Attempt>('SELECT * FROM daily_attempts WHERE id=? AND owner_id=?',[id,owner]);if(!r.rows[0])throw new DomainError('NOT_FOUND','This attempt is unavailable.',404);return r.rows[0];}
 async snapshot(id:string,owner:string){
  const a=await this.attempt(id,owner),c=await this.challenge(a.day),questions=DailyQuestionsSchema.parse(JSON.parse(c.questions)),q=questions[a.question_index];
  const responses=JSON.parse(a.responses) as ResponseRecord[],last=responses.at(-1),previous=last?questions[last.index]:undefined;
  return {id:a.id,day:a.day,ranked:!!a.ranked,index:a.question_index,total:questions.length,score:a.score,correct:a.correct,completed:!!a.completed_at,serverTime:new Date(this.clock()).toISOString(),startsAt:a.question_started_at,deadlineAt:new Date(Date.parse(a.question_started_at)+DURATION).toISOString(),question:!a.completed_at&&q?{question:q.question,options:q.options,category:q.category}:null,last:last&&previous?{correct:last.correct,points:last.points,answer:previous.options[previous.answer],sourceUrl:previous.sourceUrl}:null,...(a.completed_at?{board:await this.board(a.day,owner)}:{})};
 }
 async answer(id:string,owner:string,input:{key:string;index:number;choice:number},retries=0):Promise<Awaited<ReturnType<DailyChallengeService['snapshot']>>>{
  const a=await this.attempt(id,owner),responses=JSON.parse(a.responses) as ResponseRecord[];
  const old=responses.find(r=>r.key===input.key);
  if(old){if(old.index!==input.index||old.choice!==input.choice)throw new DomainError('IDEMPOTENCY_CONFLICT','This action was already used.',409);return this.snapshot(id,owner);}
  if(a.ranked&&a.day!==utcDay(this.clock()))throw new DomainError('DAILY_CLOSED','This ranked challenge has ended. Open today’s quest or replay this date for practice.',409);
  if(a.completed_at||a.question_index!==input.index)throw new DomainError('DAILY_PROGRESS','This question has already ended. Refresh to resume.',409);
  const now=this.clock(),start=Date.parse(a.question_started_at);if(now<start)throw new DomainError('NOT_STARTED','Get ready…',409);
  const c=await this.challenge(a.day),questions=DailyQuestionsSchema.parse(JSON.parse(c.questions)),q=questions[a.question_index];
  const elapsedMs=Math.min(DURATION,Math.max(0,now-start)),correct=now<start+DURATION&&input.choice===q.answer,points=correct?speedPoints(1000,elapsedMs,DURATION):0;
  const record={...input,correct,points,elapsedMs};responses.push(record);const completed=responses.length===10;
  const saved=await this.db.query('UPDATE daily_attempts SET question_index=?,question_started_at=?,score=?,correct=?,response_ms=?,responses=?,revision=revision+1,completed_at=? WHERE id=? AND owner_id=? AND revision=? AND completed_at IS NULL',[a.question_index+1,new Date(now+1200).toISOString(),a.score+points,a.correct+Number(correct),a.response_ms+elapsedMs,JSON.stringify(responses),completed?new Date(now).toISOString():null,id,owner,a.revision]);
  if(!saved.changes){if(retries>=4)throw new DomainError('BUSY','Please retry the same answer.',409);return this.answer(id,owner,input,retries+1);}
  return this.snapshot(id,owner);
 }
}
