import {fishCast} from '../../../packages/game-modes/src/fish';
import {crackGuess} from '../../../packages/game-modes/src/crack';
import {READING_MS,REVEAL_MS} from '../../../packages/contracts/src/timing';
import { DomainError, HostActionSchema, SubmitSchema, WordGuessSchema } from '../../../packages/contracts/src/index';
import {avatarFor,type Avatar} from '../../../packages/contracts/src/avatar';
import type { Ack, Adjudication, Award, HostAction, Leader, Principal, SessionData, SessionRecord, SessionState, Snapshot } from '../../../packages/contracts/src/index';
import type { Store, MutationResult } from '../../../packages/db/src/types';
import { normalizeAnswer, publicQuestionProjection, sanitizeAndValidateSubmission, scoreRound, validateWordGuess, wordFeedback } from '../../../packages/game-modes/src/index';
import { digestPin, digestToken, idempotentId, newPin, opaqueToken, sanitizeNickname } from './security';

type Clock = () => number;
export type EngineOptions = { pinSecret?: string; maxPlayers?: number; automatic?:boolean };
export type StateReceipt = { state: SessionState; stateVersion: number };
export type ReviewDecision = { roundId: string; answerKey: string; decision: 'accept' | 'reject'; canonical?: string; expectedStateVersion: number };
const TERMINAL = new Set<SessionState>(['SESSION_COMPLETED', 'SESSION_ABORTED']);
const REVEALED = new Set<SessionState>(['ROUND_REVEAL', 'INTERMISSION', 'SESSION_COMPLETED']);
const PREPARATION_MS = 800;
const COUNTDOWN_MS = 3000;
const INTERMISSION_MS = 800;

function receipt(data: SessionData): StateReceipt { return { state: data.session.state, stateVersion: data.session.stateVersion }; }
function currentRound(data: SessionData) {
  const round = data.quiz.rounds[data.session.roundIndex];
  if (!round) throw new DomainError('ROUND_UNAVAILABLE', 'There is no active round.', 409);
  return round;
}
function assertHost(data: SessionData, hostId: string): void {
  if (data.session.hostId !== hostId) throw new DomainError('FORBIDDEN', 'Only the host can perform this action.', 403);
}
function assertPrincipal(data: SessionData, principal: Principal): void {
  if (principal.role === 'host') { assertHost(data, principal.id); return; }
  if (principal.sessionId !== data.session.id) throw new DomainError('FORBIDDEN', 'This credential belongs to a different room.', 403);
  if (principal.role === 'player' && !data.members.some((member) => member.id === principal.id && member.status === 'active')) {
    throw new DomainError('MEMBERSHIP_REVOKED', 'Your membership in this room is no longer active.', 403);
  }
}
function assertPlayer(data: SessionData, principal: Principal, roundId: string, now: number): void {
  assertPrincipal(data, principal);
  if (principal.role !== 'player') throw new DomainError('FORBIDDEN', 'A player credential is required.', 403);
  if (data.session.state !== 'ROUND_ACTIVE') throw new DomainError('ROUND_NOT_ACTIVE', data.session.state === 'PAUSED' ? 'The round is paused.' : 'This round is not accepting answers.', 409);
  if (currentRound(data).id !== roundId) throw new DomainError('ROUND_CHANGED', 'Your answer belongs to another round.', 409);
  if (!data.session.deadlineAt || now >= Date.parse(data.session.deadlineAt)) throw new DomainError('ANSWER_LATE', 'Time is up. Your earlier acknowledged answer is preserved.', 409);
}
function changed<T>(data: SessionData, result: T, eventType: string): MutationResult<T> {
  data.session.stateVersion += 1;
  return { data, result, eventType };
}
function stateChanged(data: SessionData, eventType: string): MutationResult<StateReceipt> {
  data.session.stateVersion += 1;
  return { data, result: receipt(data), eventType };
}
function transition(data: SessionData, state: SessionState, deadlineAt: string | null = null): void {
  data.session.state = state;
  data.session.deadlineAt = deadlineAt;
}
function awardCurrent(data: SessionData, awards: Award[]): void {
  const round = currentRound(data);
  const revision = Math.max(0, ...data.awards.filter((award) => award.roundId === round.id).map((award) => award.scoringRevision)) + 1;
  data.awards = [...data.awards.filter((award) => award.roundId !== round.id), ...awards.map((award) => ({ ...award, scoringRevision: revision }))];
}
function visibleRoundIds(data: SessionData, currentAlreadyRevealed = false): Set<string> {
  return new Set(data.quiz.rounds.filter((_, index) => index < data.session.roundIndex || (index === data.session.roundIndex && (REVEALED.has(data.session.state === 'PAUSED' ? data.pausedPhase! : data.session.state) || currentAlreadyRevealed))).map((round) => round.id));
}
export function leaderboardProjection(data: SessionData, currentAlreadyRevealed = false): Leader[] {
  const visible = visibleRoundIds(data, currentAlreadyRevealed);
  const roundId = data.quiz.rounds[data.session.roundIndex]?.id;
  const rows = data.members.filter((member) => member.status === 'active').map((member) => {
    const awards = data.awards.filter((award) => award.participantId === member.id && visible.has(award.roundId));
    return { participantId: member.id, nickname: member.nickname, points: awards.reduce((sum, award) => sum + award.points, 0), rank: 0, roundPoints: awards.find((award) => award.roundId === roundId)?.points ?? 0 };
  }).sort((left, right) => right.points - left.points || data.members.findIndex((member) => member.id === left.participantId) - data.members.findIndex((member) => member.id === right.participantId) || left.participantId.localeCompare(right.participantId));
  rows.forEach((row, index) => { row.rank = index && row.points === rows[index - 1].points ? rows[index - 1].rank : index + 1; });
  return rows;
}

/** Durable domain logic. Each mutation is committed with its receipt and event
 * by Store.mutate; correctness does not depend on a socket process or timer. */
export class GameEngine {
  constructor(readonly store: Store, private readonly clock: Clock = () => Date.now(), private readonly options: EngineOptions = {}) {}

  async updateAppearance(principal:Principal,id:string,avatar:Avatar,key:string){
    return this.store.mutate(id,undefined,principal.id,key,data=>{
      assertPrincipal(data,principal);
      if(principal.role!=='player')throw new DomainError('FORBIDDEN','Only players can edit their own look.',403);
      if(data.session.state!=='LOBBY')throw new DomainError('GAME_STARTED','The game has started. Your saved look is ready.',409);
      return {data,result:{avatar},eventType:'member.look.'+principal.id,eventPayload:{avatar}};
    });
  }

  async createSession(hostId: string, versionId: string, key: string): Promise<{ sessionId: string; pin: string }> {
    if (!key || key.length > 128) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'A unique action key is required.', 400);
    const id = await idempotentId('session', hostId, key);
    try {
      const existing = await this.store.getSession(id);
      assertHost(existing, hostId);
      if (existing.session.versionId !== versionId) throw new DomainError('IDEMPOTENCY_CONFLICT', 'This action key was already used for another quiz.', 409);
      return { sessionId: id, pin: existing.session.pin };
    } catch (error) { if (!(error instanceof DomainError) || error.status !== 404) throw error; }
    const quiz = await this.store.getVersion(versionId, hostId);
    if (!quiz.rounds.length) throw new DomainError('INVALID_QUIZ', 'Publish at least one round before hosting.', 422);
    for (let attempt = 0; attempt < 8; attempt++) {
      const pin = newPin();
      const pinDigest = await digestPin(pin, this.options.pinSecret ?? '');
      if (await this.store.findSessionByPinDigest(pinDigest)) continue;
      const record: SessionRecord = { id, versionId, hostId, pin, pinDigest, state: 'LOBBY', stateVersion: 0, roundIndex: -1, deadlineAt: null, pausedRemainingMs: null, extensionCount: 0, joinLocked: false, createdAt: new Date(this.clock()).toISOString(), completedAt: null, lastMutationId: key, latestSeq: 0, maxPlayers: this.options.maxPlayers ?? 25 };
      try { await this.store.createSession(record); if(this.options.automatic)await this.store.mutate(id,undefined,hostId,'enable-autopilot-v1',data=>stateChanged(data,'session.autopilot')); const committed = await this.store.getSession(id); return { sessionId: id, pin: committed.session.pin }; }
      catch (error) {
        // The other identical request may have committed before this one.
        try {
          const existing = await this.store.getSession(id);
          assertHost(existing, hostId);
          if (existing.session.versionId !== versionId) throw new DomainError('IDEMPOTENCY_CONFLICT', 'This action key was used for another quiz.', 409);
          return { sessionId: id, pin: existing.session.pin };
        } catch (readError) { if (!(readError instanceof DomainError) || readError.status !== 404) throw readError; }
        if (attempt === 7) throw error;
      }
    }
    throw new DomainError('ROOM_UNAVAILABLE', 'Unable to reserve a room. Please try again.', 503);
  }

  async join(pinInput: string, nicknameInput: string, avatar?:Avatar): Promise<{ sessionId: string; participantId: string; token: string }> {
    const pin = pinInput.replace(/\s/g, '');
    if (!/^\d{6}$/.test(pin)) throw new DomainError('ROOM_UNAVAILABLE', 'Check the six-digit room PIN.', 404);
    const nickname = sanitizeNickname(nicknameInput);
    const data = await this.store.findSessionByPinDigest(await digestPin(pin, this.options.pinSecret ?? ''));
    if (!data || TERMINAL.has(data.session.state)) throw new DomainError('ROOM_UNAVAILABLE', 'This room is unavailable or has ended.', 404);
    if (data.session.joinLocked) throw new DomainError('JOIN_LOCKED', 'The host has closed joining for this room.', 409);
    const token = opaqueToken();
    const result = await this.store.addPlayer(data.session.id, nickname, await digestToken(token), data.session.maxPlayers, avatar);
    return { sessionId: data.session.id, participantId: result.participantId, token };
  }

  async snapshot(principal: Principal, id: string): Promise<Snapshot> {
    assertPrincipal(await this.store.getSession(id), principal);
    await this.reconcile(id);
    const data = await this.store.getSession(id);
    assertPrincipal(data, principal);
    const round = data.quiz.rounds[data.session.roundIndex];
    const ownSubmission = principal.role === 'player' ? data.submissions.find((submission) => submission.roundId === round?.id && submission.participantId === principal.id) : undefined;
    const ownAttempts = principal.role === 'player' ? data.attempts.filter((attempt) => attempt.roundId === round?.id && attempt.participantId === principal.id) : [];
    const activeIds = new Set(data.members.filter((member) => member.status === 'active').map((member) => member.id));
    const answered = new Set((round?.mode === 'word_puzzle' ? data.attempts : data.submissions).filter((item) => item.roundId === round?.id && activeIds.has(item.participantId)).map((item) => item.participantId));
    const solved = new Set(data.attempts.filter((item) => item.roundId === round?.id && item.solved && activeIds.has(item.participantId)).map((item) => item.participantId));
    let abortedAfterReveal = false;
    if (data.session.state === 'SESSION_ABORTED' && round) {
      const latestReveal = await this.store.db.query<{ payload: string }>("SELECT payload FROM session_events WHERE session_id = ? AND type = 'round.revealed' ORDER BY seq DESC LIMIT 1", [id]);
      if (latestReveal.rows[0]) abortedAfterReveal = JSON.parse(latestReveal.rows[0].payload).roundIndex === data.session.roundIndex;
    }
    const leaderboard = leaderboardProjection(data, abortedAfterReveal).map(p=>({...p,avatar:data.members.find(m=>m.id===p.participantId)?.avatar??avatarFor(p.participantId)}));
    const effective=data.session.state==='PAUSED'?data.pausedPhase??'ROUND_ACTIVE':data.session.state;
    const phase=effective==='ROUND_PREPARE'&&data.automatic?'reading':effective==='ROUND_REVEAL'?'reveal':effective==='INTERMISSION'?'placements':'play';
    const result: Snapshot = { automatic:data.automatic,completedAt:data.session.completedAt??undefined,phase,phaseId:round?.id+':'+phase,finishedCount:round ? finishedPlayers(data).size : 0,id, title: data.quiz.title, theme: data.quiz.theme, role: principal.role, state: data.session.state, stateVersion: data.session.stateVersion, serverTime: new Date(this.clock()).toISOString(), latestSeq: data.session.latestSeq, deadlineAt: data.session.deadlineAt, pausedRemainingMs: data.session.pausedRemainingMs, roundIndex: data.session.roundIndex, roundCount: data.quiz.rounds.length, round: round ? publicQuestionProjection(round) : null, joinLocked: data.session.joinLocked, members: principal.role === 'host' ? data.members : data.members.filter((member) => member.status === 'active'), ownAttempts, answerCount: answered.size, solvedCount: solved.size, leaderboard, maxPlayers: data.session.maxPlayers };
    if (principal.role === 'host') result.pin = data.session.pin;
    if (principal.role === 'player') {
      result.participantId = principal.id;
      result.ownSubmission = ownSubmission;
      result.ownPoints = leaderboard.find((row) => row.participantId === principal.id)?.points ?? 0;
    }
    if (round && (REVEALED.has(effective) || abortedAfterReveal)) {
      const prior={...data,session:{...data.session,roundIndex:data.session.roundIndex-1,state:'INTERMISSION' as const}};
      result.previousLeaderboard=leaderboardProjection(prior,true).map(p=>({...p,avatar:data.members.find(m=>m.id===p.participantId)?.avatar}));
      // Membership may change after scoring. Reconstruct the frozen scoring
      // cohort from the immutable ledger so a later kick cannot rewrite rarity.
      const scored = new Map(data.awards.filter(award => award.roundId === round.id).map(award => [award.participantId, award]));
      const frozen: SessionData = { ...data, members: data.members.filter(member => scored.has(member.id)).map(member => ({ ...member, status: scored.get(member.id)?.reason === 'participant_removed' ? 'kicked' as const : 'active' as const })) };
      result.reveal = scoreRound(frozen, round).reveal;
      result.roundAwards = [...scored.values()].map(award=>{
        // Players render their own drawing; host/display present the room gallery.
        // Avoid broadcasting every stroke to every player on each snapshot.
        if(principal.role!=='player'||award.participantId===principal.id||!award.detail.ink)return award;
        const {ink,...detail}=award.detail;return {...award,detail};
      });
      const revealEvent = await this.store.db.query<{occurred_at:string}>("SELECT occurred_at FROM session_events WHERE session_id = ? AND type = 'round.revealed' ORDER BY seq DESC LIMIT 1", [id]);
      result.revealStartedAt = revealEvent.rows[0]?.occurred_at;
      const stageEvent = await this.store.db.query<{type:string;payload:string;occurred_at:string}>("SELECT type,payload,occurred_at FROM session_events WHERE session_id = ? AND type IN ('results.reveal','results.podium','results.standings','results.auto') ORDER BY seq DESC LIMIT 1", [id]);
      const stage = stageEvent.rows[0];
      if (stage && JSON.parse(stage.payload).roundIndex === data.session.roundIndex) {
        if (stage.type === 'results.auto') result.revealStartedAt = stage.occurred_at;
        else result.resultStage = stage.type.slice(8) as Snapshot['resultStage'];
      }
    }
    if (round && principal.role === 'host' && data.session.state === 'REVIEW_REQUIRED') result.review = scoreRound(data, round).review;
    return result;
  }

  async hostAction(hostId: string, id: string, input: HostAction, key: string): Promise<StateReceipt> {
    const action = HostActionSchema.parse(input);
    assertHost(await this.store.getSession(id), hostId);
    await this.reconcile(id);
    return this.store.mutate(id, action.expectedStateVersion, hostId, key, (data) => {
      assertHost(data, hostId);
      const session = data.session;
      const now = this.clock();
      const beforeState = session.state;
      const finish = (eventType: string): MutationResult<StateReceipt> => ({ ...stateChanged(data, eventType), audit: { action: `host.${action.action.toLowerCase()}`, targetId: action.args?.participantId ?? data.quiz.rounds[session.roundIndex]?.id, detail: { beforeState, reason: action.args?.reason ?? null, seconds: action.action === 'EXTEND' ? action.args?.seconds ?? 15 : null } } });
      if (TERMINAL.has(session.state)) throw new DomainError('SESSION_ENDED', 'This room has ended and is read-only.', 409);
      if (action.action === 'END') {
        transition(data, 'SESSION_ABORTED'); session.completedAt = new Date(now).toISOString(); session.joinLocked = true;
        return finish('session.aborted');
      }
      if (action.action === 'LOCK_JOIN' || action.action === 'UNLOCK_JOIN') {
        session.joinLocked = action.action === 'LOCK_JOIN'; return finish('lobby.updated');
      }
      if (action.action === 'KICK') {
        const member = data.members.find((item) => item.id === action.args?.participantId && item.status === 'active');
        if (!member) throw new DomainError('MEMBER_UNAVAILABLE', 'That participant is no longer in this room.', 404);
        member.status = 'kicked';
        if (session.state === 'REVIEW_REQUIRED') {
          const score = scoreRound(data, currentRound(data));
          if (!score.review.length) { awardCurrent(data, score.awards); transition(data, 'ROUND_SCORED'); return finish('round.scored'); }
        }
        return finish('member.left');
      }
      if (action.action === 'START') {
        if (session.state !== 'LOBBY') throw new DomainError('INVALID_TRANSITION', 'This room has already started.', 409);
        if (!data.members.some((member) => member.status === 'active')) throw new DomainError('NO_PLAYERS', 'Wait for at least one player before starting.', 409);
        session.roundIndex = 0; session.extensionCount = 0;
        transition(data, 'ROUND_PREPARE', new Date(now + (data.automatic ? (action.args?.seconds??5)*1000 : PREPARATION_MS)).toISOString());
        return {...finish('round.preparing'),eventPayload:{readingSeconds:action.args?.seconds??5}};
      }
      if (action.action === 'PAUSE') {
        if (!['ROUND_ACTIVE',...(data.automatic?['ROUND_PREPARE','ROUND_REVEAL','INTERMISSION']:[])].includes(session.state) || !session.deadlineAt || Date.parse(session.deadlineAt) <= now) throw new DomainError('INVALID_TRANSITION', 'Only an active round can be paused.', 409);
        session.pausedRemainingMs = Math.max(0, Date.parse(session.deadlineAt) - now);
        data.pausedPhase=session.state;transition(data, 'PAUSED'); return finish(data.automatic?'phase.paused.'+beforeState:'round.paused');
      }
      if (action.action === 'RESUME') {
        if (session.state !== 'PAUSED') throw new DomainError('INVALID_TRANSITION', 'This round is not paused.', 409);
        transition(data, data.automatic ? data.pausedPhase??'ROUND_ACTIVE' : 'ROUND_ACTIVE', new Date(now + (session.pausedRemainingMs ?? 0)).toISOString());
        session.pausedRemainingMs = null; return finish('round.resumed');
      }
      if (action.action === 'EXTEND') {
        if (!['ROUND_ACTIVE', 'PAUSED'].includes(session.state)) throw new DomainError('INVALID_TRANSITION', 'This round cannot be extended.', 409);
        if (session.extensionCount >= 3) throw new DomainError('EXTENSION_LIMIT', 'Each round can be extended at most three times.', 409);
        const duration = (action.args?.seconds ?? 15) * 1000;
        if (session.state === 'PAUSED') session.pausedRemainingMs = (session.pausedRemainingMs ?? 0) + duration;
        else {
          if (!session.deadlineAt || Date.parse(session.deadlineAt) <= now) throw new DomainError('ANSWER_LATE', 'The round has already ended.', 409);
          session.deadlineAt = new Date(Date.parse(session.deadlineAt) + duration).toISOString();
        }
        session.extensionCount += 1; return finish('round.deadline_changed');
      }
      if(action.action==='ADVANCE' && data.automatic){
        const phase=session.state==='PAUSED'?data.pausedPhase:session.state;session.pausedRemainingMs=null;
        if(phase==='REVIEW_REQUIRED'){session.deadlineAt=new Date(now).toISOString();return finish('review.finishing');}
        if(phase==='ROUND_PREPARE'){transition(data,'ROUND_ACTIVE',new Date(now+currentRound(data).timerSeconds*1000).toISOString());return finish('round.started');}
        if(phase==='ROUND_ACTIVE'){transition(data,'ROUND_LOCKED',new Date(now).toISOString());return finish('round.locked');}
        if(phase==='ROUND_REVEAL'){if(session.roundIndex===data.quiz.rounds.length-1){completeSession(data,now);return finish('session.completed');}transition(data,'INTERMISSION',new Date(now+10000).toISOString());return finish('placements.started');}
        if(phase==='INTERMISSION'){startFollowingRound(data,now);return finish('round.started');}
        throw new DomainError('INVALID_TRANSITION','Wait for the current phase.',409);
      }
      if (action.action === 'LOCK') {
        if (!['ROUND_ACTIVE', 'PAUSED'].includes(session.state)) throw new DomainError('INVALID_TRANSITION', 'Only an active or paused round can be locked.', 409);
        transition(data, 'ROUND_LOCKED', new Date(now).toISOString()); session.pausedRemainingMs = null;
        return finish('round.locked');
      }
      if (action.action === 'SKIP') {
        if (['LOBBY', 'ROUND_REVEAL', 'INTERMISSION'].includes(session.state==='PAUSED'?data.pausedPhase??session.state:session.state)) throw new DomainError('INVALID_TRANSITION', 'This round cannot be skipped now.', 409);
        const round = currentRound(data);
        if (!data.voidRoundIds.includes(round.id)) data.voidRoundIds.push(round.id);
        awardCurrent(data, data.members.map((member) => ({ roundId: round.id, participantId: member.id, points: 0, reason: 'round_skipped', scoringRevision: 1, detail: { skipped: true } })));
        transition(data, 'ROUND_REVEAL',data.automatic?new Date(now+REVEAL_MS).toISOString():null); session.pausedRemainingMs = null;
        return finish('round.revealed');
      }
      if (action.action === 'REVEAL') {
        if (session.state !== 'ROUND_SCORED') throw new DomainError('INVALID_TRANSITION', 'Resolve every answer before revealing this round.', 409);
        transition(data, 'ROUND_REVEAL'); return finish('round.revealed');
      }
      if (action.action === 'RESULT_STAGE') {
        if (session.state !== 'ROUND_REVEAL' || !action.args?.stage) throw new DomainError('INVALID_TRANSITION', 'Show the round results first.', 409);
        return finish('results.' + action.args.stage);
      }
      if (action.action === 'NEXT') {
        if (session.state !== 'ROUND_REVEAL') throw new DomainError('INVALID_TRANSITION', 'Reveal this round before advancing.', 409);
        transition(data, 'INTERMISSION', new Date(now + INTERMISSION_MS).toISOString()); return finish('leaderboard.updated');
      }
      throw new DomainError('INVALID_ACTION', 'Unknown host action.', 422);
    });
  }

  private async playerMutation<T>(id: string, playerId: string, mutationId: string, fn: (data: SessionData) => MutationResult<T>): Promise<T> {
    for (let attempt = 0; attempt < 128; attempt++) {
      try { return await this.store.mutate(id, undefined, playerId, mutationId, fn); }
      catch (error) {
        if (!(error instanceof DomainError) || error.code !== 'VERSION_CONFLICT' || attempt === 127) throw error;
        // Desynchronize concurrent phones so optimistic retries do not march
        // in lockstep and exhaust their budgets during a full-room burst.
        await new Promise(resolve => setTimeout(resolve, 1 + crypto.getRandomValues(new Uint8Array(1))[0] % 12));
      }
    }
    throw new DomainError('VERSION_CONFLICT', 'The room is busy. Retry your answer with the same action ID.', 409);
  }

  async submit(player: Principal, id: string, raw: unknown): Promise<Ack> {
    const input = SubmitSchema.parse(raw);
    return this.playerMutation(id, player.id, input.clientMutationId, (data) => {
      const now = this.clock();
      assertPlayer(data, player, input.roundId, now);
      const round = currentRound(data);
      if (round.mode === 'word_puzzle') throw new DomainError('INVALID_MODE', 'Submit a word attempt for this round.', 422);
      const previous = data.submissions.find((item) => item.roundId === input.roundId && item.participantId === player.id);
      if (previous && input.revision <= previous.revision) throw new DomainError('STALE_SUBMISSION', 'Your newer acknowledged answer is already saved.', 409, { serverRevision: previous.revision });
      const fishing=round.mode==='fish'&&round.publicConfig.fishScoring==='catch-v1';
      const deduction=round.mode==='crack'&&round.publicConfig.crackScoring==='deduction-v1';
      if (previous && ((!fishing && !deduction && round.mode !== 'amountle' && !round.allowRevision) || previous.payload.locked)) throw new DomainError('ANSWER_LOCKED', 'Your answer is already locked.', 409);
      const payload = sanitizeAndValidateSubmission(round, input.payload);
      if (round.mode === 'amountle' && previous && (payload.count ?? 0) < (previous.payload.count ?? 0)) throw new DomainError('REMOVAL_DISABLED', 'This round only permits adding to your count.', 422);
      let crackAck:Partial<Ack>={};
      if(fishing){const result=fishCast(round,payload.choiceId!,previous,now,Date.parse(data.session.deadlineAt!));Object.assign(payload,result.payload);crackAck=result.ack;}
      if(deduction){
        const result=crackGuess(round,payload.value!,previous,now,Date.parse(data.session.deadlineAt!));
        Object.assign(payload,result.payload);crackAck=result.ack;
      }
      const acceptedAt = new Date(now).toISOString();
      const submission = { id: crypto.randomUUID(), roundId: input.roundId, participantId: player.id, clientMutationId: input.clientMutationId, revision: input.revision, payload, acceptedAt };
      data.submissions = [...data.submissions.filter((item) => item.roundId !== input.roundId || item.participantId !== player.id), submission];
      shortenFinishedRound(data,now);
      return changed(data, { clientMutationId: input.clientMutationId, accepted: true as const, serverRevision: input.revision, acceptedAt, ...crackAck, ...(round.mode === 'amountle' ? {acceptedCount: payload.count} : {}) }, 'answer.received');
    });
  }

  async wordGuess(player: Principal, id: string, raw: unknown): Promise<Ack> {
    const input = WordGuessSchema.parse(raw);
    return this.playerMutation(id, player.id, input.clientMutationId, (data) => {
      const now = this.clock();
      assertPlayer(data, player, input.roundId, now);
      const round = currentRound(data);
      if (round.mode !== 'word_puzzle') throw new DomainError('INVALID_MODE', 'This round does not accept word attempts.', 422);
      const previous = data.attempts.filter((item) => item.roundId === round.id && item.participantId === player.id);
      if (previous.some((item) => item.solved)) throw new DomainError('WORD_SOLVED', 'You have already solved this word.', 409);
      if (previous.length >= round.publicConfig.maxAttempts) throw new DomainError('ATTEMPTS_EXHAUSTED', 'You have used every attempt for this word.', 409);
      const guess = validateWordGuess(round, input.guess);
      if (previous.some((item) => item.guess === guess)) throw new DomainError('DUPLICATE_GUESS', 'You have already tried that word.', 409);
      const feedback = wordFeedback(round.secretConfig.answer, guess, round.publicConfig.locale);
      const solved = feedback.every((letter) => letter === 'exact');
      const attempt = previous.length + 1;
      const acceptedAt = new Date(now).toISOString();
      data.attempts.push({ id: crypto.randomUUID(), roundId: round.id, participantId: player.id, clientMutationId: input.clientMutationId, attempt, guess, feedback, solved, acceptedAt });
      shortenFinishedRound(data,now);
      return changed(data, { clientMutationId: input.clientMutationId, accepted: true as const, serverRevision: attempt, acceptedAt, feedback, solved, attempt }, 'word.attempt_received');
    });
  }

  async review(hostId: string, id: string, input: ReviewDecision, key: string): Promise<StateReceipt> {
    const answerDigest = await digestToken(normalizeAnswer(input.answerKey));
    return this.store.mutate(id, input.expectedStateVersion, hostId, key, (data) => {
      assertHost(data, hostId);
      const round = currentRound(data);
      const finish = (eventType: string): MutationResult<StateReceipt> => ({ ...stateChanged(data, eventType), audit: { action: 'host.rare_review', targetId: round.id, detail: { decision: input.decision, answerDigest } } });
      if (data.session.state !== 'REVIEW_REQUIRED' || round.mode !== 'rare_answers' || round.id !== input.roundId) throw new DomainError('REVIEW_CLOSED', 'This round is not awaiting review.', 409);
      if(data.automatic&&data.session.deadlineAt&&Date.parse(data.session.deadlineAt)<=this.clock())throw new DomainError('REVIEW_CLOSED','Review time is over.',409);
      const answerKey = normalizeAnswer(input.answerKey);
      const candidates = scoreRound(data, round).review;
      if (!candidates.some((candidate) => candidate.answerKey === answerKey) && !data.adjudications.some((item) => item.roundId === round.id && item.answerKey === answerKey)) throw new DomainError('ANSWER_UNAVAILABLE', 'That answer is not in this review queue.', 404);
      if (!['accept', 'reject'].includes(input.decision)) throw new DomainError('INVALID_DECISION', 'Accept or reject this answer.', 422);
      const canonical = normalizeAnswer(input.canonical ?? answerKey);
      if (!canonical || canonical.length > 100 || /[<>\p{Cc}\p{Cf}]/u.test(canonical)) throw new DomainError('INVALID_CANONICAL', 'Provide a plain-text canonical answer of at most 100 characters.', 422);
      const adjudication: Adjudication = { id: crypto.randomUUID(), roundId: round.id, answerKey, decision: input.decision, canonical, actorId: hostId, createdAt: new Date(this.clock()).toISOString() };
      data.adjudications = [...data.adjudications.filter((item) => item.roundId !== round.id || item.answerKey !== answerKey), adjudication];
      const score = scoreRound(data, round);
      if (!score.review.length) { awardCurrent(data, score.awards); transition(data, 'ROUND_SCORED'); return finish('round.scored'); }
      return finish('round.review_updated');
    });
  }

  async pairDisplay(hostId: string, id: string): Promise<{ token: string; expiresAt: string }> {
    const data = await this.store.getSession(id); assertHost(data, hostId);
    if (TERMINAL.has(data.session.state)) throw new DomainError('SESSION_ENDED', 'This room has ended.', 409);
    const token = opaqueToken(); const expiresAt = new Date(this.clock() + 8 * 60 * 60 * 1000).toISOString();
    await this.store.createDisplay(id, await digestToken(token), expiresAt);
    return { token, expiresAt };
  }
  async revokeDisplays(hostId: string, id: string): Promise<void> {
    assertHost(await this.store.getSession(id), hostId); await this.store.revokeDisplays(id);
  }

  async reconcile(id?: string): Promise<{ reconciled: number }> {
    const ids = id ? [id] : await this.store.overdueSessions(new Date(this.clock()).toISOString());
    let reconciled = 0;
    for (const sessionId of ids) {
      for (let pass = 0; pass < 12; pass++) {
        const data = await this.store.getSession(sessionId);
        const state = data.session.state;
        const now = this.clock();
        const immediate = state === 'ROUND_LOCKED' || state === 'ROUND_EVALUATING' || (data.automatic && state === 'ROUND_SCORED');
        if (!immediate && (!data.session.deadlineAt || Date.parse(data.session.deadlineAt) > now || !['ROUND_PREPARE', 'ROUND_COUNTDOWN', 'ROUND_ACTIVE', 'REVIEW_REQUIRED', 'ROUND_REVEAL', 'INTERMISSION'].includes(state))) break;
        try {
          await this.store.mutate(sessionId, data.session.stateVersion, `worker:${sessionId}`, `reconcile:${data.session.stateVersion}:${state}`, (current) => {
            const session = current.session;
            const scheduled = Date.parse(session.deadlineAt ?? new Date(this.clock()).toISOString());
            if(current.automatic && session.state==='REVIEW_REQUIRED'){current.reviewTimeoutRoundId=currentRound(current).id;const scored=scoreRound(current,currentRound(current));awardCurrent(current,scored.awards);transition(current,'ROUND_SCORED');return stateChanged(current,'review.timed_out');}
            if(current.automatic && session.state==='ROUND_SCORED'){transition(current,'ROUND_REVEAL',new Date(this.clock()+REVEAL_MS).toISOString());return stateChanged(current,'round.revealed');}
            if(current.automatic && session.state==='ROUND_REVEAL'){if(session.roundIndex===current.quiz.rounds.length-1){completeSession(current,scheduled);return stateChanged(current,'session.completed');}transition(current,'INTERMISSION',new Date(scheduled+10000).toISOString());return stateChanged(current,'placements.started');}
            if (session.state === 'ROUND_PREPARE') {
              transition(current, current.automatic?'ROUND_ACTIVE':'ROUND_COUNTDOWN', new Date(scheduled + (current.automatic?currentRound(current).timerSeconds*1000:COUNTDOWN_MS)).toISOString()); return stateChanged(current, 'round.countdown');
            }
            if (session.state === 'ROUND_COUNTDOWN') {
              transition(current, 'ROUND_ACTIVE', new Date(scheduled + currentRound(current).timerSeconds * 1000).toISOString()); return stateChanged(current, 'round.started');
            }
            if (session.state === 'ROUND_ACTIVE') {
              transition(current, 'ROUND_LOCKED', session.deadlineAt); return stateChanged(current, 'round.locked');
            }
            if (session.state === 'ROUND_LOCKED') {
              transition(current, 'ROUND_EVALUATING', session.deadlineAt); return stateChanged(current, 'round.evaluating');
            }
            if (session.state === 'ROUND_EVALUATING') {
              const result = scoreRound(current, currentRound(current));
              if (result.review.length) { transition(current, 'REVIEW_REQUIRED',current.automatic?new Date(this.clock()+30000).toISOString():null); return stateChanged(current, 'round.review_required'); }
              awardCurrent(current, result.awards); transition(current, 'ROUND_SCORED'); return stateChanged(current, 'round.scored');
            }
            if(current.automatic && session.state==='INTERMISSION'){startFollowingRound(current,scheduled);return stateChanged(current,'round.started');}
            if (session.state === 'INTERMISSION') {
              if (session.roundIndex + 1 >= current.quiz.rounds.length) {
                transition(current, 'SESSION_COMPLETED'); session.completedAt = new Date(this.clock()).toISOString(); session.joinLocked = true;
                return stateChanged(current, 'session.completed');
              }
              session.roundIndex += 1; session.extensionCount = 0; session.pausedRemainingMs = null;
              transition(current, 'ROUND_PREPARE', new Date(scheduled + PREPARATION_MS).toISOString()); return stateChanged(current, 'round.preparing');
            }
            throw new DomainError('STATE_CONFLICT', 'The room changed during recovery.', 409);
          });
          reconciled++;
        } catch (error) { if (!(error instanceof DomainError) || error.status !== 409) throw error; }
      }
    }
    return { reconciled };
  }
}

function finishedPlayers(data:SessionData):Set<string>{
 const round=currentRound(data);
 return new Set(data.members.filter(m=>m.status==='active').filter(m=>{
  if(round.mode==='word_puzzle'){const a=data.attempts.filter(a=>a.roundId===round.id&&a.participantId===m.id);return a.some(a=>a.solved)||a.length>=round.publicConfig.maxAttempts;}
  const sub=data.submissions.find(s=>s.roundId===round.id&&s.participantId===m.id);
  if(round.mode==='fish'&&round.publicConfig.fishScoring==='catch-v1')return false;
  if(round.mode==='crack'&&round.publicConfig.crackScoring==='deduction-v1')return sub?.payload.locked===true;
  return !!sub&&(sub.payload.locked===true||(round.mode!=='amountle'&&!round.allowRevision));
 }).map(m=>m.id));
}
function shortenFinishedRound(data:SessionData,now:number){
 const eligible=data.members.filter(m=>m.status==='active');
 if(data.automatic&&eligible.length&&finishedPlayers(data).size===eligible.length&&data.session.deadlineAt)
  data.session.deadlineAt=new Date(Math.min(Date.parse(data.session.deadlineAt),now+900)).toISOString();
}
function completeSession(data:SessionData,now:number){transition(data,'SESSION_COMPLETED');data.session.completedAt=new Date(now).toISOString();data.session.joinLocked=true;}
function startFollowingRound(data:SessionData,now:number){
 if(data.session.roundIndex+1>=data.quiz.rounds.length){completeSession(data,now);return;}
 data.session.roundIndex++;data.session.extensionCount=0;data.session.pausedRemainingMs=null;
 transition(data,'ROUND_PREPARE',new Date(now+(data.readingSeconds??READING_MS/1000)*1000).toISOString());
}
