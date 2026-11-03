import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NodeSqliteDatabase} from '../../packages/db/src/sqlite';
import {SqlStore} from '../../packages/db/src/store';
import {DailyChallengeService} from '../../apps/game-service/src/daily';
import {selectDailyArcade,DailyArcadeSchema} from '../../apps/game-service/src/daily-arcade';
import {prepareDaily} from '../../apps/game-service/src/daily-preparation';
import {isApproximateFact,NUMERIC_FACTS} from '../../apps/game-service/src/numeric-facts';

test('five reviewed Daily games balance action, tactile and puzzle modes without recycling a sequence',()=>{
 const recent:ReturnType<typeof selectDailyArcade>[]=[];const seen=new Set<string>();
 for(let date=1;date<=28;date++){
  const day='2026-11-'+String(date).padStart(2,'0');const rounds=selectDailyArcade(day,recent.slice(0,4));
  DailyArcadeSchema.parse(rounds);
  const modes=rounds.map(r=>r.mode);assert.equal(new Set(modes).size,5);
  assert.equal(modes.filter(m=>['fish','claw','sling','drop'].includes(m)).length,2);
  assert.equal(modes.filter(m=>['draw','stack','amountle','size_it_up'].includes(m)).length,2);
  assert.equal(modes.filter(m=>['fermi','crack','word_puzzle'].includes(m)).length,1);
  assert.notDeepEqual(modes,recent[0]?.map(r=>r.mode));
  for(const q of rounds){seen.add(q.mode);assert.match(q.sourceUrl,/^https:\/\//);assert.notEqual(q.options[q.answer],undefined);
   if(['stack','amountle','crack','draw'].includes(q.mode)){
    const fact=NUMERIC_FACTS.find(f=>'fact-'+f.id===q.id);assert.ok(fact);assert.equal(isApproximateFact(fact),false);
   }
  }
  recent.unshift(rounds);
 }
 assert.equal(seen.size,11);
});

test('five-game server run is speed scored, one ranked attempt, guest ranking and immutable history',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'daily-arcade-')),db=new NodeSqliteDatabase(join(dir,'db.sqlite'));
 t.after(async()=>{await db.close();await rm(dir,{recursive:true,force:true});});
 await db.migrate(await readFile('drizzle/0000_initial.sql','utf8'));
 await db.query('CREATE TABLE creator_avatars (owner_id TEXT PRIMARY KEY,avatar_json TEXT)');
 await db.migrate(await readFile('packages/db/migrations/sqlite/20261025171428_daily_world_challenge.sql','utf8'),'daily-v1');
 await db.migrate(await readFile('packages/db/migrations/sqlite/20261103000000_account_usernames.sql','utf8'),'names');
 await db.migrate(await readFile('packages/db/migrations/sqlite/20261103000002_daily_skill_scoring.sql','utf8'),'daily-snapshots');
 const store=new SqlStore(db),owner=await store.ensureUser('registered','The Fisher'),guest=await store.ensureUser('daily-guest:test','Player 4821');
 await db.query('INSERT INTO auth_accounts (id,email,password_hash,display_name,username,created_at) VALUES (?,?,?,?,?,?)',[owner.id,'registered@example.test','hash','The Fisher','fish_king','2026-11-03T00:00:00Z']);
 let now=Date.parse('2026-11-03T00:00:00Z');const service=new DailyChallengeService(db,()=>now);
 const result=await prepareDaily(db,now);assert.ok(result.prepared>=7);
 const prepared=await db.query<{questions:string;version:number;status:string}>('SELECT * FROM daily_challenges WHERE day=?',['2026-11-03']);
 assert.equal(prepared.rows[0].version,3);assert.equal(prepared.rows[0].status,'published');
 const questions=DailyArcadeSchema.parse(JSON.parse(prepared.rows[0].questions));
 assert.equal(questions.length,5);
 const [ranked,concurrent]=await Promise.all([service.start('2026-11-03',owner,false),service.start('2026-11-03',owner,false)]);
 assert.equal(ranked.id,concurrent.id);assert.equal(ranked.ranked,true);
 assert.equal(JSON.stringify(ranked).includes(questions[0].explanation),false);
 assert.equal(JSON.stringify(ranked.question).includes('"answer"'),false);
 await assert.rejects(service.start('2026-11-03',guest,true,true));
 const guestRun=await service.start('2026-11-03',guest,false,true);assert.equal(guestRun.ranked,true);
 assert.equal((await service.start('2026-11-03',guest,false,true)).id,guestRun.id);
 await assert.rejects(service.start('2026-11-03',owner,true));
 await assert.rejects(service.snapshot(ranked.id,guest.id));
 let snapshot=ranked;
 for(let i=0;i<5;i++){
  now=Date.parse(snapshot.startsAt)+1000;
  const response={key:'round-'+i,index:i,choice:-1};
  snapshot=await service.answer(ranked.id,owner.id,response);
  assert.equal(snapshot.index,i+1);
  assert.equal(snapshot.score,0);
  const retry=await service.answer(ranked.id,owner.id,response);assert.equal(retry.index,i+1);
  await assert.rejects(service.answer(ranked.id,owner.id,{...response,key:'replayed-'+i}));
 }
 assert.equal(snapshot.completed,true);assert.equal(snapshot.board?.own?.username,'fish_king');
 assert.equal((await service.board('2026-11-03',guest.id)).own,null);
 let guestSnapshot=guestRun;for(let i=0;i<5;i++){now=Date.parse(guestSnapshot.startsAt)+2000;guestSnapshot=await service.answer(guestRun.id,guest.id,{key:'guest-'+i,index:i,choice:-1});}
 assert.equal(guestSnapshot.board?.own?.username,'Player 4821');
 assert.equal(guestSnapshot.board?.own?.rank,snapshot.board?.own?.rank);
 assert.equal((await service.start('2026-11-03',guest,true,true)).ranked,false);
 now=Date.parse('2026-11-04T00:00:00Z');
 assert.equal((await service.start('2026-11-03',owner,true)).ranked,false);
 assert.equal((await service.archive('2026-11-04',owner.id))[0].own_score,0);
});

test('Daily v3 rewards faster correct performance, penalizes Crack mistakes, and preserves live profile identity',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'daily-skill-')),db=new NodeSqliteDatabase(join(dir,'db.sqlite'));
 t.after(async()=>{await db.close();await rm(dir,{recursive:true,force:true});});
 await db.migrate(await readFile('drizzle/0000_initial.sql','utf8'));
 await db.migrate(await readFile('packages/db/migrations/sqlite/20261025171428_daily_world_challenge.sql','utf8'),'daily');
 await db.migrate(await readFile('packages/db/migrations/sqlite/20261103000000_account_usernames.sql','utf8'),'names');
 await db.query('CREATE TABLE creator_avatars (owner_id TEXT PRIMARY KEY,avatar_json TEXT)');
 await db.migrate(await readFile('packages/db/migrations/sqlite/20261103000002_daily_skill_scoring.sql','utf8'),'daily-snapshots');
 const store=new SqlStore(db),fast=await store.ensureUser('registered','Display Name'),slow=await store.ensureUser('daily-guest:skill','Player 4821');
 await db.query('INSERT INTO auth_accounts (id,email,password_hash,display_name,username,created_at) VALUES (?,?,?,?,?,?)',[fast.id,'skill@example.test','hash','Display Name','first_name','2026-11-03T00:00:00Z']);
 await db.query('INSERT INTO creator_avatars VALUES (?,?)',[fast.id,JSON.stringify({character:'cat'})]);
 let now=Date.parse('2026-11-03T10:00:00Z');const service=new DailyChallengeService(db,()=>now);
 const rounds=['amountle','draw','fermi','crack','word_puzzle'].map((mode,i)=>({id:'fixture-'+i,mode,question:'Test fixture number '+i,options:mode==='word_puzzle'?['cat','dog','fox','hen']:['10','20','30','40'],answer:0,category:'Fixture',difficulty:'medium',sourceUrl:'https://example.org/fixture',explanation:'Test only.'}));
 await db.query("INSERT INTO daily_challenges(day,title,questions,version,scoring_version,prepared_at,status) VALUES(?,?,?,3,'daily-speed-v3',?,'published')",['2026-11-03','Fixture',JSON.stringify(rounds),new Date(now).toISOString()]);
 const scores:number[]=[];
 for(const [owner,delay] of [[fast,1000],[slow,20000]] as const){
  let snap=await service.start('2026-11-03',owner,false,owner===slow);
  for(let index=0;index<5;index++){
   now=Date.parse(snap.startsAt)+delay;
   if(index===3){const wrong=await service.answer(snap.id,owner.id,{key:'wrong',index,choice:-1,value:9});assert.equal(wrong.score,snap.score);assert.equal(wrong.guess?.hint,'higher');now+=800;}
   snap=await service.answer(snap.id,owner.id,{key:'answer-'+index,index,choice:-1,...(index===4?{text:'cat'}:{value:10})});
  }
  scores.push(snap.score);assert.equal(snap.correct,5);assert.equal(snap.board?.own?.rank,owner===fast?1:2);
  assert.ok(snap.score<5000,'Time and the incorrect Crack guess reduce the maximum');
 }
 assert.ok(scores[0]>scores[1],'Faster correct run must beat identical slower performance');
 assert.deepEqual(scores,[4732,3623]);
 await db.query('UPDATE auth_accounts SET username=? WHERE id=?',['renamed',fast.id]);
 const board=await service.board('2026-11-03',fast.id);
 assert.equal(board.leaders.length,2);assert.deepEqual(board.leaders.map(r=>r.rank),[1,2]);
 assert.equal(board.own?.username,'renamed');assert.deepEqual(board.own?.avatar,{character:'cat'});
 const before=JSON.stringify(board.leaders);
 now=Date.parse('2026-11-04T00:00:00Z');const replay=await service.start('2026-11-03',slow,false,true);assert.equal(replay.ranked,false);
 assert.equal(JSON.stringify((await service.board('2026-11-03')).leaders),before);
});

test('attempt snapshots preserve legacy practice across a same-day version switch and reject stale starts',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'daily-switch-')),db=new NodeSqliteDatabase(join(dir,'db.sqlite'));
 t.after(async()=>{await db.close();await rm(dir,{recursive:true,force:true});});
 await db.migrate(await readFile('drizzle/0000_initial.sql','utf8'));
 await db.migrate(await readFile('packages/db/migrations/sqlite/20261025171428_daily_world_challenge.sql','utf8'),'daily');
 await db.migrate(await readFile('packages/db/migrations/sqlite/20261103000000_account_usernames.sql','utf8'),'names');
 await db.query('CREATE TABLE creator_avatars (owner_id TEXT PRIMARY KEY,avatar_json TEXT)');
 const store=new SqlStore(db),guest=await store.ensureUser('daily-guest:old','Player 4821');
 let now=Date.parse('2026-11-03T10:00:00Z');
 const old=Array.from({length:10},(_,i)=>({id:'legacy-'+i,question:'Legacy fixture question '+i,options:['A','B','C','D'],answer:0,category:'Test',difficulty:'medium',sourceUrl:'https://example.org',explanation:'Test fixture'}));
 await db.query("INSERT INTO daily_challenges(day,title,questions,prepared_at,status) VALUES(?,?,?,?,'published')",['2026-11-03','Legacy',JSON.stringify(old),new Date(now).toISOString()]);
 // Existing attempts predating migration receive a snapshot during backfill.
 await db.query("INSERT INTO daily_attempts(id,day,owner_id,display_name,ranked,question_started_at,created_at) VALUES('legacy-attempt',?,?,?,?,?,?)",['2026-11-03',guest.id,guest.displayName,0,new Date(now).toISOString(),new Date(now).toISOString()]);
 await db.migrate(await readFile('packages/db/migrations/sqlite/20261103000002_daily_skill_scoring.sql','utf8'),'snapshots');
 const service=new DailyChallengeService(db,()=>now),before=await service.snapshot('legacy-attempt',guest.id);
 const next=selectDailyArcade('2026-11-03');
 await db.query("UPDATE daily_challenges SET version=3,scoring_version='daily-speed-v3',questions=? WHERE day=?",[JSON.stringify(next),'2026-11-03']);
 const resumed=await service.snapshot('legacy-attempt',guest.id);
 assert.deepEqual(resumed.question,before.question);assert.equal(resumed.total,10);assert.equal(resumed.scoringVersion,'daily-time-v1');
 now+=1000;assert.equal((await service.answer('legacy-attempt',guest.id,{key:'resume',index:0,choice:0})).score,975);
 const ranked=await service.start('2026-11-03',guest,false,true);assert.equal(ranked.total,5);assert.equal(ranked.ranked,true);assert.ok([26000,35000].includes(ranked.durationMs));
 // A challenge switch between SELECT and INSERT cannot attach a stale snapshot to a new ranked run.
 const other=await store.ensureUser('daily-guest:race','Player 4822');let switched=false;
 const racingDb={...db,query:async(sql:string,params?:import('../../packages/db/src/types').SqlValue[])=>{
  if(sql.startsWith('INSERT INTO daily_attempts')&&!switched){switched=true;await db.query("UPDATE daily_challenges SET questions=? WHERE day=?",[JSON.stringify(selectDailyArcade('2026-11-04')),'2026-11-03']);}
  return db.query(sql,params);
 }} as unknown as import('../../packages/db/src/types').SqlDatabase;
 await assert.rejects(new DailyChallengeService(racingDb,()=>now).start('2026-11-03',other,false,true),/new challenge is ready/);
 assert.equal((await db.query('SELECT id FROM daily_attempts WHERE owner_id=?',[other.id])).rows.length,0);
});
