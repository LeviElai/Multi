'use client';
import { newId } from '../../../packages/contracts/src/id';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, Monitor, Play, RotateCcw, Smartphone, Trophy, X } from 'lucide-react';
import { MODE_META, type Award, type QuizInput, type Reveal, type Round, type SessionData, type Submission, type WordAttempt } from '../../../packages/contracts/src/index';
import { normalizeAnswer, publicQuestionProjection, sanitizeAndValidateSubmission, scoreRound, segmentGraphemes, validateAuthorConfig, validateWordGuess, wordFeedback } from '../../../packages/game-modes/src/index';
import { Shape } from './ModeArt';
import ModePlayer from './ModePlayer';
import { RoundClock } from './RoundClock';
import { practiceLeaderboard } from '../lib/competition';
import { RoundResults, Standings } from './game/Competition';
import { Podium } from './Reveal';
import type { Snapshot, Ack, Leader } from '../../../packages/contracts/src/index';
import { RareAnswerControl, RareDepthReveal } from './world/RareExperience';
import { WorldScene } from './world/WorldScene';
import { GameIntro } from './world/GameWorld';
import { Atmosphere } from './world/Atmosphere';
type Props = {
    quiz: QuizInput;
    initialRound?: number;
    compact?: boolean;
    solo?: boolean;
    onClose?: () => void;
};
type Result = {
    awards: Award[];
    reveal: Reveal;
    review: {
        answerKey: string;
        text: string;
        count: number;
    }[];
};
const previewPeople = [{ id: 'preview-you', nickname: 'You' }, { id: 'preview-rio', nickname: 'Rio · simulated' }, { id: 'preview-sam', nickname: 'Sam · simulated' }];
function previewData(quiz: QuizInput, round: Round, payload: Submission['payload'], attempts: WordAttempt[], people = previewPeople): SessionData {
    const now = new Date().toISOString();
    const otherPayload = (index: number): Submission['payload'] => {
        switch (round.mode) {
            case 'fermi': return { value: Math.max(round.publicConfig.min, Math.min(round.publicConfig.max, round.publicConfig.min + Math.round((round.secretConfig.answer * (index ? 1.3 : 0.8) - round.publicConfig.min) / round.publicConfig.step) * round.publicConfig.step)) };
            case 'rare_answers': return { text: round.secretConfig.answers[Math.min(index, round.secretConfig.answers.length - 1)]?.canonical ?? 'sample answer' };
            case 'word_puzzle': return {};
            case 'size_it_up': return { ratio: Math.max(round.publicConfig.minRatio, Math.min(round.publicConfig.maxRatio, round.secretConfig.targetSize / round.publicConfig.referenceSize * (index ? 1.3 : 0.8))) };
            case 'amountle': return { count: Math.min(round.publicConfig.maxCount, Math.max(0, Math.round(round.secretConfig.answer * (index ? 1.3 : 0.8)))) };
        }
    };
    const submissions: Submission[] = people.map((person, index) => ({ id: `preview-submission-${index}`, roundId: round.id, participantId: person.id, clientMutationId: `preview-mutation-${index}`, revision: 1, payload: index === 0 ? payload : otherPayload(index - 1), acceptedAt: now }));
    const simulatedAttempts: WordAttempt[] = round.mode === 'word_puzzle' ? people.slice(1).map((person, index) => ({ id: `preview-attempt-${index}`, roundId: round.id, participantId: person.id, clientMutationId: `preview-word-${index}`, attempt: index + 2, guess: round.secretConfig.answer, feedback: wordFeedback(round.secretConfig.answer, round.secretConfig.answer), solved: true, acceptedAt: now })) : [];
    return {
        session: { id: 'simulation', versionId: 'simulation-version', hostId: 'simulation-host', pinDigest: '', pin: '', state: 'ROUND_EVALUATING', stateVersion: 1, roundIndex: quiz.rounds.findIndex(r => r.id === round.id), deadlineAt: null, pausedRemainingMs: null, extensionCount: 0, joinLocked: false, createdAt: now, completedAt: null, lastMutationId: '', latestSeq: 0, maxPlayers: people.length },
        quiz: { id: 'simulation-version', quizId: 'simulation', version: 1, title: quiz.title, theme: quiz.theme, rounds: quiz.rounds, createdAt: now },
        members: people.map(person => ({ ...person, joinedAt: now, status: 'active' as const })), submissions,
        attempts: [...attempts, ...simulatedAttempts], adjudications: [], awards: [], voidRoundIds: [],
    };
}
export function SizeSilhouette({ asset, color = 'currentColor', className, style }: {
    asset: Extract<Round, {
        mode: 'size_it_up';
    }>['publicConfig']['asset'];
    color?: string;
    className?: string;
    style?: CSSProperties;
}) {
    return <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className={className} style={style}><Shape asset={asset} fill={color}/></svg>;
}
export function Preview({ quiz, initialRound = 0, compact = false, solo = false, onClose }: Props) {
    const [index, setIndex] = useState(initialRound), [epoch, setEpoch] = useState(0), [scores, setScores] = useState<Record<string, Award[]>>({}), [finished, setFinished] = useState(false);
    const people=solo?previewPeople.slice(0,1):previewPeople;
    const round = quiz.rounds[index];
    const leaders = practiceLeaderboard(people, quiz.rounds.map(r => r.id), scores, round?.id ?? '');
    if (!round)
        return <p>Add a round to preview it.</p>;
    try {
        publicQuestionProjection(round);
    }
    catch {
        return <div className="practice-incomplete"><h3>Complete the question</h3><p>Check the required fields to preview this round.</p></div>;
    }
    const base: Snapshot = { id: 'practice', title: quiz.title, theme: quiz.theme, role: 'player', state: 'ROUND_PREPARE', stateVersion: 1, serverTime: new Date().toISOString(), latestSeq: 0, deadlineAt: null, pausedRemainingMs: null, roundIndex: index, roundCount: quiz.rounds.length, round: publicQuestionProjection(round), joinLocked: true, members: people.map(p => ({ ...p, joinedAt: '', status: 'active' })), participantId: people[0].id, ownAttempts: [], answerCount: 0, solvedCount: 0, leaderboard: leaders, maxPlayers: people.length };
    return <section className={'game-preview unified-preview ' + (compact ? 'is-compact' : '') + (solo ? ' solo-game' : '')} aria-label="Quiz practice"><header className="preview-toolbar"><span>{solo ? "Solo game" : "Practice · two simulated opponents"}</span>{onClose && <button className="icon-btn" aria-label="Close preview" onClick={onClose}><X size={18}/></button>}</header>{finished ? <Podium snapshot={{ ...base, state: 'SESSION_COMPLETED' }}/> : <PracticeRound key={round.id + ':' + epoch + ':' + JSON.stringify(round)} quiz={quiz} round={round} base={base} onScore={awards => setScores(current => ({ ...current, [round.id]: awards }))} onNext={() => { if (index < quiz.rounds.length - 1)
        setIndex(i => i + 1);
    else
        setFinished(true); }}/>}<footer className="preview-bottom"><button className="text-link" aria-label="Reset practice round" onClick={() => { setFinished(false); setEpoch(e => e + 1); setScores(current => { const next = { ...current }; delete next[round.id]; return next; }); }}>{solo ? "Restart round" : "↺ Reset"}</button><span>Round {index + 1} / {quiz.rounds.length}</span><div><button className="icon-btn" aria-label="Previous round" disabled={index === 0} onClick={() => { setFinished(false); setIndex(i => i - 1); }}>←</button><button className="icon-btn" aria-label="Next practice round" disabled={index === quiz.rounds.length - 1} onClick={() => { setFinished(false); setIndex(i => i + 1); }}>→</button></div></footer></section>;
}
function PracticeRound({ quiz, round, base, onScore, onNext }: {
    quiz: QuizInput;
    round: Round;
    base: Snapshot;
    onScore: (a: Award[]) => void;
    onNext: () => void;
}) {
    const [state, setState] = useState<'intro' | 'play' | 'locked' | 'reveal'>('intro'), [deadline, setDeadline] = useState<string | null>(null), [submission, setSubmission] = useState<Submission | undefined>(), [attempts, setAttempts] = useState<WordAttempt[]>([]), [result, setResult] = useState<Result | null>(null), [revealedAt, setRevealedAt] = useState<string>(), [perspective, setPerspective] = useState<'player' | 'host' | 'display'>('player');
    const people = base.members;
    const payload = useRef<Submission['payload']>({}), attemptRef = useRef<WordAttempt[]>([]), completed = useRef(false);
    const errors = validateAuthorConfig(round).filter(x => x.severity === 'error' && !['provenance', 'sourceUrl'].includes(x.field));
    const finishRef = useRef<() => void>(() => { });
    function finish(decision?: 'accept' | 'reject') {
        const data = previewData(quiz, round, payload.current, attemptRef.current, base.members);
        if (decision && round.mode === 'rare_answers') {
            const text = payload.current.text ?? '';
            data.adjudications = [{ id: 'review', roundId: round.id, answerKey: normalizeAnswer(text), decision, canonical: text, actorId: 'practice-host', createdAt: new Date().toISOString() }];
        }
        const next = scoreRound(data, round);
        setResult(next);
        setState('locked');
        completed.current = true;
        if (!next.review.length)
            onScore(next.awards);
    }
    finishRef.current = () => finish();
    useEffect(() => { if (state !== 'play' || !deadline)
        return; const id = setTimeout(() => { if (!completed.current)
        finishRef.current(); }, Math.max(0, Date.parse(deadline) - Date.now())); return () => clearTimeout(id); }, [deadline, state]);
    async function submit(input: Submission['payload'] | {
        guess: string;
    }): Promise<Ack> {
        if (completed.current || state !== 'play' || (deadline && Date.now() >= Date.parse(deadline)))
            throw new Error('Time is up.');
        const now = new Date().toISOString();
        let extra: Partial<Ack> = {};
        if ('guess' in input && round.mode === 'word_puzzle') {
            const guess = validateWordGuess(round, input.guess);
            const feedback = wordFeedback(round.secretConfig.answer, guess);
            const attempt = attemptRef.current.length + 1;
            const solved = feedback.every(f => f === 'exact');
            const next = { id: newId(), roundId: round.id, participantId: people[0].id, clientMutationId: newId(), attempt, guess, feedback, solved, acceptedAt: now };
            attemptRef.current = [...attemptRef.current, next];
            setAttempts(attemptRef.current);
            extra = { feedback, solved, attempt };
            if (solved || attempt >= round.publicConfig.maxAttempts)
                finish();
        }
        else {
            const clean = sanitizeAndValidateSubmission(round, input);
            if (round.mode === 'amountle' && (clean.count ?? 0) < (payload.current.count ?? 0))
                throw new Error('Removal is disabled.');
            payload.current = clean;
            setSubmission({ id: newId(), roundId: round.id, participantId: people[0].id, clientMutationId: newId(), revision: 1, payload: clean, acceptedAt: now });
            if (clean.locked)
                finish();
        }
        return { clientMutationId: newId(), accepted: true, serverRevision: 1, acceptedAt: now, ...(round.mode === 'amountle' ? { acceptedCount: payload.current.count } : {}), ...extra };
    }
    const snap: Snapshot = { ...base, role: perspective, state: state === 'play' ? 'ROUND_ACTIVE' : state === 'reveal' ? 'ROUND_REVEAL' : state === 'locked' ? 'ROUND_SCORED' : 'ROUND_PREPARE', serverTime: new Date().toISOString(), deadlineAt: deadline, ownSubmission: submission, ownAttempts: attempts, reveal: state === 'reveal' ? result?.reveal : undefined, roundAwards: state === 'reveal' ? result?.awards : undefined, revealStartedAt: revealedAt, answerCount: submission ? base.members.length : Math.max(0,base.members.length-1), solvedCount: attempts.some(a => a.solved) ? base.members.length : Math.max(0,base.members.length-1) };
    if (errors.length)
        return <div className="practice-incomplete"><h3>Complete the question</h3><p>{errors[0].message}</p></div>;
    const show = () => { setRevealedAt(new Date().toISOString()); setState('reveal'); };
    return <div className={'practice-stage state-' + state + ' mode-' + round.mode + ' world-' + round.mode}><div className="game-world-art" aria-hidden="true"/><Atmosphere/><nav className="perspective-switch" aria-label="Preview perspective">{(['player', 'host', 'display'] as const).map(p => <button key={p} aria-pressed={perspective === p} onClick={() => setPerspective(p)}>{p === 'player' ? 'Player' : p === 'host' ? 'Host' : 'Shared display'}</button>)}</nav>{state === 'reveal' ? <><RoundResults snapshot={snap}/><button className="btn btn-primary btn-full" onClick={onNext}>{base.roundIndex === base.roundCount - 1 ? 'Final results' : 'Next round'} →</button></> : <><div className="practice-round-heading"><span>{MODE_META[round.mode].name}</span>{state === 'play' && <RoundClock deadline={deadline} offset={0} duration={round.timerSeconds}/>}</div><h2 className="practice-question">{round.question}</h2>{state === 'intro' ? <div className="practice-intro"><GameIntro mode={round.mode}/><p>{MODE_META[round.mode].description}</p><span>{round.timerSeconds} seconds · up to 1,000 points</span><button className="btn btn-primary" onClick={() => { payload.current = round.mode === 'amountle' ? { count: 0 } : {}; setDeadline(new Date(Date.now() + round.timerSeconds * 1000).toISOString()); setState('play'); }}>Start round →</button></div> : <>{perspective === 'player' ? <ModePlayer snapshot={snap} onUpdate={() => { }} onLocalSubmit={submit}/> : <div className="shared-round-progress"><strong>{round.mode === 'word_puzzle' ? snap.solvedCount : snap.answerCount}<small>/ {base.members.length}</small></strong><p>{round.mode === 'word_puzzle' ? 'players solved' : 'answers received'}</p><button className="btn" onClick={() => setPerspective('player')}>Play as a player</button><Standings leaders={base.leaderboard}/></div>}{state === 'play' && <button className="text-link practice-end" onClick={() => finish()}>{base.members.length === 1 ? "Finish round" : "End practice round"}</button>}{state === 'locked' && (result?.review.length ? <div className="practice-review"><p>Host review: {payload.current.text}</p><button className="btn" onClick={() => finish('accept')}>Accept</button><button className="btn" onClick={() => finish('reject')}>Reject</button></div> : <button className="btn btn-primary btn-full" onClick={show}>Show results →</button>)}</>}</>}</div>;
}
