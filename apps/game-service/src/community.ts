import { z } from 'zod';
import { DomainError, type QuizInput } from '../../../packages/contracts/src/index';
import type { Store } from '../../../packages/db/src/types';
import { validateQuiz } from '../../../packages/game-modes/src/index';
import {getWorkshopQuiz} from '../../../packages/game-modes/src/fixtures';
import { idempotentId } from './security';

export const CommunityInput=z.object({reviewed:z.literal(true),category:z.enum(['General','Science','Nature','History','Games','Puzzles']).default('General'),expectedRevision:z.number().int().positive()});
type Listing={quiz_id:string;version_id:string;owner_id:string;description:string;category:string;published_at:string;title:string;display_name:string};
export function starterQuiz(id:string):QuizInput|null{
 const quiz=getWorkshopQuiz();
 if(id==='starter-five')return {...quiz,title:'The five-game warm-up'};
 if(id==='starter-space'){quiz.title='A little space';quiz.description='Orbits, distances and a sky full of guesses.';quiz.rounds=quiz.rounds.filter(r=>r.mode==='word_puzzle'||r.mode==='fermi');const f=quiz.rounds.find(r=>r.mode==='fermi');if(f?.mode==='fermi'){f.question='Light takes about 8 minutes to reach Earth. At 300,000 km each second, roughly how far does it travel?';f.secretConfig.answer=144000000;f.publicConfig={...f.publicConfig,unit:'km',max:1e9,tolerance:144000000};f.explanation='8 × 60 × 300,000 = 144 million km.';}return quiz;}
 if(id==='starter-nature'){quiz.title='Outside the box';quiz.description='Trees, birds and a word from the wild.';quiz.rounds=quiz.rounds.filter(r=>r.mode==='rare_answers'||r.mode==='word_puzzle'||r.mode==='size_it_up');const w=quiz.rounds.find(r=>r.mode==='word_puzzle');if(w?.mode==='word_puzzle'){w.question='Five letters: a hard-shelled fruit of an oak tree.';w.secretConfig.answer='ACORN';w.explanation='An acorn is the fruit of an oak tree.';}return quiz;}
 return null;
}
const starters=[['starter-five','The five-game warm-up','A quick tour of all five games.','General',5],['starter-space','A little space','Orbits, distances and a sky full of guesses.','Science',2],['starter-nature','Outside the box','Trees, birds and a word from the wild.','Nature',3]] as const;
export async function browseCommunity(store:Store,q:string,category:string,offset:number){
 const query=q.trim().toLowerCase().slice(0,100);
 const rows=(await store.db.query<Listing>("SELECT c.*,v.title,u.display_name FROM community_quizzes c JOIN quiz_versions v ON v.id=c.version_id JOIN quizzes q ON q.id=c.quiz_id JOIN users u ON u.id=c.owner_id WHERE c.visible=1 AND q.status<>'archived' AND (?='' OR LOWER(v.title) LIKE ? OR LOWER(c.description) LIKE ?) AND (?='All' OR c.category=?) ORDER BY c.published_at DESC,c.quiz_id LIMIT 25 OFFSET ?",[query,`%${query}%`,`%${query}%`,category,category,offset])).rows;
 return {items:[...(offset===0?starters.filter(([,title,description,cat])=>(category==='All'||cat===category)&&`${title} ${description}`.toLowerCase().includes(query)).map(([id,title,description,category,count])=>({id,title,description,category,count,author:'MULTIGAME',starter:true})):[]),...await Promise.all(rows.slice(0,24).map(async row=>{const v=await store.getVersion(row.version_id);return {id:row.quiz_id,title:row.title,description:row.description,category:row.category,count:v.rounds.length,modes:[...new Set(v.rounds.map(r=>r.mode))],author:row.display_name,starter:false};}))],nextOffset:rows.length>24?offset+24:null};
}
export async function communityQuiz(store:Store,id:string):Promise<QuizInput>{
 const starter=starterQuiz(id);if(starter)return starter;
 z.string().uuid().parse(id);
 const row=(await store.db.query<Listing>("SELECT c.* FROM community_quizzes c JOIN quizzes q ON q.id=c.quiz_id WHERE c.quiz_id=? AND c.visible=1 AND q.status<>'archived'",[id])).rows[0];
 if(!row)throw new DomainError('NOT_FOUND','This community quiz is unavailable.',404);
 const v=await store.getVersion(row.version_id);return {title:v.title,description:row.description,language:'en',audienceContext:'general',theme:v.theme as QuizInput['theme'],rounds:v.rounds};
}
export async function shareCommunity(store:Store,owner:string,id:string,key:string,input:z.infer<typeof CommunityInput>){
 const quiz=await store.getQuiz(id,owner);
 if(validateQuiz(quiz).some(i=>i.severity==='error'))throw new DomainError('INVALID_QUIZ','Fix the quiz before sharing it.',422);
 // Sharing uses an immutable reviewed version. Future draft edits are private until shared again.
 const version=await store.publishQuiz(id,owner,input.expectedRevision,`community:${key}`);
 await store.db.query('INSERT INTO community_quizzes (quiz_id,version_id,owner_id,description,category,published_at,visible) VALUES (?,?,?,?,?,?,1) ON CONFLICT(quiz_id) DO UPDATE SET version_id=excluded.version_id,description=excluded.description,category=excluded.category,published_at=excluded.published_at,visible=1',[id,version.id,owner,quiz.description,input.category,new Date().toISOString()]);
 return {shared:true,id,versionId:version.id};
}
export async function copyCommunity(store:Store,owner:string,id:string,key:string){const quiz=await communityQuiz(store,id);const copyId=await idempotentId('community-copy',owner,key);return store.createQuiz(owner,{...quiz,rounds:quiz.rounds.map(r=>({...r,id:crypto.randomUUID()}))},copyId);}
