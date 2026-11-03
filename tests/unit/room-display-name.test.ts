import test from 'node:test';
import assert from 'node:assert/strict';
import {roomDisplayName,sanitizeNickname} from '../../apps/game-service/src/security';

test('registered room labels fit full profile names safely while guest limit remains explicit',()=>{
  assert.equal(roomDisplayName('  The Fish King  '),'The Fish King');
  const long='The International Fish Champion';
  const compact=roomDisplayName(long);
  assert.equal(compact,long.slice(0,21)+'...');
  assert.equal(sanitizeNickname(compact),compact);
  assert.throws(()=>sanitizeNickname(long));
  const accented='e\u0301'.repeat(30);
  assert.equal([...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(roomDisplayName(accented))].length,24);
  assert.throws(()=>roomDisplayName('Good name'.repeat(5)+'<script>'));
});
