'use client';
import { useState } from 'react';
import type { Round, ModeId } from '../../../../packages/contracts/src/index';
export const MODE_EXAMPLES: Record<ModeId, string> = { fermi: 'Example: How many tiles in a 12 × 12 mosaic?', rare_answers: 'Example: Pick the least popular palette color.', word_puzzle: 'Example: Find ORBIT from the clue “a looping path”.', size_it_up: 'Example: Make a tower 2.4× the reference height.', amountle: 'Example: Pour 56 objects into the container.' };
function Numeric({ label, value, onChange, min, step = 'any' }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    step?: string;
}) {
    return <label className="creator-field"><span>{label}</span><input className="field" type="number" min={min} step={step} value={Number.isFinite(value) ? value : ''} onChange={e => onChange(e.target.value === '' ? NaN : Number(e.target.value))}/></label>;
}
function RareSimple({ round, onChange }: {
    round: Extract<Round, {
        mode: 'rare_answers';
    }>;
    onChange: (r: Round) => void;
}) {
    const [text, setText] = useState(round.secretConfig.answers.map(a => [a.canonical, ...a.aliases].join(' | ')).join('\n'));
    return <><label className="creator-field"><span>Accepted answers</span><textarea className="field" rows={5} value={text} onChange={e => { setText(e.target.value); onChange({ ...round, secretConfig: { answers: e.target.value.split('\n').filter(x => x.trim()).map(line => { const [canonical, ...aliases] = line.split('|').map(v => v.trim()); return { canonical, aliases: aliases.filter(Boolean) }; }) } }); }}/><small>One answer per line. Optional alternate spellings: New York | NYC.</small></label><label className="creator-field"><span>Unexpected answers</span><select className="field" value={round.publicConfig.adjudication} onChange={e => onChange({ ...round, publicConfig: { ...round.publicConfig, adjudication: e.target.value as 'allowlist' | 'host_review' } })}><option value="allowlist">Only accept answers on my list</option><option value="host_review">Let me review other answers as host</option></select></label></>;
}
export function SimpleModeEditor({ round: r, onChange }: {
    round: Round;
    onChange: (r: Round) => void;
}) {
    if (r.mode === 'rare_answers')
        return <RareSimple round={r} onChange={onChange}/>;
    if (r.mode === 'fermi')
        return <><Numeric label="Correct answer" value={r.secretConfig.answer} onChange={answer => onChange({ ...r, secretConfig: { answer }, publicConfig: { ...r.publicConfig, min: Number.isFinite(answer) ? Math.min(r.publicConfig.min, answer) : r.publicConfig.min, max: Number.isFinite(answer) ? Math.max(r.publicConfig.max, answer * 10, 1) : r.publicConfig.max, errorMode: answer <= 0 ? 'absolute' : r.publicConfig.errorMode, tolerance: Math.max(1, Math.abs(answer) || 1), step: Number.isInteger(answer) ? r.publicConfig.step : 0.001 } })}/><label className="creator-field"><span>Unit (optional)</span><input className="field" value={r.publicConfig.unit} maxLength={30} placeholder="people, km, years…" onChange={e => onChange({ ...r, publicConfig: { ...r.publicConfig, unit: e.target.value } })}/></label></>;
    if (r.mode === 'word_puzzle')
        return <><label className="creator-field"><span>Hidden word</span><input className="field" value={r.secretConfig.answer} autoCapitalize="characters" maxLength={48} onChange={e => { const answer = e.target.value.toUpperCase(); const length = Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(answer.trim())).length; onChange({ ...r, secretConfig: { ...r.secretConfig, answer }, publicConfig: { ...r.publicConfig, length } }); }}/><small>3–12 letters. Players can use the onscreen English keyboard or type in their own language.</small></label><p className="creator-help">{r.publicConfig.maxAttempts} attempts. Change attempts and accepted words in Advanced.</p></>;
    if (r.mode === 'size_it_up')
        return <><div className="creator-two-col"><label className="creator-field"><span>Reference object</span><input className="field" maxLength={60} value={r.publicConfig.referenceLabel} onChange={e => onChange({ ...r, publicConfig: { ...r.publicConfig, referenceLabel: e.target.value } })}/></label><label className="creator-field"><span>Target object</span><input className="field" maxLength={60} value={r.publicConfig.targetLabel} onChange={e => onChange({ ...r, publicConfig: { ...r.publicConfig, targetLabel: e.target.value } })}/></label></div><Numeric label="Correct relative size (× reference)" min={0.01} value={r.secretConfig.targetSize / r.publicConfig.referenceSize} onChange={ratio => onChange({ ...r, secretConfig: { targetSize: ratio * r.publicConfig.referenceSize }, publicConfig: { ...r.publicConfig, minRatio: Number.isFinite(ratio) ? Math.max(.01, Math.min(r.publicConfig.minRatio, ratio / 2)) : r.publicConfig.minRatio, maxRatio: Number.isFinite(ratio) ? Math.max(r.publicConfig.maxRatio, ratio * 2) : r.publicConfig.maxRatio } })}/><label className="creator-field"><span>Reference artwork</span><select className="field" value={r.publicConfig.referenceAsset ?? 'block'} onChange={e => onChange({ ...r, publicConfig: { ...r.publicConfig, referenceAsset: e.target.value as typeof r.publicConfig.asset } })}>{['person', 'tree', 'car', 'bottle', 'tower', 'block', 'circle', 'rocket'].map(asset => <option key={asset} value={asset}>{asset}</option>)}</select></label><label className="creator-field"><span>Target silhouette</span><select className="field" value={r.publicConfig.asset} onChange={e => onChange({ ...r, publicConfig: { ...r.publicConfig, asset: e.target.value as typeof r.publicConfig.asset, calibration: { version: 1, intrinsicDimension: 100, start: 0, end: 100 } } })}>{['block', 'tower', 'bottle', 'circle', 'rocket', 'tree', 'person', 'car'].map(asset => <option key={asset} value={asset}>{asset}</option>)}</select></label><p className="creator-help">1× is the same size; 2× is twice as {r.publicConfig.axis === 'height' ? 'tall' : 'wide'}. Use Advanced for units and measurements.</p></>;
    return <><Numeric label="Target count" min={0} step="1" value={r.secretConfig.answer} onChange={answer => onChange({ ...r, secretConfig: { answer }, publicConfig: { ...r.publicConfig, maxCount: Number.isFinite(answer) ? Math.min(10000, Math.max(r.publicConfig.maxCount, answer * 2, 1)) : r.publicConfig.maxCount } })}/><label className="creator-field"><span>What are we counting?</span><input className="field" maxLength={30} value={r.publicConfig.unit} onChange={e => onChange({ ...r, publicConfig: { ...r.publicConfig, unit: e.target.value } })}/></label><p className="creator-help">Tap adds one object. Hold pours continuously. The deadline locks the last accepted pour.</p></>;
}
