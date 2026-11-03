import {DailyQuestionSchema,DailyQuestionsSchema} from './daily-question';
export {DailyQuestionSchema,DailyQuestionsSchema};
export type {DailyQuestion} from './daily-question';
import {DailyArcadeSchema} from './daily-arcade';
import type {DailyArcadeRound} from './daily-arcade';
import {stackFailureIndex} from '../../../packages/game-modes/src/stack';
import {fishPosition,FISH_PERIOD} from '../../../packages/game-modes/src/fish';
import {createHash} from 'node:crypto';
import {NUMERIC_FACTS} from './numeric-facts';
import {DomainError} from '../../../packages/contracts/src/index';
import type {SqlDatabase} from '../../../packages/db/src/types';
import {speedPoints} from '../../../packages/game-modes/src/speed';
const DURATION=20000;
export const utcDay=(now:number)=>new Date(now).toISOString().slice(0,10);
type Challenge={day:string;version:number;title:string;questions:string;status:string;scoring_version:string};
type ResponseRecord={key:string;index:number;choice:number;value?:number;text?:string;blocks?:{x:number;value:number}[];correct:boolean;points:number;elapsedMs:number;hint?:'higher'|'lower'};
type Attempt={id:string;day:string;owner_id:string;display_name:string;ranked:number;question_index:number;question_started_at:string;score:number;correct:number;response_ms:number;responses:string;revision:number;completed_at:string|null;challenge_snapshot:string|null};
type BoardRow={username:string;avatar:string|null;score:number;correct:number;response_ms:number;rank:number};
const unavailable=()=>new DomainError('DAILY_UNAVAILABLE','Today’s challenge is being prepared. Please try again shortly.',503);
export class DailyChallengeService{
 constructor(private db:SqlDatabase,private clock=()=>Date.now()){}
 private rounds(c:Challenge){return c.version>=2?DailyArcadeSchema.parse(JSON.parse(c.questions)):DailyQuestionsSchema.parse(JSON.parse(c.questions));}
 private duration(q:DailyArcadeRound|undefined){return q?(['draw','stack','crack','amountle','size_it_up'].includes(q.mode)?35000:26000):DURATION;}
 private attemptChallenge(a:Attempt){return a.challenge_snapshot?Promise.resolve(JSON.parse(a.challenge_snapshot) as Challenge):this.challenge(a.day);}
 private dropTruth(day:string,id:string){return parseInt(createHash('sha256').update(day+id).digest('hex').slice(0,2),16)%2===0;}
 async challenge(day:string):Promise<Challenge>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>utcDay(this.clock()))throw new DomainError('NOT_FOUND','This challenge is not available.',404);
  const r=await this.db.query<Challenge>("SELECT * FROM daily_challenges WHERE day=? AND status='published'",[day]);if(!r.rows[0])throw unavailable();return r.rows[0];
 }
 async board(day:string,owner?:string,offset=0){
  const challenge=await this.challenge(day),currentRules=challenge.scoring_version==='daily-speed-v3';
  const ranking=`SELECT id,owner_id,display_name,score,correct,response_ms,RANK() OVER(ORDER BY score DESC,correct DESC${currentRules?'':',response_ms ASC'}) AS rank FROM daily_attempts WHERE day=? AND ranked=1 AND completed_at IS NOT NULL`; 
  const top=await this.db.query<BoardRow>(`SELECT COALESCE(u.username,r.display_name) AS username,v.avatar_json AS avatar,score,correct,response_ms,rank FROM (${ranking}) r LEFT JOIN auth_accounts u ON u.id=r.owner_id LEFT JOIN creator_avatars v ON v.owner_id=u.id ORDER BY rank,r.owner_id LIMIT 25 OFFSET ?`,[day,Math.max(0,Math.min(100000,offset))]);
  const own=owner?await this.db.query<BoardRow>(`SELECT COALESCE(u.username,r.display_name) AS username,v.avatar_json AS avatar,score,correct,response_ms,rank FROM (${ranking}) r LEFT JOIN auth_accounts u ON u.id=r.owner_id LEFT JOIN creator_avatars v ON v.owner_id=u.id WHERE r.owner_id=?`,[day,owner]):null;
  const identity=(row:BoardRow)=>({...row,avatar:typeof row.avatar==='string'?JSON.parse(row.avatar):null});
  return {leaders:top.rows.map(identity),own:own?.rows[0]?identity(own.rows[0]):null};
 }
 async overview(day:string,owner?:string){const c=await this.challenge(day);return {day:c.day,title:c.title,version:c.version,scoringVersion:c.scoring_version,questionCount:this.rounds(c).length,modes:c.version>=2?(this.rounds(c) as DailyArcadeRound[]).map(r=>r.mode):[],resetAt:new Date(Date.parse(utcDay(this.clock())+'T00:00:00Z')+86400000).toISOString(),serverTime:new Date(this.clock()).toISOString(),...await this.board(day,owner)};}
 async archive(before:string,owner?:string){
  // PostgreSQL rejects an empty string for the UUID owner_id column. Anonymous
  // readers use NULL, which cannot match a ranked attempt and remains private.
  const result=await this.db.query("SELECT c.day,c.title,c.version,(SELECT MAX(a.score) FROM daily_attempts a WHERE a.day=c.day AND a.owner_id=? AND a.ranked=1 AND a.completed_at IS NOT NULL) AS own_score FROM daily_challenges c WHERE c.status='published' AND c.day<? ORDER BY c.day DESC LIMIT 31",[owner??null,before]);return result.rows;
 }
 async start(day:string,owner:{id:string;displayName:string},practice:boolean,guest=false){
  const challenge=await this.challenge(day);const now=this.clock(),ranked=!practice&&day===utcDay(now)&&(!guest||challenge.scoring_version==='daily-speed-v3');
  if(practice&&(!guest||challenge.scoring_version==='daily-speed-v3')&&day===utcDay(now)){
    const completed=await this.db.query('SELECT id FROM daily_attempts WHERE day=? AND owner_id=? AND ranked=1 AND completed_at IS NOT NULL',[day,owner.id]);
    if(!completed.rows.length)throw new DomainError('RANKED_FIRST','Finish today’s ranked run before practising.',409);
  }
  const id=crypto.randomUUID();
  const inserted=await this.db.query('INSERT INTO daily_attempts (id,day,owner_id,display_name,ranked,question_started_at,created_at,challenge_snapshot) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM daily_challenges WHERE day=? AND version=? AND scoring_version=? AND questions=?) ON CONFLICT DO NOTHING',[id,day,owner.id,owner.displayName.slice(0,60),Number(ranked),new Date(now+3000).toISOString(),new Date(now).toISOString(),JSON.stringify(challenge),day,challenge.version,challenge.scoring_version,challenge.questions]);
  const rows=ranked?await this.db.query<{id:string}>('SELECT id FROM daily_attempts WHERE day=? AND owner_id=? AND ranked=1',[day,owner.id]):{rows:[{id}]};
  if(!inserted.changes&&(!ranked||!rows.rows.length))throw new DomainError('DAILY_CHANGED','A new challenge is ready. Please open it again.',409);
  return this.snapshot(rows.rows[0].id,owner.id);
 }
 private async attempt(id:string,owner:string){const r=await this.db.query<Attempt>('SELECT * FROM daily_attempts WHERE id=? AND owner_id=?',[id,owner]);if(!r.rows[0])throw new DomainError('NOT_FOUND','This attempt is unavailable.',404);return r.rows[0];}
 async snapshot(id:string,owner:string){
  const a=await this.attempt(id,owner),c=await this.attemptChallenge(a),questions=this.rounds(c),q=questions[a.question_index],arcade=c.version>=2?q as DailyArcadeRound:undefined;
  const responses=JSON.parse(a.responses) as ResponseRecord[],last=responses.filter(r=>r.index<a.question_index).at(-1),previous=last?questions[last.index]:undefined,guess=responses.filter(r=>r.index===a.question_index).at(-1);
  const fact=arcade?NUMERIC_FACTS.find(f=>'fact-'+f.id===q.id):undefined;
  return {id:a.id,day:a.day,scoringVersion:c.scoring_version,ranked:!!a.ranked,index:a.question_index,total:questions.length,score:a.score,correct:a.correct,completed:!!a.completed_at,serverTime:new Date(this.clock()).toISOString(),startsAt:a.question_started_at,durationMs:this.duration(arcade),deadlineAt:new Date(Date.parse(a.question_started_at)+this.duration(arcade)).toISOString(),question:!a.completed_at&&q?{question:q.question,options:arcade&&['word_puzzle','crack','draw','stack','amountle','fermi','size_it_up'].includes(arcade.mode)?[]:q.options,category:q.category,...(arcade?{mode:arcade.mode,unit:fact?.unit??'',max:['amountle','stack'].includes(arcade.mode)?100:arcade.mode==='crack'?9999:arcade.mode==='size_it_up'?150000:1000000,length:arcade.mode==='word_puzzle'?q.options[q.answer].length:undefined}:{}),...(['drop'].includes(arcade?.mode??'')?{candidate:q.options[this.dropTruth(a.day,q.id)?q.answer:(q.answer+1)%4]}:{})}:null,guess:guess?.hint?{hint:guess.hint,attempts:responses.filter(r=>r.index===a.question_index).length}:null,last:last&&previous?{correct:last.correct,points:last.points,answer:previous.options[previous.answer],sourceUrl:previous.sourceUrl}:null,...(a.completed_at?{board:await this.board(a.day,owner)}:{})};
 }
 async answer(id:string,owner:string,input:{key:string;index:number;choice:number;value?:number;text?:string;blocks?:{x:number;value:number}[]},retries=0):Promise<Awaited<ReturnType<DailyChallengeService['snapshot']>>>{
  const a=await this.attempt(id,owner),responses=JSON.parse(a.responses) as ResponseRecord[];
  const old=responses.find(r=>r.key===input.key);
  if(old){if(old.index!==input.index||old.choice!==input.choice||old.value!==input.value||old.text!==input.text||JSON.stringify(old.blocks)!==JSON.stringify(input.blocks))throw new DomainError('IDEMPOTENCY_CONFLICT','This action was already used.',409);return this.snapshot(id,owner);}
  if(a.ranked&&a.day!==utcDay(this.clock()))throw new DomainError('DAILY_CLOSED','This ranked challenge has ended. Open today’s quest or replay this date for practice.',409);
  if(a.completed_at||a.question_index!==input.index)throw new DomainError('DAILY_PROGRESS','This question has already ended. Refresh to resume.',409);
  const now=this.clock(),start=Date.parse(a.question_started_at);if(now<start)throw new DomainError('NOT_STARTED','Get ready…',409);
  const c=await this.attemptChallenge(a),questions=this.rounds(c),q=questions[a.question_index],arcade=c.version>=2?q as DailyArcadeRound:undefined,duration=this.duration(arcade);
  const elapsedMs=Math.min(duration,Math.max(0,now-start));let correct=false,skill=1;
  // A server-recorded skip advances every mode at timeout without inventing a
  // numerical answer or trusting a browser-owned deadline.
  if(arcade&&!(input.choice===-1&&input.value===undefined&&input.text===undefined&&input.blocks===undefined)){
   const target=Number(q.options[q.answer]);
   if(['fermi','amountle','draw','size_it_up','stack','crack'].includes(arcade.mode)){
    const value=input.value;
    if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1000000)throw new DomainError('INVALID_ANSWER','Choose a valid number.',400);
    if(arcade.mode==='stack'&&(!input.blocks?.length||input.blocks.length>32||input.blocks.some(b=>!Number.isInteger(b.value)||![1,5,10,25].includes(b.value)||b.x<12||b.x>88)||stackFailureIndex(input.blocks)!==-1||input.blocks.reduce((sum,b)=>sum+b.value,0)!==value))throw new DomainError('INVALID_STACK','Build a supported tower to score.',400);
    const difference=Math.abs(value-target);
    if(['fermi','size_it_up'].includes(arcade.mode)){skill=Math.max(0,1-difference/Math.max(1,target*.5));correct=skill>.1;}
    else correct=difference===0;
    if(arcade.mode==='crack'&&difference!==0&&now<start+duration){
     const previous=responses.filter(r=>r.index===a.question_index);
     if(previous.length&&elapsedMs-previous.at(-1)!.elapsedMs<700)throw new DomainError('TRY_LATER','Wait a moment before trying again.',429);
     responses.push({key:input.key,index:input.index,choice:-1,value,correct:false,points:0,elapsedMs,hint:value<target?'higher':'lower'});
     const update=await this.db.query('UPDATE daily_attempts SET responses=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=? AND completed_at IS NULL',[JSON.stringify(responses),id,owner,a.revision]);
     if(!update.changes){if(retries>=4)throw new DomainError('BUSY','Please retry the same answer.',409);return this.answer(id,owner,input,retries+1);}
     return this.snapshot(id,owner);
    }
    if(arcade.mode==='crack')skill=Math.pow(.8,responses.filter(r=>r.index===a.question_index).length);
   }else if(arcade.mode==='word_puzzle')correct=typeof input.text==='string'&&input.text.trim().toLowerCase()===q.options[q.answer].toLowerCase();
   else if(arcade.mode==='drop')correct=input.choice===(this.dropTruth(a.day,q.id)?1:0);
   else if(arcade.mode==='fish'){
    if(input.choice>=0&&input.choice<q.options.length){const position=fishPosition(now,start,input.choice).position;correct=input.choice===q.answer&&position>=35&&position<=65+150/FISH_PERIOD*100;}
   }
   else correct=input.choice===q.answer;
  }else correct=input.choice===q.answer;
  correct=correct&&now<start+duration;
  const points=correct?(c.scoring_version==='daily-speed-v3'?speedPoints(1000*skill,elapsedMs,duration,['fermi','size_it_up','amountle'].includes(arcade?.mode??'')):Math.round(speedPoints(1000,elapsedMs,duration)*skill)):0;
  const record={...input,correct,points,elapsedMs};responses.push(record);const nextIndex=a.question_index+1,completed=nextIndex===questions.length;
  const saved=await this.db.query('UPDATE daily_attempts SET question_index=?,question_started_at=?,score=?,correct=?,response_ms=?,responses=?,revision=revision+1,completed_at=? WHERE id=? AND owner_id=? AND revision=? AND completed_at IS NULL',[nextIndex,new Date(now+1200).toISOString(),a.score+points,a.correct+Number(correct),a.response_ms+elapsedMs,JSON.stringify(responses),completed?new Date(now).toISOString():null,id,owner,a.revision]);
  if(!saved.changes){if(retries>=4)throw new DomainError('BUSY','Please retry the same answer.',409);return this.answer(id,owner,input,retries+1);}
  return this.snapshot(id,owner);
 }
}
