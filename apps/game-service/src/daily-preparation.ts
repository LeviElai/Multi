import type {SqlDatabase} from '../../../packages/db/src/types';
import {DailyQuestionsSchema,utcDay} from './daily';
import {DAILY_POOL,selectDaily} from './daily-pool';
/** Call from a scheduled worker, never from a player's request. Idempotent inserts
 * freeze the published questions and answer order for every date. */
export async function prepareDaily(db:SqlDatabase,now=Date.now(),choose?:(day:string,candidates:typeof DAILY_POOL)=>Promise<string[]>){
 let prepared=0,aiFailures=0;
 for(let offset=0;offset<=7;offset++){
  const day=utcDay(now+offset*86400000);
  if((await db.query('SELECT day FROM daily_challenges WHERE day=?',[day])).rows.length)continue;
  const recentRows=await db.query<{questions:string}>('SELECT questions FROM daily_challenges WHERE day<? ORDER BY day DESC LIMIT 2',[day]);
  const recent=new Set(recentRows.rows.flatMap(r=>DailyQuestionsSchema.parse(JSON.parse(r.questions)).map(q=>q.id)));
  let preferred:string[]=[];if(choose)try{const ids=await choose(day,DAILY_POOL);if(!Array.isArray(ids)||ids.length!==10||new Set(ids).size!==10||ids.some(id=>!DAILY_POOL.some(q=>q.id===id)))throw Error('Invalid AI selection');preferred=ids;}catch{aiFailures++;}
  const questions=selectDaily(day,recent,preferred);
  const result=await db.query("INSERT INTO daily_challenges(day,title,questions,prepared_at,status) VALUES(?,?,?,?, 'approved') ON CONFLICT(day) DO NOTHING",[day,'The Daily Quest',JSON.stringify(questions),new Date(now).toISOString()]);prepared+=result.changes;
 }
 const published=await db.query("UPDATE daily_challenges SET status='published',published_at=? WHERE status='approved' AND day<=?",[new Date(now).toISOString(),utcDay(now)]);
 return {prepared,published:published.changes,aiFailures};
}

export async function selectDailyWithAI(day:string,candidates:typeof DAILY_POOL,key:string,model='gemini-3.5-flash-lite'):Promise<string[]>{
 if(!/^[a-zA-Z0-9.-]+$/.test(model))throw Error('Invalid model');
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(12000),body:JSON.stringify({model,store:false,system_instruction:'Select exactly ten distinct IDs from this reviewed trivia inventory for a varied international daily quiz. Select 3 easy, 5 medium and 2 challenging questions. Do not invent IDs or facts. Return only the JSON object.',input:JSON.stringify({day,candidates:candidates.map(({id,question,category,difficulty})=>({id,question,category,difficulty}))}),response_format:{type:'text',mime_type:'application/json',schema:{type:'object',properties:{ids:{type:'array',items:{type:'string'},minItems:10,maxItems:10}},required:['ids'],additionalProperties:false}},generation_config:{max_output_tokens:600,thinking_level:'minimal'}})});
 if(!response.ok)throw Error('Daily selection unavailable');
 const result=await response.json() as {status?:string;steps?:{type?:string;content?:{type?:string;text?:string}[]}[]};
 if(result.status!=='completed')throw Error('Incomplete selection');
 const raw=result.steps?.filter(s=>s.type==='model_output').flatMap(s=>s.content??[]).filter(c=>c.type==='text').map(c=>c.text??'').join('')??'';
 return JSON.parse(raw).ids;
}
