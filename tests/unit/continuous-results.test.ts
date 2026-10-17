import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ContinuousResults from '../../apps/web/components/game/ContinuousResults';
import {getDemoQuiz} from '../../packages/game-modes/src/fixtures';
import type {Snapshot} from '../../packages/contracts/src/index';

test('automatic results announce actual tied round winners and personal place', () => {
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
 assert.match(html,/Round winners/);
 assert.match(html,/<strong>Luna · Moss<\/strong>/);
 assert.match(html,/Place #2/);
 assert.match(html,/\+1,000 points/);
 assert.doesNotMatch(html,/<strong>Overall leader<\/strong>/);
});
