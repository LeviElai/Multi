'use client';
import {useEffect,useRef,useState} from 'react';
import type {Round,PublicRound,Submission,Ack} from '../../../../packages/contracts/src/index';
import {PourQueue} from '../../lib/pour-state';
import {Lock} from 'lucide-react';
import {PourControl} from './PourControl';
export default function Amount({ round, disabled, initial, send }: {round:PublicRound;disabled:boolean;busy?:boolean;initial?:number;send:(payload:Submission['payload'])=>Promise<Ack>}) {
    const c = round.publicConfig as Extract<Round, {
        mode: 'amountle';
    }>['publicConfig'];
    const [, render] = useState(0);
    const [locking,setLocking]=useState(false);
    const mounted = useRef(true);
    const sendRef = useRef(send);
    sendRef.current = send;
    const [queue] = useState(() => new PourQueue(initial ?? 0, async (count) => {
        const ack = await sendRef.current({ count, locked: false });
        return ack.acceptedCount ?? count;
    }, () => { if (mounted.current)
        render(v => v + 1); }, initial !== undefined));
    queue.enabled = !disabled;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; queue.enabled = false; }; }, [queue]);
    useEffect(() => { if (initial !== undefined)
        queue.reconcile(initial); }, [initial, queue]);
    useEffect(()=>{if(!disabled)void queue.flush()},[disabled,queue]);
    return <><PourControl count={queue.accepted} onAdd={amount => queue.add(amount ?? 1, c.maxCount)} disabled={disabled || locking || queue.requested >= c.maxCount} seed={round.id} unit={c.unit || 'objects'} flow={Math.max(1, Math.min(10,Math.ceil(c.maxCount / Math.max(100, round.timerSeconds * 10))))}/>
 <button className="btn btn-dark btn-full count-lock" disabled={disabled || locking || queue.pending || queue.failed} onClick={async()=>{setLocking(true);try{await queue.flush();if(!queue.failed&&!queue.pending)await send({count:queue.accepted,locked:true});}catch{}finally{setLocking(false);}}}><Lock size={16}/>{locking ? "Locking…" : "Lock pour"}</button>
 <div className="pour-sync" role="status" aria-live="polite">{queue.pending ? 'Pouring…' : queue.failed ? <>Pour not received. {disabled ? 'Only accepted pours count.' : <button className="text-link" onClick={() => void queue.flush()}>Retry</button>}</> : disabled ? 'Last accepted pour locked.' : 'Pours appear when received.'}</div></>;
}
