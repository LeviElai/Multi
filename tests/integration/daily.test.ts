import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NodeSqliteDatabase} from '../../packages/db/src/sqlite';
import {SqlStore} from '../../packages/db/src/store';
import {DailyChallengeService,type DailyQuestion} from '../../apps/game-service/src/daily';
test('daily ranked attempts survive refresh, reject impersonation/replay and preserve archive rankings',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'daily-test-')),db=new NodeSqliteDatabase(join(dir,'db.sqlite'));t.after(async()=>{await db.close();await rm(dir,{recursive:true,force:true});});
 await db.migrate(await readFile('drizzle/0000_initial.sql','utf8'));
 await db.migrate(await readFile('packages/db/migrations/sqlite/20261025171428_daily_world_challenge.sql','utf8'),'daily-world-v1');
 const store=new SqlStore(db),owner=await store.ensureUser('daily-test','Player'),other=await store.ensureUser('other','Other');
 let now=Date.parse('2026-10-25T10:00:00Z');const service=new DailyChallengeService(db,()=>now);
 const questions:DailyQuestion[]=Array.from({length:10},(_,i)=>({id:'q'+i,question:'Test fixture question number '+i,options:['A','B','C','D'],answer:0,category:'Test',difficulty:'medium',sourceUrl:'https://example.org/fixture',explanation:'Test only, never published.'}));
 await db.query('INSERT INTO daily_challenges(day,title,questions,prepared_at,status) VALUES(?,?,?,?,?)',['2026-10-25','Fixture',JSON.stringify(questions),new Date(now).toISOString(),'published']);
 const starts=await Promise.all([service.start('2026-10-25',owner,false),service.start('2026-10-25',owner,false)]);assert.equal(starts[0].id,starts[1].id);
 const id=starts[0].id;assert.equal(JSON.stringify(starts[0]).includes('explanation'),false);assert.equal('answer' in starts[0].question!,false);
 await assert.rejects(service.snapshot(id,other.id));await assert.rejects(service.start('2026-10-25',owner,true));
 await assert.rejects(service.answer(id,owner.id,{key:'early',index:0,choice:0}));
 let snap=starts[0];for(let index=0;index<10;index++){
  now=Date.parse(snap.startsAt)+(index===9?21000:1000);
  const input={key:'answer-'+index,index,choice:0};
  const results=await Promise.all([service.answer(id,owner.id,input),service.answer(id,owner.id,input)]);snap=results[0];assert.equal(results[0].score,results[1].score);
  assert.equal((await new DailyChallengeService(db,()=>now).snapshot(id,owner.id)).index,index+1);
 }
 assert.equal(snap.completed,true);assert.equal(snap.correct,9);assert.equal(snap.score,8775);assert.equal(snap.board?.own?.rank,1);
 await assert.rejects(service.answer(id,owner.id,{key:'extra',index:9,choice:0}));
 const replay=await service.start('2026-10-25',owner,true);assert.equal(replay.ranked,false);assert.notEqual(replay.id,id);
 now=Date.parse('2026-10-26T10:00:00Z');assert.equal((await service.start('2026-10-25',other,false)).ranked,false);
 assert.equal((await service.board('2026-10-25',owner.id)).own?.score,8775);assert.equal((await service.archive('2026-10-26',owner.id))[0].own_score,8775);
});
