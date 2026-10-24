import {stackScale} from './stack-scale';
import { QuizInputSchema, RoundSchema } from '../../contracts/src/index';
import type {
  Award, PublicRound, QuizInput, Reveal, ReviewItem, Round, SessionData, Submission, ValidationIssue, WordAttempt,
} from '../../contracts/src/index';
import { sanitizeFermi, scoreFermi, validateFermi } from './fermi';
import { sanitizeRare, scoreRare, validateRare } from './rare-answers';
import { scoreWordAttempt, validateWord, validateWordGuess } from './word-puzzle';
import { sanitizeSize, scoreSize, validateSize } from './size-it-up';
import { sanitizeAmount, scoreAmount, validateAmount } from './amountle';
import { compareText, invalid, issue, normalizeWord, SCORING_VERSION } from './shared';
import {isArcade,validateArcade,sanitizeArcade,scoreArcade,arcadeAnswer} from './arcade';

export { getDefaultRound, getDemoQuiz } from './fixtures';
export { parseFermiNumber, scoreFermi } from './fermi';
export { normalizeAnswer, normalizeWord, segmentGraphemes, SCORING_VERSION } from './shared';
export { validateWordGuess, wordFeedback, scoreWordAttempt } from './word-puzzle';
export { scoreSize } from './size-it-up';
export { scoreAmount } from './amountle';

/** Publish-time validation; draft persistence may retain incomplete rounds. */
export function validateAuthorConfig(round: Round): ValidationIssue[] {
  const parsed = RoundSchema.safeParse(round);
  if (!parsed.success) return parsed.error.issues.map(error => ({
    roundId: typeof round?.id === 'string' ? round.id : undefined,
    field: error.path.join('.'), message: error.message, severity: 'error',
  }));
  const value = parsed.data;
  const issues: ValidationIssue[] = [];
  if(value.mode==='answer')issues.push(issue(value,'mode','Add a supported answer and choices to select one of the eleven games.'));
  if(value.answerProvided===false)issues.push(issue(value,'secretConfig.answer','Enter and confirm the correct answer.'));
  if(isArcade(value))issues.push(...validateArcade(value));
  if (value.provenance === 'needs_review') issues.push(issue(value, 'provenance', 'Review and confirm this question before publishing.'));
  if (value.provenance === 'verified_factual' && !value.sourceUrl?.trim()) issues.push(issue(value, 'sourceUrl', 'Verified factual questions require a source URL.'));
  if (value.sourceUrl?.trim()) {
    try {
      const url = new URL(value.sourceUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid source URL');
    } catch { issues.push(issue(value, 'sourceUrl', 'Use a valid HTTP or HTTPS source URL without embedded credentials.')); }
  }
  switch (value.mode) {
    case 'fermi': issues.push(...validateFermi(value)); break;
    case 'rare_answers': issues.push(...validateRare(value)); break;
    case 'word_puzzle': issues.push(...validateWord(value)); break;
    case 'size_it_up': issues.push(...validateSize(value)); break;
    case 'amountle': issues.push(...validateAmount(value)); break;
  }
  return issues;
}

export function validateQuiz(input: QuizInput): ValidationIssue[] {
  const parsed = QuizInputSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(error => {
    const index = error.path[0] === 'rounds' && typeof error.path[1] === 'number' ? error.path[1] : undefined;
    return {
      roundId: index === undefined ? undefined : input?.rounds?.[index]?.id,
      field: error.path.join('.'), message: error.message, severity: 'error' as const,
    };
  });
  const issues: ValidationIssue[] = [];
  if (!parsed.data.rounds.length) issues.push({ field: 'rounds', message: 'Add at least one round before publishing.', severity: 'error' });
  const seen = new Set<string>();
  parsed.data.rounds.forEach(round => {
    if (seen.has(round.id)) issues.push(issue(round, 'id', 'Every round must have a unique ID.'));
    seen.add(round.id);
    issues.push(...validateAuthorConfig(round));
    if(round.mode==='rare_answers')issues.push(issue(round,'mode','This legacy question needs a supported answer format before publishing.'));
  });
  return issues;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** An explicit allowlist, including nested Zod-stripped config; never serialize a Round directly. */
export function publicQuestionProjection(round: Round): PublicRound {
  const clean = RoundSchema.parse(round);
  if(clean.mode==='stack'){
    // Older published rounds may have tiny denominations. Repair only their
    // presentation, keeping the stored version, answer and accepted step intact.
    let left=Number(clean.secretConfig.answer),placements=0;
    for(const value of [...clean.publicConfig.blockValues].sort((a,b)=>b-a)){placements+=Math.floor(left/value);left%=value;}
    if(placements>32||left){const step=clean.publicConfig.step;clean.publicConfig.blockValues=[...new Set([step,...stackScale(Number(clean.secretConfig.answer)).values.filter(v=>v%step===0)])].sort((a,b)=>a-b);}
  }
  return deepFreeze({
    id: clean.id, mode: clean.mode, schemaVersion: clean.schemaVersion,
    question: clean.question, timerSeconds: clean.timerSeconds, maxPoints: clean.maxPoints,
    allowRevision: clean.allowRevision, publicConfig: clean.publicConfig, ...(clean.scoringPolicy?{scoringPolicy:clean.scoringPolicy}:{}),
    
  });
}

export function sanitizeAndValidateSubmission(round: Round, payload: unknown): Submission['payload'] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(payload))) invalid('Submit a valid answer object.');
  const fields = payload as Record<string, unknown>;
  if(isArcade(round)){
    const allowed=['locked',...(round.mode==='draw'?['value','ink']:['stack','crack'].includes(round.mode)?['value']:round.mode==='fish'&&round.publicConfig.kind==='multiple'&&round.publicConfig.fishScoring!=='catch-v1'?['choices']:round.mode==='drop'||['fish','sling','claw'].includes(round.mode)?['choiceId']:round.publicConfig.kind==='multiple'||round.publicConfig.kind==='list'?['choices']:['text'])];
    if(Object.keys(fields).some(k=>!allowed.includes(k))||(fields.locked!==undefined&&typeof fields.locked!=='boolean'))invalid('This answer contains unsupported fields.');
    return {...sanitizeArcade(round,fields),...(fields.locked===undefined?{}:{locked:fields.locked as boolean})};
  }
  const allowed: string[] = {
    fermi: ['value', 'text', 'locked'], rare_answers: ['text', 'locked'],
    size_it_up: ['ratio', 'locked'], amountle: ['count', 'locked'], word_puzzle: [],
  }[round.mode];
  if (Object.keys(fields).some(key => !allowed.includes(key))) invalid('This answer contains unsupported fields.');
  if (fields.locked !== undefined && typeof fields.locked !== 'boolean') invalid('Lock status must be a boolean.');
  const lock = fields.locked === undefined ? {} : { locked: fields.locked as boolean };
  switch (round.mode) {
    case 'fermi':
      if (fields.value !== undefined && fields.text !== undefined) invalid('Submit one numeric value, not two representations.');
      return { value: sanitizeFermi(round, fields.value ?? fields.text), ...lock };
    case 'rare_answers': return { text: sanitizeRare(fields.text), ...lock };
    case 'size_it_up': return { ratio: sanitizeSize(round, fields.ratio), ...lock };
    case 'amountle': return { count: sanitizeAmount(round, fields.count), ...lock };
    case 'word_puzzle': return invalid('Word guesses must use the word-attempt endpoint.');
  }
}

function latestSubmissions(data: SessionData, round: Round): Map<string, Submission> {
  const result = new Map<string, Submission>();
  const sorted = data.submissions.filter(submission => submission.roundId === round.id).slice()
    .sort((a, b) => a.revision - b.revision || compareText(a.acceptedAt, b.acceptedAt) || compareText(a.id, b.id));
  sorted.forEach(submission => result.set(submission.participantId, submission));
  return result;
}

function revealFor(round: Round, skipped: boolean): Reveal {
  const base = {
    provenance: round.provenance, skipped,
    ...(round.explanation ? { explanation: round.explanation } : {}),
    ...(round.sourceUrl ? { sourceUrl: round.sourceUrl } : {}),
  };
  if(isArcade(round))return {...base,answer:arcadeAnswer(round),...(round.publicConfig.options.length?{correctOptionIds:round.secretConfig.correctOptionIds}:{}),unit:round.publicConfig.unit,...(['draw','stack','crack'].includes(round.mode)?{distribution:[]}: {})};
  switch (round.mode) {
    case 'fermi': return { ...base, answer: round.secretConfig.answer, unit: round.publicConfig.unit, distribution: [] };
    case 'rare_answers': return { ...base, answer: 'Valid answers from this room', groups: [] };
    case 'word_puzzle': return { ...base, answer: normalizeWord(round.secretConfig.answer, round.publicConfig.locale) };
    case 'size_it_up': return { ...base, answer: round.secretConfig.targetSize, unit: round.publicConfig.unit, trueRatio: round.secretConfig.targetSize / round.publicConfig.referenceSize, distribution: [] };
    case 'amountle': return { ...base, answer: round.secretConfig.answer, unit: round.publicConfig.unit, distribution: [] };
  }
}

/**
 * Pure V3 scoring over accepted server records. The caller controls deadlines,
 * persistence and scoring revisions, and MUST keep this reveal server-only until
 * ROUND_REVEAL. Nonempty review means all returned awards are provisional zeros.
 */
export function scoreRound(data: SessionData, round: Round): { awards: Award[]; review: ReviewItem[]; reveal: Reveal } {
  if(data.reviewTimeoutRoundId===round.id&&round.mode==='rare_answers')round={...round,publicConfig:{...round.publicConfig,adjudication:'allowlist'}};
  const skipped = data.voidRoundIds.includes(round.id);
  const reveal = revealFor(round, skipped);
  const members = [...new Map(data.members.map(member => [member.id, member])).values()].sort((a, b) => compareText(a.id, b.id));
  const latest = latestSubmissions(data, round);
  const canonical = new Map<string, Submission['payload']>();
  const invalidIds = new Set<string>();
  if (!skipped && round.mode !== 'word_puzzle') members.filter(member => member.status === 'active').forEach(member => {
    const submission = latest.get(member.id);
    if (!submission) return;
    try {
      if(round.mode==='fish'&&round.publicConfig.fishScoring==='catch-v1'){
        const {fishPoints,fishCatches,fishCycles,fishFeedback,...input}=submission.payload;
        const clean=sanitizeAndValidateSubmission(round,input);
        if(!Number.isInteger(fishPoints)||fishPoints!<0||fishPoints!>1000||!Number.isInteger(fishCatches)||fishCatches!<0||fishPoints!>fishCatches!*100)throw new Error('Invalid fishing record');
        canonical.set(member.id,{...clean,fishPoints,fishCatches});
      }else if(round.mode==='crack'&&round.publicConfig.crackScoring==='deduction-v1'){
        // These fields are written by the engine, never accepted by SubmitSchema.
        const {crackAttempts,crackPoints,crackHint,...input}=submission.payload;
        const clean=sanitizeAndValidateSubmission(round,input);
        const ceiling=Math.max(1,Math.round(1000*.8**((crackAttempts??1)-1)));
        if(!Number.isInteger(crackAttempts)||crackAttempts!<1||!Number.isInteger(crackPoints)||crackPoints!<0||crackPoints!>ceiling)throw new Error('Invalid Crack record');
        canonical.set(member.id,{...clean,crackAttempts,crackPoints});
      }else canonical.set(member.id, sanitizeAndValidateSubmission(round, submission.payload));
    }
    catch { invalidIds.add(member.id); }
  });
  const awards = members.map(member => ({
    roundId: round.id, participantId: member.id, points: 0,
    reason: skipped ? 'round_skipped' : member.status === 'kicked' ? 'participant_removed' : invalidIds.has(member.id) ? 'invalid_submission' : 'not_submitted',
    scoringRevision: 1, detail: { scoringVersion: round.questionType||round.scoringPolicy?'v4-question':SCORING_VERSION } as Record<string, unknown>,
  }));
  if (skipped) return { awards, review: [], reveal };
  if (round.mode === 'rare_answers') {
    const rare = scoreRare(round, new Map([...canonical].map(([id, payload]) => [id, payload.text!])), data.adjudications,data.reviewTimeoutRoundId!==round.id);
    awards.forEach(award => {
      const result = rare.results.get(award.participantId);
      if (result) {
        award.points = result.points;
        award.reason = result.reason;
        award.detail = { ...award.detail, ...result };
      }
    });
    reveal.groups = rare.groups;
    return { awards, review: rare.review, reveal };
  }
  const memberMap = new Map(members.map(member => [member.id, member]));
  for (const award of awards) {
    const member = memberMap.get(award.participantId)!;
    if (member.status !== 'active') continue;
    if (round.mode === 'word_puzzle') {
      const attempts = data.attempts.filter(attempt => attempt.roundId === round.id && attempt.participantId === member.id
        && Number.isInteger(attempt.attempt) && attempt.attempt >= 1 && attempt.attempt <= round.publicConfig.maxAttempts)
        .slice().sort((a, b) => a.attempt - b.attempt || compareText(a.acceptedAt, b.acceptedAt) || compareText(a.id, b.id));
      const seenAttempts = new Set<number>();
      const valid: WordAttempt[] = [];
      for (const attempt of attempts) {
        if (seenAttempts.has(attempt.attempt)) continue;
        seenAttempts.add(attempt.attempt);
        try { validateWordGuess(round, attempt.guess); valid.push(attempt); } catch { /* Corrupt/unaccepted records never earn points. */ }
      }
      const solved = valid.find(attempt => normalizeWord(attempt.guess, round.publicConfig.locale) === normalizeWord(round.secretConfig.answer, round.publicConfig.locale));
      award.points = solved ? scoreWordAttempt(solved.attempt, round.publicConfig.maxAttempts) : 0;
      award.reason = solved ? 'word_solved' : valid.length ? 'not_solved' : 'not_submitted';
      award.detail = { ...award.detail, attemptsUsed: solved?.attempt ?? valid.length, solved: Boolean(solved) };
      continue;
    }
    const payload = canonical.get(member.id);
    if (!payload) continue;
    if(isArcade(round)){
      const result=scoreArcade(round,payload);award.points=result.points;award.reason=result.correct?'correct':'incorrect';award.detail={...award.detail,...result,...(round.mode==='draw'&&payload.ink?{ink:payload.ink}:{})};
      if(result.value!==undefined)reveal.distribution?.push({label:member.nickname,value:result.value,points:award.points});
      continue;
    }
    let value: number;
    switch (round.mode) {
      case 'fermi': value = payload.value!; award.points = scoreFermi(round, value); break;
      case 'size_it_up': value = payload.ratio!; award.points = scoreSize(round, value); break;
      case 'amountle': value = payload.count!; award.points = scoreAmount(round, value); break;
    }
    award.reason = award.points === 1000 ? 'exact' : 'estimate';
    award.detail = { ...award.detail, value };
    reveal.distribution!.push({ label: member.nickname, value, points: award.points });
  }
  reveal.distribution?.sort((a, b) => a.value - b.value || compareText(a.label, b.label));
  return { awards, review: [], reveal };
}
