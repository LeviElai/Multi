'use client';
import {newId} from '../../../packages/contracts/src/id';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, Monitor, Play, RotateCcw, Smartphone, Trophy, X } from 'lucide-react';
import { MODE_META, type Award, type QuizInput, type Reveal, type Round, type SessionData, type Submission, type WordAttempt } from '../../../packages/contracts/src/index';
import { normalizeAnswer, publicQuestionProjection, sanitizeAndValidateSubmission, scoreRound, segmentGraphemes, validateAuthorConfig, validateWordGuess, wordFeedback } from '../../../packages/game-modes/src/index';
import { Shape } from './ModeArt';
import { ScaleStage } from './ModePlayer';
import './creator.css';
import {RareAnswerControl,RareDepthReveal} from './world/RareExperience';
import {WorldScene} from './world/WorldScene';

type Props = { quiz: QuizInput; initialRound?: number; compact?: boolean; onClose?: () => void };
type Result = { awards: Award[]; reveal: Reveal; review: { answerKey: string; text: string; count: number }[] };
const people = [{ id: 'preview-you', nickname: 'You' }, { id: 'preview-rio', nickname: 'Rio · simulated' }, { id: 'preview-sam', nickname: 'Sam · simulated' }];

function previewData(quiz: QuizInput, round: Round, payload: Submission['payload'], attempts: WordAttempt[]): SessionData {
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
    session: { id: 'simulation', versionId: 'simulation-version', hostId: 'simulation-host', pinDigest: '', pin: '', state: 'ROUND_EVALUATING', stateVersion: 1, roundIndex: quiz.rounds.findIndex(r => r.id === round.id), deadlineAt: null, pausedRemainingMs: null, extensionCount: 0, joinLocked: false, createdAt: now, completedAt: null, lastMutationId: '', latestSeq: 0, maxPlayers: 3 },
    quiz: { id: 'simulation-version', quizId: 'simulation', version: 1, title: quiz.title, theme: quiz.theme, rounds: quiz.rounds, createdAt: now },
    members: people.map(person => ({ ...person, joinedAt: now, status: 'active' as const })), submissions,
    attempts: [...attempts, ...simulatedAttempts], adjudications: [], awards: [], voidRoundIds: [],
  };
}

export function SizeSilhouette({ asset, color = 'currentColor', className, style }: { asset: 'tower' | 'bottle' | 'circle' | 'rocket' | 'block'; color?: string; className?: string; style?: CSSProperties }) {
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className={className} style={style}><Shape asset={asset} fill={color} /></svg>;
}

export function Preview({ quiz, initialRound = 0, compact = false, onClose }: Props) {
  const [index, setIndex] = useState(initialRound);
  const [perspective, setPerspective] = useState<'phone' | 'host' | 'display'>('phone');
  const [value, setValue] = useState('');
  const [ratio, setRatio] = useState(() => { const initial = quiz.rounds[initialRound]; return initial?.mode === 'size_it_up' ? Math.max(initial.publicConfig.minRatio, Math.min(initial.publicConfig.maxRatio, 1)) : 1; });
  const [count, setCount] = useState(0);
  const [attempts, setAttempts] = useState<WordAttempt[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');
  const [scores, setScores] = useState<Record<string, Award[]>>({});
  const [observedRound, setObservedRound] = useState(() => JSON.stringify(quiz.rounds[initialRound] ?? null));
  const held = useRef<ReturnType<typeof setInterval> | null>(null);
  const round = quiz.rounds[Math.min(index, Math.max(0, quiz.rounds.length - 1))];

  function reset() { setValue(''); setRatio(round?.mode === 'size_it_up' ? Math.max(round.publicConfig.minRatio, Math.min(round.publicConfig.maxRatio, 1)) : 1); setCount(0); setAttempts([]); setResult(null); setRevealed(false); setError(''); }
  useEffect(() => () => { if (held.current) clearInterval(held.current); }, []);
  const roundSignature = JSON.stringify(round ?? null);
  if (observedRound !== roundSignature) { setObservedRound(roundSignature); reset(); }
  if (!round) return <div className="creator-empty"><Eye size={32} /><h3>Give your show a first round.</h3><p>Add a game, then try it here.</p></div>;
  const meta = MODE_META[round.mode];
  const configurationErrors = validateAuthorConfig(round).filter(issue => issue.severity === 'error' && issue.field !== 'provenance' && issue.field !== 'sourceUrl');
  if (configurationErrors.length) return <section className="game-preview preview-incomplete"><div className="preview-toolbar"><span className="eyebrow">LOCAL PREVIEW</span>{onClose && <button className="creator-icon-btn" aria-label="Close preview" onClick={onClose}><X size={18} /></button>}</div><div className="creator-empty"><Eye size={29} /><h3>A few details first.</h3><p>{configurationErrors[0].message}</p><span className="creator-help">Your preview comes to life when this round is playable.</span></div></section>;

  function evaluate(payload: Submission['payload'], guesses = attempts, decision?: 'accept' | 'reject') {
    try {
      const acceptedPayload = round.mode === 'word_puzzle' ? payload : sanitizeAndValidateSubmission(round, payload);
      const data = previewData(quiz, round, acceptedPayload, guesses);
      if (decision && round.mode === 'rare_answers') data.adjudications = [{ id: 'simulation-review', roundId: round.id, answerKey: normalizeAnswer(value), decision, canonical: value.trim(), actorId: 'simulation-host', createdAt: new Date().toISOString() }];
      const scored = scoreRound(data, round);
      setResult(scored); setError('');
      if (!scored.review.length) setScores(current => ({ ...current, [round.id]: scored.awards }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Check this answer and try again.'); }
  }
  function submit() {
    if (round.mode === 'word_puzzle') {
      try {
        if (attempts.length >= round.publicConfig.maxAttempts || attempts.some(a => a.solved)) return;
        const guess = validateWordGuess(round, value);
        const feedback = wordFeedback(round.secretConfig.answer, guess);
        const next: WordAttempt[] = [...attempts, { id: `preview-you-${attempts.length}`, roundId: round.id, participantId: people[0].id, clientMutationId: newId(), attempt: attempts.length + 1, guess, feedback, solved: feedback.every(x => x === 'exact'), acceptedAt: new Date().toISOString() }];
        setAttempts(next); setValue(''); setError('');
        if (next.at(-1)?.solved || next.length === round.publicConfig.maxAttempts) evaluate({}, next);
      } catch (e) { setError(e instanceof Error ? e.message : 'Check your guess.'); }
      return;
    }
    if (round.mode === 'fermi') {
      evaluate({ text: value });
    } else if (round.mode === 'rare_answers') {
      if (!value.trim()) return setError('Enter an answer first.');
      evaluate({ text: value });
    } else if (round.mode === 'size_it_up') evaluate({ ratio });
    else evaluate({ count });
  }
  function adjustCount(delta: number) { if (round.mode === 'amountle') setCount(current => Math.min(round.publicConfig.maxCount, Math.max(0, current + delta))); }
  function stopHold() { if (held.current) clearInterval(held.current); held.current = null; }
  const ownAward = result?.awards.find(a => a.participantId === people[0].id);
  const reasonLabel: Record<string, string> = { exact: 'Right on the mark.', estimate: 'A little intuition goes a long way.', word_solved: 'You cracked it.', not_solved: 'A good puzzle is worth another try.', accepted_rare: 'Valid answer. Scored by its rarity in this room.', invalid_answer: 'This answer was not accepted for this round.', not_submitted: 'No answer submitted.', invalid_submission: 'This answer did not meet the round rules.' };
  const overall = people.map(p => ({ ...p, points: Object.values(scores).flat().filter(a => a.participantId === p.id).reduce((sum, a) => sum + a.points, 0) })).sort((a, b) => b.points - a.points);

  return <section className={`game-preview ${compact ? 'is-compact' : ''} perspective-${perspective} ${round.mode==='rare_answers'?'reef-preview':''}`} style={{ '--mode-color': meta.color } as CSSProperties} aria-label="Quiz simulation">
    <div className="preview-toolbar"><span className="eyebrow"><span className="simulation-dot" /> SIMULATION</span>{!compact && <div className="perspective-switch" aria-label="Preview perspective">{([{ id: 'phone', icon: Smartphone, label: 'Phone' }, { id: 'host', icon: Monitor, label: 'Host' }, { id: 'display', icon: Eye, label: 'Display' }] as const).map(view => <button key={view.id} type="button" aria-pressed={perspective === view.id} title={`${view.label} preview`} onClick={() => setPerspective(view.id)}><view.icon size={16} /><span>{view.label}</span></button>)}</div>}{onClose && <button type="button" className="creator-icon-btn" aria-label="Close preview" onClick={onClose}><X size={20} /></button>}</div>
    {!compact && <p className="preview-disclaimer">Practice with two simulated players. Scores use the game engine; no live room is created.</p>}
    <div className="preview-layout">{round.mode==='rare_answers'&&<WorldScene ocean/>}
      <div className="preview-play-surface">
        <div className="preview-round-bar"><span>{meta.symbol} {meta.name}</span><span>{round.timerSeconds}s · practice</span></div>
        <h3>{round.question || 'Your question goes here.'}</h3>
        {perspective === 'display' && !revealed ? <div className="preview-display-hold"><span className="big-mode-symbol">{meta.symbol}</span><p>Answers happen on players’ phones.</p><button className="btn btn-ghost" onClick={() => setPerspective('phone')}>Try the phone view <Smartphone size={16} /></button></div> : !revealed ? <>
          {round.mode === 'fermi' && <form onSubmit={e => { e.preventDefault(); submit(); }}><label className="preview-input-label" htmlFor={`estimate-${round.id}`}>Your best estimate</label><div className="preview-number-input"><input id={`estimate-${round.id}`} type="text" inputMode="decimal" value={value} placeholder="0" onChange={e => setValue(e.target.value)} disabled={!!result} autoComplete="off" /><span>{round.publicConfig.unit}</span></div><p className="creator-help">From {round.publicConfig.min.toLocaleString()} to {round.publicConfig.max.toLocaleString()} · K, M and B accepted</p><button type="submit" className="btn btn-dark preview-submit" disabled={!!result}>Lock estimate <Check size={17} /></button></form>}
          {round.mode === 'rare_answers' && <RareAnswerControl value={value} onChange={setValue} disabled={!!result} onSubmit={submit}/>}
          {round.mode === 'word_puzzle' && <><div className="preview-word-board" style={{ '--letter-count': round.publicConfig.length } as CSSProperties} aria-label="Your word guesses">{Array.from({ length: round.publicConfig.maxAttempts }, (_, row) => <div className="preview-word-row" key={row}>{Array.from({ length: round.publicConfig.length }, (_, col) => <span key={col} className={`preview-word-tile ${attempts[row]?.feedback[col] ?? ''}`} aria-label={attempts[row] ? `${segmentGraphemes(attempts[row].guess)[col]}, ${attempts[row].feedback[col]}` : 'Empty letter'}>{attempts[row] ? segmentGraphemes(attempts[row].guess)[col] : row === attempts.length ? segmentGraphemes(value.toUpperCase())[col] : ''}</span>)}</div>)}</div><form onSubmit={e => { e.preventDefault(); submit(); }}><label className="preview-input-label" htmlFor={`word-${round.id}`}>{round.publicConfig.length} letters · {round.publicConfig.maxAttempts - attempts.length} guesses left</label><div className="preview-word-entry"><input className="field" id={`word-${round.id}`} value={value} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={48} onChange={e => setValue(e.target.value)} placeholder="Your guess" disabled={!!result} /><button className="btn btn-dark" type="submit" disabled={!!result}><ArrowRight size={18} /><span className="creator-sr-only">Submit guess</span></button></div></form><div className="word-key"><span className="exact" /> right place <span className="present" /> wrong place <span className="absent" /> not in word</div></>}
          {round.mode === 'size_it_up' && <><ScaleStage round={publicQuestionProjection(round)} ratio={ratio} onRatio={result ? undefined : setRatio} /><label className="preview-input-label" htmlFor={`ratio-${round.id}`}>Resize the {round.publicConfig.targetLabel.toLowerCase()} <strong>{ratio.toFixed(2)}×</strong></label><input className="creator-range" id={`ratio-${round.id}`} type="range" min={round.publicConfig.minRatio} max={round.publicConfig.maxRatio} step={0.01} value={ratio} disabled={!!result} onChange={e => setRatio(Number(e.target.value))} /><div className="range-labels"><span>{round.publicConfig.minRatio}×</span><button className="text-button" onClick={() => setRatio(Math.min(round.publicConfig.maxRatio, Math.max(round.publicConfig.minRatio, 1)))} disabled={!!result}>Reset</button><span>{round.publicConfig.maxRatio}×</span></div><button className="btn btn-dark preview-submit" disabled={!!result} onClick={submit}>Lock size <Check size={17} /></button></>}
          {round.mode === 'amountle' && <><div className="preview-vessel" aria-hidden="true"><div className="vessel-particles">{Array.from({ length: Math.min(60, count) }, (_, particle) => <i key={particle} style={{ '--particle-rotation': `${(particle * 37) % 80 - 40}deg` } as CSSProperties} />)}</div><span>{count > 60 ? `${count} total` : ''}</span></div><div className="amount-counter"><span>Your amount</span><output aria-live="off">{count.toLocaleString()}</output><span>{round.publicConfig.unit}</span></div><div className="amount-controls">{round.publicConfig.allowRemove && <button type="button" className="btn btn-ghost" disabled={!!result || count === 0} onClick={() => adjustCount(-1)} aria-label="Remove one">−1</button>}{round.publicConfig.steps.map(step => <button key={step} type="button" className="btn btn-dark" disabled={!!result || count >= round.publicConfig.maxCount} onClick={() => adjustCount(step)} onPointerDown={() => { stopHold(); held.current = setInterval(() => adjustCount(step), 180); }} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onBlur={stopHold}>+{step}</button>)}</div><label className="preview-input-label" htmlFor={`count-${round.id}`}>Or enter an exact count</label><input id={`count-${round.id}`} className="field" type="number" min={0} max={round.publicConfig.maxCount} step={1} value={count} disabled={!!result} onChange={e => setCount(Math.max(0, Math.min(round.publicConfig.maxCount, Math.round(Number(e.target.value)))))} /><button type="button" className="btn btn-dark preview-submit" disabled={!!result} onClick={submit}>Lock amount <Check size={17} /></button></>}
        </> : <div className="preview-reveal"><span className="eyebrow">THE REVEAL</span><div className="reveal-answer">{round.mode==='rare_answers'?'Your discovery':String(result?.reveal.answer ?? '')}{result?.reveal.unit && <small> {result.reveal.unit}</small>}</div><div className="preview-points"><Trophy size={22} /><strong>{ownAward?.points ?? 0}</strong><span>/ 1,000 points</span></div><p>{ownAward ? reasonLabel[ownAward.reason] ?? 'Round complete.' : 'Round complete.'}</p>{result?.reveal.groups && <RareDepthReveal groups={result.reveal.groups} ownAnswer={value}/>}{round.explanation && <p className="reveal-explanation">{round.explanation}</p>}{round.sourceUrl && /^https?:\/\//i.test(round.sourceUrl) && <a href={round.sourceUrl} target="_blank" rel="noreferrer" className="text-button">Check the source ↗</a>}{round.mode === 'size_it_up' && <><ScaleStage round={publicQuestionProjection(round)} ratio={ratio} truth={round.secretConfig.targetSize / round.publicConfig.referenceSize} /><p className="creator-help">True ratio: {(round.secretConfig.targetSize / round.publicConfig.referenceSize).toFixed(2)}× · your ratio: {ratio.toFixed(2)}×</p></>}</div>}
        {error && <p className="creator-error" role="alert">{error}</p>}
        {result && !revealed && (result.review.length ? <div className="preview-review"><strong>Host review needed</strong><p>This answer is outside your approved list. Try both decisions.</p><div className="creator-actions"><button className="btn btn-dark" onClick={() => evaluate({ text: value }, attempts, 'accept')}>Accept</button><button className="btn btn-ghost" onClick={() => evaluate({ text: value }, attempts, 'reject')}>Reject</button></div></div> : <div className="preview-accepted" aria-live="polite"><span><Check size={18} /> Answer locked in this simulation</span><button className="btn btn-dark" onClick={() => setRevealed(true)}>Show reveal <Eye size={17} /></button></div>)}
        {!result && round.mode === 'word_puzzle' && attempts.length > 0 && <button className="text-button preview-end-round" onClick={() => evaluate({})}>End practice round & reveal</button>}
        {revealed && <div className="preview-round-results"><span className="eyebrow">THIS ROUND</span>{people.map(person => <div key={person.id}><span>{person.nickname}</span><strong>{result?.awards.find(award => award.participantId === person.id)?.points ?? 0}</strong></div>)}</div>}
      </div>
      {!compact && perspective === 'host' && <aside className="preview-host-panel"><span className="eyebrow">HOST DESK</span><h3>Your practice room.</h3><p>All three participants are local simulations. Try an answer, reveal the result, then move to your next round.</p><div className="preview-stat"><strong>3</strong><span>simulated players</span></div><h4>Cumulative leaderboard</h4>{overall.map((person, rank) => <div className="preview-leader" key={person.id}><span>{rank + 1}</span><span>{person.nickname}</span><strong>{person.points.toLocaleString()}</strong></div>)}<p className="creator-help">Room timers, synchronization and reconnects are exercised in a live hosted game.</p></aside>}
    </div>
    <footer className="preview-bottom"><button className="creator-icon-btn" onClick={reset} aria-label="Reset this practice round" title="Reset practice"><RotateCcw size={17} /></button>{!compact && <><button className="creator-icon-btn" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} aria-label="Previous round"><ArrowLeft size={18} /></button><span>Round {index + 1} / {quiz.rounds.length}</span><button className="creator-icon-btn" onClick={() => setIndex(Math.min(quiz.rounds.length - 1, index + 1))} disabled={index >= quiz.rounds.length - 1} aria-label="Next round"><ArrowRight size={18} /></button></>}<span className="preview-local-label"><Play size={12} /> Local practice</span></footer>
  </section>;
}

export default Preview;
