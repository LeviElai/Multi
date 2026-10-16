'use client';
import { useRef } from 'react';
import type { PublicRound, Round } from '../../../../packages/contracts/src/index';
import { Shape } from '../ModeArt';
import { playCue } from '../../lib/audio';
export function ScaleStage({ round, ratio, truth, onRatio }: {
    round: PublicRound;
    ratio: number;
    truth?: number;
    onRatio?: (v: number) => void;
}) {
    const c = round.publicConfig as Extract<Round, {
        mode: 'size_it_up';
    }>['publicConfig'];
    const span = (c.calibration.end - c.calibration.start) / c.calibration.intrinsicDimension;
    // Camera is fixed by published bounds, never by the player's current value.
    const unit = Math.min(140, 230 / Math.max(1, c.maxRatio / span));
    const points = useRef(new Map<number, {
        x: number;
        y: number;
    }>());
    const start = useRef({ x: 0, y: 0, ratio, distance: 0 });
    const lastSnap = useRef<number | null>(null);
    const update = (value: number) => { let v = Math.max(c.minRatio, Math.min(c.maxRatio, value)); const snap = Math.round(v * 2) / 2; if (Math.abs(v - snap) < .015) {
        v = Math.max(c.minRatio, Math.min(c.maxRatio, snap));
        if (lastSnap.current !== snap) {
            playCue('adjust');
            lastSnap.current = snap;
        }
    }
    else
        lastSnap.current = null; onRatio?.(Math.round(v * 1000) / 1000); };
    const end = (id: number) => { points.current.delete(id); if (points.current.size === 1) {
        const p = [...points.current.values()][0];
        start.current = { ...p, ratio, distance: 0 };
    } };
    function target(value: number, outline = false) {
        const size = unit * value / span;
        const x = 300 - size / 2, y = 265 - size;
        const begin = c.calibration.start / c.calibration.intrinsicDimension * size, end = c.calibration.end / c.calibration.intrinsicDimension * size;
        return <g className={outline ? 'scale-truth' : 'scale-target'}><g transform={`translate(${x},${y}) scale(${size / 100})`}><Shape asset={c.asset} fill={outline ? 'none' : '#c38b62'} stroke={outline ? '#92d8c2' : undefined}/></g>{c.axis === 'height' ? <path d={`M${x - 12},${y + begin}h-6v${end - begin}h6 M${x - 18},${y + begin}h6`} fill="none" stroke={outline ? '#92d8c2' : '#f0c099'} strokeWidth="2"/> : <path d={`M${x + begin},275v7h${end - begin}v-7`} fill="none" stroke={outline ? '#92d8c2' : '#f0c099'} strokeWidth="2"/>}</g>;
    }
    return <div className={'scale-stage fixed-scale ' + (onRatio ? 'scale-interactive' : '')} onPointerDown={e => { if (!onRatio || e.button !== 0)
        return; points.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); e.currentTarget.setPointerCapture(e.pointerId); const p = [...points.current.values()]; start.current = { x: e.clientX, y: e.clientY, ratio, distance: p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0 }; }} onPointerMove={e => { if (!onRatio || !points.current.has(e.pointerId))
        return; points.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); const p = [...points.current.values()]; if (p.length === 2 && start.current.distance)
        update(start.current.ratio * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / start.current.distance);
    else {
        const rect = e.currentTarget.getBoundingClientRect();
        const pixelsPerUnit = unit / span * rect.width / 420;
        update(start.current.ratio + (c.axis === 'height' ? start.current.y - e.clientY : e.clientX - start.current.x) / Math.max(1, pixelsPerUnit));
    } }} onPointerUp={e => end(e.pointerId)} onPointerCancel={() => points.current.clear()} onLostPointerCapture={e => end(e.pointerId)}>
 <svg viewBox="0 0 420 320" role="img" aria-label={`${c.referenceLabel}: ${c.referenceSize} ${c.unit}. ${c.targetLabel}: ${ratio.toFixed(2)} times reference${truth !== undefined ? `; correct ${truth.toFixed(2)}` : ''}. Fixed ${c.axis} scale.`}><defs><pattern id={'grid-' + round.id} width="21" height="21" patternUnits="userSpaceOnUse"><path d="M21 0H0V21" fill="none" stroke="#b7d7d525"/></pattern></defs><rect width="420" height="290" fill={'url(#grid-' + round.id + ')'}/><line x1="20" x2="400" y1="265" y2="265" stroke="#87aaa5"/>
 <g transform={`translate(${95 - unit / 2},${265 - unit}) scale(${unit / 100})`}><Shape asset={c.referenceAsset ?? "block"} fill="#8db5b2"/></g><path d={`M${85 - unit / 2},${265 - unit}h-6v${unit}h6`} stroke="#badad2" fill="none"/>
 {target(ratio)}{truth !== undefined && target(truth, true)}<text x="95" y="303" textAnchor="middle" fill="#d8e5dc" fontSize="14">{c.referenceLabel.slice(0, 23)}</text><text x="300" y="303" textAnchor="middle" fill="#f2d8bd" fontSize="14">{c.targetLabel.slice(0, 23)}</text></svg>
 <p>{truth !== undefined ? `Your size ${ratio.toFixed(2)}× · correct ${truth.toFixed(2)}× · difference ${Math.abs(ratio - truth).toFixed(2)}×` : onRatio ? `Drag ${c.axis === 'height' ? 'up or down' : 'left or right'} to resize. Pinch with two fingers.` : `Compare the marked ${c.axis}.`}</p></div>;
}
