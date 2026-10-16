'use client';
import {useState} from 'react';
export default function Scratchpad(){
 const [notes,setNotes]=useState('');
 return <details className="scratchpad"><summary>Scratchpad <span>optional</span></summary><label htmlFor="estimate-notes">Work it out here</label><textarea id="estimate-notes" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1200} rows={3} placeholder="About 20 each × 50 groups…" /><small>Only on your screen. Not submitted.</small></details>;
}
