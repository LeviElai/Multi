import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ContinuousResults from '../../apps/web/components/game/ContinuousResults';
import {getDemoQuiz} from '../../packages/game-modes/src/fixtures';
import type {Snapshot} from '../../packages/contracts/src/index';

test('standings distinguish tied round best from overall lead without duplicate score panels', () => {
 const snapshot = {
  round:getDemoQuiz().rounds[0],roundIndex:0,roundCount:5,state:'INTERMISSION',phase:'placements',
  serverTime:new Date().toISOString(),deadlineAt:null,ownAttempts:[],participantId:'a',
  ownSubmission:{payload:{value:144}},reveal:{answer:144},
  leaderboard:[
   {participantId:'c',nickname:'Overall leader',points:2500,roundPoints:100,rank:1},
   {participantId:'a',nickname:'Luna',points:2000,roundPoints:1000,rank:2},
   {participantId:'b',nickname:'Moss',points:1800,roundPoints:1000,rank:3},
  ],
 } as unknown as Snapshot;
 const html=renderToStaticMarkup(createElement(ContinuousResults,{snapshot}));
 assert.equal((html.match(/<small>Round best<\/small>/g)??[]).length,2);
 assert.match(html,/is-you round-best/);
 assert.match(html,/>Luna<\/span>/);
 assert.match(html,/>Moss<\/span>/);
 assert.doesNotMatch(html,/result-winner-line|ticket-points|Answer and Placements/);
 assert.match(html,/2,500 total points/);
});


test('server deadline drives answer, comparison and points with reconnect boundary accuracy',async()=>{
 const {revealStep}=await import('../../packages/contracts/src/timing');
 assert.equal(revealStep(5500),'answer');assert.equal(revealStep(3501),'answer');assert.equal(revealStep(3500),'comparison');assert.equal(revealStep(1501),'comparison');assert.equal(revealStep(1500),'points');assert.equal(revealStep(0),'points');
});

test('quiz palette is stable by identity and readable across all eight themes',async()=>{
 const {quizColor,QUIZ_COLORS}=await import('../../apps/web/lib/quiz-color');
 const colors=Array.from({length:100},(_,i)=>quizColor('quiz-'+i));assert.equal(new Set(colors).size,8);assert.deepEqual(colors,Array.from({length:100},(_,i)=>quizColor('quiz-'+i)));
 const lum=(hex:string)=>{const rgb=hex.match(/[a-f\d]{2}/gi)!.map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 for(const c of QUIZ_COLORS)assert.ok((lum(c)+.05)/(lum('#24384b')+.05)>=4.5);
});


test('standings show previous totals first, then authoritative totals and ID-stable position exchanges',async()=>{
 const {Standings}=await import('../../apps/web/components/game/Competition');
 const previous=[{participantId:'a',nickname:'Old leader',points:1200,roundPoints:0,rank:1},{participantId:'b',nickname:'Climber',points:900,roundPoints:0,rank:2},{participantId:'c',nickname:'Another mover',points:800,roundPoints:0,rank:3}];
 const leaders=[{...previous[1],points:1900,roundPoints:1000,rank:1},{...previous[2],points:1700,roundPoints:900,rank:2},{...previous[0],points:1200,roundPoints:0,rank:3}];
 const frame=(sequence:string)=>renderToStaticMarkup(createElement(Standings,{leaders,previousLeaders:previous,ownId:'b',sequence}));
 const before=frame('previous'),after=frame('settled');assert.ok(before.indexOf('data-player="a"')<before.indexOf('data-player="b"'));assert.match(before,/1,200 total points/);assert.doesNotMatch(before,/1,900 total points/);
 assert.ok(after.indexOf('data-player="b"')<after.indexOf('data-player="c"'));assert.ok(after.indexOf('data-player="c"')<after.indexOf('data-player="a"'));assert.match(after,/1,900 total points/);assert.match(after,/\+1,000/);
 const zero=renderToStaticMarkup(createElement(Standings,{leaders:previous,previousLeaders:previous,sequence:'settled'}));assert.doesNotMatch(zero,/Round best/);
});
