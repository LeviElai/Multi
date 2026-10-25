'use client';
import {useEffect,useRef,useState} from 'react';
import type {Ack,ArcadeRound,PublicRound,Submission} from '../../../../packages/contracts/src/index';
import {playCue} from '../../lib/audio';
import {holdRoundAnimation} from './physical-motion';
export type Props={round:PublicRound;serverTime?:string;clock?:{offsetMs:number;deliveryMs:number};deadlineAt?:string|null;disabled:boolean;busy:boolean;initial?:Submission['payload'];send:(p:Submission['payload'])=>Promise<Ack>};
export type Config=ArcadeRound['publicConfig'];
export function useCommit(p:Props){
 const [effect,setEffect]=useState(p.initial?.locked?(p.initial.choiceId??'locked'):''),sending=useRef(false),restored=useRef(!!p.initial?.locked);
 useEffect(()=>{if(p.initial?.locked&&!effect&&!sending.current){restored.current=true;setEffect(p.initial.choiceId??'locked');}},[p.initial?.locked,p.initial?.choiceId,effect]);
 async function commit(payload:Submission['payload'],name:string){
  if(p.disabled||p.busy||sending.current||effect)return;
  sending.current=true;setEffect(name);holdRoundAnimation(p.round.id,p.round.mode);playCue('pour',p.round.mode);
  try{await p.send({...payload,locked:true});}catch{setEffect('');}finally{sending.current=false;}
 }
 return {effect,commit,restored:restored.current};
}
