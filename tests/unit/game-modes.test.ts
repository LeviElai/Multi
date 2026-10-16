import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Adjudication, Round, SessionData, Submission, WordAttempt } from '../../packages/contracts/src/index';
import {
  getDefaultRound, getDemoQuiz, normalizeAnswer, normalizeWord, parseFermiNumber,
  publicQuestionProjection, sanitizeAndValidateSubmission, scoreAmount, scoreFermi,
  scoreRound, scoreSize, scoreWordAttempt, segmentGraphemes, validateAuthorConfig,
  validateQuiz, validateWordGuess, wordFeedback,
} from '../../packages/game-modes/src/index';

const timestamp = '2026-10-16T10:00:00.000Z';
const forMode = <M extends Round['mode']>(mode: M): Extract<Round, { mode: M }> => getDefaultRound(mode) as Extract<Round, { mode: M }>;
const submission = (round: Round, participantId: string, payload: Submission['payload'], revision = 1): Submission => ({
  id: `${participantId}-${revision}`, roundId: round.id, participantId, payload, revision,
  clientMutationId: `${participantId}-${revision}`, acceptedAt: timestamp,
});
function session(round: Round, participants: string[], submissions: Submission[] = []): SessionData {
  return {
    session: { id: 'room', versionId: 'version', hostId: 'host', pinDigest: 'hash', pin: '123456', state: 'ROUND_LOCKED', stateVersion: 10, roundIndex: 0, deadlineAt: timestamp, pausedRemainingMs: null, extensionCount: 0, joinLocked: false, createdAt: timestamp, completedAt: null, lastMutationId: 'lock', latestSeq: 10, maxPlayers: 100 },
    quiz: { id: 'version', quizId: 'quiz', version: 1, title: 'Test', theme: 'studio', rounds: [round], createdAt: timestamp },
    members: participants.map(id => ({ id, nickname: id, status: 'active', joinedAt: timestamp })),
    submissions, attempts: [], adjudications: [], awards: [], voidRoundIds: [],
  };
}
function decision(round: Round, answerKey: string, canonical: string, choice: 'accept' | 'reject' = 'accept', date = timestamp): Adjudication {
  return { id: `${answerKey}-${date}`, roundId: round.id, answerKey, canonical, decision: choice, actorId: 'host', createdAt: date };
}
function attempt(round: Round, participantId: string, guess: string, number: number, solved = false): WordAttempt {
  return { id: `${participantId}-${number}`, roundId: round.id, participantId, clientMutationId: `${participantId}-${number}`, attempt: number, guess, solved, feedback: ['absent'], acceptedAt: timestamp };
}
const scores = (data: SessionData, round: Round) => Object.fromEntries(scoreRound(data, round).awards.map(award => [award.participantId, award.points]));

test('all five fresh demo rounds pass publish validation and are independently mutable', () => {
  const one = getDemoQuiz();
  const two = getDemoQuiz();
  assert.equal(one.rounds.length, 5);
  assert.deepEqual(validateQuiz(one), []);
  assert.equal(new Set([...one.rounds, ...two.rounds].map(round => round.id)).size, 10);
  assert.ok(one.rounds.every(round => round.provenance === 'creator_confirmed'));
  one.rounds[0].question = 'Changed';
  assert.notEqual(two.rounds[0].question, 'Changed');
});

test('quiz publish gates reject empty, duplicate, malformed and unreviewed content', () => {
  const quiz = getDemoQuiz();
  assert.ok(validateQuiz({ ...quiz, rounds: [] }).some(issue => issue.field === 'rounds'));
  assert.ok(validateQuiz({ ...quiz, rounds: [quiz.rounds[0], quiz.rounds[0]] }).some(issue => issue.field === 'id'));
  const unreviewed = { ...quiz.rounds[0], provenance: 'needs_review' as const };
  assert.ok(validateAuthorConfig(unreviewed).some(issue => issue.field === 'provenance'));
  assert.ok(validateAuthorConfig({ ...quiz.rounds[0], timerSeconds: 1 }).some(issue => issue.field === 'timerSeconds'));
  assert.ok(validateAuthorConfig({ ...quiz.rounds[0], provenance: 'verified_factual' }).some(issue => issue.field === 'sourceUrl'));
  assert.ok(validateAuthorConfig({ ...quiz.rounds[0], sourceUrl: 'javascript:alert(1)' }).some(issue => issue.field === 'sourceUrl'));
  assert.ok(validateAuthorConfig({ ...quiz.rounds[0], sourceUrl: 'https://user:secret@example.com/' }).some(issue => issue.field === 'sourceUrl'));
});

test('public projection is deeply frozen, independently cloned and strips unknown nested keys', () => {
  const round = forMode('amountle');
  const input = { ...round, privateNotes: 'hidden', publicConfig: { ...round.publicConfig, answer: 56, secretConfig: { answer: 56 } } };
  const projection = publicQuestionProjection(input);
  assert.deepEqual(Object.keys(projection).sort(), ['id', 'mode', 'schemaVersion', 'question', 'timerSeconds', 'maxPoints', 'allowRevision', 'publicConfig'].sort());
  assert.equal('secretConfig' in projection, false);
  assert.equal('explanation' in projection, false);
  assert.equal('answer' in projection.publicConfig, false);
  assert.equal('secretConfig' in projection.publicConfig, false);
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.publicConfig), true);
  assert.equal(Object.isFrozen((projection.publicConfig as typeof round.publicConfig).steps), true);
  round.publicConfig.steps.push(100);
  assert.equal((projection.publicConfig as typeof round.publicConfig).steps.includes(100), false);
  for (const other of getDemoQuiz().rounds) {
    const serialized = JSON.stringify(publicQuestionProjection(other));
    assert.equal(serialized.includes('secretConfig'), false);
    assert.equal(serialized.includes('sourceUrl'), false);
    assert.equal(serialized.includes('explanation'), false);
  }
});

test('Fermi accepts canonical decimals and unambiguous K/M/B shorthand', () => {
  for (const [input, expected] of [['1.2K', 1200], ['2 m', 2e6], ['0.5B', 5e8], ['-.25', -0.25], ['+12.', 12], ['0', 0]] as const) {
    assert.equal(parseFermiNumber(input), expected);
  }
  assert.equal(parseFermiNumber(-0), 0);
  for (const invalid of ['1,000', '1,5', '1e3', '1e99999', 'Infinity', 'NaN', '12 apples', '1 000', '1KK', '', '1.2.3', '1000001B', NaN, Infinity, -Infinity, 1e16]) {
    assert.throws(() => parseFermiNumber(invalid));
  }
});

test('Fermi submission sanitization is mode strict and preserves explicit locks', () => {
  const round = forMode('fermi');
  round.publicConfig.max = 2000;
  assert.deepEqual(sanitizeAndValidateSubmission(round, { text: '1.2K', locked: true }), { value: 1200, locked: true });
  assert.throws(() => sanitizeAndValidateSubmission(round, { value: 10, text: '10' }));
  assert.throws(() => sanitizeAndValidateSubmission(round, { value: 10, count: 10 }));
  assert.throws(() => sanitizeAndValidateSubmission(round, { value: 3000 }));
  assert.throws(() => sanitizeAndValidateSubmission(round, { value: 12.5 }));
  assert.throws(() => sanitizeAndValidateSubmission(round, { value: 10, locked: 'yes' }));
  assert.throws(() => sanitizeAndValidateSubmission(round, []));
});

test('Fermi uses exact decimal-grid alignment rather than approximate modulo', () => {
  const round = forMode('fermi');
  round.publicConfig = { ...round.publicConfig, min: -0.1, max: 2, step: 0.1 };
  round.secretConfig.answer = 0.3;
  assert.deepEqual(validateAuthorConfig(round), []);
  assert.deepEqual(sanitizeAndValidateSubmission(round, { text: '0.3' }), { value: 0.3 });
  assert.throws(() => sanitizeAndValidateSubmission(round, { value: 0.30000001 }));
  assert.throws(() => sanitizeAndValidateSubmission(round, { value: 0.35 }));
});

test('Fermi V3 proportional examples, zero guesses and large values are correct', () => {
  const round = forMode('fermi');
  round.secretConfig.answer = 1000;
  round.publicConfig = { ...round.publicConfig, min: -1000, max: 1e15 };
  assert.deepEqual([900, 1500, 2000, 0, -10, 1000].map(value => scoreFermi(round, value)), [900, 667, 500, 0, 0, 1000]);
  round.secretConfig.answer = 1e15;
  assert.equal(scoreFermi(round, 1e15), 1000);
  assert.equal(scoreFermi(round, 5e14), 500);
});

test('Fermi zero/negative answers require absolute scoring with positive tolerance and reachable bounds', () => {
  const round = forMode('fermi');
  round.secretConfig.answer = 0;
  assert.ok(validateAuthorConfig(round).some(issue => issue.field === 'publicConfig.errorMode'));
  round.publicConfig = { ...round.publicConfig, errorMode: 'absolute', min: -100, max: 100, tolerance: 10 };
  assert.deepEqual(validateAuthorConfig(round), []);
  assert.equal(scoreFermi(round, 0), 1000);
  assert.equal(scoreFermi(round, -5), 500);
  assert.equal(scoreFermi(round, 10), 0);
  round.secretConfig.answer = -20;
  assert.equal(scoreFermi(round, -20), 1000);
  assert.equal(scoreFermi(round, -25), 500);
  round.publicConfig.tolerance = 0;
  assert.ok(validateAuthorConfig(round).some(issue => issue.field === 'publicConfig.tolerance'));
  round.publicConfig.tolerance = 10;
  round.publicConfig.min = 101;
  assert.ok(validateAuthorConfig(round).some(issue => issue.field === 'publicConfig.max'));
});

test('Rare normalization is exact, versioned, accent-preserving and markup-safe', () => {
  assert.equal(normalizeAnswer('  ＣＯＲＡＬ  '), 'coral');
  assert.equal(normalizeAnswer('North—  Sky!'), 'north sky');
  assert.equal(normalizeAnswer('CAFÉ'), 'café');
  assert.notEqual(normalizeAnswer('café'), normalizeAnswer('cafe'));
  const round = forMode('rare_answers');
  assert.throws(() => sanitizeAndValidateSubmission(round, { text: '<script>alert(1)</script>' }));
  assert.throws(() => sanitizeAndValidateSubmission(round, { text: '\u202ecoral' }));
  assert.throws(() => sanitizeAndValidateSubmission(round, { text: '!!!' }));
  const data = session(round, ['p'], [submission(round, 'p', { text: 'cor' })]);
  assert.equal(scores(data, round).p, 0, 'No substring matching');
});

test('Rare validation rejects ambiguous aliases and unsafe answer catalogs', () => {
  const round = forMode('rare_answers');
  round.secretConfig.answers = [{ canonical: 'Red', aliases: ['warm'] }, { canonical: 'Orange', aliases: ['Warm!'] }];
  assert.ok(validateAuthorConfig(round).some(issue => issue.message.includes('more than one')));
  round.secretConfig.answers = [{ canonical: '<b>red</b>', aliases: [] }];
  assert.ok(validateAuthorConfig(round).length);
  round.secretConfig.answers = [];
  assert.ok(validateAuthorConfig(round).length);
  round.publicConfig.adjudication = 'host_review';
  assert.deepEqual(validateAuthorConfig(round), []);
});

test('Rare V3 frequency denominator includes only final valid answers', () => {
  const round = forMode('rare_answers');
  round.secretConfig.answers = Array.from({ length: 11 }, (_, index) => ({ canonical: `Color ${index}`, aliases: index === 0 ? ['primary'] : [] }));
  const ids = Array.from({ length: 22 }, (_, index) => `p${index}`);
  const records = ids.slice(0, 20).map((id, index) => submission(round, id, { text: index < 10 ? (index % 2 ? 'primary' : 'color 0') : `Color ${index - 9}` }));
  records.push(submission(round, 'p20', { text: 'invalid' }));
  const data = session(round, ids, records);
  const result = scoreRound(data, round);
  const value = scores(data, round);
  assert.equal(value.p0, 526);
  assert.equal(value.p9, 526);
  assert.equal(value.p10, 1000);
  assert.equal(value.p20, 0);
  assert.equal(value.p21, 0);
  assert.equal(result.reveal.groups?.find(group => group.answer === 'Color 0')?.count, 10);
  assert.deepEqual(result.review, []);
});

test('Rare singleton, zero-valid, all-duplicate, latest-revision and kicked-player cases', () => {
  const round = forMode('rare_answers');
  const data = session(round, ['a', 'b', 'c'], [submission(round, 'a', { text: 'mint' })]);
  assert.deepEqual(scores(data, round), { a: 1000, b: 0, c: 0 });
  data.submissions.push(submission(round, 'b', { text: 'mint' }));
  assert.deepEqual(scores(data, round), { a: 0, b: 0, c: 0 });
  data.submissions.unshift(submission(round, 'b', { text: 'sky' }, 2));
  assert.deepEqual(scores(data, round), { a: 1000, b: 1000, c: 0 });
  data.members[1].status = 'kicked';
  assert.deepEqual(scores(data, round), { a: 1000, b: 0, c: 0 });
  data.submissions = [submission(round, 'c', { text: 'unlisted' })];
  assert.deepEqual(scores(data, round), { a: 0, b: 0, c: 0 });
});

test('Rare review keeps all scores provisional and recomputes alias frequencies after host decisions', () => {
  const round = forMode('rare_answers');
  round.publicConfig.adjudication = 'host_review';
  const data = session(round, ['a', 'b', 'c', 'd'], [
    submission(round, 'a', { text: 'Mint' }), submission(round, 'b', { text: 'fresh' }),
    submission(round, 'c', { text: 'Sky' }), submission(round, 'd', { text: ' FRESH! ' }),
  ]);
  let result = scoreRound(data, round);
  assert.equal(result.review.length, 1);
  assert.deepEqual(result.review[0], { answerKey: 'fresh', text: 'fresh', count: 2 });
  assert.ok(result.awards.every(award => award.points === 0));
  data.adjudications = [decision(round, 'fresh', 'mint')];
  result = scoreRound(data, round);
  assert.deepEqual(result.review, []);
  assert.deepEqual(scores(data, round), { a: 333, b: 333, c: 1000, d: 333 });
  data.adjudications.push(decision(round, 'fresh', '', 'reject', '2026-10-16T10:01:00.000Z'));
  assert.deepEqual(scores(data, round), { a: 1000, b: 0, c: 1000, d: 0 });
});

test('Rare accepted alias chains and cycles form one consistent canonical bucket', () => {
  const round = forMode('rare_answers');
  round.publicConfig.adjudication = 'host_review';
  const data = session(round, ['a', 'b', 'c'], [submission(round, 'a', { text: 'aaa' }), submission(round, 'b', { text: 'bbb' }), submission(round, 'c', { text: 'Sky' })]);
  data.adjudications = [decision(round, 'aaa', 'bbb'), decision(round, 'bbb', 'ccc'), decision(round, 'ccc', 'bbb')];
  assert.deepEqual(scores(data, round), { a: 500, b: 500, c: 1000 });
  assert.equal(scoreRound(data, round).reveal.groups?.length, 2);
});

test('Word feedback allocates exact matches before finite repeated-letter matches', () => {
  assert.deepEqual(wordFeedback('APPLE', 'PAPAL'), ['present', 'present', 'exact', 'absent', 'present']);
  assert.deepEqual(wordFeedback('BALLOON', 'LOBBALO'), ['present', 'present', 'present', 'absent', 'present', 'present', 'present']);
  assert.deepEqual(wordFeedback('APPLE', 'AAAAA'), ['exact', 'absent', 'absent', 'absent', 'absent']);
  assert.deepEqual(wordFeedback('ORBIT', 'orbit'), ['exact', 'exact', 'exact', 'exact', 'exact']);
});

test('Word feedback counts Unicode graphemes and canonical composition, not UTF-16 units', () => {
  assert.equal(segmentGraphemes('A👩‍👩‍👧‍👦B').length, 3);
  assert.deepEqual(wordFeedback('A👩‍👩‍👧‍👦B', 'B👩‍👩‍👧‍👦A'), ['present', 'exact', 'present']);
  assert.deepEqual(wordFeedback('A\u0301XX', 'XÁX'), ['present', 'present', 'exact']);
  assert.equal(normalizeWord(' café '), 'CAFÉ');
  assert.throws(() => wordFeedback('APPLE', 'APP'));
});

test('Word validation checks grapheme length, allowed letters and the custom vocabulary', () => {
  const round = forMode('word_puzzle');
  assert.equal(validateWordGuess(round, ' orbit '), 'ORBIT');
  for (const guess of ['app', 'a b c', '<b>x>', '12345', '中国语中文', 'a👩‍👩‍👧‍👦bcd']) assert.throws(() => validateWordGuess(round, guess));
  round.publicConfig.dictionaryPolicy = 'custom';
  round.secretConfig.allowedGuesses = ['about', 'raise'];
  assert.equal(validateWordGuess(round, 'ABOUT'), 'ABOUT');
  assert.equal(validateWordGuess(round, 'ORBIT'), 'ORBIT', 'The answer is always a valid guess');
  assert.throws(() => validateWordGuess(round, 'apple'));
  round.secretConfig.allowedGuesses.push('too long');
  assert.ok(validateAuthorConfig(round).some(issue => issue.field.includes('allowedGuesses')));
  round.secretConfig.allowedGuesses = [];
  round.publicConfig.length = 4;
  round.secretConfig.answer = 'cafe\u0301';
  assert.deepEqual(validateAuthorConfig(round), []);
  assert.equal(validateWordGuess(round, 'CAFÉ'), 'CAFÉ');
});

test('Word scoring uses the first actual correct attempt and rejects forged flags or attempts past the cap', () => {
  const round = forMode('word_puzzle');
  const data = session(round, ['a', 'b', 'c']);
  data.attempts = [attempt(round, 'a', 'ABOUT', 1, true), attempt(round, 'a', 'ORBIT', 3, false), attempt(round, 'a', 'ORBIT', 4, true), attempt(round, 'b', 'ORBIT', 7, true), attempt(round, 'c', 'ABOUT', 1, true)];
  assert.deepEqual(scores(data, round), { a: 700, b: 0, c: 0 });
  assert.deepEqual(Array.from({ length: 8 }, (_, index) => scoreWordAttempt(index + 1, 8)), [1000, 850, 700, 550, 400, 250, 100, 0]);
  assert.equal(scoreWordAttempt(0, 6), 0);
  assert.equal(scoreWordAttempt(1.5, 6), 0);
});

test('Size It Up scores ratios independently of viewport and rejects invalid calibrations', () => {
  const round = forMode('size_it_up');
  assert.equal(scoreSize(round, 2.4), 1000);
  assert.equal(scoreSize(round, 1.2), 500);
  const data = session(round, ['phone320', 'display1440'], [submission(round, 'phone320', { ratio: 2 }), submission(round, 'display1440', { ratio: 2 })]);
  assert.deepEqual(scores(data, round), { display1440: 833, phone320: 833 });
  assert.throws(() => sanitizeAndValidateSubmission(round, { ratio: 0 }));
  assert.throws(() => sanitizeAndValidateSubmission(round, { ratio: 100 }));
  for (const calibration of [
    { version: 1 as const, intrinsicDimension: 100, start: 50, end: 40 },
    { version: 1 as const, intrinsicDimension: 100, start: 0, end: 101 },
    { version: 1 as const, intrinsicDimension: Infinity, start: 0, end: 100 },
    { version: 1 as const, intrinsicDimension: 200, start: 0, end: 100 },
  ]) {
    assert.ok(validateAuthorConfig({ ...round, publicConfig: { ...round.publicConfig, calibration } }).length);
  }
  round.secretConfig.targetSize = 100;
  assert.ok(validateAuthorConfig(round).some(issue => issue.field === 'secretConfig.targetSize'));
});

test('Amountle is an integer absolute state, including zero and bounded counts', () => {
  const round = forMode('amountle');
  assert.equal(scoreAmount(round, 56), 1000);
  assert.equal(scoreAmount(round, 42), 500);
  assert.equal(scoreAmount(round, 0), 0);
  assert.deepEqual(sanitizeAndValidateSubmission(round, { count: 100, locked: true }), { count: 100, locked: true });
  for (const count of [-1, 0.5, 101, NaN, Infinity, '56']) assert.throws(() => sanitizeAndValidateSubmission(round, { count }));
  round.secretConfig.answer = 0;
  round.publicConfig.tolerance = 5;
  assert.equal(scoreAmount(round, 0), 1000);
  assert.equal(scoreAmount(round, 2), 600);
  round.publicConfig.maxCount = 10000;
  round.secretConfig.answer = 10000;
  assert.equal(scoreAmount(round, 10000), 1000);
  assert.equal(scoreAmount(round, 5000), 500);
  assert.equal(scoreAmount(round, 0), 0);
});

test('Amountle V3 branch near 100 is explicit and publish gates retain reachable controls', () => {
  const round = forMode('amountle');
  round.publicConfig.maxCount = 200;
  round.secretConfig.answer = 100;
  round.publicConfig.tolerance = 50;
  assert.equal(scoreAmount(round, 75), 500);
  round.secretConfig.answer = 101;
  assert.equal(scoreAmount(round, 75), 743, 'This intentional V3 provisional discontinuity needs playtesting');
  round.secretConfig.answer = 201;
  assert.ok(validateAuthorConfig(round).some(issue => issue.field === 'secretConfig.answer'));
  round.publicConfig.steps = [10, 100];
  assert.ok(validateAuthorConfig(round).some(issue => issue.field === 'publicConfig.steps'));
});

test('Scoring uses latest absolute state exactly once and void rounds earn zero', () => {
  const round = forMode('amountle');
  const data = session(round, ['a', 'b'], [submission(round, 'a', { count: 56 }, 2), submission(round, 'a', { count: 1 }, 1), submission(round, 'a', { count: 56 }, 2), submission(round, 'b', { count: 999 }, 3)]);
  const before = structuredClone(data);
  const first = scoreRound(data, round);
  assert.deepEqual(first, scoreRound(data, round));
  assert.deepEqual(data, before, 'Scoring must not mutate persisted records');
  assert.deepEqual(scores(data, round), { a: 1000, b: 0 });
  assert.equal(first.awards.length, 2);
  assert.ok(first.awards.every(award => award.scoringRevision === 1));
  data.voidRoundIds.push(round.id);
  assert.deepEqual(scores(data, round), { a: 0, b: 0 });
  assert.equal(scoreRound(data, round).reveal.skipped, true);
});

test('Numeric score curves are bounded integers and symmetric under reciprocal proportional error', () => {
  const fermi = forMode('fermi');
  fermi.secretConfig.answer = 1000;
  const size = forMode('size_it_up');
  const amount = forMode('amountle');
  for (let index = 1; index <= 1000; index++) {
    const factor = index / 100;
    assert.equal(scoreFermi(fermi, 1000 * factor), scoreFermi(fermi, 1000 / factor));
    for (const score of [scoreFermi(fermi, index), scoreSize(size, factor), scoreAmount(amount, index)]) {
      assert.equal(Number.isInteger(score), true);
      assert.ok(score >= 0 && score <= 1000);
    }
  }
});
