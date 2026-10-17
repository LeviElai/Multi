'use client';
import {PublishDialog,type PublishSettings} from './creator/PublishDialog';
import {CommunityShare} from './CommunityShare';
import {quizColor} from '../lib/quiz-color';
import { newId } from '../../../packages/contracts/src/id';
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Check, CheckCircle2, ChevronDown, Copy, Eye, GripVertical, Layers3, Loader2, LockKeyhole, Plus, Search, Settings2, Trash2, Undo2, X } from 'lucide-react';
import { MODE_META, MODES, DraftQuizInputSchema, type ModeId, type Quiz, type QuizInput, type QuizVersion, type Round, type ValidationIssue } from '../../../packages/contracts/src/index';
import { getDefaultRound, getEmptyRound, getWorkshopQuiz } from '../../../packages/game-modes/src/fixtures';
import { segmentGraphemes, validateAuthorConfig, validateQuiz } from '../../../packages/game-modes/src/index';
import { api } from '../lib/api';
import { Preview, SizeSilhouette } from './Preview';
import { PixelSprite } from './world/Sprites';
import { SimpleModeEditor, MODE_EXAMPLES } from './creator/SimpleModeEditor';
type CreatorProps = {
    quizId?: string;
    view?: 'create' | 'library' | 'edit' | 'preview';
};
const QUESTION_HELP:Record<ModeId,string>={fermi:'Ask a question with a number as its answer.',rare_answers:'Choose a clear category, then add every accepted answer below.',word_puzzle:'Write a clue without giving away the hidden word.',size_it_up:'Ask players to resize the target beside the reference. Keep the target measurement secret.',amountle:'Describe what players should count. Keep the total secret.'};
type SaveState = 'saved' | 'unsaved' | 'saving' | 'invalid' | 'error' | 'conflict';
const blank: QuizInput = { title: 'Untitled quiz', description: '', language: 'en', audienceContext: 'adult_private', theme: 'studio', rounds: [] };
const mutationHeaders = () => ({ 'Content-Type': 'application/json', 'Idempotency-Key': newId() });
const quizInput = (quiz: QuizInput): QuizInput => ({ title: quiz.title, description: quiz.description, language: quiz.language, audienceContext: quiz.audienceContext, theme: quiz.theme, rounds: quiz.rounds });
const newRoundIds = (quiz: QuizInput): QuizInput => ({ ...quizInput(quiz), rounds: quiz.rounds.map(round => ({ ...structuredClone(round), id: newId() })) });
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const isConflict = (error: unknown) => { const value = error as {
    status?: number;
    code?: string;
}; return value?.status === 409 || /CONFLICT|REVISION/i.test(value?.code ?? '') || /revision|another editor/i.test(messageOf(error)); };
function Field({ label, help, children, className = '' }: {
    label: string;
    help?: string;
    children: ReactNode;
    className?: string;
}) {
    const id = useId();
    const nativeControl = isValidElement(children) && typeof children.type === 'string' && ['input', 'select', 'textarea'].includes(children.type);
    return <div className={`creator-field ${className}`}>{nativeControl ? <label htmlFor={id}>{label}</label> : <span id={`${id}-label`}>{label}</span>}{nativeControl ? cloneElement(children as ReactElement<{
        id: string;
        'aria-describedby'?: string;
    }>, { id, 'aria-describedby': help ? `${id}-help` : undefined }) : <div role="group" aria-labelledby={`${id}-label`}>{children}</div>}{help && <small id={`${id}-help`}>{help}</small>}</div>;
}
function NumberField({ label, value, onChange, min, max, step = 'any', help }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number | 'any';
    help?: string;
}) {
    return <Field label={label} help={help}><input className="field" type="number" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step} onChange={event => onChange(event.target.value === '' ? NaN : Number(event.target.value))}/></Field>;
}
function RareEditor({ round, advanced, onChange }: {
    round: Extract<Round, {
        mode: 'rare_answers';
    }>;
    advanced: boolean;
    onChange: (round: Round) => void;
}) {
    const [text, setText] = useState(() => round.secretConfig.answers.map(answer => `${answer.canonical}${answer.aliases.length ? ` | ${answer.aliases.join(', ')}` : ''}`).join('\n'));
    return <><Field label="Approved answers" help={advanced ? 'One answer per line. Add aliases after |, separated by commas. Example: New York | NYC, New York City' : 'One correct answer per line. Add at least two for a more interesting room.'}><textarea className="field answer-list" rows={6} value={text} placeholder={'Coral\nMint\nLilac'} onChange={event => { const next = event.target.value; setText(next); onChange({ ...round, secretConfig: { answers: next.split('\n').filter(line => line.trim()).map(line => { const [canonical, ...aliasParts] = line.split('|'); return { canonical: canonical.trim(), aliases: aliasParts.join('|').split(',').map(alias => alias.trim()).filter(Boolean) }; }) } }); }}/></Field><div className="editor-rule"><span>✳</span><p>A valid answer earns more when fewer people in the room choose it. Aliases count as the same answer.</p></div>{advanced && <Field label="Answers outside this list"><select className="field" value={round.publicConfig.adjudication} onChange={event => onChange({ ...round, publicConfig: { ...round.publicConfig, adjudication: event.target.value as 'allowlist' | 'host_review' } })}><option value="allowlist">Reject automatically</option><option value="host_review">Ask the host to decide</option></select></Field>}</>;
}
function WordEditor({ round, advanced, onChange }: {
    round: Extract<Round, {
        mode: 'word_puzzle';
    }>;
    advanced: boolean;
    onChange: (round: Round) => void;
}) {
    const [guesses, setGuesses] = useState(round.secretConfig.allowedGuesses.join('\n'));
    return <><Field label="The secret word" help="3–12 letters. The clue above is visible to players; this word stays hidden."><input className="field word-answer-input" value={round.secretConfig.answer} maxLength={48} autoCapitalize="characters" spellCheck={false} onChange={event => onChange({ ...round, publicConfig: { ...round.publicConfig, length: segmentGraphemes(event.target.value.trim()).length }, secretConfig: { ...round.secretConfig, answer: event.target.value.toUpperCase() } })}/></Field><div className="creator-two-col"><NumberField label="Attempts" value={round.publicConfig.maxAttempts} min={3} max={8} step={1} onChange={maxAttempts => onChange({ ...round, publicConfig: { ...round.publicConfig, maxAttempts } })}/><Field label="Accepted guesses"><select className="field" value={round.publicConfig.dictionaryPolicy} onChange={event => onChange({ ...round, publicConfig: { ...round.publicConfig, dictionaryPolicy: event.target.value as 'custom' | 'unrestricted_valid_chars' } })}><option value="unrestricted_valid_chars">Any valid letters</option><option value="custom">My word list</option></select></Field></div>{round.publicConfig.dictionaryPolicy === 'custom' && <Field label="Allowed guesses" help="One word per line, each the same length as the secret. The answer is always accepted."><textarea className="field answer-list" rows={5} value={guesses} onChange={event => { setGuesses(event.target.value); onChange({ ...round, secretConfig: { ...round.secretConfig, allowedGuesses: event.target.value.split(/[\n,]/).map(word => word.trim().toUpperCase()).filter(Boolean) } }); }}/></Field>}{advanced && <div className="editor-rule"><span>W</span><p>Scores start at 1,000 and decrease by 150 for each additional guess. Repeated letters use exact-position matches first.</p></div>}</>;
}
function ModeEditor({ round, advanced, onChange }: {
    round: Round;
    advanced: boolean;
    onChange: (round: Round) => void;
}) {
    if (!advanced)
        return <SimpleModeEditor round={round} onChange={onChange}/>;
    if (round.mode === 'rare_answers')
        return <RareEditor round={round} advanced={advanced} onChange={onChange}/>;
    if (round.mode === 'word_puzzle')
        return <WordEditor round={round} advanced={advanced} onChange={onChange}/>;
    if (round.mode === 'fermi')
        return <><div className="creator-two-col"><NumberField label="Correct answer" value={round.secretConfig.answer} onChange={answer => onChange({ ...round, secretConfig: { answer }, publicConfig: { ...round.publicConfig, errorMode: answer <= 0 ? 'absolute' : round.publicConfig.errorMode } })}/><Field label="Unit"><input className="field" value={round.publicConfig.unit} maxLength={30} placeholder="km, years, people…" onChange={event => onChange({ ...round, publicConfig: { ...round.publicConfig, unit: event.target.value } })}/></Field></div><div className="creator-two-col"><NumberField label="Smallest allowed estimate" value={round.publicConfig.min} onChange={min => onChange({ ...round, publicConfig: { ...round.publicConfig, min } })}/><NumberField label="Largest allowed estimate" value={round.publicConfig.max} onChange={max => onChange({ ...round, publicConfig: { ...round.publicConfig, max } })}/></div>{advanced && <><Field label="Scoring"><select className="field" value={round.publicConfig.errorMode} onChange={event => onChange({ ...round, publicConfig: { ...round.publicConfig, errorMode: event.target.value as 'proportional' | 'absolute' } })}><option value="proportional">Proportional · compare ratios</option><option value="absolute">Absolute · compare distance</option></select></Field><div className="creator-two-col">{round.publicConfig.errorMode === 'absolute' && <NumberField label="Distance for zero points" value={round.publicConfig.tolerance} min={0.000001} help="At this distance from the answer, the score reaches zero." onChange={tolerance => onChange({ ...round, publicConfig: { ...round.publicConfig, tolerance } })}/>}<NumberField label="Input step" value={round.publicConfig.step} min={0.000001} onChange={step => onChange({ ...round, publicConfig: { ...round.publicConfig, step } })}/></div></>}<div className="editor-rule"><span>↗</span><p>{round.publicConfig.errorMode === 'proportional' ? 'An exact answer earns 1,000. Half or double the answer earns 500.' : `An exact answer earns 1,000. Each ${Number.isFinite(round.publicConfig.tolerance) ? round.publicConfig.tolerance : 'configured'} units of error removes 1,000 points, down to zero.`}</p></div></>;
    if (round.mode === 'size_it_up')
        return <><div className="creator-two-col"><Field label="Reference label"><input className="field" value={round.publicConfig.referenceLabel} maxLength={60} onChange={event => onChange({ ...round, publicConfig: { ...round.publicConfig, referenceLabel: event.target.value } })}/></Field><Field label="Target label"><input className="field" value={round.publicConfig.targetLabel} maxLength={60} onChange={event => onChange({ ...round, publicConfig: { ...round.publicConfig, targetLabel: event.target.value } })}/></Field><NumberField label="Reference size" value={round.publicConfig.referenceSize} min={0.000001} onChange={referenceSize => onChange({ ...round, publicConfig: { ...round.publicConfig, referenceSize } })}/><NumberField label="Target size" value={round.secretConfig.targetSize} min={0.000001} onChange={targetSize => onChange({ ...round, secretConfig: { targetSize } })}/><Field label="Unit"><input className="field" value={round.publicConfig.unit} maxLength={20} onChange={event => onChange({ ...round, publicConfig: { ...round.publicConfig, unit: event.target.value } })}/></Field><Field label="Measurement axis"><select className="field" value={round.publicConfig.axis} onChange={event => onChange({ ...round, publicConfig: { ...round.publicConfig, axis: event.target.value as 'width' | 'height' } })}><option value="height">Height</option><option value="width">Width</option></select></Field></div><label className="creator-field"><span>Reference artwork</span><select className="field" value={round.publicConfig.referenceAsset ?? 'block'} onChange={e => onChange({ ...round, publicConfig: { ...round.publicConfig, referenceAsset: e.target.value as typeof round.publicConfig.asset } })}>{['person', 'tree', 'car', 'bottle', 'tower', 'block', 'circle', 'rocket'].map(asset => <option key={asset} value={asset}>{asset}</option>)}</select></label><Field label="Silhouette"><div className="asset-picker">{(['block', 'tower', 'bottle', 'circle', 'rocket', 'tree', 'person', 'car'] as const).map(asset => <button key={asset} type="button" aria-pressed={round.publicConfig.asset === asset} aria-label={`${asset} silhouette`} title={asset} onClick={() => onChange({ ...round, publicConfig: { ...round.publicConfig, asset, calibration: { version: 1, intrinsicDimension: 100, start: 0, end: 100 } } })}><SizeSilhouette asset={asset}/><span>{asset}</span></button>)}</div></Field>{advanced && <><div className="creator-two-col"><NumberField label="Minimum player ratio" value={round.publicConfig.minRatio} min={0.01} onChange={minRatio => onChange({ ...round, publicConfig: { ...round.publicConfig, minRatio } })}/><NumberField label="Maximum player ratio" value={round.publicConfig.maxRatio} min={0.01} onChange={maxRatio => onChange({ ...round, publicConfig: { ...round.publicConfig, maxRatio } })}/></div><div className="calibration-panel"><span className="eyebrow">MEASUREMENT CALIBRATION</span><p>All built-in silhouettes use a 100-unit view box. Endpoints define the measured span on your selected axis.</p><div className="calibration-ruler"><i style={{ left: `${round.publicConfig.calibration.start / round.publicConfig.calibration.intrinsicDimension * 100}%`, right: `${100 - round.publicConfig.calibration.end / round.publicConfig.calibration.intrinsicDimension * 100}%` }}/><span>0</span><span>{round.publicConfig.calibration.intrinsicDimension}</span></div><div className="creator-two-col"><NumberField label="Measurement start" value={round.publicConfig.calibration.start} min={0} max={100} onChange={start => onChange({ ...round, publicConfig: { ...round.publicConfig, calibration: { ...round.publicConfig.calibration, start } } })}/><NumberField label="Measurement end" value={round.publicConfig.calibration.end} min={0} max={100} onChange={end => onChange({ ...round, publicConfig: { ...round.publicConfig, calibration: { ...round.publicConfig.calibration, end } } })}/></div></div></>}<div className="editor-rule"><span>↔</span><p>True size: <strong>{Number.isFinite(round.secretConfig.targetSize / round.publicConfig.referenceSize) ? (round.secretConfig.targetSize / round.publicConfig.referenceSize).toFixed(2) : '—'}×</strong> the reference. Player scores use this ratio, independent of screen size.</p></div></>;
    return <><div className="creator-two-col"><NumberField label="Target count" value={round.secretConfig.answer} min={0} max={10000} step={1} onChange={answer => onChange({ ...round, secretConfig: { answer } })}/><NumberField label="Maximum count" value={round.publicConfig.maxCount} min={1} max={10000} step={1} onChange={maxCount => onChange({ ...round, publicConfig: { ...round.publicConfig, maxCount } })}/></div><Field label="What are we counting?"><input className="field" value={round.publicConfig.unit} maxLength={30} placeholder="tokens, days, items…" onChange={event => onChange({ ...round, publicConfig: { ...round.publicConfig, unit: event.target.value } })}/></Field>{advanced && <><NumberField label="Distance for zero points" value={round.publicConfig.tolerance} min={0.0001} max={10000} help="Used for targets of 100 or less. Larger targets use proportional scoring." onChange={tolerance => onChange({ ...round, publicConfig: { ...round.publicConfig, tolerance } })}/></>}<div className="editor-rule"><span>⠿</span><p>Players see the target and pour by eye. No removal or direct entry. The count locks at the deadline.</p></div></>;
}
export function Creator({ quizId, view = 'create' }: CreatorProps) {
    const router = useRouter();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [draft, setDraft] = useState<QuizInput>(blank);
    const [library, setLibrary] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(view === 'library' || !!quizId);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [authNeeded, setAuthNeeded] = useState(false);
    const [notice, setNotice] = useState('');
    const [saveState, setSaveState] = useState<SaveState>('saved');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
    const [selected, setSelected] = useState<string | null>(null);
    const [advanced, setAdvanced] = useState(false);
    const [mobileView, setMobileView] = useState<'rounds' | 'edit'>('edit');
    const [changeMode, setChangeMode] = useState<ModeId | null>(null);
    useEffect(() => setChangeMode(null), [selected]);
    const pickerTrigger = useRef<HTMLElement | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [publishSetup,setPublishSetup]=useState<{startRoom:boolean;share:boolean}|null>(null);
    const [isShared,setIsShared]=useState(false);
    useEffect(()=>{if(!quizId)return;let active=true;api<{shared:boolean}>(`/quizzes/${quizId}/community`).then(r=>{if(active)setIsShared(r.shared);}).catch(()=>{});return()=>{active=false;};},[quizId]);
    const [pickerOpen, setPickerOpen] = useState(false);
    useEffect(() => { if (pickerOpen) {
        pickerTrigger.current = document.activeElement as HTMLElement;
    }
    else {
        pickerTrigger.current?.focus();
    } }, [pickerOpen]);
    const [previewOpen, setPreviewOpen] = useState(view === 'preview');
    const [deleted, setDeleted] = useState<{
        round: Round;
        index: number;
    } | null>(null);
    const [dragged, setDragged] = useState<string | null>(null);
    const [published, setPublished] = useState<QuizVersion | null>(null);
    const [serverIssues, setServerIssues] = useState<ValidationIssue[]>([]);
    const [editorEpoch, setEditorEpoch] = useState(0);
    const quizRef = useRef<Quiz | null>(null);
    const draftRef = useRef<QuizInput>(blank);
    const changes = useRef(0);
    const savedChanges = useRef(0);
    const conflict = useRef(false);
    const savePromise = useRef<Promise<Quiz | null> | null>(null);
    const saveRef = useRef<() => Promise<Quiz | null>>(async () => null);
    function reportError(value: unknown) { setError(messageOf(value)); setAuthNeeded((value as {
        status?: number;
    })?.status === 401); }
    function installQuiz(value: Quiz) {
        quizRef.current = value;
        draftRef.current = quizInput(value);
        changes.current = 0;
        savedChanges.current = 0;
        conflict.current = false;
        setQuiz(value);
        setDraft(quizInput(value));
        setSelected(value.rounds[0]?.id ?? null);
        setSaveState('saved');
        setError('');
        setAuthNeeded(false);
        setServerIssues([]);
        setEditorEpoch(current => current + 1);
    }
    useEffect(() => {
        let active = true;
        if (quizId)
            api<Quiz>(`/quizzes/${quizId}`).then(value => { if (active)
                installQuiz(value); }).catch(e => { if (active)
                reportError(e); }).finally(() => { if (active)
                setLoading(false); });
        else if (view === 'library')
            api<Quiz[]>('/quizzes').then(value => { if (active)
                setLibrary(value); }).catch(e => { if (active)
                reportError(e); }).finally(() => { if (active)
                setLoading(false); });
        return () => { active = false; };
    }, [quizId, view]);
    useEffect(() => { if (!quiz || saveState === 'conflict' || saveState === 'saving' || saveState === 'error' || saveState === 'invalid' || changes.current === savedChanges.current)
        return; const timeout = setTimeout(() => { void saveRef.current().catch(() => { }); }, 900); return () => clearTimeout(timeout); }, [draft, quiz, saveState]);
    useEffect(() => { const guard = (event: BeforeUnloadEvent) => { if (changes.current !== savedChanges.current) {
        event.preventDefault();
        event.returnValue = '';
    } }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, []);
    function edit(update: QuizInput | ((current: QuizInput) => QuizInput)) {
        const next = typeof update === 'function' ? update(draftRef.current) : update;
        draftRef.current = next;
        changes.current++;
        setDraft(next);
        setServerIssues([]);
        setPublished(null);
        setSaveState(conflict.current ? 'conflict' : 'unsaved');
    }
    async function saveDraft(): Promise<Quiz | null> {
        if (savePromise.current) {
            await savePromise.current;
            return saveRef.current();
        }
        if (conflict.current)
            throw new Error('This draft changed in another tab. Resolve the conflict before publishing.');
        const currentQuiz = quizRef.current;
        if (!currentQuiz || changes.current === savedChanges.current)
            return currentQuiz;
        const input = DraftQuizInputSchema.safeParse(draftRef.current);
        if (!input.success) {
            setSaveState('invalid');
            throw new Error('Complete the required fields before this draft can be saved.');
        }
        const count = changes.current;
        setSaveState('saving');
        const promise = api<Quiz>(`/quizzes/${currentQuiz.id}`, { method: 'PATCH', headers: mutationHeaders(), body: JSON.stringify({ ...input.data, expectedRevision: currentQuiz.revision }) }).then(saved => {
            quizRef.current = saved;
            savedChanges.current = count;
            setQuiz(saved);
            setAuthNeeded(false);
            setError('');
            setSaveState(changes.current > count ? 'unsaved' : 'saved');
            return saved;
        }).catch(e => { if (isConflict(e)) {
            conflict.current = true;
            setSaveState('conflict');
        }
        else {
            setSaveState('error');
            reportError(e);
        } throw e; }).finally(() => { savePromise.current = null; });
        savePromise.current = promise;
        const saved = await promise;
        return changes.current > savedChanges.current ? saveRef.current() : saved;
    }
    useEffect(() => { saveRef.current = saveDraft; });
    async function createQuiz(input: QuizInput, copy = false) {
        setBusy(copy ? 'copy' : 'create');
        setError('');
        try {
            const created = await api<Quiz>('/quizzes', { method: 'POST', headers: mutationHeaders(), body: JSON.stringify(copy ? { ...newRoundIds(input), title: `${input.title.slice(0, 93)} (copy)` } : input) });
            installQuiz(created);
            router.push(`/quiz/${created.id}/edit`);
        }
        catch (e) {
            reportError(e);
            setBusy('');
        }
    }
    function updateRound(next: Round) { edit(current => ({ ...current, rounds: current.rounds.map(round => round.id === next.id ? next : round) })); }
    function addRound(mode: ModeId) { const round = getEmptyRound(mode); edit(current => ({ ...current, rounds: [...current.rounds, round] })); setSelected(round.id); setMobileView('edit'); setPickerOpen(false); setNotice(`${MODE_META[mode].name} round added. `); }
    function moveRound(id: string, targetIndex: number) {
        edit(current => { const rounds = [...current.rounds]; const fromIndex = rounds.findIndex(round => round.id === id); if (fromIndex < 0)
            return current; const [round] = rounds.splice(fromIndex, 1); rounds.splice(Math.max(0, Math.min(targetIndex, rounds.length)), 0, round); return { ...current, rounds }; });
    }
    function duplicateRound(round: Round) { if (draft.rounds.length >= 40)
        return; const clone = { ...structuredClone(round), id: newId() }; edit(current => { const rounds = [...current.rounds]; rounds.splice(rounds.findIndex(item => item.id === round.id) + 1, 0, clone); return { ...current, rounds }; }); setSelected(clone.id); setNotice('Round duplicated.'); }
    function removeRound(round: Round) { const index = draft.rounds.findIndex(item => item.id === round.id); setDeleted({ round, index }); edit(current => ({ ...current, rounds: current.rounds.filter(item => item.id !== round.id) })); if (selected === round.id)
        setSelected(draft.rounds[index + 1]?.id ?? draft.rounds[index - 1]?.id ?? null); setNotice('Round deleted. You can undo this below.'); }
    function undoDelete() { if (!deleted || draft.rounds.length >= 40)
        return; edit(current => { const rounds = [...current.rounds]; rounds.splice(Math.min(deleted.index, rounds.length), 0, deleted.round); return { ...current, rounds }; }); setSelected(deleted.round.id); setDeleted(null); setNotice('Round restored.'); }
    async function publish(startRoom: boolean, settings?:PublishSettings) {
        if(!settings&&!quizRef.current?.publishedVersionId){setError('');setPublishSetup({startRoom,share:false});return;}
        if(settings)edit(current=>({...current,title:settings.title,description:settings.description}));
        setBusy(startRoom ? 'host' : 'publish');
        setError('');
        try {
            const saved = await saveDraft();
            if (!saved)
                return;
            let version:QuizVersion;
            if(settings?.share){
                const shared=await api<{versionId:string}>(`/quizzes/${saved.id}/community`,{method:'POST',headers:mutationHeaders(),body:JSON.stringify({expectedRevision:saved.revision,reviewed:true,category:settings.category})});
                version=await api<QuizVersion>(`/versions/${shared.versionId}`);setIsShared(true);
            }else version = await api<QuizVersion>(`/quizzes/${saved.id}/publish`, { method: 'POST', headers: mutationHeaders(), body: JSON.stringify({ expectedRevision: saved.revision }) });
            setPublished(version);
            const updated = await api<Quiz>(`/quizzes/${saved.id}`);
            quizRef.current = updated;
            setQuiz(updated);
            setPublishSetup(null);setNotice(settings?.share?'Your quiz is in the public library.':`Version ${version.version} is ready to host.`);
            if (startRoom) {
                const session = await api<{
                    sessionId: string;
                    pin: string;
                }>('/sessions', { method: 'POST', headers: mutationHeaders(), body: JSON.stringify({ quizVersionId: version.id }) });
                router.push(`/host/${session.sessionId}`);
            }
        }
        catch (e) {
            reportError(e);
            const details = (e as {
                details?: unknown;
            }).details;
            if (Array.isArray(details))
                setServerIssues(details as ValidationIssue[]);
            if (isConflict(e)) {
                conflict.current = true;
                setSaveState('conflict');
            }
        }
        finally {
            setBusy('');
        }
    }
    async function archive(item: Quiz) { setBusy(item.id); setError(''); try {
        await api(`/quizzes/${item.id}`, { method: 'DELETE', headers: mutationHeaders() });
        setLibrary(current => current.filter(quiz => quiz.id !== item.id));
        setNotice(`“${item.title}” archived.`);
    }
    catch (e) {
        reportError(e);
    }
    finally {
        setBusy('');
    } }
    async function loadLatest() { if (!quizRef.current)
        return; setBusy('reload'); try {
        installQuiz(await api<Quiz>(`/quizzes/${quizRef.current.id}`));
        setNotice('Loaded the latest saved draft.');
    }
    catch (e) {
        reportError(e);
    }
    finally {
        setBusy('');
    } }
    const issues = quiz ? [...validateQuiz(draft), ...serverIssues] : [];
    const blockers = issues.filter(issue => issue.severity === 'error');
    const contentBlockers=blockers.filter(issue=>!['title','description'].includes(issue.field));
    const currentRound = draft.rounds.find(round => round.id === selected) ?? draft.rounds[0];
    const currentIndex = currentRound ? draft.rounds.findIndex(round => round.id === currentRound.id) : -1;
    const roundIssues = currentRound ? issues.filter(issue => issue.roundId === currentRound.id) : [];
    const estimatedMinutes = Math.max(1, Math.ceil(draft.rounds.reduce((sum, round) => sum + (Number.isFinite(round.timerSeconds) ? round.timerSeconds : 30) + 18, 0) / 60));
    const visibleQuizzes = library.filter(item => item.status !== 'archived' && (filter === 'all' || item.status === filter) && `${item.title} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
    const savingText: Record<SaveState, string> = { saved: 'All changes saved', unsaved: 'Unsaved changes', saving: 'Saving…', invalid: 'Complete fields to save', error: 'Save failed · retry', conflict: 'Revision conflict' };
    if (loading)
        return <main className="page creator-page"><div className="creator-loading" role="status"><Loader2 size={30} className="creator-spin"/><h2>Loading your quiz…</h2></div></main>;
    if (authNeeded && !quiz)
        return <main className="page creator-page"><div className="creator-empty"><LockKeyhole size={34}/><span className="eyebrow">CREATOR SIGN-IN</span><h2>Sign in to create quizzes.</h2><p>Sign in to create quizzes, save your rounds, and open a live room.</p><Link className="btn btn-primary" href="/login">Sign in <ArrowRight size={17}/></Link></div></main>;
    if (quizId && !quiz)
        return <main className="page creator-page"><div className="creator-empty"><Layers3 size={36}/><h2>We couldn’t open this quiz.</h2><p role="alert">{error || 'It may not exist, or you may not have access.'}</p><Link className="btn btn-primary" href="/library">Back to your library <ArrowRight size={17}/></Link></div></main>;
    if (view === 'library' && !quiz)
        return <main className="page creator-page"><div className="creator-page-heading"><div><h1>My quizzes</h1><p><Link href="/community">Browse the quiz library</Link></p></div><div className="button-row"><Link className="btn btn-outline" href="/create/ai">Create with AI</Link><Link className="btn btn-primary" href="/create"><Plus size={19}/> New quiz</Link></div></div>{error && <div className="notice creator-error" role="alert">{error}<button className="text-button" onClick={() => { setLoading(true); api<Quiz[]>('/quizzes').then(setLibrary).catch(e => reportError(e)).finally(() => setLoading(false)); }}>Retry</button></div>}{notice && <p className="creator-notice" role="status"><CheckCircle2 size={17}/>{notice}</p>}<div className="library-controls"><div className="library-tabs" aria-label="Filter quizzes">{(['all', 'draft', 'published'] as const).map(item => <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === 'all' ? 'All quizzes' : item === 'draft' ? 'Drafts' : 'Published'}<span>{library.filter(quiz => quiz.status !== 'archived' && (item === 'all' || quiz.status === item)).length}</span></button>)}</div><label className="library-search"><Search size={18}/><span className="creator-sr-only">Search your quizzes</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a quiz…"/></label></div>{!visibleQuizzes.length ? <div className="library-empty"><div className="empty-game-stack" aria-hidden="true"><PixelSprite kind="fermi"/><PixelSprite kind="word_puzzle"/><PixelSprite kind="rare_answers"/></div><h2>{library.length ? 'No quizzes found.' : 'Your first quiz starts here.'}</h2><p>{library.length ? 'Try another search or filter.' : 'Choose a game and add your first question.'}</p>{!library.length && <Link className="btn btn-dark" href="/create">Create your first quiz <ArrowRight size={18}/></Link>}</div> : <div className="quiz-library-grid">{visibleQuizzes.map((item, index) => <article className="library-quiz" key={item.id}><Link className="library-quiz-cover" href={`/quiz/${item.id}/edit`} style={{ '--cover-color': quizColor(item.id) } as CSSProperties}><span className="library-quiz-status">{item.status === 'published' ? 'Published' : 'Draft'} <LockKeyhole size={11}/></span><span className="library-cover-title">{item.rounds.length} questions</span><div className="library-cover-modes" aria-label="Game modes">{[...new Set(item.rounds.map(round => round.mode))].map(mode => <span key={mode} title={MODE_META[mode].name}><PixelSprite kind={mode}/></span>)}</div><ArrowUpRight className="library-cover-arrow" size={30}/></Link><div className="library-quiz-info"><div><h3><Link href={`/quiz/${item.id}/edit`}>{item.title.trim()||'Untitled quiz'}</Link></h3><p>{item.rounds.length} rounds · {new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p></div><div className="creator-actions"><button className="creator-icon-btn" title="Duplicate quiz" aria-label={`Duplicate ${item.title}`} disabled={!!busy} onClick={() => createQuiz(item, true)}><Copy size={16}/></button><button className="creator-icon-btn" title="Archive quiz" aria-label={`Archive ${item.title}`} disabled={!!busy} onClick={() => archive(item)}><Trash2 size={16}/></button></div></div><div className="personal-card-actions"><Link className="btn btn-primary" href={`/quiz/${item.id}/edit`}>{validateQuiz(item).some(i=>i.severity==='error')||!item.rounds.length?'Continue editing':'Edit or host'}</Link><Link className="btn btn-outline" href={`/quiz/${item.id}/preview`}>Preview</Link></div></article>)}</div>}</main>;
    if (!quiz)
        return <main className="page creator-page create-entry"><Link href="/library" className="creator-back"><ArrowLeft size={16}/> My Quizzes</Link><div className="create-entry-heading"><h1>Make a <span>quiz.</span><i aria-hidden="true">✳</i></h1><p>Choose a game, add your question, then try it.</p></div>{error && <p className="notice creator-error" role="alert">{error}</p>}<Link className="workshop-ai-entry" href="/create/ai"><span className="ai-entry-art" aria-hidden="true"><PixelSprite kind="word_puzzle"/></span><span><strong>Create with AI</strong><small>Choose a topic. Get a quiz draft to review.</small></span><span className="ai-entry-arrow" aria-hidden="true">→</span></Link><h2 className="manual-entry-title">Or write your own</h2><div className="entry-mode-grid">{MODES.map(mode => <button key={mode} className={"world-"+mode} disabled={!!busy} onClick={() => createQuiz({ ...structuredClone(blank), rounds: [getEmptyRound(mode)] })}><PixelSprite kind={mode}/><strong>{MODE_META[mode].name}</strong><span>{MODE_META[mode].description}</span><b>Choose game →</b></button>)}</div><div className="entry-sample"><span>Want a head start? Try a ready-to-edit quiz with all five games.</span><button className="btn btn-outline" disabled={!!busy} onClick={() => createQuiz(getWorkshopQuiz())}>Use sample quiz <ArrowRight size={17}/></button></div><p className="create-privacy"><LockKeyhole size={15}/> Start private. Share to the library whenever you’re ready.</p>{busy && <p className="creator-notice" role="status"><Loader2 className="creator-spin" size={17}/> Creating your quiz…</p>}</main>;
    if (previewOpen)
        return <main className="page creator-page full-preview-page"><div className="creator-preview-heading"><button className="creator-back" onClick={() => setPreviewOpen(false)}><ArrowLeft size={16}/> Back to editing</button><span className="eyebrow">{draft.title}</span></div><Preview quiz={draft} initialRound={Math.max(0, currentIndex)} onClose={() => setPreviewOpen(false)}/></main>;
    return <main className="creator-editor-page" data-mobile-view={mobileView}>
    <header className="creator-editor-header"><div className="creator-editor-title"><button className="creator-icon-btn" aria-label="Back to library" disabled={!!busy} onClick={() => { void saveDraft().then(() => router.push('/library')).catch(e => reportError(e)); }}><ArrowLeft size={20}/></button><div><div className="creator-title-line"><input className="creator-title-input" aria-label="Quiz title" value={draft.title} maxLength={100} onChange={e => edit(current => ({ ...current, title: e.target.value }))}/><span className="private-tag"><LockKeyhole size={11}/>{isShared?'In library':'Private'}</span></div><button className={`save-status save-${saveState}`} disabled={saveState === 'saved' || saveState === 'saving' || saveState === 'conflict'} onClick={() => void saveDraft().catch(e => reportError(e))}>{saveState === 'saving' ? <Loader2 className="creator-spin" size={12}/> : saveState === 'saved' ? <Check size={12}/> : <span className="status-dot"/>}{savingText[saveState]}<span> · r{quiz.revision}</span></button></div></div><div className="creator-header-actions"><button className="btn btn-outline" disabled={!!busy||!!contentBlockers.length||saveState==='conflict'} onClick={()=>{setError('');setPublishSetup({startRoom:false,share:true});}}>Share to library</button><button className="btn btn-ghost" disabled={!draft.rounds.length} onClick={() => setPreviewOpen(true)}><Eye size={16}/><span>Preview</span></button><button className="btn btn-primary" disabled={!!busy || !!contentBlockers.length || saveState === 'conflict'} title={blockers.length ? `Resolve ${blockers.length} validation issue${blockers.length === 1 ? '' : 's'} first` : 'Publish a fixed version and open the host lobby'} onClick={() => publish(true)}>{busy === 'host' ? <Loader2 size={17} className="creator-spin"/> : <ArrowUpRight size={17}/>}<span>Host game</span></button></div></header>
    {error && <div className="creator-banner creator-error" role="alert"><span>{error}{authNeeded && <Link href="/login" target="_blank" rel="noreferrer" className="text-button">Sign in in a new tab, then retry saving ↗</Link>}</span><button className="creator-icon-btn" onClick={() => setError('')} aria-label="Dismiss error"><X size={17}/></button></div>}
    {saveState === 'conflict' && <div className="creator-conflict" role="alert"><div><strong>Another tab saved a newer version.</strong><p>Your edits are still here. Keep them as a separate quiz, or load the saved version. Loading it replaces your unsaved edits.</p></div><div className="creator-actions"><button className="btn btn-dark" disabled={!!busy} onClick={() => createQuiz(draftRef.current, true)}>Keep my edits as a copy</button><button className="btn btn-ghost" disabled={!!busy} onClick={loadLatest}>Load saved version</button></div></div>}
    {notice && <div className="creator-banner creator-notice" role="status"><span><CheckCircle2 size={15}/> {notice}</span><button className="creator-icon-btn" onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={15}/></button></div>}
    <nav className="creator-mobile-nav" aria-label="Quiz editor views"><button aria-pressed={mobileView === 'rounds'} onClick={() => setMobileView('rounds')}>Rounds ({draft.rounds.length})</button><button aria-pressed={mobileView === 'edit'} onClick={() => setMobileView('edit')}>Edit</button><button disabled={!draft.rounds.length} onClick={() => setPreviewOpen(true)}>Preview</button></nav>

    <div className="creator-workspace" inert={!!busy}>
      <aside className="round-sidebar"><div className="round-sidebar-heading"><span className="eyebrow">YOUR ROUNDS</span><span>{draft.rounds.length}/40</span></div><button className={`quiz-settings-button ${settingsOpen ? 'active' : ''}`} onClick={() => (setSettingsOpen(!settingsOpen), setMobileView('edit'))}><Settings2 size={17}/><span>Quiz settings</span><ChevronDown size={15}/></button><div className="round-list" aria-label="Quiz rounds">{draft.rounds.map((round, index) => { const meta = MODE_META[round.mode]; const invalid = validateAuthorConfig(round).some(issue => issue.severity === 'error'); return <div className={`round-list-item ${currentRound?.id === round.id && !settingsOpen ? 'is-active' : ''} ${dragged === round.id ? 'is-dragging' : ''}`} key={round.id} draggable onDragStart={event => { event.dataTransfer.setData('text/plain', round.id); event.dataTransfer.effectAllowed = 'move'; setDragged(round.id); }} onDragEnd={() => setDragged(null)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); if (draft.rounds.some(item => item.id === id))
        moveRound(id, index); setDragged(null); }}><button className="round-select" onClick={() => { setSelected(round.id); setSettingsOpen(false); setMobileView('edit'); }} aria-current={currentRound?.id === round.id && !settingsOpen ? 'step' : undefined}><span className="round-thumb" style={{ background: meta.color }}><span><PixelSprite kind={round.mode}/></span><small>{String(index + 1).padStart(2, '0')}</small></span><span className="round-description"><strong>{meta.name}</strong><span>{round.question || 'Add your question'}</span>{invalid && <small className="round-needs-attention">Needs attention</small>}</span></button><div className="round-order-controls"><GripVertical size={13} className="round-grip" aria-hidden="true"/><button className="creator-icon-btn" disabled={index === 0} aria-label={`Move round ${index + 1} up`} onClick={() => moveRound(round.id, index - 1)}><ArrowUp size={12}/></button><button className="creator-icon-btn" disabled={index === draft.rounds.length - 1} aria-label={`Move round ${index + 1} down`} onClick={() => moveRound(round.id, index + 1)}><ArrowDown size={12}/></button></div></div>; })}</div><button className="add-round-button" disabled={draft.rounds.length >= 40} onClick={() => { setPickerOpen(true); setSettingsOpen(false); }}><Plus size={18}/> Add round</button>{deleted && <button className="undo-delete" disabled={draft.rounds.length >= 40} onClick={undoDelete}><Undo2 size={14}/> Undo last delete</button>}<div className="run-summary"><Layers3 size={17}/><p><strong>{draft.rounds.length} rounds · about {estimatedMinutes} min</strong><span>Estimate includes reveals and transitions.</span></p></div><div className="sidebar-publish"><button className="text-button" disabled={!!busy || !!contentBlockers.length || saveState === 'conflict'} onClick={() => publish(false)}>{busy === 'publish' ? 'Publishing…' : 'Publish a private version'} <ArrowUpRight size={14}/></button>{published && <span>Version {published.version} is ready.</span>}{!!blockers.length && <span>{blockers.length} {blockers.length === 1 ? 'issue' : 'issues'} to fix before hosting</span>}</div></aside>
      <section className="round-editor-main">
        {settingsOpen ? <div className="round-editor-card settings-editor"><div className="editor-section-title"><h2>Quiz details</h2></div><Field label="Quiz title"><input className="field" value={draft.title} maxLength={100} onChange={event => edit(current => ({ ...current, title: event.target.value }))}/></Field><Field label="A short introduction" help="A little context for your collection. Maximum 500 characters."><textarea className="field" rows={3} value={draft.description} maxLength={500} placeholder="What are we getting everyone together for?" onChange={event => edit(current => ({ ...current, description: event.target.value }))}/></Field><div className="creator-private-note"><LockKeyhole size={18}/><p>Editing a draft never changes a running game or a version already in the library.</p></div><CommunityShare onStatusChange={setIsShared} quizId={quiz.id} revision={quiz.revision} blocked={!!blockers.length} onSave={saveDraft} onShared={async()=>{const latest=await api<Quiz>(`/quizzes/${quiz.id}`);quizRef.current=latest;setQuiz(latest);}}/>{issues.filter(issue => !issue.roundId).map((issue, index) => <p className={issue.severity === 'error' ? 'creator-error' : 'creator-help'} key={index}>{issue.message}</p>)}</div> : currentRound ? <><div className="round-editor-top"><div><span className="eyebrow">ROUND {String(currentIndex + 1).padStart(2, '0')}</span><h2>{MODE_META[currentRound.mode].name}<span style={{ background: MODE_META[currentRound.mode].color }}><PixelSprite kind={currentRound.mode}/></span></h2></div><div className="creator-actions"><button className="creator-icon-btn" disabled={draft.rounds.length >= 40} title="Duplicate round" aria-label="Duplicate current round" onClick={() => duplicateRound(currentRound)}><Copy size={18}/></button><button className="creator-icon-btn" title="Delete round" aria-label="Delete current round" onClick={() => removeRound(currentRound)}><Trash2 size={18}/></button></div></div><div className="round-editor-card"><div className="editor-detail-heading"><span>Question & answer</span><div className="editor-complexity" aria-label="Editor complexity"><button aria-pressed={!advanced} onClick={() => setAdvanced(false)}>Simple</button><button aria-pressed={advanced} onClick={() => setAdvanced(true)}>Advanced</button></div></div><Field help={QUESTION_HELP[currentRound.mode]} label={currentRound.mode === 'word_puzzle' ? 'Your clue' : currentRound.mode === 'rare_answers' ? 'Category or question' : 'Your question'}><textarea className="field question-field" rows={3} maxLength={500} value={currentRound.question} placeholder={QUESTION_HELP[currentRound.mode]} onChange={event => updateRound({ ...currentRound, question: event.target.value })}/></Field><div className="mode-change"><label className="sr-only" htmlFor="change-mode">Game type</label><select id="change-mode" value={changeMode ?? currentRound.mode} onChange={e => setChangeMode(e.target.value as ModeId)}>{MODES.map(m => <option key={m} value={m}>{MODE_META[m].name}</option>)}</select>{changeMode && changeMode !== currentRound.mode && <div><p>Changing game type replaces this round’s answer and settings. Your question stays.</p><button className="btn btn-small" onClick={() => { const replacement = getDefaultRound(changeMode); updateRound({ ...replacement, id: currentRound.id, question: currentRound.question, explanation: '' }); setChangeMode(null); setEditorEpoch(v => v + 1); }}>Change game type</button><button className="text-link" onClick={() => setChangeMode(null)}>Cancel</button></div>}</div><ModeEditor key={`${currentRound.id}:${editorEpoch}`} round={currentRound} advanced={advanced} onChange={updateRound}/>{currentRound.provenance==='needs_review'&&<div className="ai-review-note"><strong>Check this question and its answer.</strong><p>This is an AI draft. Correct any mistakes before confirming.</p><button className="btn btn-outline" onClick={()=>updateRound({...currentRound,provenance:'creator_confirmed'})}>I checked this answer</button></div>}{advanced && <><div className="editor-divider"/><div className="creator-two-col"><NumberField label="Time limit (seconds)" value={currentRound.timerSeconds} min={10} max={300} step={1} onChange={timerSeconds => updateRound({ ...currentRound, timerSeconds })}/><Field label="Answer provenance"><select className="field" value={currentRound.provenance} onChange={event => updateRound({ ...currentRound, provenance: event.target.value as Round['provenance'] })}><option value="creator_confirmed">Confirmed by me</option><option value="verified_factual">Source checked by me</option><option value="host_judged">Host will judge</option><option value="needs_review">Still needs review</option></select></Field></div>{(advanced || currentRound.provenance === 'verified_factual') && <Field label="Source URL" help="Link the evidence you checked. This label records your review; it is not an independent fact check."><input className="field" type="url" maxLength={2048} value={currentRound.sourceUrl ?? ''} placeholder="https://…" onChange={event => updateRound({ ...currentRound, sourceUrl: event.target.value })}/></Field>}<Field label="The reveal" help="Optional explanation shown after answers are locked."><textarea className="field" maxLength={1500} rows={2} value={currentRound.explanation ?? ''} placeholder="The story behind the answer…" onChange={event => updateRound({ ...currentRound, explanation: event.target.value })}/></Field></>}{advanced && currentRound.mode !== 'word_puzzle' && currentRound.mode !== 'amountle' && <div className="creator-checkbox-row"><input id={`revision-${currentRound.id}`} type="checkbox" checked={currentRound.allowRevision} onChange={event => updateRound({ ...currentRound, allowRevision: event.target.checked })}/><label htmlFor={`revision-${currentRound.id}`}>Allow players to revise answers before the deadline</label></div>}{!!roundIssues.length && <div className="creator-validation" role="status">{roundIssues.map((issue, index) => <p className={issue.severity === 'error' ? 'creator-error' : 'creator-warning'} key={`${issue.field}-${index}`}><span>{issue.severity === 'error' ? '!' : '↗'}</span>{issue.message}</p>)}</div>}</div></> : <div className="editor-first-round"><div className="first-round-shapes" aria-hidden="true"><span>↗</span><span>✳</span><span>W</span></div><span className="eyebrow">NEW QUIZ</span><h2>Add your first question.</h2><p>Choose a game to add a question.</p><button className="btn btn-primary" onClick={() => setPickerOpen(true)}><Plus size={18}/> Add your first round</button><button className="text-button" onClick={() => setSettingsOpen(true)}>Name your quiz first <ArrowRight size={16}/></button></div>}
      {currentRound && <div className="creator-next-actions"><button className="btn btn-outline" onClick={() => setPreviewOpen(true)}><Eye size={17}/> Preview round</button><button className="btn btn-primary" disabled={draft.rounds.length >= 40} onClick={() => setPickerOpen(true)}><Plus size={17}/> Add next round</button></div>}
      </section>
      <aside className="editor-preview-aside"><div className="editor-preview-label"><span className="eyebrow">PREVIEW</span><span><span className="simulation-dot"/> Local preview</span></div>{currentRound ? <Preview key={`${currentRound.id}:${editorEpoch}`} quiz={{ ...draft, rounds: [currentRound] }} compact/> : <div className="preview-placeholder"><span>?</span><h3>Round preview</h3><p>A playable preview appears as soon as you add a game.</p></div>}<div className="creator-tip"><span>↗</span><p><strong>Preview before hosting.</strong> Check the question, answer and controls.</p></div></aside>
    </div>
    {publishSetup&&<PublishDialog quiz={draft} startRoom={publishSetup.startRoom} shareInitially={publishSetup.share} busy={!!busy} error={error} onCancel={()=>setPublishSetup(null)} onConfirm={settings=>publish(publishSetup.startRoom,settings)}/> }
    {pickerOpen && <div className="creator-modal-scrim" onClick={event => { if (event.target === event.currentTarget)
        setPickerOpen(false); }}><section className="mode-picker-modal" role="dialog" aria-modal="true" aria-labelledby="mode-picker-title" onKeyDown={event => { if (event.key === 'Escape')
        setPickerOpen(false); if (event.key === 'Tab') {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        }
        else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    } }}><div className="mode-picker-heading"><div><span className="eyebrow">ADD ROUND</span><h2 id="mode-picker-title">Choose a game</h2></div><button autoFocus className="creator-icon-btn" aria-label="Close game picker" onClick={() => setPickerOpen(false)}><X size={22}/></button></div><div className="mode-picker-grid">{MODES.map((mode, index) => <button className="mode-picker-item" key={mode} style={{ '--mode-color': MODE_META[mode].color } as CSSProperties} onClick={() => addRound(mode)}><span className="mode-picker-number">0{index + 1}</span><span className={`mode-picker-art mode-${mode}`}><PixelSprite kind={mode}/></span><strong>{MODE_META[mode].name}</strong><span>{MODE_META[mode].description}</span><small className="mode-example">{MODE_EXAMPLES[mode]}</small><span className="mode-picker-add"><Plus size={16}/> Add round</span></button>)}</div><p>Each round awards up to 1,000 points.</p></section></div>}
  </main>;
}
export default Creator;
