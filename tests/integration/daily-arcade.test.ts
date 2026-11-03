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

test('five-game server run is timed, one ranked attempt, guest practice and immutable history',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'daily-arcade-')),db=new NodeSqliteDatabase(join(dir,'db.sqlite'));
 t.after(async()=>{await db.close();await rm(dir,{recursive:true,force:true});});
 await db.migrate(await readFile('drizzle/0000_initial.sql','utf8'));
 await db.migrate(await readFile('packages/db/migrations/sqlite/20261025171428_daily_world_challenge.sql','utf8'),'daily-v1');
 await db.migrate(await readFile('packages/db/migrations/sqlite/20261103000000_account_usernames.sql','utf8'),'names');
 const store=new SqlStore(db),owner=await store.ensureUser('registered','The Fisher'),guest=await store.ensureUser('daily-guest:test','Daily guest');
 await db.query('INSERT INTO auth_accounts (id,email,password_hash,display_name,username,created_at) VALUES (?,?,?,?,?,?)',[owner.id,'registered@example.test','hash','The Fisher','fish_king','2026-11-03T00:00:00Z']);
 let now=Date.parse('2026-11-03T00:00:00Z');const service=new DailyChallengeService(db,()=>now);
 const result=await prepareDaily(db,now);assert.ok(result.prepared>=7);
 const prepared=await db.query<{questions:string;version:number;status:string}>('SELECT * FROM daily_challenges WHERE day=?',['2026-11-03']);
 assert.equal(prepared.rows[0].version,2);assert.equal(prepared.rows[0].status,'published');
 const questions=DailyArcadeSchema.parse(JSON.parse(prepared.rows[0].questions));
 assert.equal(questions.length,5);
 const [ranked,concurrent]=await Promise.all([service.start('2026-11-03',owner,false),service.start('2026-11-03',owner,false)]);
 assert.equal(ranked.id,concurrent.id);assert.equal(ranked.ranked,true);
 assert.equal(JSON.stringify(ranked).includes(questions[0].explanation),false);
 assert.equal(JSON.stringify(ranked.question).includes('"answer"'),false);
 const practice=await service.start('2026-11-03',guest,true,true);assert.equal(practice.ranked,false);
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
 now=Date.parse('2026-11-04T00:00:00Z');
 assert.equal((await service.start('2026-11-03',owner,true)).ranked,false);
 assert.equal((await service.archive('2026-11-04',owner.id))[0].own_score,0);
});
