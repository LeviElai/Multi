import { DomainError, QuizInputSchema, type Quiz, type QuizInput, type QuizVersion, type Round, type SessionData, type SessionRecord, type Principal, type SessionEvent, type Submission, type WordAttempt, type Adjudication, type Award } from '../../contracts/src/index';
import type { Store, SqlDatabase, SqlStatement, SqlValue, MutationResult } from './types';

type Row=Record<string,unknown>;
const json=(value:unknown)=>JSON.stringify(value);
const parse=<T>(value:unknown):T=>typeof value==='string'?JSON.parse(value) as T:value as T;
const iso=(value:unknown):string=>value instanceof Date?value.toISOString():String(value);
const nullableIso=(value:unknown)=>value==null?null:iso(value);
const conflict=()=>new DomainError('VERSION_CONFLICT','This item changed. Refresh and try again.',409);
const missing=()=>new DomainError('NOT_FOUND','The requested item is unavailable.',404);
const roundColumns=['id','ordinal','mode','schema_version','question','timer_seconds','max_points','provenance','source_url','explanation','allow_revision','public_config','secret_config','scoring_version'];
const roundValues=(round:Round,ordinal:number):SqlValue[]=>[round.id,ordinal,round.mode,round.schemaVersion,round.question,round.timerSeconds,round.maxPoints,round.provenance,round.sourceUrl??null,round.explanation??null,Number(round.allowRevision),json(round.publicConfig),json(round.secretConfig),'v3-1'];
const toRound=(r:Row):Round=>({id:String(r.id),mode:r.mode,schemaVersion:Number(r.schema_version),question:String(r.question),timerSeconds:Number(r.timer_seconds),maxPoints:Number(r.max_points),provenance:r.provenance,...(r.source_url==null?{}:{sourceUrl:String(r.source_url)}),...(r.explanation==null?{}:{explanation:String(r.explanation)}),allowRevision:Boolean(r.allow_revision),publicConfig:parse(r.public_config),secretConfig:parse(r.secret_config)} as Round);
const toSession=(r:Row):SessionRecord=>({id:String(r.id),versionId:String(r.version_id),hostId:String(r.host_id),pinDigest:String(r.pin_digest),pin:String(r.pin),state:r.state as SessionRecord['state'],stateVersion:Number(r.state_version),roundIndex:Number(r.round_index),deadlineAt:nullableIso(r.deadline_at),pausedRemainingMs:r.paused_remaining_ms==null?null:Number(r.paused_remaining_ms),extensionCount:Number(r.extension_count),joinLocked:Boolean(r.join_locked),createdAt:iso(r.created_at),completedAt:nullableIso(r.completed_at),lastMutationId:String(r.last_mutation_id),latestSeq:Number(r.latest_seq),maxPlayers:Number(r.max_players)});
const toSubmission=(r:Row):Submission=>({id:String(r.id),roundId:String(r.round_id),participantId:String(r.participant_id),clientMutationId:String(r.client_mutation_id),revision:Number(r.revision),payload:parse(r.payload),acceptedAt:iso(r.accepted_at)});
const toAttempt=(r:Row):WordAttempt=>({id:String(r.id),roundId:String(r.round_id),participantId:String(r.participant_id),clientMutationId:String(r.client_mutation_id),attempt:Number(r.attempt),guess:String(r.guess),feedback:parse(r.feedback),solved:Boolean(r.solved),acceptedAt:iso(r.accepted_at)});
const toAdjudication=(r:Row):Adjudication=>({id:String(r.id),roundId:String(r.round_id),answerKey:String(r.answer_key),decision:r.decision as 'accept'|'reject',canonical:String(r.canonical),actorId:String(r.actor_id),createdAt:iso(r.created_at)});

function insert(table:string,columns:string[],values:SqlValue[],guard?:{sql:string;params:SqlValue[]},suffix=''):SqlStatement{
  return {sql:`INSERT INTO ${table} (${columns.join(',')}) ${guard?`SELECT ${values.map(()=>'?').join(',')} WHERE ${guard.sql}`:`VALUES (${values.map(()=>'?').join(',')})`} ${suffix}`,params:[...values,...(guard?.params??[])]};
}

/** Portable SQL repository; all mutations and their durable notices commit together. */
export class SqlStore implements Store {
  constructor(readonly db:SqlDatabase,private readonly now:()=>Date=()=>new Date()){}
  private sessionGuard(id:string,nonce:string){return {sql:'EXISTS (SELECT 1 FROM sessions WHERE id=? AND last_mutation_id=?)',params:[id,nonce] as SqlValue[]};}
  private quizGuard(id:string,nonce:string){return {sql:'EXISTS (SELECT 1 FROM quizzes WHERE id=? AND last_mutation_id=?)',params:[id,nonce] as SqlValue[]};}
  private async apiReceipt<T>(principalId:string,key:string|undefined):Promise<{found:boolean;result?:T}>{
    if(!key)return {found:false};
    const row=(await this.db.query('SELECT result_json FROM api_receipts WHERE principal_id=? AND idempotency_key=?',[principalId,key])).rows[0];
    return row?{found:true,result:parse<T>(row.result_json)}:{found:false};
  }
  async ensureUser(externalId:string,displayName:string):Promise<{id:string;displayName:string}>{
    const now=this.now().toISOString();
    await this.db.query('INSERT INTO users (id,external_id,display_name,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(external_id) DO UPDATE SET display_name=excluded.display_name,updated_at=excluded.updated_at',[crypto.randomUUID(),externalId,displayName,now,now]);
    const row=(await this.db.query('SELECT id,display_name FROM users WHERE external_id=?',[externalId])).rows[0];
    return {id:String(row.id),displayName:String(row.display_name)};
  }
  async listQuizzes(ownerId:string):Promise<Quiz[]>{
    const rows=(await this.db.query("SELECT id FROM quizzes WHERE owner_id=? AND status<>'archived' ORDER BY updated_at DESC,id",[ownerId])).rows;
    return Promise.all(rows.map(r=>this.getQuiz(String(r.id),ownerId)));
  }
  async getQuiz(id:string,ownerId:string):Promise<Quiz>{
    for(let attempt=0;attempt<5;attempt++){
      const r=(await this.db.query('SELECT * FROM quizzes WHERE id=? AND owner_id=?',[id,ownerId])).rows[0];
      if(!r)throw missing();
      const roundRows=(await this.db.query('SELECT * FROM draft_rounds WHERE quiz_id=? ORDER BY ordinal',[id])).rows;
      const checkRow=(await this.db.query('SELECT revision FROM quizzes WHERE id=? AND owner_id=?',[id,ownerId])).rows[0];
      if(!checkRow || Number(checkRow.revision)!==Number(r.revision))continue;
      return {id,ownerId,title:String(r.title),description:String(r.description),language:r.language as 'en',audienceContext:r.audience_context as Quiz['audienceContext'],theme:r.theme as Quiz['theme'],revision:Number(r.revision),status:r.status as Quiz['status'],...(r.published_version_id?{publishedVersionId:String(r.published_version_id)}:{}),createdAt:iso(r.created_at),updatedAt:iso(r.updated_at),rounds:roundRows.map(toRound)};
    }
    throw conflict();
  }
  async createQuiz(ownerId:string,input:QuizInput,id:string=crypto.randomUUID(),idempotencyKey?:string):Promise<Quiz>{
    idempotencyKey=idempotencyKey?`store.quiz.create:${idempotencyKey}`:undefined;
    const prior=await this.apiReceipt<Quiz>(ownerId,idempotencyKey);if(prior.found)return prior.result!;
    const validated=QuizInputSchema.parse(input);this.uniqueRounds(validated);
    const now=this.now().toISOString(),nonce=crypto.randomUUID(),guard=this.quizGuard(id,nonce);
    const created:Quiz={...validated,id,ownerId,revision:1,status:'draft',createdAt:now,updatedAt:now};
    const statements=[insert('quizzes',['id','owner_id','title','description','language','audience_context','theme','revision','status','last_mutation_id','created_at','updated_at'],[id,ownerId,validated.title,validated.description,validated.language,validated.audienceContext,validated.theme,1,'draft',nonce,now,now],undefined,'ON CONFLICT(id) DO NOTHING'),...validated.rounds.map((round,i)=>insert('draft_rounds',['quiz_id',...roundColumns],[id,...roundValues(round,i)],guard))];
    if(idempotencyKey)statements.push(insert('api_receipts',['principal_id','idempotency_key','result_json','created_at'],[ownerId,idempotencyKey,json(created),now],guard));
    const results=await this.db.batch(statements);
    if(!results[0].changes){const receipt=await this.apiReceipt<Quiz>(ownerId,idempotencyKey);if(receipt.found)return receipt.result!;return this.getQuiz(id,ownerId);}
    return created;
  }
  private uniqueRounds(input:QuizInput){if(new Set(input.rounds.map(r=>r.id)).size!==input.rounds.length)throw new DomainError('DUPLICATE_ROUND','Round IDs must be unique.',422);}
  async saveQuiz(id:string,ownerId:string,expectedRevision:number,input:QuizInput):Promise<Quiz>{
    const validated=QuizInputSchema.parse(input);this.uniqueRounds(validated);
    const nonce=crypto.randomUUID(),now=this.now().toISOString(),guard=this.quizGuard(id,nonce);
    const statements:SqlStatement[]=[{sql:"UPDATE quizzes SET title=?,description=?,language=?,audience_context=?,theme=?,revision=revision+1,status='draft',last_mutation_id=?,updated_at=? WHERE id=? AND owner_id=? AND revision=? AND status<>'archived'",params:[validated.title,validated.description,validated.language,validated.audienceContext,validated.theme,nonce,now,id,ownerId,expectedRevision]},{sql:`DELETE FROM draft_rounds WHERE quiz_id=? AND ${guard.sql}`,params:[id,...guard.params]},...validated.rounds.map((round,i)=>insert('draft_rounds',['quiz_id',...roundColumns],[id,...roundValues(round,i)],guard))];
    const results=await this.db.batch(statements);if(!results[0].changes){await this.getQuiz(id,ownerId);throw conflict();}
    return this.getQuiz(id,ownerId);
  }
  async archiveQuiz(id:string,ownerId:string):Promise<void>{
    const result=await this.db.query("UPDATE quizzes SET status='archived',revision=revision+1,updated_at=?,last_mutation_id=? WHERE id=? AND owner_id=? AND status<>'archived'",[this.now().toISOString(),crypto.randomUUID(),id,ownerId]);
    if(!result.changes)await this.getQuiz(id,ownerId);
  }
  async publishQuiz(id:string,ownerId:string,expectedRevision:number,idempotencyKey?:string):Promise<QuizVersion>{
    idempotencyKey=idempotencyKey?`store.quiz.publish:${id}:${idempotencyKey}`:undefined;
    const receipt=await this.apiReceipt<QuizVersion>(ownerId,idempotencyKey);if(receipt.found)return receipt.result!;
    const quiz=await this.getQuiz(id,ownerId);if(quiz.revision!==expectedRevision){const prior=await this.apiReceipt<QuizVersion>(ownerId,idempotencyKey);if(prior.found)return prior.result!;throw conflict();}
    if(!quiz.rounds.length)throw new DomainError('EMPTY_QUIZ','Add at least one round before publishing.',422);
    const number=Number((await this.db.query('SELECT COALESCE(MAX(version_num),0)+1 AS next FROM quiz_versions WHERE quiz_id=?',[id])).rows[0].next);
    const versionId=crypto.randomUUID(),nonce=crypto.randomUUID(),now=this.now().toISOString(),guard=this.quizGuard(id,nonce);
    const version:QuizVersion={id:versionId,quizId:id,version:number,title:quiz.title,theme:quiz.theme,rounds:quiz.rounds,createdAt:now};
    const statements:SqlStatement[]=[{sql:"UPDATE quizzes SET published_version_id=?,status='published',revision=revision+1,last_mutation_id=?,updated_at=? WHERE id=? AND owner_id=? AND revision=? AND status<>'archived'",params:[versionId,nonce,now,id,ownerId,expectedRevision]},insert('quiz_versions',['id','quiz_id','version_num','title','theme','status','created_at'],[versionId,id,number,quiz.title,quiz.theme,'building',now],guard),...quiz.rounds.map((round,i)=>insert('rounds',['version_id',...roundColumns],[versionId,...roundValues(round,i)],guard)),{sql:`UPDATE quiz_versions SET status='published' WHERE id=? AND ${guard.sql}`,params:[versionId,...guard.params]}];
    if(idempotencyKey)statements.push(insert('api_receipts',['principal_id','idempotency_key','result_json','created_at'],[ownerId,idempotencyKey,json(version),now],guard));
    const results=await this.db.batch(statements);
    if(!results[0].changes){const prior=await this.apiReceipt<QuizVersion>(ownerId,idempotencyKey);if(prior.found)return prior.result!;throw conflict();}
    return version;
  }
  async getVersion(id:string,ownerId?:string):Promise<QuizVersion>{
    const row=(await this.db.query(`SELECT v.* FROM quiz_versions v JOIN quizzes q ON q.id=v.quiz_id WHERE v.id=? AND v.status='published'${ownerId?' AND q.owner_id=?':''}`,[id,...(ownerId?[ownerId]:[])])).rows[0];if(!row)throw missing();
    const roundRows=(await this.db.query('SELECT * FROM rounds WHERE version_id=? ORDER BY ordinal',[id])).rows;
    return {id,quizId:String(row.quiz_id),version:Number(row.version_num),title:String(row.title),theme:String(row.theme),rounds:roundRows.map(toRound),createdAt:iso(row.created_at)};
  }
  async createSession(record:SessionRecord):Promise<void>{
    await this.getVersion(record.versionId,record.hostId);
    const nonce=crypto.randomUUID(),guard=this.sessionGuard(record.id,nonce),seq=record.latestSeq+1,now=this.now().toISOString();
    const statements:SqlStatement[]=[insert('sessions',['id','version_id','host_id','pin_digest','pin','state','state_version','round_index','deadline_at','paused_remaining_ms','extension_count','join_locked','created_at','completed_at','last_mutation_id','latest_seq','max_players'],[record.id,record.versionId,record.hostId,record.pinDigest,record.pin,record.state,record.stateVersion,record.roundIndex,record.deadlineAt,record.pausedRemainingMs,record.extensionCount,Number(record.joinLocked),record.createdAt,record.completedAt,nonce,seq,record.maxPlayers],undefined,'ON CONFLICT(id) DO NOTHING'),{sql:`INSERT INTO session_rounds (session_id,round_id,version_id,ordinal,voided) SELECT ?,id,version_id,ordinal,0 FROM rounds WHERE version_id=? AND ${guard.sql}`,params:[record.id,record.versionId,...guard.params]},...this.eventStatements(record.id,nonce,seq,record.stateVersion,'session.created',{state:record.state,roundIndex:record.roundIndex},now)];
    const results=await this.db.batch(statements);
    if(!results[0].changes){const existing=(await this.db.query('SELECT host_id,version_id FROM sessions WHERE id=?',[record.id])).rows[0];if(!existing||existing.host_id!==record.hostId||existing.version_id!==record.versionId)throw conflict();}
  }
  async getSession(id:string):Promise<SessionData>{
    for(let attempt=0;attempt<6;attempt++){
      const row=(await this.db.query('SELECT * FROM sessions WHERE id=?',[id])).rows[0];if(!row)throw missing();
      const session=toSession(row);
      const [quiz,members,submissions,attempts,adjudications,awards,voids,flow]=await Promise.all([
        this.getVersion(session.versionId),
        this.db.query('SELECT id,nickname,status,joined_at FROM participants WHERE session_id=? ORDER BY joined_at,id',[id]),
        this.db.query('SELECT s.* FROM submissions s WHERE s.session_id=? AND NOT EXISTS (SELECT 1 FROM submissions n WHERE n.session_id=s.session_id AND n.participant_id=s.participant_id AND n.round_id=s.round_id AND n.revision>s.revision)',[id]),
        this.db.query('SELECT * FROM word_attempts WHERE session_id=? ORDER BY round_id,participant_id,attempt',[id]),
        this.db.query('SELECT a.* FROM adjudications a WHERE a.session_id=? AND NOT EXISTS (SELECT 1 FROM adjudications n WHERE n.session_id=a.session_id AND n.round_id=a.round_id AND n.answer_key=a.answer_key AND n.adjudication_revision>a.adjudication_revision)',[id]),
        this.db.query('SELECT r.round_id,r.scoring_revision,s.participant_id,s.points,s.reason,s.detail FROM round_score_current c JOIN scoring_runs r ON r.id=c.scoring_run_id JOIN round_scores s ON s.scoring_run_id=r.id WHERE c.session_id=? ORDER BY r.round_id,s.participant_id',[id]),
        this.db.query('SELECT round_id FROM session_rounds WHERE session_id=? AND voided=1',[id]),
        this.db.query("SELECT EXISTS(SELECT 1 FROM session_events WHERE session_id=? AND type='session.autopilot') AS automatic, (SELECT type FROM session_events WHERE session_id=? AND type LIKE 'phase.paused.%' ORDER BY seq DESC LIMIT 1) AS paused_phase, (SELECT payload FROM session_events WHERE session_id=? AND type='review.timed_out' ORDER BY seq DESC LIMIT 1) AS review_timeout",[id,id,id]),
      ]);
      const latest=(await this.db.query('SELECT state_version FROM sessions WHERE id=?',[id])).rows[0];if(!latest||Number(latest.state_version)!==session.stateVersion)continue;
      return {reviewTimeoutRoundId:flow.rows[0]?.review_timeout?quiz.rounds[parse<{roundIndex:number}>(flow.rows[0].review_timeout).roundIndex]?.id:undefined,automatic:Boolean(flow.rows[0]?.automatic),pausedPhase:flow.rows[0]?.paused_phase ? String(flow.rows[0].paused_phase).split('.').at(-1) as SessionRecord['state'] : undefined,session,quiz,members:members.rows.map(m=>({id:String(m.id),nickname:String(m.nickname),status:m.status as 'active'|'kicked',joinedAt:iso(m.joined_at)})),submissions:submissions.rows.map(toSubmission),attempts:attempts.rows.map(toAttempt),adjudications:adjudications.rows.map(toAdjudication),awards:awards.rows.map(a=>({roundId:String(a.round_id),participantId:String(a.participant_id),points:Number(a.points),reason:String(a.reason),scoringRevision:Number(a.scoring_revision),detail:parse(a.detail)})),voidRoundIds:voids.rows.map(v=>String(v.round_id))};
    }
    throw conflict();
  }
  async findSessionByPinDigest(digest:string):Promise<SessionData|null>{
    const row=(await this.db.query("SELECT id FROM sessions WHERE pin_digest=? AND state NOT IN ('SESSION_COMPLETED','SESSION_ABORTED')",[digest])).rows[0];
    return row?this.getSession(String(row.id)):null;
  }
  async findPlayer(sessionId:string,tokenDigest:string):Promise<Principal|null>{
    const row=(await this.db.query("SELECT id FROM participants WHERE session_id=? AND token_digest=? AND status='active' AND token_expires_at>?",[sessionId,tokenDigest,this.now().toISOString()])).rows[0];
    return row?{role:'player',id:String(row.id),sessionId}:null;
  }
  async addPlayer(sessionId:string,nickname:string,tokenDigest:string,maxPlayers:number):Promise<{participantId:string}>{
    for(let attempt=0;attempt<128;attempt++){
      try{return await this.addPlayerOnce(sessionId,nickname,tokenDigest,maxPlayers);}
      catch(error){if(!(error instanceof DomainError)||error.code!=='VERSION_CONFLICT'||attempt===127)throw error;await new Promise(resolve=>setTimeout(resolve,Math.min(24,2**attempt)+Math.random()*12));}
    }
    throw conflict();
  }
  private async addPlayerOnce(sessionId:string,nickname:string,tokenDigest:string,maxPlayers:number):Promise<{participantId:string}>{
    const prior=await this.findPlayer(sessionId,tokenDigest);if(prior)return {participantId:prior.id};
    const row=(await this.db.query('SELECT * FROM sessions WHERE id=?',[sessionId])).rows[0];if(!row)throw missing();
    const current=toSession(row),nonce=crypto.randomUUID(),id=crypto.randomUUID(),now=this.now().toISOString(),expiresAt=new Date(this.now().getTime()+7*86400000).toISOString(),guard=this.sessionGuard(sessionId,nonce);
    if(current.joinLocked)throw new DomainError('JOIN_LOCKED','The host has locked joining.',409);
    const cap=Math.min(current.maxPlayers,maxPlayers);
    const statements:SqlStatement[]=[{sql:"UPDATE sessions SET state_version=state_version+1,latest_seq=latest_seq+1,last_mutation_id=? WHERE id=? AND state_version=? AND join_locked=0 AND state NOT IN ('SESSION_COMPLETED','SESSION_ABORTED') AND (SELECT COUNT(*) FROM participants WHERE session_id=? AND status='active')<?",params:[nonce,sessionId,current.stateVersion,sessionId,cap]},insert('participants',['id','session_id','nickname','display_name_norm','token_digest','token_expires_at','status','joined_at','last_seen_at'],[id,sessionId,nickname,nickname.normalize('NFKC').trim().toLocaleLowerCase('en'),tokenDigest,expiresAt,'active',now,now],guard),...this.eventStatements(sessionId,nonce,current.latestSeq+1,current.stateVersion+1,'member.joined',{participantId:id},now)];
    const result=await this.db.batch(statements);
    if(!result[0].changes){const duplicate=await this.findPlayer(sessionId,tokenDigest);if(duplicate)return {participantId:duplicate.id};const latest=(await this.db.query('SELECT join_locked FROM sessions WHERE id=?',[sessionId])).rows[0];if(latest?.join_locked)throw new DomainError('JOIN_LOCKED','The host has locked joining.',409);const count=Number((await this.db.query("SELECT COUNT(*) AS n FROM participants WHERE session_id=? AND status='active'",[sessionId])).rows[0].n);if(count>=cap)throw new DomainError('ROOM_FULL','This room has reached its player limit.',409);throw conflict();}
    return {participantId:id};
  }
  async createDisplay(sessionId:string,tokenDigest:string,expiresAt:string):Promise<void>{
    if(!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=this.now().getTime())throw new DomainError('INVALID_EXPIRY','Display token expiry must be in the future.',422);
    await this.db.query('INSERT INTO display_pairings (id,session_id,token_digest,expires_at,created_at) VALUES (?,?,?,?,?)',[crypto.randomUUID(),sessionId,tokenDigest,expiresAt,this.now().toISOString()]);
  }
  async findDisplay(tokenDigest:string):Promise<Principal|null>{
    const row=(await this.db.query('SELECT id,session_id FROM display_pairings WHERE token_digest=? AND revoked_at IS NULL AND expires_at>?',[tokenDigest,this.now().toISOString()])).rows[0];return row?{role:'display',id:String(row.id),sessionId:String(row.session_id)}:null;
  }
  async revokeDisplays(sessionId:string):Promise<void>{await this.db.query('UPDATE display_pairings SET revoked_at=? WHERE session_id=? AND revoked_at IS NULL',[this.now().toISOString(),sessionId]);}
  private eventStatements(sessionId:string,nonce:string,seq:number,stateVersion:number,type:string,payload:Record<string,unknown>,now:string):SqlStatement[]{
    const eventId=crypto.randomUUID(),guard=this.sessionGuard(sessionId,nonce);
    return [insert('session_events',['session_id','seq','event_id','state_version','type','role_scope','payload','occurred_at'],[sessionId,seq,eventId,stateVersion,type,'all',json(payload),now],guard),insert('outbox',['id','session_id','event_id','delivery_status','attempts','created_at'],[crypto.randomUUID(),sessionId,eventId,'pending',0,now],guard)];
  }
  private async receipt<T>(sessionId:string,principalId:string,mutationId:string):Promise<{found:boolean;result?:T}>{
    const row=(await this.db.query('SELECT result_json FROM mutation_receipts WHERE session_id=? AND principal_id=? AND idempotency_key=?',[sessionId,principalId,mutationId])).rows[0];return row?{found:true,result:parse<T>(row.result_json)}:{found:false};
  }
  async mutate<T>(sessionId:string,expectedVersion:number|undefined,principalId:string,mutationId:string,fn:(data:SessionData)=>MutationResult<T>):Promise<T>{
    const prior=await this.receipt<T>(sessionId,principalId,mutationId);if(prior.found)return prior.result!;
    const original=await this.getSession(sessionId);if(expectedVersion!==undefined&&expectedVersion!==original.session.stateVersion)throw conflict();
    const output=fn(structuredClone(original)),data=output.data,s=data.session,nonce=crypto.randomUUID(),now=this.now().toISOString(),guard=this.sessionGuard(sessionId,nonce),version=original.session.stateVersion+1,seq=original.session.latestSeq+1;
    if(s.id!==sessionId||s.versionId!==original.session.versionId||s.hostId!==original.session.hostId)throw new DomainError('IMMUTABLE_SESSION','Session identity and published content cannot change.',422);
    const statements:SqlStatement[]=[{sql:'UPDATE sessions SET state=?,state_version=?,round_index=?,deadline_at=?,paused_remaining_ms=?,extension_count=?,join_locked=?,completed_at=?,last_mutation_id=?,latest_seq=? WHERE id=? AND state_version=?',params:[s.state,version,s.roundIndex,s.deadlineAt,s.pausedRemainingMs,s.extensionCount,Number(s.joinLocked),s.completedAt,nonce,seq,sessionId,original.session.stateVersion]}];
    for(const member of data.members){const old=original.members.find(m=>m.id===member.id);if(!old)throw new DomainError('INVALID_MEMBER','New members must use the atomic join path.',422);if(old.nickname!==member.nickname||old.status!==member.status)statements.push({sql:`UPDATE participants SET nickname=?,display_name_norm=?,status=?,kicked_at=? WHERE session_id=? AND id=? AND ${guard.sql}`,params:[member.nickname,member.nickname.normalize('NFKC').toLocaleLowerCase('en'),member.status,member.status==='kicked'?now:null,sessionId,member.id,...guard.params]});}
    for(const submission of data.submissions){
      const old=original.submissions.find(x=>x.roundId===submission.roundId&&x.participantId===submission.participantId);if(old&&json(old)===json(submission))continue;
      if(old&&submission.revision<=old.revision)throw new DomainError('STALE_REVISION','Submission revisions must increase.',409);
      // Every accepted revision remains durable; getSession returns only latest.
      const id=old?.id===submission.id?crypto.randomUUID():submission.id;
      statements.push(insert('submissions',['id','session_id','round_id','participant_id','client_mutation_id','revision','payload','accepted_at'],[id,sessionId,submission.roundId,submission.participantId,submission.clientMutationId,submission.revision,json(submission.payload),submission.acceptedAt],guard));
    }
    for(const attempt of data.attempts){if(original.attempts.some(x=>x.id===attempt.id))continue;statements.push(insert('word_attempts',['id','session_id','round_id','participant_id','client_mutation_id','attempt','guess','feedback','solved','accepted_at'],[attempt.id,sessionId,attempt.roundId,attempt.participantId,attempt.clientMutationId,attempt.attempt,attempt.guess,json(attempt.feedback),Number(attempt.solved),attempt.acceptedAt],guard));}
    for(const adjudication of data.adjudications){
      const old=original.adjudications.find(x=>x.roundId===adjudication.roundId&&x.answerKey===adjudication.answerKey);if(old&&json(old)===json(adjudication))continue;
      statements.push({sql:`INSERT INTO adjudications (id,session_id,round_id,answer_key,decision,canonical,actor_id,adjudication_revision,created_at) SELECT ?,?,?,?,?,?,?,(SELECT COALESCE(MAX(adjudication_revision),0)+1 FROM adjudications WHERE session_id=? AND round_id=? AND answer_key=?),? WHERE ${guard.sql}`,params:[old?.id===adjudication.id?crypto.randomUUID():adjudication.id,sessionId,adjudication.roundId,adjudication.answerKey,adjudication.decision,adjudication.canonical,adjudication.actorId,sessionId,adjudication.roundId,adjudication.answerKey,adjudication.createdAt,...guard.params]});
    }
    if(json(original.awards)!==json(data.awards)){
      for(const roundId of new Set(original.awards.map(a=>a.roundId))){
        const old=original.awards.filter(a=>a.roundId===roundId),next=data.awards.filter(a=>a.roundId===roundId);
        const canonical=(items:Award[])=>json([...items].sort((a,b)=>a.participantId.localeCompare(b.participantId)));
        if(next.length&&next[0].scoringRevision===old[0].scoringRevision&&canonical(next)!==canonical(old))throw new DomainError('SCORING_REVISION_REQUIRED','Changing an award requires a new scoring revision.',409);
        if(next.length&&next[0].scoringRevision<old[0].scoringRevision)throw new DomainError('SCORING_REVISION_REQUIRED','Scoring revisions cannot move backwards.',409);
      }
      statements.push(...this.scoreStatements(data.awards,sessionId,nonce,now));
    }
    for(const round of data.quiz.rounds){const voided=data.voidRoundIds.includes(round.id);if(voided!==original.voidRoundIds.includes(round.id))statements.push({sql:`UPDATE session_rounds SET voided=? WHERE session_id=? AND round_id=? AND ${guard.sql}`,params:[Number(voided),sessionId,round.id,...guard.params]});}
    statements.push(...this.eventStatements(sessionId,nonce,seq,version,output.eventType,{state:s.state,roundIndex:s.roundIndex},now),insert('audit_logs',['id','actor_id','session_id','action','target_id','detail','created_at'],[crypto.randomUUID(),principalId,sessionId,output.audit?.action??output.eventType,output.audit?.targetId??sessionId,json({...(output.audit?.detail??{}),stateVersion:version,roundIndex:s.roundIndex}),now],guard),insert('mutation_receipts',['session_id','principal_id','idempotency_key','result_json','created_at'],[sessionId,principalId,mutationId,json(output.result??null),now],guard));
    const result=await this.db.batch(statements);
    if(!result[0].changes){const duplicate=await this.receipt<T>(sessionId,principalId,mutationId);if(duplicate.found)return duplicate.result!;throw conflict();}
    return output.result;
  }
  private scoreStatements(awards:Award[],sessionId:string,nonce:string,now:string):SqlStatement[]{
    const guard=this.sessionGuard(sessionId,nonce),statements:SqlStatement[]=[{sql:`DELETE FROM round_score_current WHERE session_id=? AND ${guard.sql}`,params:[sessionId,...guard.params]}],groups=new Map<string,Award[]>();
    for(const award of awards){const group=groups.get(award.roundId)??[];group.push(award);groups.set(award.roundId,group);}
    for(const [roundId,group] of groups){
      const revision=group[0].scoringRevision;if(group.some(a=>a.scoringRevision!==revision))throw new DomainError('MIXED_SCORING_REVISION','A round must have one current score revision.',422);
      const runId=crypto.randomUUID();statements.push(insert('scoring_runs',['id','session_id','round_id','scoring_revision','scorer_version','completed_at'],[runId,sessionId,roundId,revision,'v3-1',now],guard,'ON CONFLICT(session_id,round_id,scoring_revision) DO NOTHING'));
      for(const award of group)statements.push({sql:`INSERT INTO round_scores (scoring_run_id,session_id,participant_id,points,reason,detail) SELECT id,?,?,?,?,? FROM scoring_runs WHERE session_id=? AND round_id=? AND scoring_revision=? AND ${guard.sql} ON CONFLICT(scoring_run_id,participant_id) DO NOTHING`,params:[sessionId,award.participantId,award.points,award.reason,json(award.detail),sessionId,roundId,revision,...guard.params]});
      statements.push({sql:`INSERT INTO round_score_current (session_id,round_id,scoring_run_id) SELECT session_id,round_id,id FROM scoring_runs WHERE session_id=? AND round_id=? AND scoring_revision=? AND ${guard.sql}`,params:[sessionId,roundId,revision,...guard.params]});
    }
    return statements;
  }
  async overdueSessions(now:string):Promise<string[]>{return (await this.db.query("SELECT id FROM sessions WHERE (deadline_at<=? AND state IN ('ROUND_PREPARE','ROUND_COUNTDOWN','ROUND_ACTIVE','REVIEW_REQUIRED','ROUND_REVEAL','INTERMISSION')) OR state IN ('ROUND_LOCKED','ROUND_EVALUATING','ROUND_SCORED') ORDER BY created_at LIMIT 200",[now])).rows.map(r=>String(r.id));}
  async events(sessionId:string,after:number):Promise<SessionEvent[]>{return (await this.db.query('SELECT * FROM session_events WHERE session_id=? AND seq>? ORDER BY seq LIMIT 500',[sessionId,after])).rows.map(r=>({eventId:String(r.event_id),sessionId:String(r.session_id),seq:Number(r.seq),type:String(r.type),occurredAt:iso(r.occurred_at),stateVersion:Number(r.state_version),payload:parse(r.payload)}));}
}
