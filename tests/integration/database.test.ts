import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeSqliteDatabase } from '../../packages/db/src/sqlite';
import { SqlStore } from '../../packages/db/src/store';
import { postgresPlaceholders } from '../../packages/db/src/postgres';
import { DomainError,type QuizInput,type SessionRecord,type SessionData } from '../../packages/contracts/src/index';

const migration=await readFile(new URL('../../packages/db/migrations/sqlite/0001_initial.sql',import.meta.url),'utf8');
const uuid=()=>crypto.randomUUID();
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function quizInput():QuizInput{return {title:'Persistence fixture',description:'Integration-test content',language:'en',audienceContext:'adult_private',theme:'studio',rounds:[{id:uuid(),schemaVersion:1,question:'Estimate the fixture value',mode:'fermi',timerSeconds:30,maxPoints:1000,provenance:'creator_confirmed',allowRevision:true,publicConfig:{unit:'items',errorMode:'proportional',min:1,max:10000,tolerance:50,step:1},secretConfig:{answer:500}}]};}
async function fixture(t:{after:(fn:()=>Promise<void>)=>void},maxPlayers=100){
  const directory=await mkdtemp(join(tmpdir(),'multigame-db-')),path=join(directory,'canonical.sqlite');
  const db=new NodeSqliteDatabase(path);await db.migrate(migration);const store=new SqlStore(db);
  t.after(async()=>{try{db.close();}catch{}await rm(directory,{recursive:true,force:true});});
  const owner=await store.ensureUser('creator-fixture','Fixture host'),input=quizInput(),quiz=await store.createQuiz(owner.id,input),version=await store.publishQuiz(quiz.id,owner.id,quiz.revision);
  const record:SessionRecord={id:uuid(),versionId:version.id,hostId:owner.id,pinDigest:hash('987654'),pin:'987654',state:'LOBBY',stateVersion:0,roundIndex:-1,deadlineAt:null,pausedRemainingMs:null,extensionCount:0,joinLocked:false,createdAt:new Date().toISOString(),completedAt:null,lastMutationId:uuid(),latestSeq:0,maxPlayers};
  await store.createSession(record);
  return {directory,path,db,store,owner,input,quiz,version,record};
}
const mutation=(state:SessionData,eventType='lobby.updated')=>{state.session.stateVersion++;return {data:state,result:{version:state.session.stateVersion},eventType};};
async function count(db:NodeSqliteDatabase,table:string){return Number((await db.query(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);}
const isConflict=(error:unknown)=>error instanceof DomainError&&error.status===409;

test('schema migration is repeatable and PIN/snapshot lookups use relational indexes',async t=>{
  const f=await fixture(t);await f.db.migrate(migration);
  await assert.rejects(f.db.migrate(migration+'\n-- changed applied migration'),/was modified/);
  const tables=(await f.db.query("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(r=>r.name);
  for(const name of ['quizzes','draft_rounds','quiz_versions','rounds','sessions','participants','submissions','word_attempts','scoring_runs','round_scores','session_events','outbox','mutation_receipts'])assert.ok(tables.includes(name));
  const columns=(await f.db.query('PRAGMA table_info(sessions)')).rows.map(r=>String(r.name));assert.ok(!columns.some(x=>/json|snapshot|blob/.test(x)));
  const pinPlan=await f.db.query('EXPLAIN QUERY PLAN SELECT id FROM sessions WHERE pin_digest=?',[f.record.pinDigest]);assert.match(JSON.stringify(pinPlan.rows),/INDEX/);
  const memberPlan=await f.db.query("EXPLAIN QUERY PLAN SELECT id FROM participants WHERE session_id=? AND status='active'",[f.record.id]);assert.match(JSON.stringify(memberPlan.rows),/participants_session_status/);
});

test('optimistic draft autosave atomically rejects a stale overwrite',async t=>{
  const f=await fixture(t),published=await f.store.getQuiz(f.quiz.id,f.owner.id);
  const one={...f.input,title:'Writer one',rounds:[{...f.input.rounds[0],question:'Accepted edit'}]};
  const two={...f.input,title:'Writer two',rounds:[]};
  const results=await Promise.allSettled([f.store.saveQuiz(f.quiz.id,f.owner.id,published.revision,one),f.store.saveQuiz(f.quiz.id,f.owner.id,published.revision,two)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&isConflict(r.reason)).length,1);
  const saved=await f.store.getQuiz(f.quiz.id,f.owner.id);assert.equal(saved.revision,published.revision+1);assert.equal(saved.title,'Writer one');assert.equal(saved.rounds[0].question,'Accepted edit');
});

test('published versions and rounds reject insert, update and deletion; live sessions retain the old version',async t=>{
  const f=await fixture(t);
  await assert.rejects(f.db.query("UPDATE quiz_versions SET title='tampered' WHERE id=?",[f.version.id]),/immutable/);
  await assert.rejects(f.db.query('DELETE FROM quiz_versions WHERE id=?',[f.version.id]),/immutable/);
  await assert.rejects(f.db.query("UPDATE rounds SET question='tampered' WHERE version_id=?",[f.version.id]),/immutable/);
  await assert.rejects(f.db.query('DELETE FROM rounds WHERE version_id=?',[f.version.id]),/immutable/);
  await assert.rejects(f.db.query('INSERT INTO rounds SELECT version_id,?,99,mode,schema_version,question,timer_seconds,max_points,provenance,source_url,explanation,allow_revision,public_config,secret_config,scoring_version FROM rounds WHERE version_id=?',[uuid(),f.version.id]),/immutable/);
  const draft=await f.store.getQuiz(f.quiz.id,f.owner.id),edited=await f.store.saveQuiz(f.quiz.id,f.owner.id,draft.revision,{...f.input,title:'Second edition'});
  const next=await f.store.publishQuiz(f.quiz.id,f.owner.id,edited.revision,'publish-retry-123');
  for(let i=0;i<100;i++)assert.deepEqual(await f.store.publishQuiz(f.quiz.id,f.owner.id,edited.revision,'publish-retry-123'),next);
  assert.equal(await count(f.db,'quiz_versions'),2);const session=await f.store.getSession(f.record.id);assert.equal(session.quiz.id,f.version.id);assert.equal(session.quiz.title,'Persistence fixture');
});

test('concurrent joins enforce the persisted cap, scoped token and join lock',async t=>{
  const f=await fixture(t,10);
  const joins=await Promise.allSettled(Array.from({length:24},(_,i)=>f.store.addPlayer(f.record.id,`Player ${i}`,hash(`token-${i}`),100)));
  assert.equal(joins.filter(r=>r.status==='fulfilled').length,10);assert.equal(await count(f.db,'participants'),10);
  const all=await f.store.getSession(f.record.id);assert.equal(all.session.stateVersion,10);assert.equal(all.session.latestSeq,11);assert.equal(await count(f.db,'outbox'),11);
  const accepted=joins.findIndex(x=>x.status==='fulfilled'),principal=await f.store.findPlayer(f.record.id,hash(`token-${accepted}`));assert.equal(principal?.role,'player');assert.equal(await f.store.findPlayer(uuid(),hash(`token-${accepted}`)),null);
  assert.equal(await f.store.findPlayer(f.record.id,`token-${accepted}`),null);
  assert.deepEqual(await f.store.addPlayer(f.record.id,'Ignored duplicate nickname',hash(`token-${accepted}`),100),{participantId:principal!.id});
  await f.store.mutate(f.record.id,all.session.stateVersion,f.owner.id,uuid(),data=>{data.session.joinLocked=true;return mutation(data);});
  await assert.rejects(f.store.addPlayer(f.record.id,'Late join',hash('late'),100),e=>e instanceof DomainError&&e.code==='JOIN_LOCKED');
});

test('CAS loser produces no child writes, events, outbox entries or receipts',async t=>{
  const f=await fixture(t),version=(await f.store.getSession(f.record.id)).session.stateVersion;
  const results=await Promise.allSettled(Array.from({length:18},()=>f.store.mutate(f.record.id,version,f.owner.id,uuid(),data=>{data.session.joinLocked=true;return mutation(data);} )));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&isConflict(r.reason)).length,17);
  assert.equal(await count(f.db,'mutation_receipts'),1);assert.equal(await count(f.db,'session_events'),2);assert.equal(await count(f.db,'outbox'),2);assert.equal(await count(f.db,'audit_logs'),1);
});

test('100 duplicate commands return the committed receipt without rerunning the mutation',async t=>{
  const f=await fixture(t),key=uuid();let effects=0;
  const first=await f.store.mutate(f.record.id,0,f.owner.id,key,data=>{effects++;data.session.joinLocked=true;return {...mutation(data),audit:{action:'host.lock_join',targetId:f.record.id,detail:{reason:'Private moderation context'}}};});
  for(let i=0;i<100;i++)assert.deepEqual(await f.store.mutate(f.record.id,0,f.owner.id,key,()=>{throw new Error('Duplicate callback must not run');}),first);
  assert.equal(effects,1);assert.equal(await count(f.db,'mutation_receipts'),1);assert.equal(await count(f.db,'session_events'),2);
  const audit=(await f.db.query('SELECT actor_id,action,detail FROM audit_logs')).rows[0];assert.equal(audit.actor_id,f.owner.id);assert.equal(audit.action,'host.lock_join');assert.match(String(audit.detail),/Private moderation context/);assert.ok(!(JSON.stringify(await f.store.events(f.record.id,0))).includes('Private moderation context'));
});

test('accepted answer revisions are retained and FK failures roll back state/event/receipt together',async t=>{
  const f=await fixture(t),player=await f.store.addPlayer(f.record.id,'Player',hash('player'),100),roundId=f.version.rounds[0].id;
  for(let revision=1;revision<=2;revision++)await f.store.mutate(f.record.id,undefined,player.participantId,uuid(),data=>{
    const submission={id:uuid(),roundId,participantId:player.participantId,clientMutationId:uuid(),revision,payload:{value:revision*100},acceptedAt:new Date().toISOString()};data.submissions=[submission];return mutation(data,'answer.received');
  });
  const before=await f.store.getSession(f.record.id);assert.equal(before.submissions.length,1);assert.equal(before.submissions[0].revision,2);assert.equal(await count(f.db,'submissions'),2);
  const previousEvents=await count(f.db,'session_events'),previousReceipts=await count(f.db,'mutation_receipts');
  await assert.rejects(f.store.mutate(f.record.id,undefined,f.owner.id,uuid(),data=>{data.submissions.push({id:uuid(),roundId,participantId:uuid(),clientMutationId:uuid(),revision:1,payload:{value:900},acceptedAt:new Date().toISOString()});return mutation(data);}),/FOREIGN KEY/);
  assert.equal((await f.store.getSession(f.record.id)).session.stateVersion,before.session.stateVersion);assert.equal(await count(f.db,'session_events'),previousEvents);assert.equal(await count(f.db,'mutation_receipts'),previousReceipts);
});

test('score revisions preserve history while totals read only the current run',async t=>{
  const f=await fixture(t),player=await f.store.addPlayer(f.record.id,'Player',hash('score-player'),100),roundId=f.version.rounds[0].id;
  for(let revision=1;revision<=2;revision++)await f.store.mutate(f.record.id,undefined,f.owner.id,uuid(),data=>{data.awards=[{roundId,participantId:player.participantId,points:revision===1?900:0,reason:revision===1?'correct':'void',scoringRevision:revision,detail:{}}];if(revision===2)data.voidRoundIds=[roundId];return mutation(data,'round.scored');});
  const current=await f.store.getSession(f.record.id);assert.equal(current.awards.length,1);assert.equal(current.awards[0].points,0);assert.equal(current.awards[0].scoringRevision,2);assert.deepEqual(current.voidRoundIds,[roundId]);assert.equal(await count(f.db,'scoring_runs'),2);assert.equal(await count(f.db,'round_scores'),2);assert.equal(await count(f.db,'round_score_current'),1);
  const events=await f.store.events(f.record.id,0);assert.ok(events.every(event=>!JSON.stringify(event.payload).includes('secretConfig')));assert.deepEqual(events.map(e=>e.seq),[1,2,3,4]);
});

test('display tokens expire, revoke and cannot authenticate as a player',async t=>{
  const f=await fixture(t),digest=hash('display-token');await f.store.createDisplay(f.record.id,digest,new Date(Date.now()+60000).toISOString());
  assert.equal((await f.store.findDisplay(digest))?.role,'display');assert.equal(await f.store.findPlayer(f.record.id,digest),null);await f.store.revokeDisplays(f.record.id);assert.equal(await f.store.findDisplay(digest),null);
  await assert.rejects(f.store.createDisplay(f.record.id,hash('expired'),new Date(Date.now()-1000).toISOString()),e=>e instanceof DomainError&&e.code==='INVALID_EXPIRY');
});

test('close/reopen recovers authoritative state, members, history and receipts from a real file',async t=>{
  const f=await fixture(t),player=await f.store.addPlayer(f.record.id,'Returning player',hash('resume'),100),key=uuid();
  await f.store.mutate(f.record.id,undefined,f.owner.id,key,data=>{data.session.state='ROUND_ACTIVE';data.session.roundIndex=0;data.session.deadlineAt=new Date(Date.now()-1000).toISOString();return mutation(data,'round.started');});
  const before=await f.store.getSession(f.record.id);f.db.close();
  const reopened=new NodeSqliteDatabase(f.path);try{await reopened.migrate(migration);const store=new SqlStore(reopened);assert.deepEqual(await store.getSession(f.record.id),before);assert.deepEqual(await store.overdueSessions(new Date().toISOString()),[f.record.id]);assert.equal((await store.findPlayer(f.record.id,hash('resume')))?.id,player.participantId);assert.deepEqual(await store.mutate(f.record.id,0,f.owner.id,key,()=>{throw new Error('receipt survived restart');}),{version:before.session.stateVersion});}finally{reopened.close();}
});

test('PostgreSQL placeholder conversion preserves literal question marks and comments',()=>{
  assert.equal(postgresPlaceholders("SELECT '?', \"?\", ? -- ?\n, ? /* ? */"),"SELECT '?', \"?\", $1 -- ?\n, $2 /* ? */");
});
